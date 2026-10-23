import mongoose from "mongoose";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Product from "../models/Product";
import Customer from "../models/Customer";
import Seller from "../models/Seller";
import { calculateDistance } from "../utils/locationHelper";
import { resolveCartLinePricing } from "../modules/product/cartProductHelper";
import { resolveOrderVariation, reserveVariantStock } from "./orderStockService";
import {
  FIRST_ORDER_OFFER_CODE,
} from "./firstOrderOfferService";
import { getActiveCartRules } from "./cartRuleService";
import {
  CouponError,
  computeOrderTotals,
  calculateDeliveryFee,
  getPlatformFee,
  consumeCoupon,
  getAppSettings,
  resolveCoupon,
  round2,
} from "./orderPricingService";

/** Unpaid online orders hold their stock for this long before it is released. */
export const ONLINE_PAYMENT_WINDOW_MINUTES = 30;
// Checkout shows no handling charge (Checkout.tsx handlingCharge = 0).

const ONLINE_GATEWAYS = ["Razorpay", "Cashfree"];

export class OrderPlacementError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

/** Map checkout payment labels to the values the rest of the system checks. */
export const normalizePaymentMethod = (method: unknown): string => {
  const value = String(method || "").trim();
  if (!value || ["cash", "cod", "cash on delivery"].includes(value.toLowerCase())) return "COD";
  return value;
};

export const isOnlineGateway = (method: string) => ONLINE_GATEWAYS.includes(method);

const isTransactionUnsupported = (error: any) =>
  error?.code === 20 ||
  /Transaction numbers are only allowed|replica set|does not support transactions/i.test(error?.message || "");

/**
 * Run `fn` inside a MongoDB transaction, falling back to running without one on
 * deployments that do not support transactions (standalone local mongod).
 */
export const runInTransaction = async <T>(fn: (session: mongoose.ClientSession | null) => Promise<T>): Promise<T> => {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } catch (error) {
    if (isTransactionUnsupported(error)) return fn(null);
    throw error;
  } finally {
    await session.endSession();
  }
};

interface PlaceOrderInput {
  userId: string;
  body: any;
  online: boolean;
}

const parseCoordinate = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
};

/**
 * Turn a checkout request into a saved Order + OrderItems:
 * prices come from the catalog (same as the cart), stock is reserved per
 * variant, free gifts are checked against active rules, sellers must be
 * approved and in range, and fees/discounts are computed server-side.
 */
