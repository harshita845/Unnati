import mongoose from "mongoose";
import type { Server as SocketIOServer } from "socket.io";
import Category from "../models/Category";
import Product from "../models/Product";
import Seller from "../models/Seller";
import Notification from "../models/Notification";
import WalletTransaction from "../models/WalletTransaction";
import SubscriptionPlan from "../models/SubscriptionPlan";
import SellerSubscription, { ISellerSubscription } from "../models/SellerSubscription";
import SubscriptionSettings, { ISubscriptionSettings } from "../models/SubscriptionSettings";
import { createRazorpayOrder, isValidRazorpaySignature } from "./paymentGatewayService";

const DAY_MS = 24 * 60 * 60 * 1000;

export class SubscriptionError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

// Socket.IO instance for live seller notifications (set from server.ts)
let io: SocketIOServer | null = null;
export const setSubscriptionSocket = (server: SocketIOServer) => {
  io = server;
};

export const getSubscriptionSettings = () => SubscriptionSettings.getSettings();

const idStr = (value: unknown) => String((value as any)?._id || value || "");
const toId = (value: unknown) => new mongoose.Types.ObjectId(idStr(value));
const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtDate = (d?: Date | null) => (d ? d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }) : "");

/** End date for a plan duration starting at `start` (calendar months/years). */
export const computeEndDate = (start: Date, value: number, unit: string): Date => {
  const end = new Date(start);
  if (unit === "year") end.setFullYear(end.getFullYear() + value);
  else if (unit === "month") end.setMonth(end.getMonth() + value);
  else end.setTime(end.getTime() + value * DAY_MS);
  return end;
};

/** Validate a custom start/end pair chosen by Super Admin. */
export const parseDateRange = (start: unknown, end: unknown) => {
  const startDate = new Date(String(start || ""));
  const endDate = new Date(String(end || ""));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new SubscriptionError(400, "Choose a valid start date and end date");
  }
  if (endDate <= startDate) throw new SubscriptionError(400, "End date must be after the start date");
  if (endDate <= new Date()) throw new SubscriptionError(400, "End date must be in the future");
  return { startDate, endDate };
};

const notifySeller = async (
  sellerId: unknown,
  title: string,
  message: string,
  type: "Info" | "Success" | "Warning" | "Payment" = "Info",
  priority: "Low" | "Medium" | "High" | "Urgent" = "Medium"
) => {
  try {
    await Notification.create({
      recipientType: "Seller",
      recipientId: toId(sellerId),
      title,
      message,
      type,
      priority,
      link: "/seller/subscriptions",
      actionLabel: "View subscription",
    });
    io?.to(`seller-${idStr(sellerId)}`).emit("seller-notification", {
      type: "SUBSCRIPTION",
      title,
      message,
      link: "/seller/subscriptions",
    });
  } catch (error) {
    console.error("Subscription notification failed:", error);
  }
};

// ----------------------------------------------------------------------------
// Category rules (Super Admin decides per category)
// ----------------------------------------------------------------------------

/** Whether the category needs a plan, its grace period and its bill type (category value or global default). */
export const getCategoryRules = async (categoryId: unknown, settings?: ISubscriptionSettings) => {
  const s = settings || (await getSubscriptionSettings());
  if (!categoryId || !mongoose.isValidObjectId(idStr(categoryId))) {
    return { required: false, graceDays: s.graceDays, billType: (s.invoiceEnabled ? "gst" : "receipt") as "gst" | "receipt" };
  }
  const category: any = await Category.findById(idStr(categoryId))
    .select("subscriptionEnabled subscriptionGraceDays subscriptionBillType")
    .lean();
  return {
    required: !!category?.subscriptionEnabled,
    graceDays: typeof category?.subscriptionGraceDays === "number" ? category.subscriptionGraceDays : s.graceDays,
    billType: (category?.subscriptionBillType || (s.invoiceEnabled ? "gst" : "receipt")) as "gst" | "receipt",
  };
};

