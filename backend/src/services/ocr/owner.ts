import type { Request } from "express";
import mongoose from "mongoose";
import SellerSubscription from "../../models/SellerSubscription";
import SubscriptionPlan from "../../models/SubscriptionPlan";

/**
 * Who a scan belongs to. Admin scans work on the admin's own store (as before); a seller's scans
 * only ever see and change that seller's products, suppliers and history.
 */
export type ScanOwner = { kind: "admin"; adminId: string } | { kind: "seller"; sellerId: string };

export const scanOwnerFrom = (req: Request): ScanOwner | null => {
  const id = req.user?.userId;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  if (req.user?.userType === "Seller") return { kind: "seller", sellerId: id };
  if (req.user?.userType === "Admin") return { kind: "admin", adminId: id };
  return null;
};

/** Scans this owner may see. Admin history leaves sellers' scans out. */
export const ownerFilter = (owner: ScanOwner) =>
  owner.kind === "seller" ? { seller: new mongoose.Types.ObjectId(owner.sellerId) } : { seller: null };

/** Fields stamped on a new scan. */
export const ownerFields = (owner: ScanOwner) =>
  owner.kind === "seller" ? { seller: owner.sellerId } : { admin: owner.adminId };

export interface ScanBillAccess {
  enabled: boolean;
  monthlyLimit: number;
  planName: string | null;
}

/**
 * Scan Bill is a premium plan feature: the seller needs a running subscription whose plan has it
 * switched on. Read from the plan as it is now, so switching it on for a plan reaches sellers who
 * already bought it. No grace period: it stops the day the plan ends.
 */
export async function getSellerScanBillAccess(sellerId: unknown): Promise<ScanBillAccess> {
  const none = { enabled: false, monthlyLimit: 0, planName: null };
  const id = String(sellerId || "");
  if (!mongoose.Types.ObjectId.isValid(id)) return none;
  const now = new Date();
  const subs: any[] = await SellerSubscription.find({
    seller: new mongoose.Types.ObjectId(id),
    status: "Active",
    startDate: { $lte: now },
    endDate: { $gt: now },
    plan: { $ne: null },
  })
    .select("plan")
    .lean();
  if (!subs.length) return none;
  const plans: any[] = await SubscriptionPlan.find({ _id: { $in: subs.map((s) => s.plan) }, "limits.scanBillEnabled": true })
    .select("name limits.scanBillMonthlyLimit")
    .lean();
  if (!plans.length) return none;
  const best = plans.reduce((a, b) => ((b.limits?.scanBillMonthlyLimit || 0) > (a.limits?.scanBillMonthlyLimit || 0) ? b : a));
  return { enabled: true, monthlyLimit: Math.max(1, Number(best.limits?.scanBillMonthlyLimit) || 100), planName: best.name };
}
