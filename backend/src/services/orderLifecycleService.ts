import mongoose from "mongoose";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Coupon from "../models/Coupon";
import Customer from "../models/Customer";
import Delivery from "../models/Delivery";
import { restoreOrderStock } from "./orderStockService";
import { createCommissions } from "./orderService";
import { FIRST_ORDER_OFFER_CODE } from "./firstOrderOfferService";
import { OrderPlacementError, runInTransaction } from "./orderPlacementService";
import { clearOrderCache } from "../socket/socketService";

/** Order states after which nothing (stock, money, status) may change through these helpers. */
export const TERMINAL_ORDER_STATUSES = ["Delivered", "Cancelled", "Rejected", "Returned"];

/** Payment method values that mean cash on delivery (older orders stored "Cash"). */
export const COD_PAYMENT_METHODS = ["COD", "Cash", "cash", "cod"];

/** Flat payout credited to the delivery partner per delivered order. */
export const DELIVERY_PARTNER_PAYOUT = 40;

const isAwaitingOnlinePayment = (order: any) =>
  order.status === "Pending" && !COD_PAYMENT_METHODS.includes(order.paymentMethod) && order.paymentStatus !== "Paid";

interface CancelOptions {
  finalStatus?: "Cancelled" | "Rejected";
  reason?: string;
  cancelledBy?: string;
  /** Extra statuses (beyond terminal ones) from which this caller may not cancel. */
  notCancellableFrom?: string[];
  /** Extra filter, e.g. { customer: userId } so customers only cancel their own orders. */
  filter?: Record<string, unknown>;
}

/**
 * Cancel or reject an order exactly once: flips the status atomically, puts the
 * reserved stock back, releases the coupon use and marks unpaid online payments failed.
 */
export const cancelOrderAndRestoreStock = async (orderId: string, options: CancelOptions = {}) => {
  const finalStatus = options.finalStatus || "Cancelled";
  const blocked = Array.from(new Set([...TERMINAL_ORDER_STATUSES, ...(options.notCancellableFrom || [])]));

  const order = await runInTransaction(async (session) => {
    const previous: any = await Order.findOneAndUpdate(
      { _id: orderId, ...(options.filter || {}), status: { $nin: blocked } },
      {
        $set: {
          status: finalStatus,
          cancelledAt: new Date(),
          ...(options.reason ? { cancellationReason: options.reason } : {}),
          ...(options.cancelledBy && mongoose.isValidObjectId(options.cancelledBy)
            ? { cancelledBy: new mongoose.Types.ObjectId(options.cancelledBy) }
            : {}),
        },
      },
      { new: false, session: session || undefined }
    );

    if (!previous) {
      const existing: any = await Order.findOne({ _id: orderId, ...(options.filter || {}) })
        .select("status")
        .session(session);
      if (!existing) throw new OrderPlacementError(404, "Order not found");
      throw new OrderPlacementError(400, `Order cannot be cancelled as it is already ${existing.status}`);
    }

    await restoreOrderStock(previous._id, session);

    if (isAwaitingOnlinePayment(previous)) {
      await Order.updateOne({ _id: previous._id }, { $set: { paymentStatus: "Failed" } }, { session: session || undefined });
    }

    if (previous.couponCode && previous.couponCode !== FIRST_ORDER_OFFER_CODE && previous.couponDiscount > 0) {
      await Coupon.updateOne(
        { code: previous.couponCode, usageCount: { $gt: 0 } },
        { $inc: { usageCount: -1 } },
        { session: session || undefined }
      );
    }

    return Order.findById(previous._id).session(session);
  });

  clearOrderCache(String(orderId));
  return order;
};

/**
 * The single path to "Delivered": marks the order delivered once, credits the
 * seller(s) via commissions, and pays/records cash for the delivery partner.
 */