/** A plan / subscription covering several categories bills with GST if any of them uses GST invoices. */
const billTypeFor = async (categoryIds: unknown[], settings: ISubscriptionSettings) => {
  for (const id of categoryIds) {
    if ((await getCategoryRules(id, settings)).billType === "gst") return "gst" as const;
  }
  return "receipt" as const;
};

// ----------------------------------------------------------------------------
// Access checks
// ----------------------------------------------------------------------------

/**
 * Does the seller currently have access to sell in this category?
 * Access = an active (or expired but still within this category's grace period) subscription that covers it.
 */
export const getCategoryAccess = async (sellerId: unknown, categoryId: unknown) => {
  const rules = await getCategoryRules(categoryId);
  if (!rules.required) return { required: false, allowed: true as const, graceDays: rules.graceDays };

  const now = new Date();
  const subscription = await SellerSubscription.findOne({
    seller: toId(sellerId),
    status: { $in: ["Active", "Expired"] },
    startDate: { $lte: now },
    endDate: { $gt: new Date(now.getTime() - rules.graceDays * DAY_MS) },
    categories: toId(categoryId),
  }).sort({ endDate: -1 });

  if (!subscription) return { required: true, allowed: false as const, graceDays: rules.graceDays };
  const inGrace = !!subscription.endDate && subscription.endDate <= now;
  return { required: true, allowed: true as const, subscription, inGrace, graceDays: rules.graceDays };
};

/**
 * Called before a seller adds a product to (or moves a product into) a category.
 * Throws when the category needs a plan the seller doesn't have, or the plan's product limit is reached.
 */
export const assertSellerCanListProduct = async (sellerId: unknown, categoryId: unknown, excludeProductId?: unknown) => {
  const access = await getCategoryAccess(sellerId, categoryId);
  if (!access.required) return;
  if (!access.allowed) {
    throw new SubscriptionError(403, "This category needs an active subscription plan. Go to Subscriptions to buy or renew a plan.");
  }
  const maxProducts = access.subscription?.planSnapshot?.limits?.maxProducts;
  if (maxProducts) {
    const count = await Product.countDocuments({
      seller: toId(sellerId),
      category: { $in: access.subscription!.categories },
      ...(excludeProductId ? { _id: { $ne: toId(excludeProductId) } } : {}),
    });
    if (count >= maxProducts) {
      throw new SubscriptionError(
        403,
        `Your plan "${access.subscription!.planSnapshot.name}" allows up to ${maxProducts} products in these categories. Upgrade your plan to add more.`
      );
    }
  }
};

/** Commission % from the seller's active plan for this category, or null to use the seller's normal rate. */
export const getCommissionOverride = async (sellerId: unknown, categoryId: unknown): Promise<number | null> => {
  const access = await getCategoryAccess(sellerId, categoryId);
  const value = access.allowed && access.required ? access.subscription?.planSnapshot?.limits?.commissionPercent : null;
  return typeof value === "number" ? value : null;
};

/** Sellers with an active plan that includes "featured store". */
export const getFeaturedSellerIds = async (): Promise<string[]> => {
  const now = new Date();
  const ids = await SellerSubscription.distinct("seller", {
    status: "Active",
    startDate: { $lte: now },
    endDate: { $gt: now },
    "planSnapshot.limits.featuredStore": true,
  });
  return ids.map((id: any) => String(id));
};

// ----------------------------------------------------------------------------
// Visibility of seller products when access lapses / returns
// ----------------------------------------------------------------------------

/** Hide or show the seller's products in these categories according to current access. */
export const syncSellerCategoryVisibility = async (sellerId: unknown, categoryIds: unknown[]) => {
  for (const categoryId of categoryIds) {
    const access = await getCategoryAccess(sellerId, categoryId);
    await Product.updateMany(
      { seller: toId(sellerId), category: toId(categoryId) },
      { $set: { subscriptionHidden: !access.allowed } }
    );
  }
};

