import mongoose from "mongoose";
import Product from "../models/Product";
import Repack from "../models/Repack";
import RepackRule from "../models/RepackRule";
import StockLedger from "../models/StockLedger";
import { resolveLedgerSku } from "../modules/product/variantHelpers";
import { parsePackQuantity, suggestSourcePerPack } from "../utils/packQuantity";

/**
 * Repacking: bulk stock turned into smaller packs inside one store (a 50 kg bag of rice into 1 kg
 * and 5 kg packets). It is an internal stock movement, not a sale or purchase:
 *   - the bulk item's stock goes down by what the packs use, plus any wastage
 *   - each pack size's stock goes up by the number of packs made
 *   - every packet gets a cost: its share of the bulk cost, its packaging, and its share of wastage
 *   - all of it is written to the stock ledger and kept as an auditable repack record
 *
 * The preview and the real thing share one calculation, so the numbers someone confirms on screen
 * are exactly the numbers that get posted. Posting runs in one database transaction: it all happens
 * or none of it does.
 */

export class RepackError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface RepackOutputInput {
  productId: string;
  variationId: string;
  packs: number;
  /** how much of the bulk item one pack uses, in the bulk item's own stock units */
  sourcePerPack: number;
  packagingCostPerPack?: number;
}

export interface RepackInput {
  sellerId: string;
  source: { productId: string; variationId: string };
  outputs: RepackOutputInput[];
  /** bulk lost while repacking (spillage, damaged bags), in the bulk item's stock units */
  wastage?: number;
  batchNo?: string;
  note?: string;
  /** update each pack size's purchase price to the new weighted-average cost (default true) */
  updateCost?: boolean;
}

export interface RepackActor {
  type: "Admin" | "Seller";
  id: string;
  name: string;
}

type Session = mongoose.ClientSession | null | undefined;

const oid = (v: unknown) => new mongoose.Types.ObjectId(String(v));
// stock can be fractional (10.5 kg of loose rice): keep 6 places so float noise never builds up
const qty = (n: number) => Math.round(n * 1e6) / 1e6;
const money = (n: number) => Math.round(n * 100) / 100;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const variantLabel = (v: any) => [v?.name || v?.variationType, v?.value].filter((x) => x && x !== "Standard").join(" ") || "";
const displayName = (p: any, v: any) => [p?.productName, variantLabel(v)].filter(Boolean).join(" — ");

async function loadVariant(sellerId: string, productId: string, variationId: string, session: Session) {
  if (!mongoose.isValidObjectId(productId) || !mongoose.isValidObjectId(variationId)) {
    throw new RepackError(400, "Choose an item from the list");
  }
  const product: any = await Product.findOne({ _id: oid(productId), seller: oid(sellerId) })
    .select("productName sku variations")
    .session(session || null)
    .lean();
  if (!product) throw new RepackError(404, "That item isn't in this store");
  const variant = (product.variations || []).find((v: any) => String(v._id) === String(variationId));
  if (!variant) throw new RepackError(404, `That size of ${product.productName} no longer exists`);
  return { product, variant };
}

