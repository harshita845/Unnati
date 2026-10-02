import { Server as SocketIOServer } from 'socket.io';
import { cancelOrderAndRestoreStock } from "./orderLifecycleService";
import Delivery from '../models/Delivery';
import Order from '../models/Order';
import Seller from '../models/Seller';
import DeliveryTracking from '../models/DeliveryTracking';
import mongoose from 'mongoose';
import { notifySellersOfOrderUpdate } from './sellerNotificationService';

// Dispatch state (who was offered an order, who declined) is stored on Order.dispatch
const TERMINAL_STATUSES = ['Delivered', 'Cancelled', 'Rejected', 'Returned'];

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Find all available delivery boys (online and active)
 */
export async function findAvailableDeliveryBoys(): Promise<mongoose.Types.ObjectId[]> {
    try {
        const deliveryBoys = await Delivery.find({
            isOnline: true,
            status: 'Active',
        }).select('_id');

        return deliveryBoys.map(db => db._id);
    } catch (error) {
        console.error('Error finding available delivery boys:', error);
        return [];
    }
}

/**
 * Find delivery boys near a specific location within a radius
 * Uses the delivery boy's location from the Delivery model (preferred)
 * or falls back to DeliveryTracking
 */
export async function findDeliveryBoysNearLocation(
    latitude: number,
    longitude: number,
    radiusKm: number = 10
): Promise<{ deliveryBoyId: mongoose.Types.ObjectId; distance: number }[]> {
    try {
        // 1. Try to find delivery boys using the new GeoJSON location field in Delivery model
        const nearbyDeliveryBoys: { deliveryBoyId: mongoose.Types.ObjectId; distance: number }[] = [];

        let deliveryBoysWithLocation: any[];
        try {
            deliveryBoysWithLocation = await Delivery.find({
                isOnline: true,
                status: 'Active',
                location: {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: [longitude, latitude]
                        },
                        $maxDistance: radiusKm * 1000 // Convert km to meters
                    }
                }
            }).select('_id location');
        } catch (geoError: any) {
            // $near needs a 2dsphere index on `location` (the schema only indexes location.coordinates).
            // Without it, compute distances here instead of finding nobody.
            console.warn(`⚠️ Geo query unavailable (${geoError?.message}); computing delivery distances in app`);
            const candidates = await Delivery.find({
                isOnline: true,
                status: 'Active',
                'location.coordinates.1': { $exists: true },
            }).select('_id location');
            deliveryBoysWithLocation = candidates.filter((d: any) => {
                const [dLng, dLat] = d.location.coordinates;
                return calculateDistance(latitude, longitude, dLat, dLng) <= radiusKm;
            });
        }

        if (deliveryBoysWithLocation.length > 0) {
            for (const db of deliveryBoysWithLocation) {
                if (db.location && db.location.coordinates) {
                    const [dbLng, dbLat] = db.location.coordinates;
                    const distance = calculateDistance(latitude, longitude, dbLat, dbLng);
                    nearbyDeliveryBoys.push({
                        deliveryBoyId: db._id as mongoose.Types.ObjectId,
                        distance
                    });
                }
            }

            console.log(`📍 Found ${nearbyDeliveryBoys.length} delivery boys using live location within ${radiusKm}km of seller`);
            return nearbyDeliveryBoys.sort((a, b) => a.distance - b.distance);
        }

        console.log(`⚠️ No delivery boys found within ${radiusKm}km using live location. Checking fallback...`);

        // 2. Fallback to the old method using DeliveryTracking if no delivery boys found with the new field
        // Get all active and online delivery boys
        const allDeliveryBoys = await Delivery.find({
            isOnline: true,
            status: 'Active',
        }).select('_id');

        if (allDeliveryBoys.length === 0) {
            return [];
        }

        // Get latest locations for these delivery boys from DeliveryTracking
        const deliveryBoyIds = allDeliveryBoys.map(db => db._id);

        // Get the most recent tracking record for each delivery boy
        const trackingRecords = await DeliveryTracking.aggregate([
            {
                $match: {
                    deliveryBoy: { $in: deliveryBoyIds },
                    // Check both legacy fields and new currentLocation structure
                    $or: [
                        { 'currentLocation.latitude': { $exists: true }, 'currentLocation.longitude': { $exists: true } },
                        { latitude: { $exists: true }, longitude: { $exists: true } }
                    ]
                }
            },
            {
                $sort: { 'currentLocation.timestamp': -1, updatedAt: -1 }
            },
            {
                $group: {
                    _id: '$deliveryBoy',
                    latestLocation: { $first: '$currentLocation' },
                    legacyLat: { $first: '$latitude' },
                    legacyLng: { $first: '$longitude' }
                }
            }
        ]);

        for (const record of trackingRecords) {
            const deliveryLat = record.latestLocation?.latitude || record.legacyLat;
            const deliveryLng = record.latestLocation?.longitude || record.legacyLng;

            if (deliveryLat && deliveryLng) {
                const distance = calculateDistance(latitude, longitude, deliveryLat, deliveryLng);

                if (distance <= radiusKm) {
                    nearbyDeliveryBoys.push({
                        deliveryBoyId: record._id,
                        distance,
                    });
                }
            }
        }

        // Also include delivery boys who don't have tracking data yet (they might be new)
        // but give them a default distance
        const trackedIds = new Set(trackingRecords.map(r => r._id.toString()));
        for (const db of allDeliveryBoys) {
            if (!trackedIds.has(db._id.toString())) {
                // Include untracked delivery boys with a default distance
                nearbyDeliveryBoys.push({
                    deliveryBoyId: db._id as mongoose.Types.ObjectId,
                    distance: radiusKm / 2, // Default to half the radius
                });
            }
        }

        // Sort by distance (nearest first)
        nearbyDeliveryBoys.sort((a, b) => a.distance - b.distance);

        console.log(`📍 Found ${nearbyDeliveryBoys.length} delivery boys (fallback) within ${radiusKm}km`);
        return nearbyDeliveryBoys;
    } catch (error) {
        console.error('Error finding nearby delivery boys:', error);
        return [];
    }
}