export const markOrderDelivered = async (orderId: string, deliveryBoyId?: string) => {
  const order = await runInTransaction(async (session) => {
    const current: any = await Order.findById(orderId).session(session);
    if (!current) throw new OrderPlacementError(404, "Order not found");
    if (TERMINAL_ORDER_STATUSES.includes(current.status)) {
      throw new OrderPlacementError(400, `Order is already ${current.status}`);
    }
    if (isAwaitingOnlinePayment(current)) {
      throw new OrderPlacementError(400, "Order cannot be delivered before the online payment is completed");
    }

    const updated: any = await Order.findOneAndUpdate(
      { _id: orderId, status: current.status },
      {
        $set: {
          status: "Delivered",
          deliveredAt: new Date(),
          paymentStatus: "Paid",
          invoiceEnabled: true,
          ...(current.deliveryBoy || deliveryBoyId ? { deliveryBoyStatus: "Delivered" } : {}),
          ...(!current.deliveryBoy && deliveryBoyId ? { deliveryBoy: new mongoose.Types.ObjectId(deliveryBoyId) } : {}),
        },
      },
      { new: true, session: session || undefined }
    );
    if (!updated) throw new OrderPlacementError(409, "Order was updated by someone else. Please refresh and try again.");

    const items = await OrderItem.find({ order: updated._id, status: { $nin: ["Cancelled", "Returned"] } }).session(session);
    await createCommissions(items as any, session);
    await OrderItem.updateMany(
      { order: updated._id, status: { $nin: ["Cancelled", "Returned"] } },
      { $set: { status: "Delivered" } },
      { session: session || undefined }
    );

    if (updated.deliveryBoy) {
      await Delivery.updateOne(
        { _id: updated.deliveryBoy },
        {
          $inc: {
            balance: DELIVERY_PARTNER_PAYOUT,
            cashCollected: COD_PAYMENT_METHODS.includes(updated.paymentMethod) ? updated.total : 0,
          },
        },
        { session: session || undefined }
      );
    }

    return updated;
  });

  clearOrderCache(String(orderId));
  return order;
};

/**
 * Move a paid online order from "Pending" (awaiting payment) to "Received".
 * Returns { order, alreadyConfirmed } — safe to call twice for the same payment.
 */
export const confirmOnlinePayment = async (orderId: string, paymentId: string) => {
  const updated: any = await Order.findOneAndUpdate(
    { _id: orderId, status: "Pending", paymentStatus: { $ne: "Paid" } },
    {
      $set: { status: "Received", paymentStatus: "Paid", paymentId },
      $unset: { paymentExpiresAt: 1 },
    },
    { new: true }
  );

  if (updated) {
    await Customer.updateOne({ _id: updated.customer }, { $inc: { totalOrders: 1, totalSpent: updated.total } });
    return { order: updated, alreadyConfirmed: false };
  }

  const existing: any = await Order.findById(orderId);
  if (!existing) throw new OrderPlacementError(404, "Order not found");
  if (existing.paymentStatus === "Paid") return { order: existing, alreadyConfirmed: true };

  // Paid after the payment window closed and stock was released: keep a record for refund.
  existing.paymentStatus = "Paid";
  existing.paymentId = paymentId;
  existing.adminNotes = `${existing.adminNotes || ""}\nPayment ${paymentId} received after order was ${existing.status}. Refund required.`.trim();
  await existing.save();
  throw new OrderPlacementError(
    409,
    "Your payment was received after the order expired. It will be refunded. Please place the order again."
  );
};

/** Cancel unpaid online orders whose payment window has passed and release their stock. */
export const expireUnpaidOnlineOrders = async () => {
  const expired = await Order.find({
    status: "Pending",
    paymentStatus: { $ne: "Paid" },
    paymentExpiresAt: { $lte: new Date() },
  })
    .select("_id")
    .limit(200)
    .lean();

  let count = 0;
  for (const { _id } of expired) {
    try {
      await cancelOrderAndRestoreStock(String(_id), {
        reason: "Payment not completed in time",
        notCancellableFrom: ["Received", "Processed", "Ready for pickup", "Picked up", "Shipped", "Out for Delivery"],
      });
      count++;
    } catch (error: any) {
      // Another request (payment confirmation, customer cancel) got there first
      if (!(error instanceof OrderPlacementError)) console.error(`Failed to expire order ${_id}:`, error);
    }
  }
  return count;
};