/** Works out the whole repack without changing anything. */
export async function previewRepack(input: RepackInput, session?: Session) {
  if (!mongoose.isValidObjectId(input.sellerId)) throw new RepackError(400, "Choose the store");
  if (!input.source?.productId || !input.source?.variationId) throw new RepackError(400, "Choose the bulk item to repack");
  if (!Array.isArray(input.outputs) || input.outputs.length === 0) throw new RepackError(400, "Add at least one pack size to make");

  const { product: srcProduct, variant: srcVariant } = await loadVariant(input.sellerId, input.source.productId, input.source.variationId, session);
  const srcLabel = variantLabel(srcVariant);
  const unitCost = Number(srcVariant.purchasePrice) || 0;
  const available = qty(Number(srcVariant.stock) || 0);

  const wastage = qty(Number(input.wastage) || 0);
  if (wastage < 0) throw new RepackError(400, "Wastage cannot be negative");

  const seen = new Set<string>();
  const warnings: string[] = [];
  const lines = [];
  for (const out of input.outputs) {
    const { product, variant } = await loadVariant(input.sellerId, out.productId, out.variationId, session);
    const name = displayName(product, variant);
    if (String(variant._id) === String(srcVariant._id)) {
      throw new RepackError(400, "A pack size can't be the same item as the bulk stock it comes from");
    }
    if (seen.has(String(variant._id))) throw new RepackError(400, `${name} is listed twice — combine the packs into one line`);
    seen.add(String(variant._id));

    const packs = Number(out.packs);
    if (!Number.isInteger(packs) || packs <= 0) throw new RepackError(400, `Enter a whole number of packs for ${name}`);
    const sourcePerPack = qty(Number(out.sourcePerPack));
    if (!(sourcePerPack > 0)) throw new RepackError(400, `Enter how much bulk one ${name} pack uses`);
    const packagingCostPerPack = money(Number(out.packagingCostPerPack) || 0);
    if (packagingCostPerPack < 0) throw new RepackError(400, `Packaging cost for ${name} cannot be negative`);

    // The labels say "50 kg" and "1 kg" but the ratio entered disagrees: almost always a typo
    const suggested = suggestSourcePerPack(srcVariant.value || srcLabel, variant.value || variantLabel(variant));
    if (suggested && Math.abs(suggested - sourcePerPack) / suggested > 0.01) {
      warnings.push(
        `${name}: each pack is set to use ${sourcePerPack} of ${srcLabel || srcProduct.productName}, but the labels suggest ${suggested}. Check the conversion.`
      );
    }

    lines.push({ product, variant, name, packs, sourcePerPack, packagingCostPerPack, suggested });
  }

  const usedForPacks = qty(lines.reduce((sum, l) => sum + l.packs * l.sourcePerPack, 0));
  const totalUsed = qty(usedForPacks + wastage);
  if (totalUsed > available + 1e-9) {
    throw new RepackError(
      400,
      `Not enough bulk stock: this needs ${totalUsed} of ${displayName(srcProduct, srcVariant)}, but only ${available} is in stock`
    );
  }
  if (unitCost === 0) {
    warnings.push(
      "This bulk item has no purchase price, so packet costs only include packaging and wastage, and the packs' purchase prices will be left unchanged. Set its purchase price for accurate costs."
    );
  }

  const wastageCost = wastage * unitCost;
  const outputs = lines.map((l) => {
    const sourceUsed = l.packs * l.sourcePerPack;
    // wastage is shared by how much of the bulk each pack size used
    const wastageShare = usedForPacks > 0 ? (wastageCost * sourceUsed) / usedForPacks : 0;
    const sourceCostPerPack = l.sourcePerPack * unitCost;
    const wastageCostPerPack = wastageShare / l.packs;
    const costPerPack = money(sourceCostPerPack + l.packagingCostPerPack + wastageCostPerPack);
    const stockBefore = qty(Number(l.variant.stock) || 0);
    const previousCost = Number(l.variant.purchasePrice) || 0;
    // weighted average with the packs already on the shelf, so profit reports stay right. With no
    // purchase price on the bulk the real cost is unknown: averaging in ₹0 would drag existing costs
    // down, so the pack keeps the cost it had
    const newCost =
      unitCost === 0
        ? previousCost
        : previousCost > 0 && stockBefore > 0
          ? money((stockBefore * previousCost + l.packs * costPerPack) / (stockBefore + l.packs))
          : costPerPack;
    return {
      product: String(l.product._id),
      variationId: String(l.variant._id),
      productName: l.product.productName,
      variantLabel: variantLabel(l.variant),
      sku: l.variant.sku || "",
      packs: l.packs,
      sourcePerPack: l.sourcePerPack,
      suggestedSourcePerPack: l.suggested,
      sourceUsed: qty(sourceUsed),
      stockBefore,
      stockAfter: qty(stockBefore + l.packs),
      sourceCostPerPack: money(sourceCostPerPack),
      packagingCostPerPack: l.packagingCostPerPack,
      wastageCostPerPack: money(wastageCostPerPack),
      costPerPack,
      previousCost,
      newCost,
    };
  });

  const sourceCost = money(usedForPacks * unitCost);
  const packagingCost = money(lines.reduce((sum, l) => sum + l.packs * l.packagingCostPerPack, 0));

  return {
    sellerId: String(input.sellerId),
    batchNo: (input.batchNo || "").trim(),
    note: (input.note || "").trim(),
    source: {
      product: String(srcProduct._id),
      variationId: String(srcVariant._id),
      productName: srcProduct.productName,
      variantLabel: srcLabel,
      sku: srcVariant.sku || "",
      unitCost,
      stockBefore: available,
      usedForPacks,
      wastage,
      totalUsed,
      stockAfter: qty(available - totalUsed),
    },
    outputs,
    totals: {
      packsCreated: lines.reduce((sum, l) => sum + l.packs, 0),
      sourceCost,
      packagingCost,
      wastageCost: money(wastageCost),
      totalCost: money(sourceCost + packagingCost + wastageCost),
    },
    warnings,
  };
}