/**
 * Find delivery boys near seller locations for an order
 * Aggregates all unique sellers from order items and finds delivery boys within their service radius
 */
export async function findDeliveryBoysNearSellerLocations(
    order: any
): Promise<mongoose.Types.ObjectId[]> {
    try {
        // Get unique seller IDs from order items
        const sellerIds = [...new Set(
            order.items
                ?.map((item: any) => item.seller?.toString())
                .filter((id: string) => id) || []
        )];

        if (sellerIds.length === 0) {
            console.log('No sellers found in order, falling back to all available delivery boys');
            return findAvailableDeliveryBoys();
        }

        // Get seller locations
        const sellers = await Seller.find({
            _id: { $in: sellerIds },
        }).select('latitude longitude location serviceRadiusKm storeName');

        if (sellers.length === 0) {
            console.log('No seller data found, falling back to all available delivery boys');
            return findAvailableDeliveryBoys();
        }

        // Find delivery boys near each seller location
        const nearbyDeliveryBoyMap = new Map<string, { distance: number }>();

        for (const seller of sellers) {
            let lat: number | null = null;
            let lng: number | null = null;

            // Prioritize GeoJSON location field
            if (seller.location && seller.location.coordinates) {
                lng = seller.location.coordinates[0];
                lat = seller.location.coordinates[1];
            } else {
                // Fallback to legacy fields
                lat = seller.latitude ? parseFloat(seller.latitude) : null;
                lng = seller.longitude ? parseFloat(seller.longitude) : null;
            }

            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                console.log(`Seller ${seller.storeName} has no valid location, skipping`);
                continue;
            }

            const radius = seller.serviceRadiusKm || 10; // Default 10km
            const nearbyBoys = await findDeliveryBoysNearLocation(lat, lng, radius);

            for (const boy of nearbyBoys) {
                const boyId = boy.deliveryBoyId.toString();
                // Keep the smallest distance if same delivery boy is near multiple sellers
                if (!nearbyDeliveryBoyMap.has(boyId) || nearbyDeliveryBoyMap.get(boyId)!.distance > boy.distance) {
                    nearbyDeliveryBoyMap.set(boyId, { distance: boy.distance });
                }
            }
        }

        if (nearbyDeliveryBoyMap.size === 0) {
            console.log('No delivery boys found near seller locations, falling back to all available');
            return findAvailableDeliveryBoys();
        }

        // Sort by distance and return IDs
        const sortedBoys = Array.from(nearbyDeliveryBoyMap.entries())
            .sort((a, b) => a[1].distance - b[1].distance)
            .map(([id]) => new mongoose.Types.ObjectId(id));

        console.log(`📍 Found ${sortedBoys.length} delivery boys near seller locations`);
        return sortedBoys;
    } catch (error) {
        console.error('Error finding delivery boys near seller locations:', error);
        return findAvailableDeliveryBoys();
    }
}

