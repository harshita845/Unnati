import mongoose from "mongoose";
import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Order from "../../../models/Order";
import OrderItem from "../../../models/OrderItem";
import Product from "../../../models/Product";
import StockLedger from "../../../models/StockLedger";

/**
 * Delete Order and Restore Stock
 */
export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid Order ID format",
    });
  }

  const order = await Order.findById(id).populate("items");
  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  const isSeller = req.user?.userType === "Seller";
  const isAdmin = req.user?.userType === "Admin";

  const adminId =
    isAdmin && req.user?.userId && mongoose.Types.ObjectId.isValid(req.user.userId)
      ? new mongoose.Types.ObjectId(req.user.userId)
      : undefined;

  const sellerId =
    isSeller && req.user?.userId && mongoose.Types.ObjectId.isValid(req.user.userId)
      ? new mongoose.Types.ObjectId(req.user.userId)
      : undefined;

  let orderItems = await OrderItem.find({ order: order._id }).populate("product");

  // Fallback: If no OrderItem documents found, check embedded order.items
  if ((!orderItems || orderItems.length === 0) && Array.isArray((order as any).items)) {
    orderItems = (order as any).items;
  }

  for (const item of orderItems || []) {
    const rawProductId = item.product?._id || item.product;
    if (!rawProductId || !mongoose.Types.ObjectId.isValid(rawProductId)) continue;

    const product = await Product.findById(rawProductId);
    if (!product) continue;

    const previousStock = product.stock || 0;
    const returnQty = Number(item.quantity) || 1;

    let stockRestored = false;
    if (item.sku && product.variations && product.variations.length > 0) {
      const vIndex = product.variations.findIndex((v: any) => v.sku === item.sku);
      if (vIndex > -1) {
        const previousVariationStock = product.variations[vIndex].stock || 0;
        product.variations[vIndex].stock = previousVariationStock + returnQty;
        product.stock = previousStock + returnQty;
        await product.save();

        try {
          await StockLedger.create({
            product: product._id,
            variationId: product.variations[vIndex]._id,
            sku: item.sku,
            quantity: returnQty,
            type: "IN",
            source: "ORDER_DELETE",
            referenceId: order._id,
            previousStock: previousVariationStock,
            newStock: product.variations[vIndex].stock,
            ...(adminId ? { admin: adminId } : {}),
            ...(sellerId ? { seller: sellerId } : {}),
          });
        } catch (ledgerErr) {
          console.warn("StockLedger log error on order delete (variation):", ledgerErr);
        }

        stockRestored = true;
      }
    }

    if (!stockRestored) {
      product.stock = previousStock + returnQty;
      await product.save();

      try {
        await StockLedger.create({
          product: product._id,
          sku: item.sku || (product as any).sku || "N/A",
          quantity: returnQty,
          type: "IN",
          source: "ORDER_DELETE",
          referenceId: order._id,
          previousStock,
          newStock: product.stock,
          ...(adminId ? { admin: adminId } : {}),
          ...(sellerId ? { seller: sellerId } : {}),
        });
      } catch (ledgerErr) {
        console.warn("StockLedger log error on order delete:", ledgerErr);
      }
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("stock-update", {
        productId: product._id,
        newStock: product.stock,
      });
    }
  }

  await OrderItem.deleteMany({ order: order._id });
  await Order.findByIdAndDelete(id);

  const io = req.app.get("io");
  if (io) {
    io.emit("order-deleted", { orderId: id });
    io.emit("order-updated", { orderId: id, status: "DELETED" });
  }

  return res.status(200).json({
    success: true,
    message: "Order deleted and stock restored successfully",
  });
});

