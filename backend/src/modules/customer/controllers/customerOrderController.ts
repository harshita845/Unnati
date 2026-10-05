import { Request, Response } from "express";
import Order from "../../../models/Order";
import OrderItem from "../../../models/OrderItem";
import Return from "../../../models/Return";
import mongoose from "mongoose";
import { notifySellersOfOrderUpdate } from "../../../services/sellerNotificationService";
import { notifyAdminsOfNewOrder } from "../../../services/adminNotificationService";
import { generateDeliveryOtp } from "../../../services/deliveryOtpService";
import { Server as SocketIOServer } from "socket.io";
import { OrderPlacementError, placeOrder, runInTransaction } from "../../../services/orderPlacementService";
import { cancelOrderAndRestoreStock, confirmOnlinePayment } from "../../../services/orderLifecycleService";
import {
  createCashfreeOrder,
  createRazorpayOrder,
  getCashfreePaidReference,
  isValidRazorpaySignature,
} from "../../../services/paymentGatewayService";

// Tell the store(s) and admins about a new order. Delivery partners are offered it
// only after every store has accepted (see seller updateOrderStatus).
const notifyNewOrder = async (req: Request, orderId: unknown) => {
    try {
        const io: SocketIOServer = req.app.get("io") as SocketIOServer;
        if (!io) return;
        const savedOrder = await Order.findById(orderId).lean();
        if (!savedOrder) return;
        await notifySellersOfOrderUpdate(io, savedOrder, 'NEW_ORDER');
        await notifyAdminsOfNewOrder(io, savedOrder);
    } catch (notificationError) {
        // Log error but don't fail the request
        console.error("Error sending new order notifications:", notificationError);
    }
};

const sendOrderError = (res: Response, error: any, fallbackMessage: string) => {
    if (error instanceof OrderPlacementError) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error(fallbackMessage, error);
    return res.status(500).json({
        success: false,
        message: `${fallbackMessage} ${error?.message || ""}`.trim(),
        error: error?.message,
    });
};

// Create a new order (Cash on Delivery)
export const createOrder = async (req: Request, res: Response) => {
    try {
        const { order } = await runInTransaction((session) =>
            placeOrder({ userId: req.user!.userId, body: req.body, online: false }, session)
        );

        await notifyNewOrder(req, order._id);

        return res.status(201).json({
            success: true,
            message: "Order placed successfully",
            data: order,
        });
    } catch (error: any) {
        return sendOrderError(res, error, "Error creating order.");
    }
};

// Get authenticated customer's orders
export const getMyOrders = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { status, page = 1, limit = 10 } = req.query;

        const query: any = { customer: userId };

        if (status) {
            query.status = status; // Note: Model field is 'status', not 'orderStatus'
        }

        const skip = (Number(page) - 1) * Number(limit);

        const orders = await Order.find(query)
            .populate({
                path: 'items',
                populate: { path: 'product', select: 'productName mainImage price' }
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const total = await Order.countDocuments(query);

        // Transform orders to match frontend Order type
        const transformedOrders = orders.map(order => {
            const orderObj = order.toObject();
            return {
                ...orderObj,
                id: orderObj._id.toString(),
                totalItems: Array.isArray(orderObj.items) ? orderObj.items.length : 0,
                totalAmount: orderObj.total,
                fees: {
                    platformFee: orderObj.platformFee || 0,
                    deliveryFee: orderObj.shipping || 0
                },
                // Keep original fields for backward compatibility
                subtotal: orderObj.subtotal,
                address: orderObj.deliveryAddress
            };
        });

        return res.status(200).json({
            success: true,
            data: transformedOrders,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching orders",
            error: error.message,
        });
    }
};

// Get single order details
export const getOrderById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;

        // Find order and ensure it belongs to the user
        const order = await Order.findOne({ _id: id, customer: userId })
            .populate({
                path: 'items',
                populate: [
                    { path: 'product', select: 'productName mainImage pack manufacturer price' },
                    { path: 'seller', select: 'storeName city phone fssaiLicNo' }
                ]
            })
            .populate('deliveryBoy', 'name mobile profileImage vehicleNumber');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        // Transform order to match frontend Order type
        const orderObj = order.toObject();
        const transformedOrder = {
            ...orderObj,
            id: orderObj._id.toString(),
            totalItems: Array.isArray(orderObj.items) ? orderObj.items.length : 0,
            totalAmount: orderObj.total,
            fees: {
                platformFee: orderObj.platformFee || 0,
                deliveryFee: orderObj.shipping || 0
            },
            // Keep original fields for backward compatibility
            subtotal: orderObj.subtotal,
            address: orderObj.deliveryAddress,
            // Include invoice enabled flag
            invoiceEnabled: orderObj.invoiceEnabled || false,
            // Assigned delivery partner (shown with the delivery OTP)
            deliveryPartner: orderObj.deliveryBoy && typeof orderObj.deliveryBoy === 'object'
                ? {
                    name: (orderObj.deliveryBoy as any).name,
                    phone: (orderObj.deliveryBoy as any).mobile,
                    profileImage: (orderObj.deliveryBoy as any).profileImage,
                    vehicleNumber: (orderObj.deliveryBoy as any).vehicleNumber,
                }
                : undefined,
            deliveryBoy: orderObj.deliveryBoy && typeof orderObj.deliveryBoy === 'object'
                ? (orderObj.deliveryBoy as any)._id
                : orderObj.deliveryBoy
        };

        return res.status(200).json({
            success: true,
            data: transformedOrder,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching order detail",
            error: error.message,
        });
    }
};

