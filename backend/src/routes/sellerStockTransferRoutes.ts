import { Router } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import { acceptIncomingTransfer, getIncomingTransfers, rejectIncomingTransfer } from "../modules/seller/controllers/sellerStockTransferController";

// Receiving store: see and answer stock transfers sent to it
const router = Router();
router.use(authenticate);
router.use(requireUserType("Seller"));
router.get("/", getIncomingTransfers);
router.post("/:id/accept", acceptIncomingTransfer);
router.post("/:id/reject", rejectIncomingTransfer);
export default router;
