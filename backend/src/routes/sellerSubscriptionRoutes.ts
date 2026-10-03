import { Router } from "express";
import * as controller from "../modules/seller/controllers/sellerSubscriptionController";

// Mounted at /seller/subscriptions (Seller only)
const router = Router();

router.get("/", controller.getOverview);
router.post("/purchase", controller.purchase);
router.post("/:id/verify", controller.verifyPayment);
router.get("/:id/invoice", controller.getInvoice);

export default router;
