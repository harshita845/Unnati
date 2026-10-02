import mongoose from "mongoose";
import Product from "../models/Product";
import OrderItem from "../models/OrderItem";

type Session = mongoose.ClientSession | null | undefined;

const extractCleanVariationValue = (val: unknown): string => {
  const str = String(val ?? "").trim();
  return str.includes(":") ? str.split(":").pop()!.trim() : str;
};

/**
 * True when a product variation matches the selector sent by the cart
 * (variant _id, or a label such as "500g" / "Weight: 500g").
 */
export const matchesVariation = (variation: any, selector: unknown): boolean => {
  if (selector === undefined || selector === null || selector === "") return false;
  const rawValue = String(selector);
  if (variation?._id && variation._id.toString() === rawValue) return true;

  const cleanVal = extractCleanVariationValue(rawValue).toLowerCase();
  const fullVal = rawValue.trim().toLowerCase();
  const matches = (target: unknown) => {
    if (typeof target !== "string") return false;
    const t = target.trim().toLowerCase();
    return t === cleanVal || t === fullVal;
  };

  return (
    matches(variation?.value) ||
    matches(variation?.name) ||
    matches(variation?.title) ||
    matches(variation?.pack)
  );
};

/**
 * Pick the variation an order line refers to. Every product has at least one
 * variation; when the cart did not identify one (legacy carts) we use the first,
 * which is also what the cart priced the line at.
 */
export const resolveOrderVariation = (
  product: any,
  variantId?: unknown,
  variationLabel?: unknown
): any | undefined => {
  const variations: any[] = Array.isArray(product?.variations) ? product.variations : [];
  if (!variations.length) return undefined;

  for (const selector of [variantId, variationLabel]) {
    const match = variations.find((v) => matchesVariation(v, selector));
    if (match) return match;
  }
  return variations[0];
};

/**
 * Atomically take `quantity` units from one specific variation.
 * Returns the updated product, or null when that variation lacks stock.
 */
export const reserveVariantStock = async (
  productId: string | mongoose.Types.ObjectId,
  variantId: string | mongoose.Types.ObjectId,
  quantity: number,
  session?: Session
) => {
  return Product.findOneAndUpdate(
    {
      _id: productId,
      variations: {
        $elemMatch: {
          _id: new mongoose.Types.ObjectId(String(variantId)),
          stock: { $gte: quantity },
        },
      },
    },
    { $inc: { "variations.$.stock": -quantity, stock: -quantity } },
    { new: true, session: session || undefined }
  );
};

/**
 * Put stock back for one order line. Uses the variantId recorded at order time;
 * older orders without it fall back to the same variation resolution used to sell.
 */
export const restoreOrderItemStock = async (orderItem: any, session?: Session) => {
  if (!orderItem?.product || !orderItem.quantity) return;

  let variantId = orderItem.variantId ? String(orderItem.variantId) : undefined;
  if (!variantId) {
    const product = await Product.findById(orderItem.product)
      .select("variations")
      .session(session || null)
      .lean();
    const variation = resolveOrderVariation(product, undefined, orderItem.variation);
    variantId = variation?._id ? String(variation._id) : undefined;
  }

  if (variantId) {
    await Product.updateOne(
      { _id: orderItem.product, "variations._id": new mongoose.Types.ObjectId(variantId) },
      { $inc: { "variations.$.stock": orderItem.quantity, stock: orderItem.quantity } },
      { session: session || undefined }
    );
  } else {
    await Product.updateOne(
      { _id: orderItem.product },
      { $inc: { stock: orderItem.quantity } },
      { session: session || undefined }
    );
  }
};

/**
 * Restore stock for every still-active line of an order and mark the lines Cancelled.
 */
export const restoreOrderStock = async (orderId: string | mongoose.Types.ObjectId, session?: Session) => {
  const items = await OrderItem.find({
    order: orderId,
    status: { $nin: ["Cancelled", "Returned"] },
  }).session(session || null);

  for (const item of items) {
    await restoreOrderItemStock(item, session);
    item.status = "Cancelled";
    await item.save({ session: session || undefined });
  }
};