export const placeOrder = async (
  { userId, body, online }: PlaceOrderInput,
  session: mongoose.ClientSession | null
) => {
  const { items, address } = body || {};
  const paymentMethod = normalizePaymentMethod(body?.paymentMethod);

  if (!Array.isArray(items) || items.length === 0) {
    throw new OrderPlacementError(400, "Order must have at least one item");
  }
  if (!address) throw new OrderPlacementError(400, "Delivery address is required");
  if (!online && !String(address.city || "").trim()) {
    throw new OrderPlacementError(400, "City is required in delivery address");
  }
  if (!online && !String(address.pincode || "").trim()) {
    throw new OrderPlacementError(400, "Pincode is required in delivery address");
  }
  if (online && !isOnlineGateway(paymentMethod)) {
    throw new OrderPlacementError(400, "Invalid Payment Gateway");
  }
  if (!online && paymentMethod !== "COD") {
    throw new OrderPlacementError(400, "Online payments must be started from the online checkout");
  }

  const deliveryLat = parseCoordinate(address.latitude);
  const deliveryLng = parseCoordinate(address.longitude);
  if (deliveryLat === null || deliveryLng === null) {
    throw new OrderPlacementError(400, "Delivery address location (latitude/longitude) is required");
  }
  if (deliveryLat < -90 || deliveryLat > 90 || deliveryLng < -180 || deliveryLng > 180) {
    throw new OrderPlacementError(400, "Invalid delivery address coordinates");
  }

  const customer = await Customer.findById(userId).session(session);
  if (!customer) throw new OrderPlacementError(404, "Customer not found");

  const settings: any = await getAppSettings();

  const order = new Order({
    customer: new mongoose.Types.ObjectId(userId),
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    deliveryAddress: {
      address: address.address || address.street || "N/A",
      city: address.city || "N/A",
      state: address.state || "",
      pincode: address.pincode || "000000",
      landmark: address.landmark || "",
      latitude: deliveryLat,
      longitude: deliveryLng,
    },
    paymentMethod,
    paymentStatus: "Pending",
    status: online ? "Pending" : "Received",
    subtotal: 0,
    total: 0,
    items: [],
  });

  const orderItemIds: mongoose.Types.ObjectId[] = [];
  const sellerIds = new Set<string>();
  let paidSubtotal = 0;

  const loadOrderableProduct = async (productId: unknown) => {
    if (!productId || !mongoose.isValidObjectId(String(productId))) {
      throw new OrderPlacementError(400, "Invalid item structure: product.id is missing");
    }
    const product: any = await Product.findById(productId).session(session);
    if (!product || product.status !== "Active" || product.publish === false) {
      throw new OrderPlacementError(409, "A product in your cart is no longer available. Please remove it and try again.");
    }
    return product;
  };

  const addOrderItem = async (product: any, variation: any, qty: number, unitPrice: number, label: string, isFreeGift: boolean) => {
    const reserved = await reserveVariantStock(product._id, variation._id, qty, session);
    if (!reserved) return false;

    if (product.seller) sellerIds.add(String(product.seller));
    const orderItem = new OrderItem({
      order: order._id,
      product: product._id,
      seller: product.seller,
      productName: product.productName,
      productImage: variation.mainImage || product.mainImage,
      sku: variation.sku || product.sku,
      unitPrice,
      quantity: qty,
      total: round2(unitPrice * qty),
      variation: label,
      variantId: variation._id,
      isFreeGift,
      status: "Pending",
    });
    await orderItem.save({ session: session || undefined });
    orderItemIds.push(orderItem._id as mongoose.Types.ObjectId);
    return true;
  };

  // 1. Paid items — priced exactly like the server cart
  for (const item of items.filter((i: any) => !i?.isFreeGift)) {
    const qty = Number(item?.quantity) || 0;
    if (!Number.isInteger(qty) || qty <= 0) throw new OrderPlacementError(400, "Invalid item quantity");

    const product = await loadOrderableProduct(item?.product?.id || item?.product?._id);
    const variation = resolveOrderVariation(product, item.variantId, item.variant ?? item.variation);
    if (!variation) {
      throw new OrderPlacementError(409, `${product.productName} is not available for sale`);
    }
    const pricing = resolveCartLinePricing(product, { variantId: String(variation._id) });

    const ok = await addOrderItem(product, variation, qty, pricing.unitPrice, pricing.variationLabel || variation.value, false);
    if (!ok) {
      throw new OrderPlacementError(
        409,
        `Insufficient stock for ${product.productName} (${variation.value}). Please update your cart.`
      );
    }
    paidSubtotal += pricing.unitPrice * qty;
  }
  paidSubtotal = round2(paidSubtotal);

  // 2. Free gifts — only honoured when an active rule grants that product for this cart value
  const cartRules = await getActiveCartRules();
  const giftRules = cartRules.filter(
    (rule: any) => (rule.ruleType || "free_gift") === "free_gift" && rule.giftProductId && paidSubtotal >= Number(rule.minCartValue || 0)
  );
  const grantedGiftIds = new Set<string>();
  for (const item of items.filter((i: any) => i?.isFreeGift)) {
    const productId = String(item?.product?.id || item?.product?._id || "");
    if (grantedGiftIds.has(productId) || !giftRules.some((r: any) => String(r.giftProductId) === productId)) {
      console.warn(`[placeOrder] Ignoring free gift ${productId}: no matching active rule for cart value ${paidSubtotal}`);
      continue;
    }
    const product: any = await Product.findById(productId).session(session);
    const variation = product ? resolveOrderVariation(product, item.variantId, item.variant ?? item.variation) : undefined;
    if (!product || !variation) continue;
    const added = await addOrderItem(product, variation, 1, 0, `${variation.variationType || "Standard"}: ${variation.value}`, true);
    if (added) grantedGiftIds.add(productId);
    else console.warn(`[placeOrder] Free gift ${product.productName} is out of stock; order placed without it`);
  }

  if (orderItemIds.length === 0) throw new OrderPlacementError(400, "Order must have at least one item");

  // 3. Every seller must be approved and deliver to this address
  if (sellerIds.size > 0) {
    const sellers = await Seller.find({ _id: { $in: Array.from(sellerIds) } }).session(session);
    for (const sellerId of sellerIds) {
      const seller: any = sellers.find((s: any) => String(s._id) === sellerId);
      if (!seller || seller.status !== "Approved") {
        throw new OrderPlacementError(403, "A store in your cart is not accepting orders right now. Please remove its items.");
      }
      const coords = seller.location?.coordinates;
      if (!coords || coords.length < 2) {
        throw new OrderPlacementError(403, `Seller ${seller.storeName} does not have a valid location. Order cannot be placed.`);
      }
      const distance = calculateDistance(deliveryLat, deliveryLng, coords[1], coords[0]);
      const serviceRadius = seller.serviceRadiusKm || 10;
      if (distance > serviceRadius) {
        throw new OrderPlacementError(
          403,
          `Your delivery address is ${distance.toFixed(2)} km away from ${seller.storeName}. They only deliver within ${serviceRadius} km. Please select products from sellers in your area.`
        );
      }
    }
  }

  // 4. Totals — the same function the checkout quote uses, so the amount shown is the amount charged
  const subtotalForCoupon = paidSubtotal + getPlatformFee(settings) + calculateDeliveryFee(settings, paidSubtotal);
  let couponDiscount = 0;
  let couponCode: string | undefined;
  if (body?.couponCode) {
    try {
      const { coupon, discount } = await resolveCoupon(body.couponCode, subtotalForCoupon, userId, session);
      await consumeCoupon(coupon._id as mongoose.Types.ObjectId, session);
      couponDiscount = discount;
      couponCode = coupon.code;
    } catch (error) {
      if (error instanceof CouponError) throw new OrderPlacementError(400, `Coupon not applied: ${error.message}`);
      throw error;
    }
  }

  const totals = computeOrderTotals({
    paidSubtotal,
    settings,
    customer,
    cartRules,
    couponDiscount,
    tipAmount: body?.tipAmount,
    giftPackaging: body?.giftPackaging,
    online,
  });

  order.subtotal = totals.subtotal;
  order.shipping = totals.deliveryFee;
  order.platformFee = totals.platformFee;
  order.tipAmount = totals.tipAmount;
  order.giftPackagingFee = totals.giftPackagingFee;
  order.couponDiscount = totals.couponDiscount;
  order.discount = totals.totalDiscount;
  order.couponCode = couponCode || (totals.firstOrderDiscount > 0 ? FIRST_ORDER_OFFER_CODE : undefined);
  order.total = totals.total;
  order.items = orderItemIds;

  if (online) {
    order.paymentGateway = paymentMethod;
    order.paymentExpiresAt = new Date(Date.now() + ONLINE_PAYMENT_WINDOW_MINUTES * 60 * 1000);
  }

  await order.save({ session: session || undefined });

  // Online orders count towards the customer's history only once paid
  if (!online) {
    await Customer.findByIdAndUpdate(
      userId,
      { $inc: { totalOrders: 1, totalSpent: order.total } },
      { session: session || undefined }
    );
  }

  return { order, customer };
};