async function nextRepackNumber(session: mongoose.ClientSession) {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const last: any = await Repack.findOne({ repackNumber: { $regex: `^RPK-${day}-` } })
    .sort({ repackNumber: -1 })
    .select("repackNumber")
    .session(session)
    .lean();
  const n = last ? Number(String(last.repackNumber).split("-").pop()) + 1 : 1;
  return `RPK-${day}-${String(n).padStart(3, "0")}`;
}

/** Posts the repack: moves the stock, writes the ledger, keeps the record. */
export async function createRepack(input: RepackInput, actor: RepackActor) {
  let updateCost = input.updateCost !== false;
  const session = await mongoose.startSession();
  let created: any;
  try {
    await session.withTransaction(async () => {
      const p = await previewRepack(input, session);
      // nothing to update packs with when the bulk's cost is unknown
      if (p.source.unitCost === 0) updateCost = false;

      // Take the bulk only if it is all still there: a sale or another repack may have used some
      // since the preview, and stock must never go negative
      const took = await Product.updateOne(
        {
          _id: oid(p.source.product),
          variations: { $elemMatch: { _id: oid(p.source.variationId), stock: { $gte: p.source.totalUsed } } },
        },
        { $inc: { "variations.$.stock": -p.source.totalUsed, stock: -p.source.totalUsed } },
        { session }
      );
      if (took.modifiedCount !== 1) {
        throw new RepackError(409, "The bulk stock changed while you were repacking. Review the numbers and try again.");
      }

      // Same rule as a manual stock edit: a size that hits 0 is "Sold out", and one that gets stock back
      // is available again (otherwise freshly made packs could stay marked as sold out)
      if (p.source.stockAfter <= 0) {
        await Product.updateOne(
          { _id: oid(p.source.product), "variations._id": oid(p.source.variationId) },
          { $set: { "variations.$.status": "Sold out" } },
          { session }
        );
      }

      for (const out of p.outputs) {
        await Product.updateOne(
          { _id: oid(out.product), "variations._id": oid(out.variationId) },
          {
            $inc: { "variations.$.stock": out.packs, stock: out.packs },
            ...(updateCost ? { $set: { "variations.$.purchasePrice": out.newCost } } : {}),
          },
          { session }
        );
        await Product.updateOne(
          { _id: oid(out.product) },
          { $set: { "variations.$[v].status": "Available" } },
          { session, arrayFilters: [{ "v._id": oid(out.variationId), "v.status": "Sold out" }] }
        );
      }

      const repackId = new mongoose.Types.ObjectId();
      const ledgerBase = {
        referenceId: repackId,
        seller: oid(p.sellerId),
        ...(actor.type === "Admin" ? { admin: oid(actor.id) } : {}),
      };
      const srcProductSku: any = await Product.findById(p.source.product).select("sku").session(session).lean();
      await StockLedger.create(
        [
          {
            ...ledgerBase,
            product: oid(p.source.product),
            variationId: oid(p.source.variationId),
            sku: resolveLedgerSku(p.source.sku, srcProductSku?.sku),
            quantity: p.source.totalUsed,
            type: "OUT",
            source: "REPACK",
            previousStock: p.source.stockBefore,
            newStock: p.source.stockAfter,
          },
          ...(await Promise.all(
            p.outputs.map(async (out) => {
              const prod: any = await Product.findById(out.product).select("sku").session(session).lean();
              return {
                ...ledgerBase,
                product: oid(out.product),
                variationId: oid(out.variationId),
                sku: resolveLedgerSku(out.sku, prod?.sku),
                quantity: out.packs,
                type: "IN" as const,
                source: "REPACK" as const,
                previousStock: out.stockBefore,
                newStock: out.stockAfter,
              };
            })
          )),
        ],
        { session, ordered: true }
      );

      const [record] = await Repack.create(
        [
          {
            _id: repackId,
            repackNumber: await nextRepackNumber(session),
            seller: oid(p.sellerId),
            batchNo: p.batchNo || undefined,
            note: p.note || undefined,
            source: { ...p.source, product: oid(p.source.product), variationId: oid(p.source.variationId) },
            outputs: p.outputs.map((o) => ({
              product: oid(o.product),
              variationId: oid(o.variationId),
              productName: o.productName,
              variantLabel: o.variantLabel,
              sku: o.sku,
              packs: o.packs,
              sourcePerPack: o.sourcePerPack,
              stockBefore: o.stockBefore,
              stockAfter: o.stockAfter,
              sourceCostPerPack: o.sourceCostPerPack,
              packagingCostPerPack: o.packagingCostPerPack,
              wastageCostPerPack: o.wastageCostPerPack,
              costPerPack: o.costPerPack,
              previousCost: o.previousCost,
              newCost: updateCost ? o.newCost : o.previousCost,
            })),
            totals: p.totals,
            costUpdated: updateCost,
            performedBy: { type: actor.type, id: oid(actor.id), name: actor.name || actor.type },
          },
        ],
        { session }
      );

      // Remember each conversion for this store, so the next repack starts pre-filled
      await RepackRule.bulkWrite(
        p.outputs.map((o) => ({
          updateOne: {
            filter: { seller: oid(p.sellerId), sourceVariationId: oid(p.source.variationId), targetVariationId: oid(o.variationId) },
            update: {
              $set: {
                sourceProduct: oid(p.source.product),
                targetProduct: oid(o.product),
                sourcePerPack: o.sourcePerPack,
                packagingCostPerPack: o.packagingCostPerPack,
                lastUsedAt: new Date(),
              },
            },
            upsert: true,
          },
        })),
        { session }
      );

      created = record.toObject();
    });
  } finally {
    await session.endSession();
  }
  return created;
}

