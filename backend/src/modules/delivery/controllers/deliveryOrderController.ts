import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler";
import Order from "../../../models/Order";
import { notifySellersOfOrderUpdate } from "../../../services/sellerNotificationService";
import OrderItem from "../../../models/OrderItem";
import Seller from "../../../models/Seller";
import { generateDeliveryOtp, verifyDeliveryOtp } from "../../../services/deliveryOtpService";
import {
    COD_PAYMENT_METHODS,
    TERMINAL_ORDER_STATUSES,
    markOrderDelivered,
} from "../../../services/orderLifecycleService";
import {
    PICKUP_READY_STATUSES,
    getOrderStoreStops,
    riderVisibleOrdersFilter,
    transitionOrderStatus,
    verifyStorePickup,
    riderCanServeOrder,
    StoreStop,
} from "../../../services/orderFlowService";
import { handleOrderAcceptance, handleOrderRejection } from "../../../services/orderNotificationService";
import { OrderPlacementError } from "../../../services/orderPlacementService";
import { restoreOrderItemStock } from "../../../services/orderStockService";
import Refund from "../../../models/Refund";
import Customer from "../../../models/Customer";
import { sendNotification } from "../../../services/notificationService";
import { completeReturnRequest } from "../../../services/returnCompletionService";

// Statuses a delivery partner may set directly; "Delivered" requires the customer's OTP
// ("Ready for pickup" is set by the store once it has packed the order)
const DELIVERY_PARTNER_STATUSES = ['Picked up', 'Out for Delivery'];

/**
 * Where the rider goes next: the next store still to collect from (packed ones first, in the
 * order the stores appear), then the customer once every store is collected.
 */
const nextStopFor = (order: any, stores: StoreStop[]) => {
    const remaining = stores.filter((s) => !s.pickedUp);
    if (remaining.length === 0) {
        return {
            type: 'customer' as const,
            name: order.customerName,
            address: `${order.deliveryAddress?.address || ''}, ${order.deliveryAddress?.city || ''}`,
            latitude: order.deliveryAddress?.latitude ?? null,
            longitude: order.deliveryAddress?.longitude ?? null,
        };
    }
    const next = remaining.find((s) => s.ready) || remaining[0];
    return { type: 'store' as const, ...next };
};
import DeliveryAssignment from "../../../models/DeliveryAssignment";
import Return from "../../../models/Return";

/**
 * Helper to map order items for response
 */
const mapOrderItems = (items: any[]) => {
    if (!items || !Array.isArray(items)) return [];
    return items.map((item: any) => {
        const qty = item.quantity || 1;
        const total = item.total || 0;
        const unitPrice = item.unitPrice > 0 ? item.unitPrice : (total > 0 ? total / qty : 0);
        return {
            name: item.productName || "Unknown Item",
            productName: item.productName || "Unknown Item",
            quantity: qty,
            unitPrice,
            price: unitPrice,
            total: total || unitPrice * qty,
            image: item.productImage,
            isFreeGift: !!item.isFreeGift
        };
    });
};

/**
 * Get All Orders History
 * Returns all past orders with pagination
 */
export const getAllOrdersHistory = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ deliveryBoy: deliveryId })
        .populate("items") // Populate OrderItems
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await Order.countDocuments({ deliveryBoy: deliveryId });

    // Format orders for frontend
    const formattedOrders = orders.map(order => ({
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: order.status,
        address: `${order.deliveryAddress.address}, ${order.deliveryAddress.city}`,
        latitude: order.deliveryAddress?.latitude,
        longitude: order.deliveryAddress?.longitude,
        totalAmount: order.total,
        items: mapOrderItems(order.items),
        createdAt: order.createdAt,
        estimatedDeliveryTime: order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'
    }));

    res.status(200).json({
        success: true,
        data: formattedOrders,
        pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total
        }
    });
});

/**
 * Get Today's Assigned Orders
 */