const createTrial = async (
  sellerId: unknown,
  categoryIds: unknown[],
  startDate: Date,
  endDate: Date,
  activatedBy: { type: "Admin" | "System"; id?: unknown }
) => {
  const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS));
  return SellerSubscription.create({
    seller: toId(sellerId),
    plan: null,
    planSnapshot: { name: "Free Trial", price: 0, durationValue: days, durationUnit: "day", features: [], limits: { featuredStore: false } },
    categories: categoryIds.map(toId),
    isTrial: true,
    status: "Active",
    startDate,
    endDate,
    billType: "receipt",
    payment: { method: "Trial", baseAmount: 0, gstPercent: 0, gstAmount: 0, totalAmount: 0, paidAt: new Date() },
    activatedBy: { type: activatedBy.type, id: activatedBy.id ? toId(activatedBy.id) : undefined },
  });
};

/**
 * Category "subscription required" switched on or off.
 * On, Super Admin chooses what existing sellers get:
 *   - trial: { startDate, endDate } -> free trial for those dates
 *   - trial: null                   -> no trial: they must buy a plan now (products hidden until they do)
 *   - (not given)                   -> free trial of the default trial days from today
 * Off: all products in the category become visible again.
 */
export const onCategorySubscriptionChanged = async (
  categoryId: unknown,
  enabled: boolean,
  options?: { trial?: { startDate: Date; endDate: Date } | null; adminId?: unknown }
) => {
  const catId = toId(categoryId);
  if (!enabled) {
    await Product.updateMany({ category: catId, subscriptionHidden: true }, { $set: { subscriptionHidden: false } });
    return { trialsGranted: 0, sellersAffected: 0 };
  }

  const settings = await getSubscriptionSettings();
  let trial: { startDate: Date; endDate: Date } | null = null;
  if (options?.trial) trial = options.trial;
  else if (options?.trial === undefined && settings.trialDays > 0) {
    const now = new Date();
    trial = { startDate: now, endDate: computeEndDate(now, settings.trialDays, "day") };
  }

  const sellerIds: any[] = await Product.distinct("seller", { category: catId });
  const category: any = await Category.findById(catId).select("name").lean();
  let trialsGranted = 0;

  for (const sellerId of sellerIds) {
    const access = await getCategoryAccess(sellerId, catId);
    if (!access.allowed && trial) {
      await createTrial(sellerId, [catId], trial.startDate, trial.endDate, { type: options?.adminId ? "Admin" : "System", id: options?.adminId });
      trialsGranted++;
      await notifySeller(
        sellerId,
        "Free trial started",
        `"${category?.name}" now needs a subscription. You have a free trial from ${fmtDate(trial.startDate)} to ${fmtDate(trial.endDate)}. Buy a plan before it ends to keep selling there.`,
        "Info",
        "High"
      );
    } else if (!access.allowed) {
      await notifySeller(
        sellerId,
        "Subscription required",
        `"${category?.name}" now needs a subscription plan. Your products there are hidden from customers until you buy one.`,
        "Warning",
        "Urgent"
      );
    }
    await syncSellerCategoryVisibility(sellerId, [catId]);
  }
  return { trialsGranted, sellersAffected: sellerIds.length };
};

/** Super Admin gives a seller a free trial for chosen categories and dates. */
export const adminGrantTrial = async (adminId: unknown, sellerId: unknown, categoryIds: unknown[], start: unknown, end: unknown) => {
  if (!mongoose.isValidObjectId(idStr(sellerId)) || !(await Seller.exists({ _id: idStr(sellerId) }))) {
    throw new SubscriptionError(404, "Seller not found");
  }
  const ids = (Array.isArray(categoryIds) ? categoryIds : []).filter((c) => mongoose.isValidObjectId(idStr(c)));
  if (!ids.length) throw new SubscriptionError(400, "Select at least one category");
  const { startDate, endDate } = parseDateRange(start, end);
  const trial = await createTrial(sellerId, ids, startDate, endDate, { type: "Admin", id: adminId });
  await syncSellerCategoryVisibility(sellerId, ids);
  await notifySeller(sellerId, "Free trial granted", `You have a free trial from ${fmtDate(startDate)} to ${fmtDate(endDate)}.`, "Success");
  return trial;
};