/**
 * Emit new order notification to delivery boys near seller locations
 * Prioritizes delivery boys within the seller's service radius
 */
export async function notifyDeliveryBoysOfNewOrder(
    io: SocketIOServer,
    order: any
): Promise<void> {
    try {
        // Find delivery boys near seller locations (within service radius)
        let nearbyDeliveryBoyIds = await findDeliveryBoysNearSellerLocations(order);

        if (nearbyDeliveryBoyIds.length === 0) {
            console.log('No available delivery boys to notify (including fallback)');
            return;
        }

        // --- FILTER BUSY DELIVERY BOYS ---
        // Check if any of these delivery boys already have an active order
        // Active = deliveryBoyStatus is Assigned, Picked Up, or In Transit
        const busyDeliveryBoys = await Order.find({
            deliveryBoy: { $in: nearbyDeliveryBoyIds },
            deliveryBoyStatus: { $in: ['Assigned', 'Picked Up', 'In Transit'] },
            // Double check status to be sure we don't count completed/cancelled ones just in case statuses are out of sync
            status: { $nin: ['Delivered', 'Cancelled', 'Rejected', 'Returned'] }
        }).distinct('deliveryBoy');

        if (busyDeliveryBoys.length > 0) {
            const busyIdsSet = new Set(busyDeliveryBoys.map(id => id.toString()));

            const originalCount = nearbyDeliveryBoyIds.length;
            nearbyDeliveryBoyIds = nearbyDeliveryBoyIds.filter(id => !busyIdsSet.has(id.toString()));

            console.log(`ℹ️ Filtered out ${originalCount - nearbyDeliveryBoyIds.length} busy delivery boys. Active: ${nearbyDeliveryBoyIds.length}`);

            if (nearbyDeliveryBoyIds.length === 0) {
                console.log('⚠️ All nearby delivery boys are currently busy with other orders.');
                // Optionally: could emit to admin or retry later
                return;
            }
        }
        // ---------------------------------

        // Prepare order data for notification
        const orderData = {
            orderId: order._id.toString(),
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            deliveryAddress: {
                address: order.deliveryAddress.address,
                city: order.deliveryAddress.city,
                state: order.deliveryAddress.state,
                pincode: order.deliveryAddress.pincode,
            },
            total: order.total,
            subtotal: order.subtotal,
            shipping: order.shipping,
            createdAt: order.createdAt,
        };

        // Initialize notification state
        const orderId = order._id.toString();
        const notifiedIds = new Set<string>();

        // Only add delivery boys who are actually connected to the notification room
        for (const id of nearbyDeliveryBoyIds) {
            const idString = id.toString().trim();
            const roomName = `delivery-${idString}`;
            const room = io.sockets.adapter.rooms.get(roomName);

            if (room && room.size > 0) {
                notifiedIds.add(idString);
                io.to(roomName).emit('new-order', orderData);
                console.log(`📤 Emitted new-order to connected delivery boy room: ${roomName}`);
            } else {
                console.log(`⏩ Skipping disconnected delivery boy: ${idString}`);
            }
        }

        if (notifiedIds.size === 0) {
            console.log('⚠️ No connected delivery boys found to notify');
            // We might still want to emit to the general room as a fallback
            io.to('delivery-notifications').emit('new-order', orderData);
            // But we can't track rejection state accurately if we don't know who is connected
            return;
        }

        await Order.updateOne(
            { _id: order._id },
            {
                $set: {
                    dispatch: {
                        notifiedDeliveryBoys: Array.from(notifiedIds).map((id) => new mongoose.Types.ObjectId(id)),
                        rejectedDeliveryBoys: [],
                        notifiedAt: new Date(),
                    },
                },
            }
        );

        // Also emit to general room for any others who might have joined
        io.to('delivery-notifications').emit('new-order', orderData);

        console.log(`📢 Notified ${notifiedIds.size} connected delivery boys near seller locations about order ${order.orderNumber}`);
    } catch (error) {
        console.error('Error notifying delivery boys:', error);
    }
}