export const getTodayOrders = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Which orders this rider may see at all: their own (any status — includes today's
    // deliveries), or an unassigned order they were actually dispatched (by live GPS distance
    // to the store, not a fixed registered city — a rider's real location can differ from it,
    // e.g. travelling between Indore and Hyderabad).
    const riderId = new mongoose.Types.ObjectId(String(deliveryId));
    const visibility = {
        $or: [
            { deliveryBoy: riderId },
            {
                $and: [
                    { $or: [{ deliveryBoy: null }, { deliveryBoy: { $exists: false } }] },
                    { status: { $in: PICKUP_READY_STATUSES } },
                    { 'dispatch.rejectedDeliveryBoys': { $ne: riderId } },
                    { $or: [{ 'dispatch.notifiedDeliveryBoys.0': { $exists: false } }, { 'dispatch.notifiedDeliveryBoys': riderId }] },
                ],
            },
        ],
    };

    const orderQuery: any = {
        status: { $ne: "Cancelled" },
        $and: [
            visibility,
            { $or: [{ createdAt: { $gte: todayStart, $lte: todayEnd } }, { updatedAt: { $gte: todayStart, $lte: todayEnd } }] },
        ],
    };

    const orders = await Order.find(orderQuery)
        .populate("items")
        .sort({ updatedAt: -1 });

    const formattedOrders = orders.map(order => ({
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: order.status,
        address: `${order.deliveryAddress?.address || ''}, ${order.deliveryAddress?.city || ''}`,
        latitude: order.deliveryAddress?.latitude,
        longitude: order.deliveryAddress?.longitude,
        items: mapOrderItems(order.items), // Real items
        totalAmount: order.total,
        estimatedDeliveryTime: order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        createdAt: order.createdAt,
        // Distance calculation to be implemented. sending null/undefined for now to avoid fake data
        distance: null
    }));

    return res.status(200).json({
        success: true,
        data: formattedOrders
    });
});

/**
 * Get Pending Orders
 */
export const getPendingOrders = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Unassigned offers this partner hasn't declined: ones they were offered when every store
    // accepted, plus ones they can serve now (they came online later, or are near the stores now).
    // The offer list is fixed at that moment, so without this a rider who wasn't online then never saw it.
    const riderId = new mongoose.Types.ObjectId(String(deliveryId));
    const pendingQuery: any = {
        $and: [
            riderVisibleOrdersFilter(deliveryId, {
                'dispatch.rejectedDeliveryBoys': { $ne: riderId },
            }),
            {
                $or: [
                    { createdAt: { $gte: todayStart, $lte: todayEnd } },
                    { updatedAt: { $gte: todayStart, $lte: todayEnd } }
                ]
            }
        ]
    };

    const candidates = await Order.find(pendingQuery)
        .populate("items")
        .sort({ createdAt: -1 });
    // Unassigned orders: shown if this rider was offered it or can serve its stores now — never to
    // riders in another city
    const orders = [];
    for (const o of candidates) {
        if (o.deliveryBoy) {
            orders.push(o);
            continue;
        }
        const wasOffered = ((o as any).dispatch?.notifiedDeliveryBoys || []).some((id: any) => String(id) === String(deliveryId));
        if (wasOffered || (await riderCanServeOrder(deliveryId, o._id))) orders.push(o);
    }

    const formattedOrders = orders.map(order => ({
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: order.status,
        address: `${order.deliveryAddress?.address || ''}, ${order.deliveryAddress?.city || ''}`,
        latitude: order.deliveryAddress?.latitude,
        longitude: order.deliveryAddress?.longitude,
        items: mapOrderItems(order.items), // Real items
        totalAmount: order.total,
        estimatedDeliveryTime: order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        createdAt: order.createdAt,
        distance: null
    }));

    return res.status(200).json({
        success: true,
        data: formattedOrders
    });
});

/**
 * Get Specific Order Details
 */
