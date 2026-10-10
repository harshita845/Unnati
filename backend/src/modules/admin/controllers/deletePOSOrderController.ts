import mongoose from "mongoose";
import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Order from "../../../models/Order";
import OrderItem from "../../../models/OrderItem";

/**
 * Delete POS Order and Clean up Items
 */
export const deletePOSOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID format"
      });
    }

    // Find the order with populated items
    const order = await Order.findById(id).populate('items');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Delete order items
    await OrderItem.deleteMany({ order: order._id });

    // Delete the order
    await Order.findByIdAndDelete(id);

    const io = req.app.get("io");
    if (io) {
      io.emit("order-deleted", { orderId: id });
      io.emit("order-updated", { orderId: id, status: "DELETED" });
    }

    return res.status(200).json({
      success: true,
      message: "POS Order deleted successfully"
    });
  }
);