// ----------------------------------------------------------------------------
// Buying / activating
// ----------------------------------------------------------------------------

const buildPendingSubscription = async (sellerId: unknown, planId: unknown) => {
  if (!mongoose.isValidObjectId(idStr(planId))) throw new SubscriptionError(400, "Invalid plan");
  const plan = await SubscriptionPlan.findOne({ _id: idStr(planId), isActive: true });
  if (!plan) throw new SubscriptionError(404, "This plan is not available");
  if (!mongoose.isValidObjectId(idStr(sellerId))) throw new SubscriptionError(404, "Seller not found");
  const seller = await Seller.findById(idStr(sellerId)).select("_id");
  if (!seller) throw new SubscriptionError(404, "Seller not found");

  const settings = await getSubscriptionSettings();
  const billType = await billTypeFor(plan.categories, settings);
  const baseAmount = round2(plan.price);
  // GST is charged only when the categories bill with a GST invoice
  const gstPercent = billType === "gst" ? settings.gstPercent || 0 : 0;
  const gstAmount = round2((baseAmount * gstPercent) / 100);

  return {
    plan,
    settings,
    doc: new SellerSubscription({
      seller: seller._id,
      plan: plan._id,
      planSnapshot: {
        name: plan.name,
        price: plan.price,
        durationValue: plan.durationValue,
        durationUnit: plan.durationUnit,
        features: plan.features,
        limits: {
          maxProducts: plan.limits?.maxProducts ?? null,
          commissionPercent: plan.limits?.commissionPercent ?? null,
          featuredStore: !!plan.limits?.featuredStore,
        },
      },
      categories: plan.categories,
      status: "PendingPayment",
      billType,
      payment: { baseAmount, gstPercent, gstAmount, totalAmount: round2(baseAmount + gstAmount) },
    }),
  };
};

/**
 * Mark a pending subscription as paid and start it. A renewal bought before the current period
 * ends starts when that period ends, so no paid days are lost. Super Admin can set custom dates.
 */
const activateSubscription = async (
  subscription: ISellerSubscription,
  payment: { method: "Online" | "Manual" | "Wallet"; paymentId?: string; reference?: string },
  activatedBy: { type: "Seller" | "Admin"; id?: unknown },
  customDates?: { startDate: Date; endDate: Date }
) => {
  const settings = await getSubscriptionSettings();
  const now = new Date();
  const latest = await SellerSubscription.findOne({
    seller: subscription.seller,
    status: { $in: ["Active", "Expired"] },
    categories: { $all: subscription.categories },
    endDate: { $gt: now },
    _id: { $ne: subscription._id },
  }).sort({ endDate: -1 });

  const start = customDates?.startDate || (latest?.endDate && latest.endDate > now ? latest.endDate : now);
  const end = customDates?.endDate || computeEndDate(start, subscription.planSnapshot.durationValue, subscription.planSnapshot.durationUnit);

  let invoiceNumber: string | undefined;
  if (subscription.payment.totalAmount > 0) {
    const counter = await SubscriptionSettings.findOneAndUpdate({ _id: settings._id }, { $inc: { invoiceCounter: 1 } }, { new: true });
    invoiceNumber = `${settings.invoicePrefix || "SUB"}-${now.getFullYear()}-${String(counter!.invoiceCounter).padStart(5, "0")}`;
  }

  const updated = await SellerSubscription.findOneAndUpdate(
    { _id: subscription._id, status: "PendingPayment" },
    {
      $set: {
        status: "Active",
        startDate: start,
        endDate: end,
        renewedFrom: latest?._id || null,
        "payment.method": payment.method,
        "payment.paymentId": payment.paymentId,
        "payment.reference": payment.reference,
        "payment.paidAt": now,
        invoiceNumber,
        activatedBy: { type: activatedBy.type, id: activatedBy.id ? toId(activatedBy.id) : undefined },
      },
    },
    { new: true }
  );
  if (!updated) throw new SubscriptionError(409, "This subscription was already processed");

  await syncSellerCategoryVisibility(updated.seller, updated.categories);
  await notifySeller(
    updated.seller,
    latest ? "Subscription renewed" : "Subscription active",
    `Your plan "${updated.planSnapshot.name}" is active from ${fmtDate(updated.startDate)} until ${fmtDate(updated.endDate)}.`,
    "Success"
  );
  return updated;
};

