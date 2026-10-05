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
import { PICKUP_READY_STATUSES, riderVisibleOrdersFilter, transitionOrderStatus } from "../../../services/orderFlowService";
import { OrderPlacementError } from "../../../services/orderPlacementService";
import { restoreOrderItemStock } from "../../../services/orderStockService";
import Refund from "../../../models/Refund";
import Customer from "../../../models/Customer";
import { sendNotification } from "../../../services/notificationService";

// Statuses a delivery partner may set directly; "Delivered" requires the customer's OTP
// ("Ready for pickup" is set by the store once it has packed the order)
const DELIVERY_PARTNER_STATUSES = ['Picked up', 'Out for Delivery'];

/** Short code the store reads out / prints for pickup: last 6 characters of the order number. */
export const pickupCodeFor = (orderNumber: string) => String(orderNumber || '').slice(-6);

/**
 * Pickup verification: the scanned barcode / typed value must be this order's number,
 * its 6-digit pickup code, or its id. Prevents a rider collecting the wrong package.
 */
const matchesPickupCode = (order: any, raw: unknown) => {
    const code = String(raw ?? '').trim().replace(/^#/, '').toUpperCase();
    if (!code) return false;
    const orderNumber = String(order.orderNumber || '').toUpperCase();
    return code === orderNumber || code === String(order._id).toUpperCase() || (code.length === 6 && code === pickupCodeFor(orderNumber));
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

    // Unassigned offers: only ones this partner was offered (dispatch is by distance to the store)
    // and has not declined. Orders dispatched while no partner was online are open to all.
    const riderId = new mongoose.Types.ObjectId(String(deliveryId));
    const pendingQuery: any = riderVisibleOrdersFilter(deliveryId, {
        'dispatch.rejectedDeliveryBoys': { $ne: riderId },
        $or: [{ 'dispatch.notifiedDeliveryBoys.0': { $exists: false } }, { 'dispatch.notifiedDeliveryBoys': riderId }],
    });

    const orders = await Order.find(pendingQuery)
        .populate("items")
        .sort({ createdAt: -1 });

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
        (notified.length === 0 || notified.includes(deliveryId));
    if (!isMine && !isOffer) {
        return res.status(403).json({
            success: false,
            message: order.deliveryBoy
                ? "This order is assigned to another delivery partner"
                : "This order isn't available to you yet — the store hasn't finished packing it",
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

    return res.status(200).json({
        success: true,
        data: formattedOrder
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
        if (order.status === 'Received' || order.status === 'Pending') {
            return res.status(400).json({
                success: false,
                message: "The store has not accepted this order yet. Wait for the store to accept and pack it.",
            });
        }
        if (order.status === 'Processed') {
            return res.status(400).json({
                success: false,
                message: "The store is still packing this order. Wait for it to be marked ready for pickup.",
            });
        }
        // Collecting the package requires proving it is this order (barcode on the bill or pickup code)
        if (order.status !== 'Picked up') {
            const { pickupCode } = req.body;
            if (!pickupCode) {
                return res.status(400).json({
                    success: false,
                    message: "Verify the package first: scan the barcode on the bill or enter the order number / pickup code.",
                });
            }
            if (!matchesPickupCode(order, pickupCode)) {
                return res.status(400).json({
                    success: false,
                    message: `This package is not order #${order.orderNumber}. Check the order number on the bill and try again.`,
                });
            }
        }
        from = PICKUP_READY_STATUSES;
        extra.deliveryBoyStatus = 'Picked Up';
        extra.pickupVerifiedAt = new Date();
    } else {
        // Out for Delivery: only once the package has been collected
        if (order.status !== 'Picked up' && order.status !== 'Out for Delivery') {
            return res.status(400).json({ success: false, message: "Collect the package from the store (Picked up) first." });
        }
        from = ['Picked up'];
        extra.deliveryBoyStatus = 'In Transit';
    }

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

    // Emit socket events for status changes
    const io = (req.app as any).get("io");
    if (io) {
        if (status === 'Picked up' && previousStatus !== 'Picked up') {
            // Emit order-taken event
            io.to(`order-${id}`).emit('order-taken', {
                orderId: id,
                message: 'Order has been picked up from seller',
            });
        }

        io.to(`order-${id}`).emit('order-status-updated', { orderId: id, status });

        notifySellersOfOrderUpdate(io, updated, 'STATUS_UPDATE');
    }

    return res.status(200).json({
        success: true,
        message: `Order status updated to ${status}`,
        data: updated
    });
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

    // Get all unique seller IDs from order items
    const orderItems = await OrderItem.find({ order: id });
    const sellerIds = [...new Set(orderItems.map(item => item.seller.toString()))];

    // Get seller details including locations
    const sellers = await Seller.find({ _id: { $in: sellerIds } })
        .select('storeName address city latitude longitude location');

    // Format seller locations: map location (GeoJSON) first, legacy latitude/longitude text as fallback
    const sellerLocations = sellers
        .map((seller: any) => {
            const coords = seller.location?.coordinates;
            const hasGeo = Array.isArray(coords) && coords.length === 2 && (coords[0] !== 0 || coords[1] !== 0);
            return {
                sellerId: seller._id.toString(),
                storeName: seller.storeName,
                address: seller.address,
                city: seller.city,
                latitude: hasGeo ? Number(coords[1]) : parseFloat(seller.latitude || ''),
                longitude: hasGeo ? Number(coords[0]) : parseFloat(seller.longitude || ''),
            };
        })
        .filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude));

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
            const alreadyCompleted = rReq.status === "Completed";
            if (status === "Picked Up") {
                rReq.status = "Picked Up";
                rReq.pickupCompleted = new Date();
            } else if (status === "Delivered") {
                rReq.status = "Completed";

                if (!alreadyCompleted) {
                    const orderItem: any = await OrderItem.findById(rReq.orderItem);
                    if (orderItem) {
                        // The item is physically back at the store either way — put it back into stock
                        await restoreOrderItemStock({
                            product: orderItem.product,
                            variantId: orderItem.variantId,
                            variation: orderItem.variation,
                            quantity: rReq.quantity,
                        });

                        if (rReq.requestType === "Return") {
                            orderItem.status = "Returned";
                            await orderItem.save();

                            // Refund the customer: the amount set at approval, or the item's own price
                            const amount = rReq.refundAmount || Math.round((orderItem.unitPrice || 0) * rReq.quantity * 100) / 100;
                            if (amount > 0) {
                                const refund = await Refund.create({
                                    order: rReq.order,
                                    customer: rReq.customer,
                                    amount,
                                    reason: `Return: ${rReq.reason || "Item returned"}`,
                                    status: "Completed",
                                    processedAt: new Date(),
                                });
                                // walletAmount is a read-only virtual alias for creditBalance — update the real field
                                await Customer.updateOne({ _id: rReq.customer }, { $inc: { creditBalance: amount } });
                                rReq.refundAmount = amount;
                                rReq.refundId = refund._id as any;
                                refundIssued = amount;
                                sendNotification(
                                    "Customer",
                                    String(rReq.customer),
                                    "Refund credited",
                                    `₹${amount} for your return has been credited to your Unnati wallet.`,
                                    { type: "Payment", priority: "High" }
                                ).catch((err) => console.error("Return refund notification failed:", err));
                            }
                        }
                        // Replacement: the old item is restocked above; no refund (a new item is owed instead).
                    }
                }
            }
            await rReq.save();
        }
    }

    return res.status(200).json({
        success: true,
        message: `Task status updated to ${status}`,
        data: { ...assignment.toObject(), refundIssued },
    });
});
