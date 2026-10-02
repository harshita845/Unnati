import mongoose from "mongoose";
import AppSettings from "../models/AppSettings";
import Coupon from "../models/Coupon";
import Order from "../models/Order";

// Defaults mirror customerConfigController.getPublicConfig, which the checkout page uses.
const DEFAULT_DELIVERY_FEE = 40;
const DEFAULT_FREE_DELIVERY_THRESHOLD = 199;

/** Gift packaging fee charged when the customer opts in at checkout (matches Checkout.tsx). */
export const GIFT_PACKAGING_FEE = 30;
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
