import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { GstReturnError, buildGstReturns, gstReturnStores } from "../../../services/gstReturnService";

// GET /admin/reports/gst-returns?month=YYYY-MM&sellerId=  (no sellerId = the admin's own store)
export const getGstReturns = asyncHandler(async (req: Request, res: Response) => {
  try {
    const data = await buildGstReturns(String(req.query.month || ""), req.query.sellerId ? String(req.query.sellerId) : undefined);
    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof GstReturnError) return res.status(error.statusCode).json({ success: false, message: error.message });
    throw error;
  }
});

// GET /admin/reports/gst-returns/stores
export const getGstReturnStores = asyncHandler(async (_req: Request, res: Response) => {
  return res.json({ success: true, data: await gstReturnStores() });
});

// GET /seller/reports/gst-returns?month=YYYY-MM  — the logged-in seller's own store only
export const getSellerGstReturns = asyncHandler(async (req: Request, res: Response) => {
  try {
    const data = await buildGstReturns(String(req.query.month || ""), String(req.user?.userId));
    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof GstReturnError) return res.status(error.statusCode).json({ success: false, message: error.message });
    throw error;
  }
});
