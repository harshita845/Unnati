import mongoose from "mongoose";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import { OrderPlacementError } from "./orderPlacementService";
import { COD_PAYMENT_METHODS, TERMINAL_ORDER_STATUSES, cancelOrderAndRestoreStock } from "./orderLifecycleService";
import { clearOrderCache } from "../socket/socketService";

/**
 * Order flow (one direction only):
 *   Pending (awaiting online payment) -> Received (waiting for the store)
 *   -> Processed (every store accepted; riders are offered the order now)
 *   -> Ready for pickup (every store packed) -> Picked up (rider verified the package)
 *   -> Out for Delivery -> Delivered (customer OTP)
 */
export const ORDER_STAGE: Record<string, number> = {
  Pending: 0,
  Received: 1,
  Processed: 2,
  "Ready for pickup": 3,
  "Picked up": 4,
  Shipped: 4,
  "Out for Delivery": 5,
  Delivered: 6,
};

/**
 * Riders only learn about an order once every store has finished packing it — not the moment
 * a store accepts. "Processed" (accepted, being packed) is deliberately not included here.
 */
export const PICKUP_READY_STATUSES = ["Ready for pickup"];

/** Statuses from which the package has left the store. */
export const AFTER_PICKUP_STATUSES = ["Picked up", "Shipped", "Out for Delivery"];

const toObjectId = (id: unknown) => new mongoose.Types.ObjectId(String(id));

/**
 * Move an order to `to` only if it is currently in one of `from`, in a single
 * atomic update, so a stale page or a slower request can never move it backwards.
 * Repeating a transition that already happened is a no-op.
 */
export const transitionOrderStatus = async (
  orderId: unknown,
  from: string[],
  to: string,
  extra: Record<string, unknown> = {},
  filter: Record<string, unknown> = {}
) => {
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, status: { $in: from }, ...filter },
    { $set: { status: to, ...extra } },
    { new: true }
  );
  if (updated) {
    clearOrderCache(String(orderId));
    return { order: updated as any, changed: true };
  }
  const current: any = await Order.findOne({ _id: orderId, ...filter });
  if (!current) throw new OrderPlacementError(404, "Order not found");
  if (current.status === to) return { order: current, changed: false };
  throw new OrderPlacementError(409, `Order is already ${current.status} and can't be changed to ${to}`);
};

/** Stores that still have live items in the order. */
export const getOrderSellerIds = async (orderId: unknown): Promise<string[]> => {
  const ids = await OrderItem.distinct("seller", { order: orderId, status: { $nin: ["Cancelled", "Returned"] } });
  return ids.filter(Boolean).map((id: any) => String(id));
};

export interface SellerOrderProgress {
  acceptedAt: Date | null;
  readyAt: Date | null;
  totalStores: number;
  storesAccepted: number;
  storesReady: number;
}

export const getSellerOrderProgress = async (order: any, sellerId: unknown): Promise<SellerOrderProgress> => {
  const sellers = await getOrderSellerIds(order._id);
  const progress: any[] = order.sellerProgress || [];
  const mine = progress.find((p) => String(p.seller) === String(sellerId));
  const inOrder = (p: any) => sellers.includes(String(p.seller));
  return {
    acceptedAt: mine?.acceptedAt || null,
    readyAt: mine?.readyAt || null,
    totalStores: sellers.length,
    storesAccepted: progress.filter((p) => inOrder(p) && p.acceptedAt).length,
    storesReady: progress.filter((p) => inOrder(p) && p.readyAt).length,
  };
};

const loadSellerOrder = async (orderId: unknown, sellerId: unknown) => {
  if (!mongoose.isValidObjectId(String(orderId))) throw new OrderPlacementError(400, "Invalid order");
  const hasItems = await OrderItem.exists({ order: orderId, seller: sellerId });
  if (!hasItems) throw new OrderPlacementError(404, "Order not found or access denied");
  const order: any = await Order.findById(orderId);
  if (!order) throw new OrderPlacementError(404, "Order not found");
  if (TERMINAL_ORDER_STATUSES.includes(order.status)) {
    throw new OrderPlacementError(400, `Order is already ${order.status}`);
  }
  if (order.status === "Pending" && !COD_PAYMENT_METHODS.includes(order.paymentMethod) && order.paymentStatus !== "Paid") {
    throw new OrderPlacementError(400, "This order is still waiting for the customer's online payment");
  }
  return order;
};

/**
 * A store accepts its part of the order. When the last store accepts, the order becomes
 * Processed — the store is now packing it. Riders are not offered it yet; that happens
 * when the store marks it Ready for pickup (see sellerMarkReady).
 */
export const sellerAcceptOrder = async (orderId: unknown, sellerId: unknown) => {
  const order = await loadSellerOrder(orderId, sellerId);
  if (ORDER_STAGE[order.status] >= ORDER_STAGE["Picked up"]) {
    throw new OrderPlacementError(400, `Order is already ${order.status}`);
  }
  const sid = toObjectId(sellerId);
  const now = new Date();
  const alreadyAccepted = (order.sellerProgress || []).some((p: any) => String(p.seller) === String(sid) && p.acceptedAt);
  if (alreadyAccepted || ORDER_STAGE[order.status] >= ORDER_STAGE["Processed"]) {
    throw new OrderPlacementError(400, `You have already accepted this order (it is ${order.status})`);
  }

  // Record this store's acceptance once (the filter makes concurrent clicks safe)
  await Order.updateOne(
    { _id: order._id, "sellerProgress.seller": { $ne: sid } },
    { $push: { sellerProgress: { seller: sid, acceptedAt: now } } }
  );
  await Order.updateOne(
    { _id: order._id, sellerProgress: { $elemMatch: { seller: sid, acceptedAt: null } } },
    { $set: { "sellerProgress.$.acceptedAt": now } }
  );

  const fresh: any = await Order.findById(order._id);
  const progress = await getSellerOrderProgress(fresh, sellerId);
  let result = fresh;
  if (progress.storesAccepted >= progress.totalStores && fresh.status === "Received") {
    result = (await transitionOrderStatus(order._id, ["Received"], "Processed")).order;
  }
  clearOrderCache(String(order._id));
  return { order: result, progress: await getSellerOrderProgress(result, sellerId) };
};

