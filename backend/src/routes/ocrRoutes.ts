import { Router, Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { authenticate, requireUserType } from "../middleware/auth";
import * as ocr from "../modules/ocr/ocrController";

/** Admin POS → Scan Bill: /api/v1/admin/pos/ocr/* (admin login required) */
const router = Router();
router.use(authenticate, requireUserType("Admin"));

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

export default router;
