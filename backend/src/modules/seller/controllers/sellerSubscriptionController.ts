import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler";
import Seller from "../../../models/Seller";
import SellerSubscription from "../../../models/SellerSubscription";
import {
  SubscriptionError,
  getSellerSubscriptionOverview,
  startSellerPurchase,
  verifySellerPurchase,
} from "../../../services/sellerSubscriptionService";

const handle = (res: Response, error: any) => {
  if (error instanceof SubscriptionError) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  throw error;
};

/** Plans, the seller's status per subscription category, and history. */
export const getOverview = asyncHandler(async (req: Request, res: Response) => {
  return res.status(200).json({ success: true, data: await getSellerSubscriptionOverview(req.user!.userId) });
});

/** Buy or renew a plan. Online returns a Razorpay order; Wallet completes immediately. */
export const purchase = asyncHandler(async (req: Request, res: Response) => {
  const method = req.body.method === "Wallet" ? "Wallet" : "Online";
  try {
    const result = await startSellerPurchase(req.user!.userId, req.body.planId, method);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return handle(res, error);
  }
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const { razorpayOrderId, paymentId, razorpaySignature } = req.body;
  try {
    const subscription = await verifySellerPurchase(req.user!.userId, req.params.id, razorpayOrderId, paymentId, razorpaySignature);
    return res.status(200).json({ success: true, message: "Payment verified, plan active", data: subscription });
  } catch (error) {
    return handle(res, error);
  }
});

/** Data for the seller's GST invoice or payment receipt (bill type comes from the categories). */
export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid subscription" });
  const subscription: any = await SellerSubscription.findOne({ _id: req.params.id, seller: req.user!.userId })
    .populate("categories", "name")
    .lean();
  if (!subscription || !subscription.payment?.paidAt || subscription.payment?.method === "Trial" || !subscription.payment?.totalAmount) {
    return res.status(404).json({ success: false, message: "No paid subscription found" });
  }
  const seller = await Seller.findById(req.user!.userId).select("storeName sellerName address city email mobile gstNumber gstin").lean();
  return res.status(200).json({
    success: true,
    data: { subscription, seller, invoiceEnabled: subscription.billType !== "receipt" },
  });
});