export const getOrderDetails = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const order = await Order.findById(id).populate("items");

    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    // A rider may only open their own order, or one they were offered once it's Ready for pickup —
    // not any order by pasting its id (e.g. one the store hasn't even accepted yet).
    const deliveryId = String(req.user?.userId || "");
    const isMine = !!order.deliveryBoy && String(order.deliveryBoy) === deliveryId;
    const notified: string[] = ((order as any).dispatch?.notifiedDeliveryBoys || []).map(String);
    const rejected: string[] = ((order as any).dispatch?.rejectedDeliveryBoys || []).map(String);
    const isOffer =
        !order.deliveryBoy &&
        PICKUP_READY_STATUSES.includes(order.status) &&
        !rejected.includes(deliveryId) &&
        (notified.includes(deliveryId) || (notified.length === 0 && (await riderCanServeOrder(deliveryId, order._id))));
    if (!isMine && !isOffer) {
        return res.status(403).json({
            success: false,
            message: order.deliveryBoy
                ? "This order is assigned to another delivery partner"
                : "This order isn't available to you",
        });
    }

    const formattedOrder = {
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        address: `${order.deliveryAddress?.address || ''}, ${order.deliveryAddress?.city || ''}`,
        // The map needs real coordinates, not just the text address, to draw the route
        latitude: order.deliveryAddress?.latitude,
        longitude: order.deliveryAddress?.longitude,
        status: order.status,
        items: mapOrderItems(order.items), // Real populated items
        totalAmount: order.total,
        createdAt: order.createdAt,
        distance: null
    };
    // Each store on the order with its own progress (packed / collected) and map coordinates,
    // and where to go next. Pickup codes are never sent to the rider: the store gives it.
    const stores = await getOrderStoreStops(order);

    return res.status(200).json({
        success: true,
        data: {
            ...formattedOrder,
            stores,
            storesPickedUp: stores.filter((s) => s.pickedUp).length,
            totalStores: stores.length,
            nextStop: nextStopFor(order, stores),
            deliveryOtpSent: !!order.deliveryOtp && !order.deliveryOtpVerified,
            // Already mine, or still an offer I can accept
            assignedToMe: isMine,
        }
    });
});

/**
 * Update Order Status
 */
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    const deliveryId = req.user?.userId;

    const order = await Order.findById(id);
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.deliveryBoy && order.deliveryBoy.toString() !== deliveryId) {
        return res.status(403).json({ success: false, message: "This order is assigned to another delivery partner" });
    }

    if (status === 'Delivered') {
        return res.status(400).json({
            success: false,
            message: "Delivery must be confirmed with the customer's OTP. Use Send OTP and enter the code the customer gives you."
        });
    }
    if (!DELIVERY_PARTNER_STATUSES.includes(status)) {
        return res.status(400).json({
            success: false,
            message: `Invalid status. Delivery partner can set: ${DELIVERY_PARTNER_STATUSES.join(', ')}`
        });
    }
    if (TERMINAL_ORDER_STATUSES.includes(order.status)) {
        return res.status(400).json({ success: false, message: `Order is already ${order.status}` });
    }
    if (order.status === 'Pending' && !COD_PAYMENT_METHODS.includes(order.paymentMethod) && order.paymentStatus !== 'Paid') {
        return res.status(400).json({ success: false, message: "This order is still waiting for the customer's online payment" });
    }

    const extra: Record<string, unknown> = {};
    if (!order.deliveryBoy && deliveryId) extra.deliveryBoy = new mongoose.Types.ObjectId(deliveryId);
    let from: string[];

    if (status === 'Picked up') {
        // Collecting is per store: the code says which store's part was handed over
        const { pickupCode } = req.body;
        if (!pickupCode) {
            return res.status(400).json({
                success: false,
                message: "Enter the store's pickup code (or scan it from the store's bill) to collect its items.",
            });
        }
        return respondToPickup(req, res, id, deliveryId, pickupCode);
    }
    // Out for Delivery: only once every store's part has been collected
    if (order.status !== 'Picked up' && order.status !== 'Out for Delivery') {
        const stores = await getOrderStoreStops(order);
        const left = stores.filter((s) => !s.pickedUp).map((s) => s.storeName);
        return res.status(400).json({
            success: false,
            message: left.length
                ? `Collect from every store first. Still to collect: ${left.join(', ')}.`
                : "Collect the package from the store (Picked up) first.",
        });
    }
    from = ['Picked up'];
    extra.deliveryBoyStatus = 'In Transit';

    const previousStatus = order.status;
    let updated: any;
    try {
        // Atomic and forward-only: a slower request or stale screen can never move the order back
        ({ order: updated } = await transitionOrderStatus(id, from, status, extra, {
            $or: [{ deliveryBoy: null }, { deliveryBoy: { $exists: false } }, { deliveryBoy: new mongoose.Types.ObjectId(deliveryId) }],
        }));
    } catch (err: any) {
        if (err instanceof OrderPlacementError) {
            return res.status(err.statusCode).json({ success: false, message: err.message });
        }
        throw err;
    }

    // Heading to the customer: send their delivery OTP now (shown in their app, and by SMS when set up)
    let otpSent = false;
    if (status === 'Out for Delivery' && previousStatus !== 'Out for Delivery') {
        try {
            await generateDeliveryOtp(id, updated.customerPhone);
            otpSent = true;
        } catch (err: any) {
            console.error('Could not send delivery OTP:', err.message);
        }
    }

    // Emit socket events for status changes
    const io = (req.app as any).get("io");
    if (io) {
        io.to(`order-${id}`).emit('order-status-updated', { orderId: id, status });
        if (otpSent) {
            const fresh = await Order.findById(id).select('deliveryOtp deliveryOtpExpiresAt');
            io.to(`order-${id}`).emit('delivery-otp-refreshed', { orderId: id, deliveryOtp: fresh?.deliveryOtp, expiresAt: fresh?.deliveryOtpExpiresAt });
        }
        notifySellersOfOrderUpdate(io, updated, 'STATUS_UPDATE');
    }

    return res.status(200).json({
        success: true,
        message: otpSent ? `Order is out for delivery. The customer's delivery OTP has been sent.` : `Order status updated to ${status}`,
        data: updated,
        otpSent,
    });
});