/**
 * Refresh Delivery OTP
 */
export const refreshDeliveryOtp = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;

        const order = await Order.findOne({ _id: id, customer: userId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (['Delivered', 'Cancelled', 'Rejected', 'Returned'].includes(order.status)) {
            return res.status(400).json({ success: false, message: `Order is already ${order.status}` });
        }

        // Generate and send new OTP
        const result = await generateDeliveryOtp(id, order.customerPhone);

        // Fetch updated order to get newly saved random 6-digit OTP
        const updatedOrder = await Order.findById(id);

        // Emit socket event (customer room)
        const io = (req.app as any).get("io");
        if (io && updatedOrder) {
            io.to(`order-${id}`).emit('delivery-otp-refreshed', {
                orderId: id,
                deliveryOtp: updatedOrder.deliveryOtp,
                expiresAt: updatedOrder.deliveryOtpExpiresAt
            });
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Error refreshing delivery OTP:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to refresh delivery OTP",
            error: error.message
        });
    }
};

// Cancel Order
export const cancelOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user!.userId;

        if (!reason) {
            return res.status(400).json({ success: false, message: "Cancellation reason is required" });
        }

        const order: any = await cancelOrderAndRestoreStock(id, {
            reason,
            cancelledBy: userId,
            filter: { customer: userId },
            // Once the delivery partner has the items the order can no longer be cancelled
            notCancellableFrom: ['Picked up', 'Shipped', 'Out for Delivery'],
        });

        try {
            const io = (req.app as any).get("io");
            if (io) await notifySellersOfOrderUpdate(io, order, 'ORDER_CANCELLED');
        } catch (err) {
            console.error("Notification error:", err);
        }

        return res.status(200).json({
            success: true,
            message: "Order cancelled successfully",
            data: {
                id: order._id,
                status: order.status,
                cancelledAt: order.cancelledAt
            }
        });
    } catch (error: any) {
        return sendOrderError(res, error, "Failed to cancel order.");
    }
};

