import mongoose from "mongoose";
import Notification from "../models/Notification";
import Product from "../models/Product";
import Seller from "../models/Seller";
import StockLedger from "../models/StockLedger";
import StockTransfer from "../models/StockTransfer";
import { resolveLedgerSku } from "../modules/product/variantHelpers";

/**
 * Online stock transfer between stores (each store has its own product records):
 *   1. Send (admin): the sending store must have enough stock; it is taken out now (Pending)
 *   2. Accept (receiving store): the same product in the receiving store (same variant SKU, else
 *      same product name and variant) gets the quantity; if that store doesn't have the product,
 *      a copy of it (same details and photos) is added with the transferred quantity as its stock
 *   3. Reject (receiving store) or Cancel (admin) while Pending: the stock goes back to the sender
 * Every step writes the stock ledger (source TRANSFER) and runs in one database transaction:
 * it either all happens or none of it does.
 */

export class StockTransferError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface TransferLineInput {
  productId: string;
  variationId: string;
  quantity: number;
}

const oid = (v: unknown) => new mongoose.Types.ObjectId(String(v));
const same = (a?: unknown, b?: unknown) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const variantLabel = (v: any) => [v?.name || v?.variationType, v?.value].filter((x) => x && x !== "Standard").join(" ") || "";

async function nextTransferNumber(session: mongoose.ClientSession) {
  const d = new Date();
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const count = await StockTransfer.countDocuments({ transferNumber: { $regex: `^TRF-${day}-` } }).session(session);
  return `TRF-${day}-${String(count + 1).padStart(3, "0")}`;
}

/** Find the matching product + variant in the receiving store, or copy the product there */
async function destinationFor(source: any, srcVariant: any, toSellerId: mongoose.Types.ObjectId, session: mongoose.ClientSession) {
  const sku = String(srcVariant.sku || "").trim();
  let dest: any = null;
  if (sku) dest = await Product.findOne({ seller: toSellerId, "variations.sku": sku }).session(session).lean();
  if (!dest) {
    dest = await Product.findOne({ seller: toSellerId, productName: { $regex: `^${escape(String(source.productName).trim())}$`, $options: "i" } })
      .session(session)
      .lean();
  }
  if (dest) {
    const variants: any[] = dest.variations || [];
    const match =
      (sku && variants.find((v) => same(v.sku, sku))) ||
      variants.find((v) => same(v.value, srcVariant.value) && same(v.name || v.variationType, srcVariant.name || srcVariant.variationType)) ||
      (variants.length === 1 && (source.variations || []).length === 1 ? variants[0] : null);
    if (!match) {
      throw new StockTransferError(
        409,
        `"${source.productName}" is in the receiving store but without the "${variantLabel(srcVariant) || srcVariant.value}" option. Add that option there first.`
      );
    }
    return { productId: dest._id, variationId: match._id, created: false };
  }

  // Not stocked there: add a copy of the product (stock 0 on every option; the transfer adds to one)
  const copy: any = { ...source };
  delete copy._id;
  delete copy.__v;
  copy.seller = toSellerId;
  copy.stock = 0;
  copy.searchCount = 0;
  copy.subscriptionHidden = false;
  copy.createdAt = new Date();
  copy.updatedAt = new Date();
  let destVariationId: any = null;
  copy.variations = (source.variations || []).map((v: any) => {
    const nv = { ...v, _id: new mongoose.Types.ObjectId(), stock: 0 };
    if (String(v._id) === String(srcVariant._id)) destVariationId = nv._id;
    return nv;
  });
  const inserted = await Product.collection.insertOne(copy, { session });
  return { productId: inserted.insertedId, variationId: destVariationId, created: true };
}