/**
 * Handle order acceptance by a delivery boy.
 * A single atomic update assigns the order, so two partners accepting at the
 * same moment cannot both get it, and the result survives server restarts.
 */
export async function handleOrderAcceptance(
    io: SocketIOServer,
    orderId: string,
    deliveryBoyId: string
): Promise<{ success: boolean; message: string }> {
    try {
        const normalizedDeliveryBoyId = String(deliveryBoyId).trim();
        if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(normalizedDeliveryBoyId)) {
            return { success: false, message: 'Invalid order or delivery partner' };
        }
        const riderId = new mongoose.Types.ObjectId(normalizedDeliveryBoyId);

        const order: any = await Order.findOneAndUpdate(
            {
                _id: orderId,
                deliveryBoy: null,
                status: { $nin: TERMINAL_STATUSES },
                'dispatch.rejectedDeliveryBoys': { $ne: riderId },
                // Only partners who were offered the order (if the offer list was recorded)
                $or: [
                    { 'dispatch.notifiedDeliveryBoys.0': { $exists: false } },
                    { 'dispatch.notifiedDeliveryBoys': riderId },
                ],
            },
            { $set: { deliveryBoy: riderId, deliveryBoyStatus: 'Assigned', assignedAt: new Date() } },
            { new: true }
        );

        if (!order) {
            const existing: any = await Order.findById(orderId).select('deliveryBoy status dispatch');
            if (!existing) return { success: false, message: 'Order not found' };
            if (existing.deliveryBoy) {
                return String(existing.deliveryBoy) === normalizedDeliveryBoyId
                    ? { success: true, message: 'Order already assigned to you' }
                    : { success: false, message: 'Order already accepted by another delivery boy' };
            }
            if (TERMINAL_STATUSES.includes(existing.status)) {
                return { success: false, message: `Order is already ${existing.status}` };
            }
            if (existing.dispatch?.rejectedDeliveryBoys?.some((id: any) => String(id) === normalizedDeliveryBoyId)) {
                return { success: false, message: 'You have already rejected this order' };
            }
            return { success: false, message: 'You were not notified about this order' };
        }

        // Mark as processed when assigned (without moving a seller-advanced order backwards)
        await Order.updateOne({ _id: order._id, status: { $in: ['Received', 'Pending'] } }, { $set: { status: 'Processed' } });

        // Emit order-accepted event to stop notifications for all delivery boys
        io.to('delivery-notifications').emit('order-accepted', {
            orderId,
            acceptedBy: normalizedDeliveryBoyId,
        });
        const notifiedIds: any[] = order.dispatch?.notifiedDeliveryBoys?.length
            ? order.dispatch.notifiedDeliveryBoys
            : [riderId];
        for (const notifiedId of notifiedIds) {
            io.to(`delivery-${String(notifiedId)}`).emit('order-accepted', {
                orderId,
                acceptedBy: normalizedDeliveryBoyId,
            });
        }

        // Emit delivery-boy-accepted event to customer for tracking
        io.to(`order-${orderId}`).emit('delivery-boy-accepted', {
            orderId,
            deliveryBoyId: normalizedDeliveryBoyId,
            message: 'Delivery boy accepted your order. Tracking started.',
        });

        console.log(`✅ Order ${orderId} accepted by delivery boy ${normalizedDeliveryBoyId}`);
        return { success: true, message: 'Order accepted successfully' };
    } catch (error) {
        console.error('Error handling order acceptance:', error);
        return { success: false, message: 'Error accepting order' };
    }
}

