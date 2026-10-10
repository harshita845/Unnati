import { Router } from "express";
import {
  getOrders,
  getOrderById,
  updateOrderStatus,
} from "../modules/seller/controllers/orderController";
import * as deleteOrderController from "../modules/admin/controllers/deleteOrderController";
import { authenticate, requireUserType, checkEnabled } from "../middleware/auth";

const router = Router();

// All routes require authentication and seller user type
router.use(authenticate);
router.use(requireUserType("Seller"));
router.use(checkEnabled);

// Get seller's orders with filters
router.get("/", getOrders);

// Get order by ID (standard and pos alias)
router.get("/pos/:id", getOrderById);
router.get("/:id", getOrderById);

// Update order status
router.patch("/:id/status", updateOrderStatus);

// Delete order and restore stock (standard and pos alias)
router.delete("/pos/:id", deleteOrderController.deleteOrder);
router.delete("/:id", deleteOrderController.deleteOrder);

export default router;