/** Seller starts buying a plan. Online -> Razorpay order to complete in the app; Wallet -> paid at once. */
export const startSellerPurchase = async (sellerId: unknown, planId: unknown, method: "Online" | "Wallet") => {
  const { doc, settings } = await buildPendingSubscription(sellerId, planId);

  if (method === "Wallet") {
    if (!settings.paymentMethods.wallet) throw new SubscriptionError(400, "Wallet payment is not enabled");
    const amount = doc.payment.totalAmount;
    const debited = await Seller.findOneAndUpdate({ _id: doc.seller, balance: { $gte: amount } }, { $inc: { balance: -amount } }, { new: true });
    if (!debited) throw new SubscriptionError(400, "Not enough wallet balance for this plan");
    await doc.save();
    await WalletTransaction.create({
      sellerId: doc.seller,
      amount,
      type: "Debit",
      description: `Subscription: ${doc.planSnapshot.name}`,
      reference: `SUB-${doc._id}`,
      status: "Completed",
    });
    return { subscription: await activateSubscription(doc, { method: "Wallet", reference: `SUB-${doc._id}` }, { type: "Seller", id: sellerId }) };
  }

  if (!settings.paymentMethods.online) throw new SubscriptionError(400, "Online payment is not enabled");
  await doc.save();
  if (doc.payment.totalAmount <= 0) {
    // Free plan: nothing to pay
    return { subscription: await activateSubscription(doc, { method: "Online", reference: "FREE" }, { type: "Seller", id: sellerId }) };
  }
  try {
    const order = await createRazorpayOrder(doc.payment.totalAmount, `sub_${doc._id}`, String(doc._id));
    doc.payment.gatewayOrderId = order.id;
    await doc.save();
    return { subscription: doc, razorpay: { key: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: doc.payment.totalAmount } };
  } catch (error: any) {
    await SellerSubscription.updateOne({ _id: doc._id }, { $set: { status: "Cancelled", cancelReason: "Payment gateway error", cancelledAt: new Date() } });
    console.error("Subscription payment start failed:", error?.response?.data || error?.message);
    throw new SubscriptionError(502, "Could not start the payment. Please try again.");
  }
};

/** Verify the Razorpay payment for a pending subscription and activate it. */
export const verifySellerPurchase = async (sellerId: unknown, subscriptionId: unknown, razorpayOrderId: string, paymentId: string, signature: string) => {
  if (!mongoose.isValidObjectId(idStr(subscriptionId))) throw new SubscriptionError(400, "Invalid subscription");
  const subscription = await SellerSubscription.findOne({ _id: idStr(subscriptionId), seller: idStr(sellerId) });
  if (!subscription) throw new SubscriptionError(404, "Subscription not found");
  if (subscription.status === "Active") return subscription;
  if (subscription.status !== "PendingPayment") throw new SubscriptionError(400, "This payment is no longer pending");
  if (
    !subscription.payment.gatewayOrderId ||
    razorpayOrderId !== subscription.payment.gatewayOrderId ||
    !isValidRazorpaySignature(subscription.payment.gatewayOrderId, paymentId, signature)
  ) {
    throw new SubscriptionError(400, "Payment could not be verified. If money was deducted it will be refunded.");
  }
  return activateSubscription(subscription, { method: "Online", paymentId }, { type: "Seller", id: sellerId });
};