/** Shared by POST /orders/:id/pickup and the older PUT status "Picked up". */
async function respondToPickup(req: Request, res: Response, orderId: string, riderId: string | undefined, pickupCode: unknown) {
    if (!riderId) return res.status(401).json({ success: false, message: "Login required" });
    try {
        const result = await verifyStorePickup(orderId, riderId, pickupCode);
        const io = (req.app as any).get("io");
        if (io && !result.alreadyPickedUp) {
            io.to(`order-${orderId}`).emit('store-picked-up', { orderId, sellerId: result.store.sellerId, storeName: result.store.storeName });
            if (result.orderPickedUp) {
                io.to(`order-${orderId}`).emit('order-taken', { orderId, message: 'Collected from every store' });
                io.to(`order-${orderId}`).emit('order-status-updated', { orderId, status: 'Picked up' });
            }
            notifySellersOfOrderUpdate(io, result.order, 'STATUS_UPDATE');
        }
        const left = result.stores.filter((s) => !s.pickedUp);
        const message = result.alreadyPickedUp
            ? `${result.store.storeName} was already collected.`
            : result.allPickedUp
                ? `Collected from ${result.store.storeName}. All stores collected: head to the customer.`
                : `Collected from ${result.store.storeName}. Next: ${left.map((s) => s.storeName).join(', ')}.`;
        return res.status(200).json({
            success: true,
            message,
            data: {
                orderId,
                status: result.order.status,
                store: result.store,
                stores: result.stores,
                storesPickedUp: result.stores.filter((s) => s.pickedUp).length,
                totalStores: result.stores.length,
                alreadyPickedUp: result.alreadyPickedUp,
                allPickedUp: result.allPickedUp,
                nextStop: nextStopFor(result.order, result.stores),
            },
        });
    } catch (err: any) {
        if (err instanceof OrderPlacementError) return res.status(err.statusCode).json({ success: false, message: err.message });
        throw err;
    }
}

/**
 * The rider is at a store: verify that store's own pickup code and collect only its part.
 * POST /delivery/orders/:id/pickup { pickupCode }
 */
export const verifyStorePickupController = asyncHandler(async (req: Request, res: Response) => {
    return respondToPickup(req, res, req.params.id, req.user?.userId, req.body?.pickupCode);
});

/**
 * Accept an offered order over HTTP (works without a socket connection, e.g. on serverless hosting).
 * POST /delivery/orders/:id/accept
 */
export const acceptOrderController = asyncHandler(async (req: Request, res: Response) => {
    const io = (req.app as any).get("io");
    const result = await handleOrderAcceptance(io || null, req.params.id, String(req.user?.userId || ''));
    if (result.success) return res.status(200).json(result);
    const status = /another delivery|already accepted/i.test(result.message) ? 409 : /not found/i.test(result.message) ? 404 : 400;
    return res.status(status).json(result);
});

