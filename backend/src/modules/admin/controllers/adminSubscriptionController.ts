import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler";
import Category from "../../../models/Category";
import SubscriptionPlan, { PLAN_DURATION_UNITS } from "../../../models/SubscriptionPlan";
import SellerSubscription from "../../../models/SellerSubscription";
import {
  SubscriptionError,
  adminActivatePlan,
  adminCancelSubscription,
  adminExtendSubscription,
  adminGrantTrial,
  adminUpdateDates,
  getSubscriptionSettings,
} from "../../../services/sellerSubscriptionService";

const handle = (res: Response, error: any) => {
  if (error instanceof SubscriptionError) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  if (error?.name === "ValidationError") {
    const message = Object.values(error.errors || {}).map((e: any) => e.message).join(", ");
    return res.status(400).json({ success: false, message: message || error.message });
  }
  throw error;
};

const toNumberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
};

/** Validate and normalise a plan from the request body. */
const parsePlanBody = async (body: any) => {
  const errors: string[] = [];
  const name = String(body.name || "").trim();
  if (!name) errors.push("Plan name is required");

  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) errors.push("Price must be 0 or more");

  const durationValue = Number(body.durationValue);
  if (!Number.isInteger(durationValue) || durationValue < 1) errors.push("Duration must be a whole number of at least 1");
  const durationUnit = String(body.durationUnit || "");
  if (!(PLAN_DURATION_UNITS as readonly string[]).includes(durationUnit)) errors.push("Duration unit must be day, month or year");

  const categoryIds: string[] = Array.isArray(body.categories) ? body.categories.map(String) : [];
  if (!categoryIds.length) errors.push("Select at least one category");
  if (categoryIds.some((id) => !mongoose.isValidObjectId(id))) errors.push("Invalid category selected");
  else if (categoryIds.length) {
    const found = await Category.countDocuments({ _id: { $in: categoryIds } });
    if (found !== new Set(categoryIds).size) errors.push("One or more categories no longer exist");
  }

  const features = (Array.isArray(body.features) ? body.features : [])
    .map((f: unknown) => String(f || "").trim())
    .filter(Boolean)
    .slice(0, 30);

  const maxProducts = toNumberOrNull(body.limits?.maxProducts);
  if (Number.isNaN(maxProducts) || (maxProducts !== null && (!Number.isInteger(maxProducts) || maxProducts < 1))) {
    errors.push("Max products must be a whole number of at least 1 (leave empty for unlimited)");
  }
  const commissionPercent = toNumberOrNull(body.limits?.commissionPercent);
  if (Number.isNaN(commissionPercent) || (commissionPercent !== null && (commissionPercent < 0 || commissionPercent > 100))) {
    errors.push("Commission must be between 0 and 100 (leave empty to use the seller's normal rate)");
  }

  return {
    errors,
    data: {
      name,
      description: String(body.description || "").trim(),
      price,
      durationValue,
      durationUnit,
      categories: [...new Set(categoryIds)],
      features,
      limits: { maxProducts, commissionPercent, featuredStore: !!body.limits?.featuredStore },
      isActive: body.isActive === undefined ? true : !!body.isActive,
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    },
  };
};

// ---------- Settings ----------

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  return res.status(200).json({ success: true, data: await getSubscriptionSettings() });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await getSubscriptionSettings();
  const { graceDays, trialDays, reminderDays, paymentMethods, gstPercent, invoiceEnabled, invoicePrefix } = req.body;
  try {
    if (graceDays !== undefined) settings.graceDays = Number(graceDays);
    if (trialDays !== undefined) settings.trialDays = Number(trialDays);
    if (reminderDays !== undefined) {
      if (!Array.isArray(reminderDays) || reminderDays.some((d: unknown) => !Number.isInteger(Number(d)) || Number(d) < 1 || Number(d) > 90)) {
        return res.status(400).json({ success: false, message: "Reminder days must be whole numbers between 1 and 90" });
      }
      settings.reminderDays = [...new Set(reminderDays.map(Number))].sort((a, b) => b - a);
    }
    if (paymentMethods) {
      const next = {
        online: paymentMethods.online ?? settings.paymentMethods.online,
        manual: paymentMethods.manual ?? settings.paymentMethods.manual,
        wallet: paymentMethods.wallet ?? settings.paymentMethods.wallet,
      };
      if (!next.online && !next.manual && !next.wallet) {
        return res.status(400).json({ success: false, message: "Keep at least one payment method enabled" });
      }
      settings.paymentMethods = { online: !!next.online, manual: !!next.manual, wallet: !!next.wallet };
    }
    if (gstPercent !== undefined) settings.gstPercent = Number(gstPercent);
    if (invoiceEnabled !== undefined) settings.invoiceEnabled = !!invoiceEnabled;
    if (invoicePrefix !== undefined) settings.invoicePrefix = String(invoicePrefix).trim().toUpperCase().slice(0, 10) || "SUB";
    if (req.user?.userId) settings.updatedBy = new mongoose.Types.ObjectId(req.user.userId);
    await settings.save();
  } catch (error) {
    return handle(res, error);
  }
  return res.status(200).json({ success: true, message: "Subscription settings saved", data: settings });
});

// ---------- Plans ----------

export const listPlans = asyncHandler(async (_req: Request, res: Response) => {
  const plans = await SubscriptionPlan.find()
    .populate("categories", "name subscriptionEnabled subscriptionGraceDays subscriptionBillType")
    .sort({ sortOrder: 1, createdAt: -1 })
    .lean();
  const counts = await SellerSubscription.aggregate([
    { $match: { status: "Active", plan: { $ne: null } } },
    { $group: { _id: "$plan", count: { $sum: 1 } } },
  ]);
  const activeCount: Record<string, number> = Object.fromEntries(counts.map((c: any) => [String(c._id), c.count]));
  return res.status(200).json({
    success: true,
    data: plans.map((p: any) => ({ ...p, activeSubscribers: activeCount[String(p._id)] || 0 })),
  });
});

