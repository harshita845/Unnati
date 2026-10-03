import { Router } from "express";
import * as controller from "../modules/admin/controllers/adminSubscriptionController";

// Mounted at /admin/subscriptions (Admin only)
const router = Router();

router.get("/settings", controller.getSettings);
router.put("/settings", controller.updateSettings);

router.get("/plans", controller.listPlans);
router.post("/plans", controller.createPlan);
router.put("/plans/:id", controller.updatePlan);
router.delete("/plans/:id", controller.deletePlan);

router.get("/", controller.listSubscriptions);
router.post("/activate", controller.activateForSeller);
router.post("/trial", controller.grantTrial);
router.put("/:id/dates", controller.updateDates);
router.post("/:id/extend", controller.extendSubscription);
router.post("/:id/cancel", controller.cancelSubscription);

export default router;