/**
 * Decline an offered order over HTTP.
 * POST /delivery/orders/:id/reject
 */
export const rejectOrderController = asyncHandler(async (req: Request, res: Response) => {
    const io = (req.app as any).get("io");
    const result: any = await handleOrderRejection(io || null, req.params.id, String(req.user?.userId || ''));
    return res.status(result?.success === false ? 400 : 200).json(result || { success: true });
});

/**
 * Get Return Orders
 */
export const getReturnOrders = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    const orders = await Order.find({
        deliveryBoy: deliveryId,
        status: { $in: ["Returned", "Cancelled", "Rejected"] }
    })
        .populate("items")
        .sort({ updatedAt: -1 });

    const formattedOrders = orders.map(order => ({
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: order.status,
        address: `${order.deliveryAddress?.address || ''}, ${order.deliveryAddress?.city || ''}`,
        latitude: order.deliveryAddress?.latitude,
        longitude: order.deliveryAddress?.longitude,
        items: mapOrderItems(order.items),
        totalAmount: order.total,
        createdAt: order.createdAt,
        distance: null
    }));

    return res.status(200).json({
        success: true,
        data: formattedOrders
    });
});

/**
 * Get Seller Locations for Order
 * Returns all unique seller shop locations for items in this order
 */
export const getSellerLocationsForOrder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const deliveryId = req.user?.userId;

    // Verify order exists
    const order = await Order.findById(id);
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.deliveryBoy && order.deliveryBoy.toString() !== deliveryId) {
        return res.status(403).json({ success: false, message: "This order is assigned to another delivery partner" });
    }

    // Each store with its own progress, so the map can route to the stores still to collect from
    const stores = await getOrderStoreStops(order);
    const sellerLocations = stores
        .filter((s) => s.latitude !== null && s.longitude !== null)
        .map((s) => ({ ...s, latitude: s.latitude as number, longitude: s.longitude as number }));

    return res.status(200).json({
        success: true,
        data: sellerLocations
    });
});

/**
 * Send Delivery OTP
 * Generates and sends OTP to customer
 */
export const sendDeliveryOtp = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const deliveryId = req.user?.userId;

    const order = await Order.findById(id);
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.deliveryBoy && order.deliveryBoy.toString() !== deliveryId) {
        return res.status(403).json({ success: false, message: "This order is assigned to another delivery partner" });
    }
    if (!order.deliveryBoy && deliveryId) {
        order.deliveryBoy = new mongoose.Types.ObjectId(deliveryId);
        await order.save();
    }

    if (order.status === 'Delivered') {
        return res.status(400).json({ success: false, message: "Order is already delivered" });
    }

    if (order.status !== 'Picked up' && order.status !== 'Out for Delivery') {
        return res.status(400).json({ success: false, message: "Order must be picked up before sending delivery OTP" });
    }

    try {
        const result = await generateDeliveryOtp(id, order.customerPhone);

        // Emit otp-sent event to delivery boy
        const io = (req.app as any).get("io");
        if (io) {
            io.to(`delivery-${deliveryId}`).emit('otp-sent', {
                orderId: id,
                orderNumber: order.orderNumber,
                message: 'Delivery OTP sent to customer',
            });
            // Let the customer's order page show the new OTP straight away
            const fresh = await Order.findById(id).select('deliveryOtp deliveryOtpExpiresAt');
            io.to(`order-${id}`).emit('delivery-otp-refreshed', {
                orderId: id,
                deliveryOtp: fresh?.deliveryOtp,
                expiresAt: fresh?.deliveryOtpExpiresAt,
            });
        }

        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to send delivery OTP"
        });
    }
});

/**
 * Verify Delivery OTP and mark order as delivered
 */