/**
 * A store has packed its items. When every store is packed, the order becomes Ready for
 * pickup and `dispatchNow` is true: that is the moment riders are offered it.
 */
export const sellerMarkReady = async (orderId: unknown, sellerId: unknown) => {
  const order = await loadSellerOrder(orderId, sellerId);
  const sid = toObjectId(sellerId);
  const mine = (order.sellerProgress || []).find((p: any) => String(p.seller) === String(sid));
  // Accepted by this store, or by an admin on behalf of all stores (order already Processed)
  if (!mine?.acceptedAt && order.status !== "Processed" && order.status !== "Ready for pickup") {
    throw new OrderPlacementError(400, "Accept the order before marking it ready");
  }
  if (ORDER_STAGE[order.status] >= ORDER_STAGE["Picked up"]) {
    throw new OrderPlacementError(400, `Order is already ${order.status}`);
  }

  const now = new Date();
  await Order.updateOne(
    { _id: order._id, "sellerProgress.seller": { $ne: sid } },
    { $push: { sellerProgress: { seller: sid, acceptedAt: now } } }
  );
  await Order.updateOne(
    { _id: order._id, sellerProgress: { $elemMatch: { seller: sid, readyAt: null } } },
    { $set: { "sellerProgress.$.readyAt": now } }
  );

  const fresh: any = await Order.findById(order._id);
  const progress = await getSellerOrderProgress(fresh, sellerId);
  let dispatchNow = false;
  let result = fresh;
  if (progress.storesReady >= progress.totalStores && fresh.status === "Processed") {
    const { order: moved, changed } = await transitionOrderStatus(order._id, ["Processed"], "Ready for pickup");
    result = moved;
    dispatchNow = changed;
  }
  clearOrderCache(String(order._id));
  return { order: result, dispatchNow, progress: await getSellerOrderProgress(result, sellerId) };
};

/** A store declines the order before it has been picked up: the whole order is rejected and stock released. */
export const sellerRejectOrder = async (orderId: unknown, sellerId: unknown, reason?: string) => {
  await loadSellerOrder(orderId, sellerId);
  return cancelOrderAndRestoreStock(String(orderId), {
    finalStatus: "Rejected",
    reason: reason || "Rejected by store",
    cancelledBy: String(sellerId),
    notCancellableFrom: [...AFTER_PICKUP_STATUSES],
  });
};

/** A store cancels the order; only possible while the package is still at the store. */
export const sellerCancelOrder = async (orderId: unknown, sellerId: unknown, reason?: string) => {
  await loadSellerOrder(orderId, sellerId);
  return cancelOrderAndRestoreStock(String(orderId), {
    reason: reason || "Cancelled by store",
    cancelledBy: String(sellerId),
    notCancellableFrom: [...AFTER_PICKUP_STATUSES],
  });
};

/** Statuses of an order a rider is working on. */
export const RIDER_ACTIVE_STATUSES = ["Processed", "Ready for pickup", "Picked up", "Out for Delivery"];

/**
 * Orders a rider should see: their own active orders, plus unassigned orders the
 * store(s) have accepted (never ones still waiting for the store).
 */
export const riderVisibleOrdersFilter = (riderId: unknown, unassignedExtra: Record<string, unknown> = {}) => ({
  $or: [
    { deliveryBoy: toObjectId(riderId), status: { $in: RIDER_ACTIVE_STATUSES } },
    {
      $and: [
        { $or: [{ deliveryBoy: null }, { deliveryBoy: { $exists: false } }] },
        { status: { $in: PICKUP_READY_STATUSES } },
        unassignedExtra,
      ],
    },
  ],
});

/**
 * Admin moved an order forward on the stores' behalf: record that every store in it has
 * accepted (and, for Ready for pickup, packed) so the store pages agree with the order
 * instead of showing "Accepted" with nothing behind it.
 */
export const recordAllStoresProgress = async (orderId: unknown, stage: "accepted" | "ready") => {
  const sellers = await getOrderSellerIds(orderId);
  const now = new Date();
  for (const sellerId of sellers) {
    const sid = toObjectId(sellerId);
    await Order.updateOne(
      { _id: orderId, "sellerProgress.seller": { $ne: sid } },
      { $push: { sellerProgress: { seller: sid, acceptedAt: now, ...(stage === "ready" ? { readyAt: now } : {}) } } }
    );
    await Order.updateOne(
      { _id: orderId, sellerProgress: { $elemMatch: { seller: sid, acceptedAt: null } } },
      { $set: { "sellerProgress.$.acceptedAt": now } }
    );
    if (stage === "ready") {
      await Order.updateOne(
        { _id: orderId, sellerProgress: { $elemMatch: { seller: sid, readyAt: null } } },
        { $set: { "sellerProgress.$.readyAt": now } }
      );
    }
  }
};
