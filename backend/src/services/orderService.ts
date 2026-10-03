import mongoose from "mongoose";
import Order from "../models/Order";
import { IOrderItem } from "../models/OrderItem";
import Commission from "../models/Commission";
import Product from "../models/Product";
import { getCommissionOverride } from "./sellerSubscriptionService";
import Seller from "../models/Seller";
import WalletTransaction from "../models/WalletTransaction";
import { clearOrderCache } from "../socket/socketService";
import {
  decrementVariantStock,
  incrementVariantStock,
} from "../modules/product/variantStockService";

/**
 * Process order status transition
 */
export const processOrderStatusTransition = async (
  orderId: string,
  newStatus: string,
  previousStatus: string
) => {
  const order = await Order.findById(orderId).populate("items");

  if (!order) {
    throw new Error("Order not found");
  }

  // Clear tracking cache if order is completed, cancelled, or rejected
  if (["Delivered", "Cancelled", "Returned", "Failed", "Rejected"].includes(newStatus)) {
    clearOrderCache(orderId);
  }

  // Handle status-specific logic
  switch (newStatus) {
    case "Cancelled":
      // Restore inventory if order was confirmed
      if (["Processed", "Shipped"].includes(previousStatus)) {
        await restoreInventory(order.items as any[]);
      }
      break;

    case "Processed":
      // Reserve inventory
      await reserveInventory(order.items as any[]);
      break;

    case "Delivered":
      // Create commissions for sellers
      await createCommissions(order.items as any[]);
      break;
  }

  return order;
};

/**
 * Reserve inventory for order items
 */
const reserveInventory = async (items: IOrderItem[]) => {
  for (const item of items) {
    const variantId = (item as any).variantId
      ? String((item as any).variantId)
      : undefined;
    await decrementVariantStock(
      String(item.product),
      variantId,
      item.quantity
    );
  }
};

const restoreInventory = async (items: IOrderItem[]) => {
  for (const item of items) {
    const variantId = (item as any).variantId
      ? String((item as any).variantId)
      : undefined;
    await incrementVariantStock(
      String(item.product),
      variantId,
      item.quantity
    );
  }
};

/**
 * Create commissions for sellers when order is delivered
 * Also updates seller balances and creates wallet transactions.
 * Idempotent per order: a second call for the same order does nothing.
 */
export const createCommissions = async (
  items: IOrderItem[],
  session?: mongoose.ClientSession | null
) => {
  // Free gifts carry no revenue for the seller
  const billableItems = items.filter((item) => item.seller && !(item as any).isFreeGift && item.total > 0);
  if (!billableItems.length) return;

  const orderId = billableItems[0].order;
  if (await Commission.exists({ order: orderId }).session(session || null)) return;

  // Group items by seller to aggregate earnings
  const sellerEarnings = new Map<string, { netEarning: number }>();

  for (const item of billableItems) {
    const sellerId = item.seller.toString();
    const seller = await Seller.findById(item.seller).session(session || null);
    if (!seller) continue;

    // A subscription plan can set its own commission rate for its categories
    const product = item.product
      ? await Product.findById(item.product).select("category").session(session || null).lean()
      : null;
    const planRate = product ? await getCommissionOverride(item.seller, (product as any).category) : null;
    const commissionRate = planRate ?? (seller.commission || 0);
    const commissionAmount = (item.total * commissionRate) / 100;

    await Commission.create(
      [
        {
          order: item.order,
          orderItem: item._id,
          seller: item.seller,
          orderAmount: item.total,
          commissionRate,
          commissionAmount,
          status: "Pending",
        },
      ],
      { session: session || undefined }
    );

    const entry = sellerEarnings.get(sellerId) || { netEarning: 0 };
    entry.netEarning += item.total - commissionAmount;
    sellerEarnings.set(sellerId, entry);
  }

  const order = await Order.findById(orderId).select("orderNumber").session(session || null);
  const orderNumber = order?.orderNumber || `ORDER-${orderId}`;

  for (const [sellerId, { netEarning }] of sellerEarnings.entries()) {
    const amount = Number(netEarning.toFixed(2));
    await Seller.updateOne({ _id: sellerId }, { $inc: { balance: amount } }, { session: session || undefined });
    await WalletTransaction.create(
      [
        {
          sellerId,
          amount,
          type: "Credit",
          description: `Earnings from Order #${orderNumber}`,
          reference: `ORD-${orderId}-${sellerId}`,
          status: "Completed",
        },
      ],
      { session: session || undefined }
    );
  }
};

/**
 * Validate order can transition to new status
 */
export const validateStatusTransition = (
  currentStatus: string,
  newStatus: string
): { valid: boolean; message?: string } => {
  const validTransitions: Record<string, string[]> = {
    Received: ["Pending", "Cancelled", "Rejected"],
    Pending: ["Processed", "Cancelled", "Rejected"],
    Processed: ["Shipped", "Cancelled", "Rejected"],
    Shipped: ["Out for Delivery", "Cancelled", "Rejected"],
    "Out for Delivery": ["Delivered", "Cancelled", "Rejected"],
    Delivered: ["Returned"],
    Cancelled: [],
    Rejected: [],
    Returned: [],
  };

  const allowedStatuses = validTransitions[currentStatus] || [];

  if (!allowedStatuses.includes(newStatus)) {
    return {
      valid: false,
      message: `Cannot transition from ${currentStatus} to ${newStatus}. Valid transitions: ${allowedStatuses.join(
        ", "
      )}`,
    };
  }

  return { valid: true };
};

/**
 * Calculate order totals
 */
export const calculateOrderTotals = async (
  items: IOrderItem[],
  couponCode?: string
) => {
  let subtotal = 0;
  let tax = 0;
  let shipping = 0;
  let discount = 0;

  // Calculate subtotal from items
  for (const item of items) {
    subtotal += item.total;
  }

  // Apply coupon discount if provided
  if (couponCode) {
    // Coupon validation and discount calculation would go here
    // For now, we'll skip this as it's handled in the coupon controller
  }

  // Calculate tax (example: 18% GST)
  tax = subtotal * 0.18;

  // Calculate shipping (example: free shipping over 500)
  if (subtotal < 500) {
    shipping = 50;
  }

  const total = subtotal + tax + shipping - discount;

  return {
    subtotal,
    tax,
    shipping,
    discount,
    total,
  };
};
