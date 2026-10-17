import { Server as SocketIOServer } from 'socket.io';
import { cancelOrderAndRestoreStock } from "./orderLifecycleService";
import Delivery from '../models/Delivery';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import Seller from '../models/Seller';
import DeliveryTracking from '../models/DeliveryTracking';
import { PICKUP_READY_STATUSES, riderCanServeOrder } from "./orderFlowService";
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
    radiusKm: number = 10,
    /** Riders with no known position are only included if they're in this city */
    city?: string
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

            // Riders in the store's city whose position isn't known yet can take it too
            if (city) {
                const cityRx = new RegExp(`^\\s*${city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
                const noGps = await Delivery.find({
                    isOnline: true,
                    status: 'Active',
                    city: cityRx,
                    $or: [{ 'location.coordinates.1': { $exists: false } }, { location: null }],
                }).select('_id');
                for (const db of noGps) nearbyDeliveryBoys.push({ deliveryBoyId: db._id as mongoose.Types.ObjectId, distance: radiusKm / 2 });
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

        // Riders with no known position yet: only those registered in the store's own city
        // (never every rider everywhere — a Hyderabad order must not reach Indore riders)
        const trackedIds = new Set(trackingRecords.map(r => r._id.toString()));
        const cityRx = city ? new RegExp(`^\\s*${city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') : null;
        if (cityRx) {
            const untracked = await Delivery.find({
                _id: { $in: allDeliveryBoys.map((d) => d._id).filter((id) => !trackedIds.has(String(id))) },
                city: cityRx,
                $or: [{ 'location.coordinates.1': { $exists: false } }, { location: null }],
            }).select('_id');
            for (const db of untracked) {
                nearbyDeliveryBoys.push({ deliveryBoyId: db._id as mongoose.Types.ObjectId, distance: radiusKm / 2 });
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
        // The order's stores, read from its items (the order passed in usually has item ids only)
        const sellerIds = (await OrderItem.distinct('seller', { order: order._id, status: { $nin: ['Cancelled', 'Returned'] } }))
            .filter(Boolean)
            .map(String);
        if (sellerIds.length === 0) {
            console.log('No stores found on order; nobody offered');
            return [];
        }

        const sellers = await Seller.find({ _id: { $in: sellerIds } }).select('latitude longitude location serviceRadiusKm storeName city');
        const nearbyDeliveryBoyMap = new Map<string, { distance: number }>();

        for (const seller of sellers) {
            const point = storePoint(seller);
            if (!point) {
                console.log(`Seller ${seller.storeName} has no valid location, skipping`);
                continue;
            }
            const radius = seller.serviceRadiusKm || 10; // Default 10km
            const nearbyBoys = await findDeliveryBoysNearLocation(point.lat, point.lng, radius, seller.city);
            for (const boy of nearbyBoys) {
                const boyId = boy.deliveryBoyId.toString();
                if (!nearbyDeliveryBoyMap.has(boyId) || nearbyDeliveryBoyMap.get(boyId)!.distance > boy.distance) {
                    nearbyDeliveryBoyMap.set(boyId, { distance: boy.distance });
                }
            }
        }

        // Nobody near the stores: offer it to nobody rather than to riders in other cities. The
        // order then shows only to riders near its stores (see riderCanServeOrder).
        const sortedBoys = Array.from(nearbyDeliveryBoyMap.entries())
            .sort((a, b) => a[1].distance - b[1].distance)
            .map(([id]) => new mongoose.Types.ObjectId(id));
        console.log(`📍 Found ${sortedBoys.length} delivery boys near seller locations`);
        return sortedBoys;
    } catch (error) {
        console.error('Error finding delivery boys near seller locations:', error);
        return [];
    }
}

const storePoint = (seller: any): { lat: number; lng: number } | null => {
    const c = seller?.location?.coordinates;
    if (Array.isArray(c) && c.length === 2 && (c[0] !== 0 || c[1] !== 0)) return { lat: Number(c[1]), lng: Number(c[0]) };
    const lat = parseFloat(seller?.latitude || '');
    const lng = parseFloat(seller?.longitude || '');
    return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
};

/**
 * Emit new order notification to delivery boys near seller locations
 * Prioritizes delivery boys within the seller's service radius
 */
export async function notifyDeliveryBoysOfNewOrder(
    io: SocketIOServer | null | undefined,
    order: any
): Promise<void> {
    try {
        // Delivery partners near the order's store(s) (within each store's service radius)
        let nearbyDeliveryBoyIds = await findDeliveryBoysNearSellerLocations(order);

        if (nearbyDeliveryBoyIds.length === 0) {
            console.log('No available delivery boys to notify (including fallback)');
            return;
        }

        // Partners already busy with another active order don't get a live alert, but can still
        // see and take the offer once they're free (so an order is never stranded with one rider)
        const busyDeliveryBoys = await Order.find({
            deliveryBoy: { $in: nearbyDeliveryBoyIds },
            deliveryBoyStatus: { $in: ['Assigned', 'Picked Up', 'In Transit'] },
            status: { $nin: ['Delivered', 'Cancelled', 'Rejected', 'Returned'] }
        }).distinct('deliveryBoy');
        const busyIdsSet = new Set(busyDeliveryBoys.map((id: any) => id.toString()));

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

        // Record who was offered the order. This is what limits the offer to partners near the
        // store(s) — it also works without a live socket (e.g. on serverless hosting), where
        // partners see the offer in their Pending list instead of a push.
        const offeredIds = nearbyDeliveryBoyIds.map((id) => new mongoose.Types.ObjectId(String(id)));
        await Order.updateOne(
            { _id: order._id, deliveryBoy: null },
            { $set: { dispatch: { notifiedDeliveryBoys: offeredIds, rejectedDeliveryBoys: [], notifiedAt: new Date() } } }
        );

        // Live push to the free partners connected right now
        if (io) {
            for (const id of offeredIds) {
                if (!busyIdsSet.has(String(id))) io.to(`delivery-${String(id)}`).emit('new-order', orderData);
            }
        }
        console.log(`📢 Offered order ${order.orderNumber} to ${offeredIds.length} delivery partner(s) near its store(s)`);
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
    io: SocketIOServer | null | undefined,
    orderId: string,
    deliveryBoyId: string
): Promise<{ success: boolean; message: string }> {
    try {
        const normalizedDeliveryBoyId = String(deliveryBoyId).trim();
        if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(normalizedDeliveryBoyId)) {
            return { success: false, message: 'Invalid order or delivery partner' };
        }
        const riderId = new mongoose.Types.ObjectId(normalizedDeliveryBoyId);

        // Riders offered the order when every store accepted can take it, and so can any rider who
        // can serve its stores now (came online later, or moved into range) — never one in another city
        const offer: any = await Order.findById(orderId).select('deliveryBoy dispatch').lean();
        const wasOffered = (offer?.dispatch?.notifiedDeliveryBoys || []).some((id: any) => String(id) === normalizedDeliveryBoyId);
        if (offer && !offer.deliveryBoy && !wasOffered && !(await riderCanServeOrder(riderId, orderId))) {
            return { success: false, message: 'This order is too far from you' };
        }

        const order: any = await Order.findOneAndUpdate(
            {
                _id: orderId,
                deliveryBoy: null,
                // Riders can take an order once every store has accepted it
                status: { $in: PICKUP_READY_STATUSES },
                'dispatch.rejectedDeliveryBoys': { $ne: riderId },
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
            if (existing.status === 'Received' || existing.status === 'Pending') {
                return { success: false, message: 'The store has not accepted this order yet' };
            }
            if (existing.dispatch?.rejectedDeliveryBoys?.some((id: any) => String(id) === normalizedDeliveryBoyId)) {
                return { success: false, message: 'You have already rejected this order' };
            }
            return { success: false, message: 'You were not notified about this order' };
        }

        // Assignment does not change the order status: the store accepted it already
        // Emit order-accepted event to stop notifications for all delivery boys
        io?.to('delivery-notifications').emit('order-accepted', {
            orderId,
            acceptedBy: normalizedDeliveryBoyId,
        });
        const notifiedIds: any[] = order.dispatch?.notifiedDeliveryBoys?.length
            ? order.dispatch.notifiedDeliveryBoys
            : [riderId];
        for (const notifiedId of notifiedIds) {
            io?.to(`delivery-${String(notifiedId)}`).emit('order-accepted', {
                orderId,
                acceptedBy: normalizedDeliveryBoyId,
            });
        }

        // Emit delivery-boy-accepted event to customer for tracking
        io?.to(`order-${orderId}`).emit('delivery-boy-accepted', {
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
    io: SocketIOServer | null | undefined,
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
            io?.to('delivery-notifications').emit('order-rejected-by-all', {
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
                io?.to(`order-${orderId}`).emit('order-rejected', {
                    orderId,
                    message: 'Unfortunately, no delivery partner is available at the moment. Your order has been rejected.',
                });

                // Notify sellers/restaurants
                if (io) notifySellersOfOrderUpdate(io, rejectedOrder, 'STATUS_UPDATE');

                console.log(`✅ All delivery boys rejected order ${orderId}. Order status updated to Rejected.`);
            }
        } else {
            // Emit rejection acknowledgment to the specific delivery boy
            io?.to(`delivery-${normalizedDeliveryBoyId}`).emit('order-rejection-acknowledged', {
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