export const verifyDeliveryOtpController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { otp } = req.body;
    const deliveryId = req.user?.userId;

    if (!otp) {
        return res.status(400).json({ success: false, message: "OTP is required" });
    }

    const order = await Order.findById(id);
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.deliveryBoy && order.deliveryBoy.toString() !== deliveryId) {
        return res.status(403).json({ success: false, message: "This order is assigned to another delivery partner" });
    }
    if (!order.deliveryBoy && deliveryId) {
        order.deliveryBoy = new mongoose.Types.ObjectId(deliveryId);
        await order.save();
    }

    try {
        const result = await verifyDeliveryOtp(id, otp);
        // Single settlement path: seller commissions, delivery payout, COD cash
        const updatedOrder: any = await markOrderDelivered(id, deliveryId);
        await Order.updateOne({ _id: id }, { $set: { deliveryOtpVerified: true } });

        const io = (req.app as any).get("io");
        if (io) {
            io.to(`order-${id}`).emit('order-delivered', {
                orderId: id,
                orderNumber: updatedOrder.orderNumber,
                message: 'Order has been delivered successfully',
            });
            io.to(`delivery-${deliveryId}`).emit('order-delivered', {
                orderId: id,
                orderNumber: updatedOrder.orderNumber,
                message: 'Order delivered successfully',
            });
            notifySellersOfOrderUpdate(io, updatedOrder, 'STATUS_UPDATE');
        }

        return res.status(200).json({
            success: true,
            message: result.message,
            data: updatedOrder
        });
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to verify delivery OTP"
        });
    }
});

/**
 * Get Return/Replacement Tasks assigned to delivery boy
 */
export const getReturnTasks = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    const assignments = await DeliveryAssignment.find({
        deliveryBoy: deliveryId,
        assignmentType: { $in: ["Return", "Replacement"] },
        status: { $in: ["Assigned", "Accepted", "Picked Up", "In Transit"] }
    }).populate({
        path: "returnRequest",
        populate: [
            { path: "order", select: "orderNumber items customerName customerPhone deliveryAddress" },
            { path: "orderItem", populate: { path: "product", select: "productName mainImage" } }
        ]
    });

    const formattedTasks = assignments.map(asgn => {
        const rReq = asgn.returnRequest as any;
        if (!rReq) return null;

        return {
            id: asgn._id,
            returnRequestId: rReq._id,
            orderId: rReq.order?._id,
            orderNumber: rReq.order?.orderNumber,
            productName: rReq.orderItem?.productName || "Unknown Product",
            productImage: rReq.orderItem?.product?.mainImage,
            customerName: rReq.order?.customerName,
            customerPhone: rReq.order?.customerPhone,
            address: rReq.order?.deliveryAddress,
            quantity: rReq.quantity,
            reason: rReq.reason,
            requestType: rReq.requestType,
            status: asgn.status,
            createdAt: asgn.assignedAt
        };
    }).filter(t => t !== null);

    return res.status(200).json({
        success: true,
        data: formattedTasks
    });
});

/**
 * Update Return/Replacement Task Status
 */
export const updateReturnTaskStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params; // assignmentId
    const { status } = req.body;
    const deliveryId = req.user?.userId;

    const assignment = await DeliveryAssignment.findOne({ _id: id, deliveryBoy: deliveryId });
    if (!assignment) {
        return res.status(404).json({ success: false, message: "Task assignment not found" });
    }

    const validStatuses = ["Accepted", "Picked Up", "In Transit", "Delivered", "Failed", "Cancelled"];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status" });
    }

    assignment.status = status as any;
    if (status === "Accepted") assignment.acceptedAt = new Date();
    if (status === "Picked Up") assignment.pickedUpAt = new Date();
    if (status === "In Transit") assignment.inTransitAt = new Date();
    if (status === "Delivered") assignment.deliveredAt = new Date();
    if (status === "Failed") assignment.failedAt = new Date();

    await assignment.save();

    // Update the Return request status, and complete it: restore stock for the item that
    // physically came back, and — for a Return (not a Replacement) — refund the customer.
    // This used to just flip a status flag; nothing ever credited the customer or put the
    // item back into sellable stock.
    let refundIssued: number | null = null;
    if (assignment.returnRequest) {
        const rReq = await Return.findById(assignment.returnRequest);
        if (rReq) {
            if (status === "Picked Up") {
                rReq.status = "Picked Up";
                rReq.pickupCompleted = new Date();
                await rReq.save();
            } else if (status === "Delivered") {
                // Stock and money are settled in one place, shared with the seller and admin screens
                const outcome = await completeReturnRequest(rReq);
                refundIssued = outcome.refundIssued;
            }
        }
    }

    return res.status(200).json({
        success: true,
        message: `Task status updated to ${status}`,
        data: { ...assignment.toObject(), refundIssued },
    });
});