export async function transferStock(input: {
  fromSellerId: string;
  toSellerId: string;
  items: TransferLineInput[];
  note?: string;
  adminId?: string;
}) {
  const { fromSellerId, toSellerId } = input;
  if (!mongoose.isValidObjectId(fromSellerId) || !mongoose.isValidObjectId(toSellerId)) {
    throw new StockTransferError(400, "Choose the sending and the receiving store");
  }
  if (fromSellerId === toSellerId) throw new StockTransferError(400, "The sending and receiving store must be different");
  const lines = (Array.isArray(input.items) ? input.items : []).filter((l) => mongoose.isValidObjectId(l?.productId) && mongoose.isValidObjectId(l?.variationId));
  if (!lines.length) throw new StockTransferError(400, "Add at least one product to transfer");
  for (const l of lines) {
    if (!Number.isInteger(Number(l.quantity)) || Number(l.quantity) < 1) throw new StockTransferError(400, "Each quantity must be a whole number of at least 1");
  }
  const [from, to]: any[] = await Promise.all([
    Seller.findById(fromSellerId).select("storeName").lean(),
    Seller.findById(toSellerId).select("storeName").lean(),
  ]);
  if (!from || !to) throw new StockTransferError(404, "Store not found");

  const session = await mongoose.startSession();
  let record: any;
  try {
    await session.withTransaction(async () => {
      const toId = oid(toSellerId);
      const items: any[] = [];
      const ledger: any[] = [];
      const transferId = new mongoose.Types.ObjectId();

      for (const line of lines) {
        const qty = Number(line.quantity);
        const source: any = await Product.findOne({ _id: oid(line.productId), seller: oid(fromSellerId) }).session(session).lean();
        if (!source) throw new StockTransferError(404, "A product isn't in the sending store any more");
        const srcVariant = (source.variations || []).find((v: any) => String(v._id) === String(line.variationId));
        if (!srcVariant) throw new StockTransferError(404, `"${source.productName}": that option no longer exists`);

        // Take the stock out only if there is enough (one atomic check-and-update)
        const taken = await Product.updateOne(
          { _id: source._id, variations: { $elemMatch: { _id: srcVariant._id, stock: { $gte: qty } } } },
          { $inc: { "variations.$.stock": -qty } },
          { session }
        );
        if (!taken.modifiedCount) {
          throw new StockTransferError(409, `"${source.productName}${variantLabel(srcVariant) ? ` · ${variantLabel(srcVariant)}` : ""}" has only ${Number(srcVariant.stock) || 0} in stock`);
        }

        const srcBefore = Number(srcVariant.stock) || 0;
        ledger.push({ product: source._id, variationId: srcVariant._id, sku: resolveLedgerSku(srcVariant.sku, source.sku), quantity: qty, type: "OUT", source: "TRANSFER", referenceId: transferId, previousStock: srcBefore, newStock: srcBefore - qty, admin: input.adminId });
        items.push({
          productName: source.productName,
          variantName: variantLabel(srcVariant),
          sku: srcVariant.sku || source.sku || "",
          quantity: qty,
          fromProduct: source._id,
          fromVariation: srcVariant._id,
          createdInDestination: false,
        });
      }

      await StockLedger.create(ledger, { session, ordered: true });
      [record] = await StockTransfer.create(
        [
          {
            _id: transferId,
            transferNumber: await nextTransferNumber(session),
            fromSeller: oid(fromSellerId),
            toSeller: toId,
            items,
            totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
            status: "Pending",
            note: input.note ? String(input.note).slice(0, 500) : undefined,
            createdBy: input.adminId && mongoose.isValidObjectId(input.adminId) ? oid(input.adminId) : undefined,
          },
        ],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
  await notifyStore(
    toSellerId,
    "Stock transfer to accept",
    `${record.transferNumber}: ${record.totalQuantity} unit(s) from ${from.storeName}. Accept it to add the stock to your store.`
  );
  return record;
}

export type TransferActor = { type: "Admin" | "Seller"; id: string; name?: string };

const notifyStore = async (sellerId: unknown, title: string, message: string) => {
  await Notification.create({
    recipientType: "Seller",
    recipientId: oid(sellerId),
    title,
    message,
    type: "Info",
    priority: "High",
    link: "/seller/product/stock-transfers",
    actionLabel: "View transfer",
  }).catch((e: any) => console.error("Stock transfer notification failed:", e?.message || e));
};

/**
 * Who may answer a transfer: the receiving store (seller login), or an admin when the receiving
 * store is the admin's own store. Cancelling is the admin's only.
 */
async function loadPending(transferId: string, actor: TransferActor, action: "accept" | "reject" | "cancel", session: mongoose.ClientSession) {
  if (!mongoose.isValidObjectId(transferId)) throw new StockTransferError(404, "Transfer not found");
  const t: any = await StockTransfer.findById(transferId).session(session);
  if (!t) throw new StockTransferError(404, "Transfer not found");
  if ((t.status || "Accepted") !== "Pending") throw new StockTransferError(409, `This transfer is already ${String(t.status || "Accepted").toLowerCase()}`);
  if (action === "cancel") {
    if (actor.type !== "Admin") throw new StockTransferError(403, "Only an admin can cancel a transfer");
  } else if (actor.type === "Seller") {
    if (String(t.toSeller) !== actor.id) throw new StockTransferError(403, "Only the receiving store can answer this transfer");
  } else {
    const receiver: any = await Seller.findById(t.toSeller).select("category").session(session).lean();
    if (receiver?.category !== "Admin") throw new StockTransferError(403, "The receiving store has to accept or reject this transfer itself");
  }
  return t;
}

/** Receiving store accepts: the stock arrives there (matched product, or a copy added to the store) */
export async function acceptTransfer(transferId: string, actor: TransferActor, note?: string) {
  const session = await mongoose.startSession();
  let result: any;
  try {
    await session.withTransaction(async () => {
      const t = await loadPending(transferId, actor, "accept", session);
      const ledger: any[] = [];
      for (const item of t.items) {
        const source: any = await Product.findById(item.fromProduct).session(session).lean();
        if (!source) throw new StockTransferError(409, `"${item.productName}" no longer exists in the sending store. Reject the transfer instead.`);
        const srcVariant = (source.variations || []).find((v: any) => String(v._id) === String(item.fromVariation));
        if (!srcVariant) throw new StockTransferError(409, `"${item.productName}": that option no longer exists. Reject the transfer instead.`);
        const dest = await destinationFor(source, srcVariant, t.toSeller, session);
        const destBefore: any = await Product.findById(dest.productId).session(session).lean();
        const destVariant = (destBefore?.variations || []).find((v: any) => String(v._id) === String(dest.variationId));
        await Product.updateOne({ _id: dest.productId, "variations._id": dest.variationId }, { $inc: { "variations.$.stock": item.quantity } }, { session });
        const prev = Number(destVariant?.stock) || 0;
        ledger.push({ product: dest.productId, variationId: dest.variationId, sku: resolveLedgerSku(destVariant?.sku, item.sku), quantity: item.quantity, type: "IN", source: "TRANSFER", referenceId: t._id, previousStock: prev, newStock: prev + item.quantity, ...(actor.type === "Admin" ? { admin: actor.id } : {}) });
        item.toProduct = dest.productId;
        item.toVariation = dest.variationId;
        item.createdInDestination = dest.created;
      }
      if (ledger.length) await StockLedger.create(ledger, { session, ordered: true });
      t.status = "Accepted";
      t.respondedBy = { type: actor.type, id: oid(actor.id), name: actor.name };
      t.respondedAt = new Date();
      t.responseNote = note ? String(note).slice(0, 500) : undefined;
      await t.save({ session });
      result = t;
    });
  } finally {
    await session.endSession();
  }
  return result;
}

/** Rejected by the receiving store, or cancelled by the admin: the stock goes back to the sender */
export async function returnTransfer(transferId: string, actor: TransferActor, action: "reject" | "cancel", note?: string) {
  const session = await mongoose.startSession();
  let result: any;
  try {
    await session.withTransaction(async () => {
      const t = await loadPending(transferId, actor, action, session);
      const ledger: any[] = [];
      for (const item of t.items) {
        const source: any = await Product.findById(item.fromProduct).session(session).lean();
        const srcVariant = (source?.variations || []).find((v: any) => String(v._id) === String(item.fromVariation));
        if (!srcVariant) throw new StockTransferError(409, `"${item.productName}" was removed from the sending store, so its stock can't go back. Accept the transfer instead.`);
        await Product.updateOne({ _id: source._id, "variations._id": srcVariant._id }, { $inc: { "variations.$.stock": item.quantity } }, { session });
        const prev = Number(srcVariant.stock) || 0;
        ledger.push({ product: source._id, variationId: srcVariant._id, sku: resolveLedgerSku(srcVariant.sku, item.sku), quantity: item.quantity, type: "IN", source: "TRANSFER", referenceId: t._id, previousStock: prev, newStock: prev + item.quantity, ...(actor.type === "Admin" ? { admin: actor.id } : {}) });
      }
      if (ledger.length) await StockLedger.create(ledger, { session, ordered: true });
      t.status = action === "reject" ? "Rejected" : "Cancelled";
      t.respondedBy = { type: actor.type, id: oid(actor.id), name: actor.name };
      t.respondedAt = new Date();
      t.responseNote = note ? String(note).slice(0, 500) : undefined;
      await t.save({ session });
      result = t;
    });
  } finally {
    await session.endSession();
  }
  if (action === "cancel") {
    await notifyStore(result.toSeller, "Stock transfer cancelled", `${result.transferNumber} was cancelled by the admin. Nothing was added to your store.`);
  }
  return result;
}

/** Admin: every transfer (optionally one store's); seller: only transfers sent to them */
export const listTransfers = (sellerId?: string, incomingOnly = false) =>
  StockTransfer.find(
    sellerId && mongoose.isValidObjectId(sellerId)
      ? incomingOnly
        ? { toSeller: oid(sellerId) }
        : { $or: [{ fromSeller: oid(sellerId) }, { toSeller: oid(sellerId) }] }
      : {}
  )
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("fromSeller", "storeName")
    .populate("toSeller", "storeName")
    .populate("createdBy", "firstName lastName")
    .lean();

/** A store's products that have stock, for picking what to send */
export async function transferableProducts(sellerId: string, search = "") {
  if (!mongoose.isValidObjectId(sellerId)) throw new StockTransferError(400, "Choose the sending store");
  const filter: any = { seller: oid(sellerId), "variations.stock": { $gt: 0 } };
  if (search.trim()) filter.$or = [{ productName: { $regex: escape(search.trim()), $options: "i" } }, { "variations.sku": { $regex: escape(search.trim()), $options: "i" } }];
  const products: any[] = await Product.find(filter).select("productName mainImage variations._id variations.name variations.variationType variations.value variations.stock variations.sku").sort({ productName: 1 }).limit(40).lean();
  return products.map((p) => ({
    productId: String(p._id),
    productName: p.productName,
    image: p.mainImage || "",
    variants: (p.variations || [])
      .filter((v: any) => Number(v.stock) > 0)
      .map((v: any) => ({ variationId: String(v._id), label: variantLabel(v) || "Standard", stock: Number(v.stock) || 0, sku: v.sku || "" })),
  }));
}