// Update Order Notes (Instructions/Special Requests)
export const updateOrderNotes = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { deliveryInstructions, specialRequests } = req.body;
        const userId = req.user!.userId;

        const order = await Order.findOne({ _id: id, customer: userId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (['Delivered', 'Cancelled', 'Returned'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot update notes for ${order.status} order`
            });
        }

        if (deliveryInstructions !== undefined) order.deliveryInstructions = deliveryInstructions;
        if (specialRequests !== undefined) order.specialRequests = specialRequests;

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Order notes updated",
            data: {
                deliveryInstructions: order.deliveryInstructions,
                specialRequests: order.specialRequests
            }
        });
    } catch (error: any) {
         console.error('Error updating order notes:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to update order notes",
            error: error.message
        });
    }
};

/**
 * Initiate Online Order (Razorpay/Cashfree)
 * Creates the order in "Pending" (awaiting payment) with stock reserved, then opens a gateway order.
 * Unpaid orders are released automatically after ONLINE_PAYMENT_WINDOW_MINUTES.
 */
export const initiateOnlineOrder = async (req: Request, res: Response) => {
    let order: any;
    let customer: any;
    try {
        ({ order, customer } = await runInTransaction((session) =>
            placeOrder({ userId: req.user!.userId, body: req.body, online: true }, session)
        ));
    } catch (error: any) {
        return sendOrderError(res, error, "Failed to initiate order.");
    }

    const orderId = String(order._id);
    try {
        if (order.paymentMethod === 'Razorpay') {
            const razorpayOrder = await createRazorpayOrder(order.total, order.orderNumber, orderId);
            await Order.updateOne({ _id: order._id }, { $set: { gatewayOrderId: razorpayOrder.id } });

            return res.status(200).json({
                success: true,
                data: {
                    gateway: 'Razorpay',
                    orderId: order._id,
                    razorpayOrderId: razorpayOrder.id,
                    amount: order.total,
                    key: process.env.RAZORPAY_KEY_ID,
                    customer: { name: customer.name, email: customer.email, contact: customer.phone }
                }
            });
        }

        const cashfreeOrder = await createCashfreeOrder({
            amount: order.total,
            orderId,
            customerId: String(customer._id),
            email: customer.email,
            phone: customer.phone,
        });
        await Order.updateOne({ _id: order._id }, { $set: { gatewayOrderId: cashfreeOrder.cfOrderId } });

        return res.status(200).json({
            success: true,
            data: {
                gateway: 'Cashfree',
                orderId: order._id,
                paymentSessionId: cashfreeOrder.paymentSessionId,
                amount: order.total,
                isSandbox: process.env.CASHFREE_MODE !== 'production'
            }
        });
    } catch (gatewayError: any) {
        console.error("Payment gateway error:", gatewayError?.response?.data || gatewayError?.message);
        // Release the reserved stock — the customer never reached the payment page
        await cancelOrderAndRestoreStock(orderId, { reason: "Payment gateway error" }).catch((e) =>
            console.error("Failed to release order after gateway error:", e)
        );
        return res.status(502).json({ success: false, message: "Could not start the payment. Please try again." });
    }
};

/**
 * Verify Online Payment
 * Razorpay: checks the checkout signature. Cashfree: asks Cashfree for the order status.
 * Only then is the order marked Paid and sent to sellers/delivery partners.
 */
export const verifyOnlinePayment = async (req: Request, res: Response) => {
    try {
        const { orderId, paymentId, razorpayOrderId, razorpaySignature } = req.body;
        const userId = req.user!.userId;

        if (!orderId || !mongoose.isValidObjectId(orderId)) {
            return res.status(400).json({ success: false, message: "Order ID is required" });
        }
        const order: any = await Order.findOne({ _id: orderId, customer: userId });
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        if (order.paymentStatus === "Paid") {
            return res.status(200).json({ success: true, message: "Payment already verified", data: order });
        }
        if (!order.gatewayOrderId) {
            return res.status(400).json({ success: false, message: "No payment was started for this order" });
        }

        let verifiedPaymentId: string | null = null;
        if (order.paymentGateway === 'Razorpay' || order.paymentMethod === 'Razorpay') {
            if (razorpayOrderId === order.gatewayOrderId && isValidRazorpaySignature(order.gatewayOrderId, paymentId, razorpaySignature)) {
                verifiedPaymentId = paymentId;
            }
        } else if (order.paymentGateway === 'Cashfree' || order.paymentMethod === 'Cashfree') {
            verifiedPaymentId = await getCashfreePaidReference(order.gatewayOrderId, order.total);
        }

        if (!verifiedPaymentId) {
            return res.status(400).json({ success: false, message: "Payment could not be verified. If money was deducted it will be refunded." });
        }

        const { order: paidOrder, alreadyConfirmed } = await confirmOnlinePayment(String(order._id), verifiedPaymentId);
        if (!alreadyConfirmed) await notifyNewOrder(req, paidOrder._id);

        return res.status(200).json({ success: true, message: "Payment verified", data: paidOrder });
    } catch (error: any) {
        return sendOrderError(res, error, "Verification failed.");
    }
};

/**
 * Abandon an unpaid online order (payment popup closed or failed) and release its stock.
 */
export const abandonOnlinePayment = async (req: Request, res: Response) => {
    try {
        const order: any = await cancelOrderAndRestoreStock(req.params.id, {
            reason: req.body?.reason || "Payment not completed",
            cancelledBy: req.user!.userId,
            filter: { customer: req.user!.userId, status: "Pending", paymentStatus: { $ne: "Paid" } },
        });
        return res.status(200).json({ success: true, message: "Order released", data: { id: order._id, status: order.status } });
    } catch (error: any) {
        return sendOrderError(res, error, "Failed to release order.");
    }
};

/**
 * Request Return or Replacement
 */
export const requestReturnOrReplace = async (req: Request, res: Response) => {
    try {
        const { orderId, orderItemId, requestType, reason, description, images, quantity } = req.body;
        const userId = req.user!.userId;

        // Validation
        if (!orderId || !orderItemId || !requestType || !reason) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: orderId, orderItemId, requestType, reason"
            });
        }

        if (requestType === "Replacement" && (!images || images.length === 0)) {
            return res.status(400).json({
                success: false,
                message: "Issue image is mandatory for replacement request"
            });
        }

        const order = await Order.findOne({ _id: orderId, customer: userId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Validate that order is delivered (standard policy)
        if (order.status !== "Delivered") {
            return res.status(400).json({
                success: false,
                message: "Requests can only be raised for delivered orders"
            });
        }

        const orderItem = await OrderItem.findOne({ _id: orderItemId, order: orderId });
        if (!orderItem) {
            return res.status(404).json({ success: false, message: "Order item not found" });
        }

        const requestedQuantity = Number(quantity) || orderItem.quantity;
        if (requestedQuantity > orderItem.quantity) {
             return res.status(400).json({ success: false, message: "Quantity exceeds ordered quantity" });
        }

        // Check if a request already exists for this item
        const existingRequest = await Return.findOne({ orderItem: orderItemId, status: { $ne: "Rejected" } });
        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: `A ${existingRequest.requestType} request already exists for this item`
            });
        }

        // Create return/replacement request
        const returnRequest = new Return({
            order: orderId,
            orderItem: orderItemId,
            customer: userId,
            requestType,
            reason,
            description,
            images: images || [],
            quantity: requestedQuantity,
            status: "Pending"
        });

        await returnRequest.save();

        return res.status(201).json({
            success: true,
            message: `${requestType} request raised successfully`,
            data: returnRequest
        });

    } catch (error: any) {
        console.error("Error requesting return/replace:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to raise request",
            error: error.message
        });
    }
};

