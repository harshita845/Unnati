import mongoose from "mongoose";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import { OrderPlacementError } from "./orderPlacementService";
import { COD_PAYMENT_METHODS, TERMINAL_ORDER_STATUSES, cancelOrderAndRestoreStock } from "./orderLifecycleService";
import { clearOrderCache } from "../socket/socketService";
import { calculateDistance } from "../utils/locationHelper";

/**
 * Order flow (one direction only):
 *   Pending (awaiting online payment) -> Received (waiting for the stores)
 *   -> Processed (every store accepted; riders are offered the order now)
 *   -> Ready for pickup (every store packed)
 *   -> Picked up (the rider collected from EVERY store, each verified with that store's own code)
 *   -> Out for Delivery (customer's delivery OTP is sent) -> Delivered (customer OTP)
 *
 * Each store's part moves on its own inside the order (sellerProgress): accepted -> ready ->
 * picked up. A store being ready never makes another store ready, and collecting from one store
 * never marks another store collected.
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
 * Statuses in which riders are offered / can take the order: once every store has accepted.
 * Each store still has to mark its part packed before the rider can collect it.
 */
export const PICKUP_READY_STATUSES = ["Processed", "Ready for pickup"];

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
  /** This store's own handover code (shown to the store, entered by the rider at this store) */
  pickupCode: string | null;
  pickedUpAt: Date | null;
  totalStores: number;
  storesAccepted: number;
  storesReady: number;
  storesPickedUp: number;
}

export const getSellerOrderProgress = async (order: any, sellerId: unknown): Promise<SellerOrderProgress> => {
  const sellers = await getOrderSellerIds(order._id);
  const progress: any[] = order.sellerProgress || [];
  const mine = progress.find((p) => String(p.seller) === String(sellerId));
  const inOrder = (p: any) => sellers.includes(String(p.seller));
  return {
    acceptedAt: mine?.acceptedAt || null,
    readyAt: mine?.readyAt || null,
    pickupCode: mine?.acceptedAt ? mine?.pickupCode || null : null,
    pickedUpAt: mine?.pickedUpAt || null,
    totalStores: sellers.length,
    storesAccepted: progress.filter((p) => inOrder(p) && p.acceptedAt).length,
    storesReady: progress.filter((p) => inOrder(p) && p.readyAt).length,
    storesPickedUp: progress.filter((p) => inOrder(p) && p.pickedUpAt).length,
  };
};

/** A 6-digit code not already used by another store in this order. */
const newPickupCode = (taken: Set<string>) => {
  for (;;) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!taken.has(code)) return code;
  }
};

/**
 * Give every store in the order its own pickup code (orders placed before per-store codes get
 * theirs here, the first time anyone looks). Codes are only set where missing, never changed.
 */