/** Items in a store, with every size, its stock, cost and the quantity read from its label. */
export async function repackableProducts(sellerId: string, search = "") {
  if (!mongoose.isValidObjectId(sellerId)) throw new RepackError(400, "Choose the store");
  const filter: any = { seller: oid(sellerId) };
  if (search.trim()) {
    filter.$or = [
      { productName: { $regex: escape(search.trim()), $options: "i" } },
      { "variations.sku": { $regex: escape(search.trim()), $options: "i" } },
    ];
  }
  const products: any[] = await Product.find(filter)
    .select("productName mainImage variations._id variations.name variations.variationType variations.value variations.stock variations.sku variations.purchasePrice variations.price variations.discPrice variations.compareAtPrice")
    .sort({ productName: 1 })
    .limit(40)
    .lean();
  return products.map((p) => ({
    productId: String(p._id),
    productName: p.productName,
    image: p.mainImage || "",
    variants: (p.variations || []).map((v: any) => ({
      variationId: String(v._id),
      label: variantLabel(v) || "Standard",
      value: v.value || "",
      stock: Number(v.stock) || 0,
      sku: v.sku || "",
      purchasePrice: Number(v.purchasePrice) || 0,
      price: Number(v.price) || 0,
      discPrice: Number(v.discPrice) || 0,
      compareAtPrice: Number(v.compareAtPrice) || 0,
      content: parsePackQuantity(v.value || variantLabel(v)),
    })),
  }));
}

export interface NewPackSizeInput {
  sellerId: string;
  productId: string;
  /** the size written on the pack, e.g. "500 g" */
  value: string;
  /** selling price (what the customer pays) */
  price: number;
  /** MRP, optional */
  compareAtPrice?: number;
  /** copy the size type (Weight, Volume…) from this size of the product */
  likeVariationId?: string;
}

/**
 * Adds a new size to a product so bulk can be repacked into it: "Chana Dal Split — 1 kg" gets a
 * "500 g" size. Repacking only fills sizes that exist, and making the user leave the screen to
 * create one first was where it got confusing. Starts at 0 stock; the repack puts the packs in.
 */