/**
 * What the checkout screen shows: the cart priced exactly as placeOrder would charge it.
 * Reads only — no stock is reserved, no coupon is consumed, nothing is saved. The checkout page
 * displays these numbers, so the amount shown is always the amount that will be taken.
 */
export const quoteOrder = async (userId: string, body: any) => {
  const items = Array.isArray(body?.items) ? body.items : [];
  const online = isOnlineGateway(normalizePaymentMethod(body?.paymentMethod));
  const customer = await Customer.findById(userId).lean();
  if (!customer) throw new OrderPlacementError(404, "Customer not found");
  const settings: any = await getAppSettings();

  const lines: Array<{
    productId: string;
    variantId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    mrp: number;
    isFreeGift: boolean;
    unavailable?: string;
  }> = [];
  let paidSubtotal = 0;

  for (const item of items.filter((i: any) => !i?.isFreeGift)) {
    const qty = Number(item?.quantity) || 0;
    const productId = String(item?.product?.id || item?.product?._id || "");
    const name = item?.product?.productName || item?.product?.name || "Item";
    if (!mongoose.isValidObjectId(productId) || !Number.isInteger(qty) || qty <= 0) {
      lines.push({ productId, name, quantity: qty, unitPrice: 0, lineTotal: 0, mrp: 0, isFreeGift: false, unavailable: "This item can't be ordered" });
      continue;
    }
    const product: any = await Product.findById(productId).lean();
    if (!product || product.status !== "Active" || product.publish === false) {
      lines.push({ productId, name, quantity: qty, unitPrice: 0, lineTotal: 0, mrp: 0, isFreeGift: false, unavailable: "No longer available" });
      continue;
    }
    const variation = resolveOrderVariation(product, item.variantId, item.variant ?? item.variation);
    if (!variation) {
      lines.push({ productId, name: product.productName, quantity: qty, unitPrice: 0, lineTotal: 0, mrp: 0, isFreeGift: false, unavailable: "This option is no longer sold" });
      continue;
    }
    const pricing = resolveCartLinePricing(product, { variantId: String(variation._id) });
    const lineTotal = round2(pricing.unitPrice * qty);
    lines.push({
      productId,
      variantId: String(variation._id),
      name: product.productName,
      quantity: qty,
      unitPrice: pricing.unitPrice,
      lineTotal,
      mrp: Number(variation.compareAtPrice) || Number(variation.price) || pricing.unitPrice,
      isFreeGift: false,
      ...(Number(variation.stock) < qty ? { unavailable: `Only ${Number(variation.stock) || 0} left in stock` } : {}),
    });
    paidSubtotal += pricing.unitPrice * qty;
  }
  paidSubtotal = round2(paidSubtotal);

  const cartRules = await getActiveCartRules();
  for (const item of items.filter((i: any) => i?.isFreeGift)) {
    const productId = String(item?.product?.id || item?.product?._id || "");
    const granted = cartRules.some(
      (rule: any) =>
        (rule.ruleType || "free_gift") === "free_gift" &&
        String(rule.giftProductId) === productId &&
        paidSubtotal >= Number(rule.minCartValue || 0)
    );
    if (!granted) continue;
    const product: any = await Product.findById(productId).lean();
    if (!product) continue;
    lines.push({ productId, name: product.productName, quantity: 1, unitPrice: 0, lineTotal: 0, mrp: 0, isFreeGift: true });
  }

  // A coupon is only checked here, never used up: that happens when the order is placed
  let couponDiscount = 0;
  let couponError: string | undefined;
  if (body?.couponCode) {
    const subtotalForCoupon = paidSubtotal + getPlatformFee(settings) + calculateDeliveryFee(settings, paidSubtotal);
    try {
      const { discount } = await resolveCoupon(body.couponCode, subtotalForCoupon, userId, null);
      couponDiscount = discount;
    } catch (error) {
      couponError = error instanceof CouponError ? error.message : "Coupon could not be applied";
    }
  }

  const totals = computeOrderTotals({
    paidSubtotal,
    settings,
    customer,
    cartRules,
    couponDiscount,
    tipAmount: body?.tipAmount,
    giftPackaging: body?.giftPackaging,
    online,
  });

  return {
    items: lines,
    /** Total of the items at MRP, for showing how much the customer saves */
    mrpTotal: round2(lines.reduce((sum, l) => sum + (l.isFreeGift ? 0 : l.mrp * l.quantity), 0)),
    ...totals,
    couponError,
    /** Lines that cannot be ordered right now; placing the order would fail */
    blocking: lines.filter((l) => l.unavailable).map((l) => `${l.name}: ${l.unavailable}`),
  };
};