export const createPlan = asyncHandler(async (req: Request, res: Response) => {
  const { errors, data } = await parsePlanBody(req.body);
  if (errors.length) return res.status(400).json({ success: false, message: errors.join(". ") });
  try {
    const plan = await SubscriptionPlan.create({ ...data, createdBy: req.user?.userId });
    return res.status(201).json({ success: true, message: "Plan created", data: plan });
  } catch (error) {
    return handle(res, error);
  }
});

export const updatePlan = asyncHandler(async (req: Request, res: Response) => {
  const { errors, data } = await parsePlanBody(req.body);
  if (errors.length) return res.status(400).json({ success: false, message: errors.join(". ") });
  try {
    // Sellers keep what they already bought (stored on their subscription); changes apply to new purchases
    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
    return res.status(200).json({ success: true, message: "Plan updated", data: plan });
  } catch (error) {
    return handle(res, error);
  }
});

export const deletePlan = asyncHandler(async (req: Request, res: Response) => {
  const used = await SellerSubscription.exists({ plan: req.params.id });
  if (used) {
    // Keep history intact: a plan sellers have bought is switched off instead of deleted
    await SubscriptionPlan.findByIdAndUpdate(req.params.id, { isActive: false });
    return res.status(200).json({ success: true, message: "Plan has subscribers, so it was deactivated instead of deleted" });
  }
  const deleted = await SubscriptionPlan.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, message: "Plan not found" });
  return res.status(200).json({ success: true, message: "Plan deleted" });
});

// ---------- Seller subscriptions ----------

export const listSubscriptions = asyncHandler(async (req: Request, res: Response) => {
  const { status, sellerId, planId, expiringInDays, page = "1", limit = "20" } = req.query;
  const query: any = { status: { $ne: "PendingPayment" } };
  if (status && status !== "All") query.status = status;
  if (sellerId && mongoose.isValidObjectId(String(sellerId))) query.seller = sellerId;
  if (planId && mongoose.isValidObjectId(String(planId))) query.plan = planId;
  if (expiringInDays) {
    const days = Number(expiringInDays);
    query.status = "Active";
    query.endDate = { $gt: new Date(), $lte: new Date(Date.now() + days * 24 * 60 * 60 * 1000) };
  }
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));

  const [items, total, stats] = await Promise.all([
    SellerSubscription.find(query)
      .populate("seller", "storeName sellerName mobile city")
      .populate("categories", "name")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    SellerSubscription.countDocuments(query),
    SellerSubscription.aggregate([
      { $match: { status: { $in: ["Active", "Expired", "Cancelled"] } } },
      {
        $group: {
          _id: null,
          active: { $sum: { $cond: [{ $eq: ["$status", "Active"] }, 1, 0] } },
          expired: { $sum: { $cond: [{ $eq: ["$status", "Expired"] }, 1, 0] } },
          trials: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "Active"] }, "$isTrial"] }, 1, 0] } },
          revenue: { $sum: { $cond: [{ $ne: ["$payment.method", "Trial"] }, "$payment.totalAmount", 0] } },
        },
      },
    ]),
  ]);

  return res.status(200).json({
    success: true,
    data: items,
    stats: stats[0] || { active: 0, expired: 0, trials: 0, revenue: 0 },
    pagination: { page: pageNum, limit: pageSize, total, pages: Math.ceil(total / pageSize) },
  });
});

/** Activate a plan for a seller paying by cash / bank transfer; optional custom start and end dates. */
export const activateForSeller = asyncHandler(async (req: Request, res: Response) => {
  const { sellerId, planId, reference, startDate, endDate } = req.body;
  try {
    const subscription = await adminActivatePlan(req.user?.userId, sellerId, planId, reference, { startDate, endDate });
    return res.status(201).json({ success: true, message: "Plan activated for seller", data: subscription });
  } catch (error) {
    return handle(res, error);
  }
});

/** Free trial for a seller with Super Admin's chosen categories and dates. */
export const grantTrial = asyncHandler(async (req: Request, res: Response) => {
  const { sellerId, categories, startDate, endDate } = req.body;
  try {
    const trial = await adminGrantTrial(req.user?.userId, sellerId, categories, startDate, endDate);
    return res.status(201).json({ success: true, message: "Free trial granted", data: trial });
  } catch (error) {
    return handle(res, error);
  }
});

export const updateDates = asyncHandler(async (req: Request, res: Response) => {
  try {
    const subscription = await adminUpdateDates(req.params.id, req.body.startDate, req.body.endDate);
    return res.status(200).json({ success: true, message: "Dates updated", data: subscription });
  } catch (error) {
    return handle(res, error);
  }
});

export const extendSubscription = asyncHandler(async (req: Request, res: Response) => {
  try {
    const subscription = await adminExtendSubscription(req.params.id, Number(req.body.days));
    return res.status(200).json({ success: true, message: "Subscription extended", data: subscription });
  } catch (error) {
    return handle(res, error);
  }
});

export const cancelSubscription = asyncHandler(async (req: Request, res: Response) => {
  try {
    const subscription = await adminCancelSubscription(req.params.id, req.body?.reason);
    return res.status(200).json({ success: true, message: "Subscription cancelled", data: subscription });
  } catch (error) {
    return handle(res, error);
  }
});