export async function createPackSize(input: NewPackSizeInput) {
  if (!mongoose.isValidObjectId(input.sellerId)) throw new RepackError(400, "Choose the store");
  if (!mongoose.isValidObjectId(input.productId)) throw new RepackError(400, "Choose the product");
  const value = String(input.value || "").trim().replace(/\s+/g, " ");
  if (!value) throw new RepackError(400, 'Enter the pack size, e.g. "500 g"');
  if (value.length > 40) throw new RepackError(400, "Keep the pack size short, e.g. \"500 g\"");
  const price = money(Number(input.price));
  if (!(price > 0)) throw new RepackError(400, "Enter the selling price of the new pack");
  const mrp = input.compareAtPrice !== undefined && input.compareAtPrice !== null && String(input.compareAtPrice) !== "" ? money(Number(input.compareAtPrice)) : undefined;
  if (mrp !== undefined && (!(mrp > 0) || mrp < price)) throw new RepackError(400, "MRP must be at least the selling price");

  const product: any = await Product.findOne({ _id: oid(input.productId), seller: oid(input.sellerId) });
  if (!product) throw new RepackError(404, "That item isn't in this store");
  const clash = (product.variations || []).find((v: any) => String(v.value || "").trim().toLowerCase() === value.toLowerCase());
  if (clash) throw new RepackError(409, `${product.productName} already has a "${value}" size — pick it from the list instead`);

  const like = input.likeVariationId ? (product.variations || []).find((v: any) => String(v._id) === String(input.likeVariationId)) : null;
  const variationType = like?.variationType || like?.name || "Standard";
  product.variations.push({
    variationType,
    name: like?.name || variationType,
    value,
    price: mrp ?? price,
    discPrice: price,
    compareAtPrice: mrp ?? price,
    stock: 0,
  });
  await product.save();

  const created: any = product.variations[product.variations.length - 1];
  return {
    productId: String(product._id),
    productName: product.productName,
    image: product.mainImage || "",
    variant: {
      variationId: String(created._id),
      label: variantLabel(created) || "Standard",
      value: created.value || "",
      stock: 0,
      sku: created.sku || "",
      purchasePrice: 0,
      price: Number(created.price) || 0,
      discPrice: Number(created.discPrice) || 0,
      compareAtPrice: Number(created.compareAtPrice) || 0,
      content: parsePackQuantity(created.value),
    },
  };
}

/** The conversions this store has used before for one bulk item. */
export async function repackRulesFor(sellerId: string, sourceVariationId: string) {
  if (!mongoose.isValidObjectId(sellerId) || !mongoose.isValidObjectId(sourceVariationId)) return [];
  const rules: any[] = await RepackRule.find({ seller: oid(sellerId), sourceVariationId: oid(sourceVariationId) })
    .sort({ lastUsedAt: -1 })
    .lean();
  const products: any[] = await Product.find({ _id: { $in: rules.map((r) => r.targetProduct) } })
    .select("productName variations._id variations.name variations.variationType variations.value variations.stock")
    .lean();
  return rules
    .map((r) => {
      const product = products.find((p) => String(p._id) === String(r.targetProduct));
      const variant = product?.variations?.find((v: any) => String(v._id) === String(r.targetVariationId));
      if (!product || !variant) return null; // that pack size was deleted since
      return {
        productId: String(product._id),
        variationId: String(variant._id),
        productName: product.productName,
        variantLabel: variantLabel(variant) || "Standard",
        stock: Number(variant.stock) || 0,
        sourcePerPack: r.sourcePerPack,
        packagingCostPerPack: r.packagingCostPerPack || 0,
        lastUsedAt: r.lastUsedAt,
      };
    })
    .filter(Boolean);
}

export async function listRepacks(sellerId?: string, limit = 100) {
  const filter: any = {};
  if (sellerId) {
    if (!mongoose.isValidObjectId(sellerId)) throw new RepackError(400, "Choose the store");
    filter.seller = oid(sellerId);
  }
  return Repack.find(filter).sort({ createdAt: -1 }).limit(limit).populate("seller", "storeName").lean();
}

export async function getRepack(id: string, sellerId?: string) {
  if (!mongoose.isValidObjectId(id)) throw new RepackError(404, "Repack not found");
  const filter: any = { _id: oid(id) };
  if (sellerId) filter.seller = oid(sellerId);
  const record = await Repack.findOne(filter).populate("seller", "storeName").lean();
  if (!record) throw new RepackError(404, "Repack not found");
  return record;
}