export const ensurePickupCodes = async (orderId: unknown) => {
  const sellers = await getOrderSellerIds(orderId);
  const order: any = await Order.findById(orderId).select("sellerProgress");
  if (!order) return;
  const taken = new Set<string>((order.sellerProgress || []).map((p: any) => p.pickupCode).filter(Boolean));
  for (const sellerId of sellers) {
    const sid = toObjectId(sellerId);
    const code = newPickupCode(taken);
    const pushed = await Order.updateOne(
      { _id: order._id, "sellerProgress.seller": { $ne: sid } },
      { $push: { sellerProgress: { seller: sid, pickupCode: code } } }
    );
    if (pushed.modifiedCount) {
      taken.add(code);
      continue;
    }
    const set = await Order.updateOne(
      { _id: order._id, sellerProgress: { $elemMatch: { seller: sid, pickupCode: { $in: [null, ""] } } } },
      { $set: { "sellerProgress.$.pickupCode": code } }
    );
    if (set.modifiedCount) taken.add(code);
  }
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
  // This store's own handover code (and any other store's that's missing)
  await ensurePickupCodes(order._id);

  const fresh: any = await Order.findById(order._id);
  const progress = await getSellerOrderProgress(fresh, sellerId);
  let result = fresh;
  let dispatchNow = false;
  if (progress.storesAccepted >= progress.totalStores && fresh.status === "Received") {
    const moved = await transitionOrderStatus(order._id, ["Received"], "Processed");
    result = moved.order;
    // Every store has accepted: this is when delivery partners are offered the order
    dispatchNow = moved.changed;
  }
  clearOrderCache(String(order._id));
  return { order: result, dispatchNow, progress: await getSellerOrderProgress(result, sellerId) };
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

  await ensurePickupCodes(order._id);
  const fresh: any = await Order.findById(order._id);
  const progress = await getSellerOrderProgress(fresh, sellerId);
  let dispatchNow = false;
  let result = fresh;
  if (progress.storesReady >= progress.totalStores && fresh.status === "Processed") {
    const { order: moved, changed } = await transitionOrderStatus(order._id, ["Processed"], "Ready for pickup");
    result = moved;
    // Riders were offered the order when every store accepted; only offer now if that never happened
    dispatchNow = changed && !moved.deliveryBoy && !moved.dispatch?.notifiedAt;
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
export const recordAllStoresProgress = async (orderId: unknown, stage: "accepted" | "ready" | "pickedUp") => {
  const sellers = await getOrderSellerIds(orderId);
  const now = new Date();
  for (const sellerId of sellers) {
    const sid = toObjectId(sellerId);
    await Order.updateOne(
      { _id: orderId, "sellerProgress.seller": { $ne: sid } },
      { $push: { sellerProgress: { seller: sid, acceptedAt: now, ...(stage !== "accepted" ? { readyAt: now } : {}), ...(stage === "pickedUp" ? { pickedUpAt: now } : {}) } } }
    );
    await Order.updateOne(
      { _id: orderId, sellerProgress: { $elemMatch: { seller: sid, acceptedAt: null } } },
      { $set: { "sellerProgress.$.acceptedAt": now } }
    );
    if (stage !== "accepted") {
      await Order.updateOne(
        { _id: orderId, sellerProgress: { $elemMatch: { seller: sid, readyAt: null } } },
        { $set: { "sellerProgress.$.readyAt": now } }
      );
    }
    if (stage === "pickedUp") {
      await Order.updateOne(
        { _id: orderId, sellerProgress: { $elemMatch: { seller: sid, pickedUpAt: null } } },
        { $set: { "sellerProgress.$.pickedUpAt": now } }
      );
    }
  }
  await ensurePickupCodes(orderId);
};

const storePoint = (seller: any): { lat: number; lng: number } | null => {
  const c = seller?.location?.coordinates;
  if (Array.isArray(c) && c.length === 2 && (c[0] !== 0 || c[1] !== 0)) return { lat: Number(c[1]), lng: Number(c[0]) };
  const lat = parseFloat(seller?.latitude || "");
  const lng = parseFloat(seller?.longitude || "");
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
};

/**
 * Whether a rider can serve an order nobody was specifically offered (no rider was near when
 * it was dispatched): they must be within a store's delivery radius, or — with no position
 * known — registered in one of the stores' cities. Keeps a Hyderabad order away from Indore riders.
 */
export const riderCanServeOrder = async (riderId: unknown, orderId: unknown): Promise<boolean> => {
  if (!mongoose.isValidObjectId(String(riderId))) return false;
  const rider: any = await mongoose.model("Delivery").findById(riderId).select("location city").lean();
  if (!rider) return false;
  const sellerIds = await getOrderSellerIds(orderId);
  const sellers: any[] = await mongoose.model("Seller").find({ _id: { $in: sellerIds } }).select("latitude longitude location serviceRadiusKm city").lean();
  const rc = rider.location?.coordinates;
  const riderPoint = Array.isArray(rc) && rc.length === 2 && (rc[0] !== 0 || rc[1] !== 0) ? { lat: Number(rc[1]), lng: Number(rc[0]) } : null;
  return sellers.some((s) => {
    const p = storePoint(s);
    if (riderPoint && p) return calculateDistance(riderPoint.lat, riderPoint.lng, p.lat, p.lng) <= (s.serviceRadiusKm || 10);
    return !riderPoint && !!rider.city && !!s.city && String(rider.city).trim().toLowerCase() === String(s.city).trim().toLowerCase();
  });
};

/** True once any store has handed its part to the rider (the order can no longer be cancelled). */
export const anyStoreHandedOver = (order: any) => (order?.sellerProgress || []).some((p: any) => !!p.pickedUpAt);

/** Short code the store reads out / prints for pickup: last 6 characters of the order number (single-store orders before per-store codes). */
export const legacyPickupCodeFor = (orderNumber: string) => String(orderNumber || "").slice(-6);

const normalizeCode = (raw: unknown) => String(raw ?? "").trim().replace(/^#/, "").toUpperCase();

export interface StoreStop {
  sellerId: string;
  storeName: string;
  address: string;
  city: string;
  phone?: string;
  latitude: number | null;
  longitude: number | null;
  accepted: boolean;
  ready: boolean;
  pickedUp: boolean;
  pickedUpAt: Date | null;
  itemCount: number;
}

/**
 * The stores a rider has to visit for this order, with each one's own progress (accepted,
 * packed, collected) and coordinates for the map. Never includes pickup codes.
 */
export const getOrderStoreStops = async (order: any): Promise<StoreStop[]> => {
  const items: any[] = await OrderItem.find({ order: order._id, status: { $nin: ["Cancelled", "Returned"] } }).select("seller quantity").lean();
  const counts = new Map<string, number>();
  for (const it of items) if (it.seller) counts.set(String(it.seller), (counts.get(String(it.seller)) || 0) + (Number(it.quantity) || 1));
  const sellerIds = [...counts.keys()];
  const Seller = mongoose.model("Seller");
  const sellers: any[] = await Seller.find({ _id: { $in: sellerIds } }).select("storeName address city mobile latitude longitude location").lean();
  const progress: any[] = order.sellerProgress || [];
  const allAccepted = ORDER_STAGE[order.status] >= ORDER_STAGE["Processed"];
  return sellerIds.map((sid) => {
    const s = sellers.find((x) => String(x._id) === sid) || {};
    const p = progress.find((x) => String(x.seller) === sid) || {};
    const coords = s.location?.coordinates;
    const hasGeo = Array.isArray(coords) && coords.length === 2 && (coords[0] !== 0 || coords[1] !== 0);
    const lat = hasGeo ? Number(coords[1]) : parseFloat(s.latitude || "");
    const lng = hasGeo ? Number(coords[0]) : parseFloat(s.longitude || "");
    return {
      sellerId: sid,
      storeName: s.storeName || "Store",
      address: s.address || "",
      city: s.city || "",
      phone: s.mobile,
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
      accepted: !!p.acceptedAt || allAccepted,
      ready: !!p.readyAt || order.status === "Ready for pickup",
      pickedUp: !!p.pickedUpAt || ORDER_STAGE[order.status] >= ORDER_STAGE["Picked up"],
      pickedUpAt: p.pickedUpAt || null,
      itemCount: counts.get(sid) || 0,
    };
  });
};

export interface StorePickupResult {
  order: any;
  store: StoreStop;
  stores: StoreStop[];
  alreadyPickedUp: boolean;
  allPickedUp: boolean;
  /** The order became "Picked up" with this verification */
  orderPickedUp: boolean;
}

/**
 * The rider is at a store and enters (or scans) that store's pickup code. Only that store's
 * part is marked collected. When the last store is collected the order becomes "Picked up".
 *
 * - The code identifies the store (codes are different per store), so the rider doesn't pick.
 * - The store must have marked its part packed.
 * - An unassigned order the rider was offered is assigned to them on their first pickup.
 * - Repeating a store that's already collected is harmless.
 */
export const verifyStorePickup = async (orderId: unknown, riderId: unknown, rawCode: unknown): Promise<StorePickupResult> => {
  if (!mongoose.isValidObjectId(String(orderId))) throw new OrderPlacementError(400, "Invalid order");
  const code = normalizeCode(rawCode);
  if (!code) throw new OrderPlacementError(400, "Enter the store's pickup code (or scan it from the store's bill).");
  const rider = toObjectId(riderId);

  let order: any = await Order.findById(orderId);
  if (!order) throw new OrderPlacementError(404, "Order not found");
  if (order.deliveryBoy && String(order.deliveryBoy) !== String(rider)) {
    throw new OrderPlacementError(403, "This order is assigned to another delivery partner");
  }
  if (TERMINAL_ORDER_STATUSES.includes(order.status)) throw new OrderPlacementError(400, `Order is already ${order.status}`);
  if (order.status === "Pending" || order.status === "Received") {
    throw new OrderPlacementError(400, "The store has not accepted this order yet. Wait for every store on the order to accept it.");
  }
  if (ORDER_STAGE[order.status] > ORDER_STAGE["Picked up"]) throw new OrderPlacementError(400, `Order is already ${order.status}`);

  await ensurePickupCodes(order._id);
  order = await Order.findById(orderId);
  const stores = await getOrderStoreStops(order);
  const progress: any[] = order.sellerProgress || [];

  // Which store is this code for?
  let match = progress.find((p) => p.pickupCode && p.pickupCode === code && stores.some((s) => s.sellerId === String(p.seller)));
  if (!match && stores.length === 1) {
    // Single-store order: the bill's order number / old 6-character code still works
    const orderNumber = String(order.orderNumber || "").toUpperCase();
    if (code === orderNumber || code === String(order._id).toUpperCase() || (code.length === 6 && code === legacyPickupCodeFor(orderNumber))) {
      match = progress.find((p) => String(p.seller) === stores[0].sellerId);
    }
  }
  if (!match) {
    throw new OrderPlacementError(
      400,
      stores.length > 1
        ? `This code doesn't match any store on order #${order.orderNumber}. Ask the store for its own pickup code.`
        : `This package is not order #${order.orderNumber}. Check the pickup code on the store's bill and try again.`
    );
  }
  const sid = String(match.seller);
  const store = stores.find((s) => s.sellerId === sid)!;

  if (match.pickedUpAt) {
    return { order, store, stores, alreadyPickedUp: true, allPickedUp: stores.every((s) => s.pickedUp), orderPickedUp: false };
  }
  if (!match.readyAt && order.status !== "Ready for pickup") {
    throw new OrderPlacementError(400, `${store.storeName} is still packing their items. Wait until they mark it ready for pickup.`);
  }

  // Take the order if it's still unassigned (the rider must have been offered it, or be near its
  // stores when it was offered to nobody)
  if (!order.deliveryBoy) {
    if (!order.dispatch?.notifiedDeliveryBoys?.length && !(await riderCanServeOrder(rider, order._id))) {
      throw new OrderPlacementError(403, "This order isn't available to you.");
    }
    const claimed = await Order.findOneAndUpdate(
      {
        _id: order._id,
        deliveryBoy: null,
        status: { $in: PICKUP_READY_STATUSES },
        "dispatch.rejectedDeliveryBoys": { $ne: rider },
        $or: [{ "dispatch.notifiedDeliveryBoys.0": { $exists: false } }, { "dispatch.notifiedDeliveryBoys": rider }],
      },
      { $set: { deliveryBoy: rider, deliveryBoyStatus: "Assigned", assignedAt: new Date() } },
      { new: true }
    );
    if (!claimed) {
      const now: any = await Order.findById(order._id).select("deliveryBoy");
      if (!now?.deliveryBoy || String(now.deliveryBoy) !== String(rider)) {
        throw new OrderPlacementError(403, "This order isn't available to you.");
      }
    }
  }

  // Mark only this store's part collected (atomic: a double tap can't mark it twice)
  await Order.updateOne(
    { _id: order._id, deliveryBoy: rider, sellerProgress: { $elemMatch: { seller: match.seller, pickedUpAt: null } } },
    { $set: { "sellerProgress.$.pickedUpAt": new Date(), "sellerProgress.$.pickedUpBy": rider } }
  );

  let fresh: any = await Order.findById(order._id);
  let freshStores = await getOrderStoreStops(fresh);
  const allPickedUp = freshStores.every((s) => s.pickedUp);
  let orderPickedUp = false;
  if (allPickedUp) {
    const moved = await transitionOrderStatus(
      order._id,
      PICKUP_READY_STATUSES,
      "Picked up",
      { deliveryBoyStatus: "Picked Up", pickupVerifiedAt: new Date() },
      { deliveryBoy: rider }
    );
    fresh = moved.order;
    orderPickedUp = moved.changed;
    freshStores = await getOrderStoreStops(fresh);
  }
  clearOrderCache(String(order._id));
  return {
    order: fresh,
    store: freshStores.find((s) => s.sellerId === sid)!,
    stores: freshStores,
    alreadyPickedUp: false,
    allPickedUp,
    orderPickedUp,
  };
};
