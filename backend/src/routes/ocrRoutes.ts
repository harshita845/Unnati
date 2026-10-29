import { Router, Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { authenticate, requireUserType } from "../middleware/auth";
import * as ocr from "../modules/ocr/ocrController";
import { getSellerScanBillAccess } from "../services/ocr/owner";

// AI calls cost money: per-admin limit on scans and re-scans (per server instance on Vercel)
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: () => Math.max(1, Number(process.env.OCR_RATE_LIMIT) || 20),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user?.userId || ipKeyGenerator(req.ip || ""),
  // Manual entry makes no AI call
  skip: (req: Request) => req.body?.manual === true,
  message: { success: false, message: "Too many scans in a minute. Wait a moment and try again.", code: "RATE_LIMIT" },
});

/** The Scan Bill endpoints. Each handler only touches the logged-in owner's scans and data. */
function addScanRoutes(router: Router) {
  router.get("/config", ocr.getConfig);
  router.get("/usage", ocr.getUsage);
  router.post("/upload-signature", ocr.getUploadSignature);
  router.post("/scan", scanLimiter, ocr.scanBill);
  router.get("/", ocr.listScans);
  router.get("/:id", ocr.getScan);
  router.put("/:id", ocr.updateScan);
  router.post("/:id/rescan", scanLimiter, ocr.rescanBill);
  router.post("/:id/rematch", ocr.rematchScan);
  router.post("/:id/confirm", ocr.confirmScanHandler);
  router.post("/:id/sync-ledger", ocr.syncLedgerHandler);
  router.get("/:id/export", ocr.exportScan);
  router.delete("/:id", ocr.discardScan);
  return router;
}

/** Admin POS → Scan Bill: /api/v1/admin/pos/ocr/* (admin login required) */
const adminRouter = Router();
adminRouter.use(authenticate, requireUserType("Admin"));
addScanRoutes(adminRouter);

/** Premium plan feature: the seller's running plan must have Scan Bill switched on. */
const requireSellerScanBill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const access = await getSellerScanBillAccess(req.user?.userId);
    if (!access.enabled) {
      return res.status(403).json({ success: false, code: "SCAN_BILL_NOT_IN_PLAN", message: "Scan Bill is part of premium plans. Go to Subscriptions to upgrade." });
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

/** Seller POS → Scan Bill: /api/v1/seller/pos/ocr/* (seller login + a plan that includes it) */
export const sellerOcrRoutes = Router();
sellerOcrRoutes.use(authenticate, requireUserType("Seller"), requireSellerScanBill);
addScanRoutes(sellerOcrRoutes);

export default adminRouter;
