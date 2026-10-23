import mongoose from "mongoose";
import AppSettings from "../models/AppSettings";
import Coupon from "../models/Coupon";
import Order from "../models/Order";
import { resolveFirstOrderOfferDiscount } from "./firstOrderOfferService";
import { calculateCartRuleDiscount } from "./cartRuleService";

// Used only when the store has no settings saved yet.
const DEFAULT_DELIVERY_FEE = 40;
const DEFAULT_FREE_DELIVERY_THRESHOLD = 199;
const DEFAULT_PLATFORM_FEE = 0;
const DEFAULT_GIFT_PACKAGING_FEE = 30;

const feeFrom = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/**
 * The fees every screen must agree on. Read from the store's settings so the checkout quote,
 * the placed order and the public config can never charge different amounts.
 */
export const getPlatformFee = (settings: any): number => feeFrom(settings?.platformFee, DEFAULT_PLATFORM_FEE);
export const getGiftPackagingFee = (settings: any): number => feeFrom(settings?.giftPackagingFee, DEFAULT_GIFT_PACKAGING_FEE);
const MAX_TIP_AMOUNT = 1000;

export class CouponError extends Error {}

const round2 = (n: number) => Number((Math.round(n * 100) / 100).toFixed(2));

/** Delivery fee for a paid-items subtotal, using the same settings the checkout shows. */
export const calculateDeliveryFee = (settings: any, paidSubtotal: number): number => {
  const deliveryFee = settings ? settings.deliveryCharges ?? DEFAULT_DELIVERY_FEE : DEFAULT_DELIVERY_FEE;
  const threshold = settings
    ? settings.freeDeliveryThreshold ?? DEFAULT_FREE_DELIVERY_THRESHOLD
    : DEFAULT_FREE_DELIVERY_THRESHOLD;
  return paidSubtotal >= threshold ? 0 : Number(deliveryFee) || 0;
};

export const sanitizeTip = (tip: unknown): number => {
  const value = Number(tip);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return round2(Math.min(value, MAX_TIP_AMOUNT));
};

export const calculateCouponDiscount = (coupon: any, orderTotal: number): number => {
  if (!coupon || orderTotal <= 0) return 0;
  let discount = 0;
  if (String(coupon.discountType).toLowerCase() === "percentage") {
    discount = Math.round((orderTotal * Number(coupon.discountValue || 0)) / 100);
    if (coupon.maximumDiscount && discount > coupon.maximumDiscount) {
      discount = coupon.maximumDiscount;
    }
  } else {
    discount = Number(coupon.discountValue) || 0;
  }
  return Math.min(round2(discount), orderTotal);
};

/**
 * Validate a coupon for a customer and order total. Throws CouponError with a
 * customer-facing message when the coupon cannot be used.
 */
export const resolveCoupon = async (
  code: string,
  orderTotal: number,
  customerId?: string,
  session?: mongoose.ClientSession | null
) => {
  const coupon = await Coupon.findOne({ code: String(code).toUpperCase().trim(), isActive: true }).session(
    session || null
  );
  if (!coupon) throw new CouponError("Invalid coupon code");

  const now = new Date();
  if (now < coupon.startDate || now > coupon.endDate) {
    throw new CouponError("Coupon has expired");
  }
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    throw new CouponError("Coupon usage limit reached");
  }
  if (coupon.minimumPurchase && orderTotal < coupon.minimumPurchase) {
    throw new CouponError(`Minimum order value of ₹${coupon.minimumPurchase} required`);
  }
  if (customerId && coupon.usageLimitPerUser) {
    const used = await Order.countDocuments({
      customer: customerId,
      couponCode: coupon.code,
      status: { $nin: ["Cancelled", "Rejected"] },
    }).session(session || null);
    if (used >= coupon.usageLimitPerUser) {
      throw new CouponError("You have already used this coupon");
    }
  }

  return { coupon, discount: calculateCouponDiscount(coupon, orderTotal) };
};

/** Count one use of a coupon; fails if the global limit was reached concurrently. */
export const consumeCoupon = async (couponId: mongoose.Types.ObjectId, session?: mongoose.ClientSession | null) => {
  const updated = await Coupon.findOneAndUpdate(
    {
      _id: couponId,
      $or: [
        { usageLimit: { $exists: false } },
        { usageLimit: null },
        { usageLimit: 0 },
        { $expr: { $lt: ["$usageCount", "$usageLimit"] } },
      ],
    },
    { $inc: { usageCount: 1 } },
    { new: true, session: session || undefined }
  );
  if (!updated) throw new CouponError("Coupon usage limit reached");
};

export const getAppSettings = async () => AppSettings.findOne().lean();

export { round2 };

/**
 * Every charge on an order, worked out in one place.
 *
 * The checkout quote and the order that is actually charged both call this, so the amount the
 * customer is shown can never differ from the amount taken. Inputs are the priced items subtotal
 * and the customer's choices; everything else (fees, offers) comes from the store's settings.
 */
export interface OrderTotalsInput {
  paidSubtotal: number;
  settings: any;
  /** Decides whether the first-order offer applies */
  customer: any;
  cartRules: any[];
  couponDiscount?: number;
  tipAmount?: number;
  giftPackaging?: boolean;
  /** Online payments may carry their own discount */
  online?: boolean;
}

export interface OrderTotals {
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  tipAmount: number;
  giftPackagingFee: number;
  firstOrderDiscount: number;
  cartRuleDiscount: number;
  couponDiscount: number;
  onlineDiscount: number;
  /** Every discount added up (what order.discount stores) */
  totalDiscount: number;
  /** What the customer pays */
  total: number;
}

export const computeOrderTotals = (input: OrderTotalsInput): OrderTotals => {
  const { settings, customer, cartRules } = input;
  const paidSubtotal = round2(Number(input.paidSubtotal) || 0);
  const deliveryFee = calculateDeliveryFee(settings, paidSubtotal);
  const platformFee = getPlatformFee(settings);
  const subtotalBeforeCoupon = paidSubtotal + platformFee + deliveryFee;

  const firstOrderDiscount = resolveFirstOrderOfferDiscount(settings?.firstOrderOffer, customer, subtotalBeforeCoupon);
  const cartRuleDiscount = calculateCartRuleDiscount(
    cartRules || [],
    paidSubtotal,
    Math.max(0, subtotalBeforeCoupon - firstOrderDiscount)
  );
  const couponDiscount = round2(Number(input.couponDiscount) || 0);
  const tipAmount = sanitizeTip(input.tipAmount);
  const giftPackagingFee = input.giftPackaging ? getGiftPackagingFee(settings) : 0;

  const totalBeforeOnlineDiscount = Math.max(
    0,
    subtotalBeforeCoupon + tipAmount + giftPackagingFee - firstOrderDiscount - cartRuleDiscount - couponDiscount
  );
  const onlineConfig = settings?.onlinePaymentDiscount;
  const onlineDiscount =
    input.online && onlineConfig?.enabled && Number(onlineConfig?.percentage) > 0
      ? round2((totalBeforeOnlineDiscount * Number(onlineConfig.percentage)) / 100)
      : 0;

  return {
    subtotal: paidSubtotal,
    deliveryFee,
    platformFee,
    tipAmount,
    giftPackagingFee,
    firstOrderDiscount: round2(firstOrderDiscount),
    cartRuleDiscount: round2(cartRuleDiscount),
    couponDiscount,
    onlineDiscount,
    totalDiscount: round2(firstOrderDiscount + cartRuleDiscount + couponDiscount + onlineDiscount),
    total: round2(Math.max(0, totalBeforeOnlineDiscount - onlineDiscount)),
  };
};