/** Super Admin activates a plan for a seller who paid by cash / bank transfer, optionally with custom dates. */
export const adminActivatePlan = async (
  adminId: unknown,
  sellerId: unknown,
  planId: unknown,
  reference?: string,
  dates?: { startDate?: unknown; endDate?: unknown }
) => {
  const customDates = dates?.startDate || dates?.endDate ? parseDateRange(dates.startDate, dates.endDate) : undefined;
  const { doc, settings } = await buildPendingSubscription(sellerId, planId);
  if (!settings.paymentMethods.manual) throw new SubscriptionError(400, "Manual activation is turned off in subscription settings");
  await doc.save();
  return activateSubscription(doc, { method: "Manual", reference: reference || "Manual" }, { type: "Admin", id: adminId }, customDates);
};

/** Super Admin changes the start / end date of a seller's subscription. */
export const adminUpdateDates = async (subscriptionId: unknown, start: unknown, end: unknown) => {
  if (!mongoose.isValidObjectId(idStr(subscriptionId))) throw new SubscriptionError(400, "Invalid subscription");
  const { startDate, endDate } = parseDateRange(start, end);
  const subscription = await SellerSubscription.findById(idStr(subscriptionId));
  if (!subscription || !["Active", "Expired"].includes(subscription.status)) {
    throw new SubscriptionError(404, "Active or expired subscription not found");
  }
  subscription.startDate = startDate;
  subscription.endDate = endDate;
  subscription.status = "Active";
  subscription.remindersSent = [];
  subscription.productsHiddenAt = undefined;
  subscription.expiredNotifiedAt = undefined;
  await subscription.save();
  await syncSellerCategoryVisibility(subscription.seller, subscription.categories);
  await notifySeller(subscription.seller, "Subscription dates updated", `Your plan "${subscription.planSnapshot.name}" now runs from ${fmtDate(startDate)} to ${fmtDate(endDate)}.`, "Info");
  return subscription;
};

export const adminExtendSubscription = async (subscriptionId: unknown, days: number) => {
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new SubscriptionError(400, "Days must be between 1 and 3650");
  const subscription = await SellerSubscription.findById(idStr(subscriptionId));
  if (!subscription || !subscription.endDate || !["Active", "Expired"].includes(subscription.status)) {
    throw new SubscriptionError(404, "Active or expired subscription not found");
  }
  const base = subscription.endDate > new Date() ? subscription.endDate : new Date();
  subscription.endDate = new Date(base.getTime() + days * DAY_MS);
  subscription.status = "Active";
  subscription.remindersSent = [];
  subscription.productsHiddenAt = undefined;
  subscription.expiredNotifiedAt = undefined;
  await subscription.save();
  await syncSellerCategoryVisibility(subscription.seller, subscription.categories);
  await notifySeller(subscription.seller, "Subscription extended", `Your plan "${subscription.planSnapshot.name}" was extended by ${days} days.`, "Success");
  return subscription;
};

export const adminCancelSubscription = async (subscriptionId: unknown, reason?: string) => {
  if (!mongoose.isValidObjectId(idStr(subscriptionId))) throw new SubscriptionError(400, "Invalid subscription");
  const subscription = await SellerSubscription.findOneAndUpdate(
    { _id: idStr(subscriptionId), status: { $in: ["Active", "Expired", "PendingPayment"] } },
    { $set: { status: "Cancelled", cancelledAt: new Date(), cancelReason: reason || "Cancelled by admin" } },
    { new: true }
  );
  if (!subscription) throw new SubscriptionError(404, "Subscription not found or already cancelled");
  await syncSellerCategoryVisibility(subscription.seller, subscription.categories);
  await notifySeller(subscription.seller, "Subscription cancelled", `Your plan "${subscription.planSnapshot.name}" was cancelled. ${reason || ""}`.trim(), "Warning", "High");
  return subscription;
};

// ----------------------------------------------------------------------------
// Background job: reminders, expiry, hiding after each category's grace period
// ----------------------------------------------------------------------------