/**
 * Handle order rejection by a delivery boy.
 * When every partner that was offered the order has declined, the order is
 * rejected and its stock released.
 */
export async function handleOrderRejection(
    io: SocketIOServer,
    orderId: string,
    deliveryBoyId: string
): Promise<{ success: boolean; message: string; allRejected: boolean }> {
    try {
        const normalizedDeliveryBoyId = String(deliveryBoyId).trim();
        if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(normalizedDeliveryBoyId)) {
            return { success: false, message: 'Invalid order or delivery partner', allRejected: false };
        }
        const riderId = new mongoose.Types.ObjectId(normalizedDeliveryBoyId);

        const order: any = await Order.findOneAndUpdate(
            {
                _id: orderId,
                deliveryBoy: null,
                status: { $nin: TERMINAL_STATUSES },
                'dispatch.notifiedDeliveryBoys': riderId,
            },
            { $addToSet: { 'dispatch.rejectedDeliveryBoys': riderId } },
            { new: true }
        );

        if (!order) {
            const existing: any = await Order.findById(orderId).select('deliveryBoy status dispatch');
            if (!existing || !existing.dispatch?.notifiedDeliveryBoys?.length) {
                return { success: false, message: 'Order notification not found', allRejected: false };
            }
            if (existing.deliveryBoy) return { success: false, message: 'Order already accepted', allRejected: false };
            if (TERMINAL_STATUSES.includes(existing.status)) {
                return { success: false, message: `Order is already ${existing.status}`, allRejected: false };
            }
            console.warn(`⚠️ Delivery boy ${normalizedDeliveryBoyId} not in notified list for order ${orderId}`);
            return { success: false, message: 'You were not notified about this order', allRejected: false };
        }

        const rejected = new Set((order.dispatch.rejectedDeliveryBoys || []).map((id: any) => String(id)));
        const allRejected = order.dispatch.notifiedDeliveryBoys.every((id: any) => rejected.has(String(id)));

        if (allRejected) {
            // Emit order-rejected-by-all event
            io.to('delivery-notifications').emit('order-rejected-by-all', {
                orderId,
            });

            // Reject the order and put its reserved stock back (runs once even if rejections race)
            const rejectedOrder: any = await cancelOrderAndRestoreStock(orderId, {
                finalStatus: 'Rejected',
                reason: `All notified delivery boys (${order.dispatch.notifiedDeliveryBoys.length}) rejected the order.`,
            }).catch((err) => {
                console.error(`❌ Could not reject order ${orderId}:`, err.message);
                return null;
            });
            if (rejectedOrder) {
                await Order.updateOne({ _id: orderId }, { $set: { deliveryBoyStatus: 'Failed' } });

                // Notify customer via socket
                io.to(`order-${orderId}`).emit('order-rejected', {
                    orderId,
                    message: 'Unfortunately, no delivery partner is available at the moment. Your order has been rejected.',
                });

                // Notify sellers/restaurants
                notifySellersOfOrderUpdate(io, rejectedOrder, 'STATUS_UPDATE');

                console.log(`✅ All delivery boys rejected order ${orderId}. Order status updated to Rejected.`);
            }
        } else {
            // Emit rejection acknowledgment to the specific delivery boy
            io.to(`delivery-${normalizedDeliveryBoyId}`).emit('order-rejection-acknowledged', {
                orderId,
            });
        }

        console.log(`🚫 Delivery boy ${normalizedDeliveryBoyId} rejected order ${orderId}`);
        return { success: true, message: 'Order rejected', allRejected };
    } catch (error) {
        console.error('Error handling order rejection:', error);
        return { success: false, message: 'Error rejecting order', allRejected: false };
    }
}