export const runSubscriptionJob = async (now = new Date()) => {
  const settings = await getSubscriptionSettings();
  const reminderDays = [...(settings.reminderDays || [])].filter((d) => d > 0).sort((a, b) => b - a);
  const stats = { reminders: 0, expired: 0, hidden: 0, pendingCleared: 0 };

  // 1. Reminders before expiry
  if (reminderDays.length) {
    const upcoming = await SellerSubscription.find({
      status: "Active",
      startDate: { $lte: now },
      endDate: { $gt: now, $lte: new Date(now.getTime() + reminderDays[0] * DAY_MS) },
    });
    for (const sub of upcoming) {
      const daysLeft = Math.ceil((sub.endDate!.getTime() - now.getTime()) / DAY_MS);
      const due = reminderDays.filter((d) => daysLeft <= d && !sub.remindersSent.includes(d));
      if (!due.length) continue;
      // Skip if a renewal has already been bought for these categories
      const renewed = await SellerSubscription.exists({
        seller: sub.seller,
        status: "Active",
        categories: { $all: sub.categories },
        startDate: { $gte: sub.endDate },
      });
      sub.remindersSent.push(...due);
      await sub.save();
      if (renewed) continue;
      await notifySeller(
        sub.seller,
        "Subscription expiring soon",
        `Your plan "${sub.planSnapshot.name}" expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Renew now to keep selling without interruption.`,
        "Warning",
        "High"
      );
      stats.reminders++;
    }
  }

  // 2. Expire periods that have ended
  const ended = await SellerSubscription.find({ status: "Active", endDate: { $lte: now } });
  for (const sub of ended) {
    sub.status = "Expired";
    sub.expiredNotifiedAt = now;
    await sub.save();
    stats.expired++;
    const access = await Promise.all(sub.categories.map((c) => getCategoryAccess(sub.seller, c)));
    if (access.every((a) => a.allowed && a.subscription && String(a.subscription._id) !== String(sub._id))) continue; // renewed
    const grace = Math.min(...access.map((a) => a.graceDays ?? settings.graceDays));
    await notifySeller(
      sub.seller,
      "Subscription expired",
      grace > 0
        ? `Your plan "${sub.planSnapshot.name}" has expired. Renew within ${grace} day${grace === 1 ? "" : "s"}, or your products in these categories will be hidden from customers.`
        : `Your plan "${sub.planSnapshot.name}" has expired and your products in these categories are hidden from customers. Renew to show them again.`,
      "Warning",
      "Urgent"
    );
  }

  // 3. Grace over (per category): hide products unless another plan covers the category
  const lapsed = await SellerSubscription.find({ status: "Expired", productsHiddenAt: { $exists: false } });
  for (const sub of lapsed) {
    await syncSellerCategoryVisibility(sub.seller, sub.categories);
    const graces = await Promise.all(sub.categories.map(async (c) => (await getCategoryRules(c, settings)).graceDays));
    const maxGrace = graces.length ? Math.max(...graces) : settings.graceDays;
    if (sub.endDate && sub.endDate.getTime() + maxGrace * DAY_MS <= now.getTime()) {
      sub.productsHiddenAt = now;
      await sub.save();
      stats.hidden++;
    }
  }

  // 4. Trials / custom-dated plans whose start date has arrived: make products visible
  const starting = await SellerSubscription.find({
    status: "Active",
    startDate: { $lte: now, $gt: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
  });
  for (const sub of starting) await syncSellerCategoryVisibility(sub.seller, sub.categories);

  // 5. Abandoned online payments (older than 1 day) are cleared
  const cleared = await SellerSubscription.updateMany(
    { status: "PendingPayment", createdAt: { $lte: new Date(now.getTime() - DAY_MS) } },
    { $set: { status: "Cancelled", cancelledAt: now, cancelReason: "Payment not completed" } }
  );
  stats.pendingCleared = cleared.modifiedCount;
  return stats;
};

// ----------------------------------------------------------------------------
// Seller overview
// ----------------------------------------------------------------------------

const daysBetween = (from: Date, to: Date) => Math.ceil((to.getTime() - from.getTime()) / DAY_MS);

export const getSellerSubscriptionOverview = async (sellerId: unknown) => {
  const settings = await getSubscriptionSettings();
  const now = new Date();
  const sid = toId(sellerId);

  const [plans, history, requiredCategories, sellerCategoryIds] = await Promise.all([
    SubscriptionPlan.find({ isActive: true }).populate("categories", "name").sort({ sortOrder: 1, price: 1 }).lean(),
    SellerSubscription.find({ seller: sid, status: { $ne: "PendingPayment" } }).populate("categories", "name").sort({ createdAt: -1 }).limit(100).lean(),
    Category.find({ subscriptionEnabled: true, status: "Active" }).select("name").lean(),
    Product.distinct("category", { seller: sid }),
  ]);

  const sellerCats = new Set(sellerCategoryIds.map((c: any) => String(c)));
  const requiredIds = new Set((requiredCategories as any[]).map((c) => String(c._id)));
  // Every category the seller actually sells in, even ones that don't require a plan,
  // so a seller in any city always sees all of their own categories here.
  const extraIds = [...sellerCats].filter((id) => !requiredIds.has(id));
  const extraCategories = extraIds.length ? await Category.find({ _id: { $in: extraIds }, status: "Active" }).select("name").lean() : [];
  const allCategories = [
    ...(requiredCategories as any[]).map((c) => ({ ...c, required: true })),
    ...extraCategories.map((c: any) => ({ ...c, required: false })),
  ];

  const categories = [];
  for (const cat of allCategories) {
    if (!cat.required) {
      categories.push({
        categoryId: String(cat._id),
        name: cat.name,
        sellsHere: true,
        required: false,
        state: "NotRequired" as const,
        daysLeft: null,
        graceDays: 0,
        endDate: null,
        planName: null,
        isTrial: false,
        usage: null,
      });
      continue;
    }
    const access = await getCategoryAccess(sid, cat._id);
    const sub = access.allowed ? access.subscription : null;
    let state: "Active" | "ExpiringSoon" | "Grace" | "Expired" | "NotSubscribed" | "Upcoming" = "NotSubscribed";
    let daysLeft: number | null = null;
    if (sub?.endDate) {
      daysLeft = daysBetween(now, sub.endDate);
      if (sub.endDate <= now) {
        state = "Grace";
        daysLeft = daysBetween(now, new Date(sub.endDate.getTime() + access.graceDays * DAY_MS));
      } else {
        state = daysLeft <= Math.max(0, ...(settings.reminderDays || [7])) ? "ExpiringSoon" : "Active";
      }
    } else {
      const upcoming = await SellerSubscription.findOne({ seller: sid, status: "Active", categories: cat._id, startDate: { $gt: now } }).sort({ startDate: 1 }).lean();
      if (upcoming) {
        state = "Upcoming";
        daysLeft = daysBetween(now, (upcoming as any).startDate);
      } else if (history.some((h: any) => h.categories.some((c: any) => String(c._id || c) === String(cat._id)))) {
        state = "Expired";
      }
    }
    let usage: { products: number; maxProducts: number | null } | null = null;
    if (sub) {
      const count = await Product.countDocuments({ seller: sid, category: { $in: sub.categories } });
      usage = { products: count, maxProducts: sub.planSnapshot?.limits?.maxProducts ?? null };
    }
    categories.push({
      categoryId: String(cat._id),
      name: cat.name,
      sellsHere: sellerCats.has(String(cat._id)),
      required: true,
      state,
      daysLeft,
      graceDays: access.graceDays,
      endDate: sub?.endDate || null,
      planName: sub?.planSnapshot?.name || null,
      isTrial: !!sub?.isTrial,
      usage,
    });
  }

  // Price shown to sellers: GST only for plans whose categories bill with a GST invoice
  const plansWithBilling = [];
  for (const plan of plans as any[]) {
    const billType = await billTypeFor(plan.categories, settings);
    const gstPercent = billType === "gst" ? settings.gstPercent || 0 : 0;
    plansWithBilling.push({ ...plan, billType, gstPercent, totalPrice: round2(plan.price * (1 + gstPercent / 100)) });
  }

  return {
    settings: {
      graceDays: settings.graceDays,
      paymentMethods: settings.paymentMethods,
      gstPercent: settings.gstPercent,
    },
    categories,
    plans: plansWithBilling,
    history,
  };
};
