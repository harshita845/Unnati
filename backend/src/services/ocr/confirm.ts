import mongoose, { ClientSession } from "mongoose";
import ScannedDocument, { IScannedDocument } from "../../models/ScannedDocument";
import Product from "../../models/Product";
import Seller from "../../models/Seller";
import Category from "../../models/Category";
import StockLedger from "../../models/StockLedger";
import SupplierLedger from "../../models/SupplierLedger";
import SupplierTransaction, { SupplierTransactionType } from "../../models/SupplierTransaction";
import AdminPurchaseEntry from "../../models/AdminPurchaseEntry";
import { decrementVariantStock, incrementVariantStock } from "../../modules/product/variantStockService";
import { findVariantById, resolveLedgerSku, variantsFromProductDoc } from "../../modules/product/variantHelpers";
import { confirmBlockers, resolvePaid, ReviewBill, ReviewBillSchema, ReviewItem } from "./review";
import { createScannedSale } from "./sales";
import { ConfirmError } from "./errors";

/**
 * Confirm a reviewed scan: one MongoDB transaction does everything (stock, ledgers, purchase entry
 * or sale, and the scan's own status), so it either all happens or none of it does.
 *
 * Idempotent: the transaction starts by flipping the scan draft → confirmed with a conditional
 * update. A second confirm (double click, retry after a timeout) finds it already confirmed and
 * gets the first result back instead of adding stock twice.
 */

export { ConfirmError };

export interface ConfirmResult {
  alreadyConfirmed: boolean;
  scan: IScannedDocument;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0);
const SCAN_ENTRY_PREFIX = "SCAN-";

async function adminStoreSellerId(): Promise<string> {
  // The client's own store (category "Admin"), same as products created from the admin panel
  const seller: any = await Seller.findOne({ category: "Admin" }).select("_id").lean();
  if (seller) return String(seller._id);
  const byMobile: any = await Seller.findOne({ mobile: "9999999999" }).select("_id").lean();
  if (byMobile) return String(byMobile._id);
  throw new ConfirmError("Admin Store not found. Add one product from Admin → Products first, then retry.", 409);
}

/**
 * Quick-create products for lines marked "create". Runs before the transaction (product save
 * builds a search embedding, too slow to hold a transaction open for) and writes the new ids back
 * onto the scan, so a retried confirm links to them instead of creating duplicates.
 */
async function createNewProducts(scan: IScannedDocument, bill: ReviewBill): Promise<mongoose.Types.ObjectId[]> {
  const toCreate = bill.items.map((it, i) => ({ it, i })).filter(({ it }) => it.action === "create" && !it.productId);
  if (!toCreate.length) return [];
  const sellerId = await adminStoreSellerId();
  const fallbackCategory: any = await Category.findOne({ status: "Active" }).sort({ createdAt: 1 }).select("_id").lean();
  const created: mongoose.Types.ObjectId[] = [];

  for (const { it, i } of toCreate) {
    const category = it.categoryId || (fallbackCategory ? String(fallbackCategory._id) : null);
    if (!category) throw new ConfirmError(`Line ${i + 1}: choose a category for the new product.`, 400);
    const rate = num(it.rate);
    const mrp = num(it.mrp) || rate;
    const selling = num(it.sellingPrice) || mrp || rate;
    const product = await Product.create({
      productName: String(it.name).trim(),
      seller: sellerId,
      category,
      hsnCode: it.hsn || undefined,
      gst: typeof it.taxRate === "number" ? it.taxRate : undefined,
      status: "Active",
      publish: true,
      variations: [
        {
          variationType: "Standard",
          name: "Standard",
          value: it.unit || "Standard",
          price: selling,
          discPrice: selling,
          compareAtPrice: mrp || selling,
          purchasePrice: rate || undefined,
          stock: 0, // the confirm transaction adds the scanned quantity
          barcode: it.barcode ? [it.barcode] : [],
        },
      ],
    });
    const variantId = product.variations?.[0]?._id;
    bill.items[i] = { ...it, action: "link", productId: String(product._id), variationId: variantId ? String(variantId) : null };
    created.push(product._id as mongoose.Types.ObjectId);
  }
  // Remember the new products right away (outside the transaction, on purpose)
  await ScannedDocument.updateOne(
    { _id: scan._id },
    { $set: { data: bill }, $addToSet: { "sync.createdProducts": { $each: created } } }
  );
  return created;
}

interface StockLine {
  item: ReviewItem;
  productId: string;
  variantId: string;
  sku: string;
  qty: number;
}

/** Check every linked line points at a real product/variant (inside the transaction). */
async function resolveStockLines(items: ReviewItem[], session: ClientSession): Promise<StockLine[]> {
  const lines: StockLine[] = [];
  for (const [i, item] of items.entries()) {
    if (item.action === "skip" || !item.productId) continue;
    const product: any = await Product.findById(item.productId).session(session).lean();
    if (!product) throw new ConfirmError(`Line ${i + 1}: the linked product no longer exists. Pick another.`, 409);
    const variants = variantsFromProductDoc(product);
    let variantId = item.variationId && findVariantById(variants, item.variationId) ? item.variationId : undefined;
    if (!variantId && variants.length === 1) variantId = String(variants[0]._id);
    if (!variantId) throw new ConfirmError(`Line ${i + 1}: "${product.productName}" has several variants. Pick which one.`, 400);
    const variant = findVariantById(variants, variantId)!;
    lines.push({ item, productId: String(product._id), variantId, sku: resolveLedgerSku(variant.sku), qty: num(item.quantity) });
  }
  return lines;
}

async function moveStock(
  lines: StockLine[],
  direction: "IN" | "OUT",
  source: "RESTOCK" | "MANUAL" | "POS",
  ctx: { scanId: mongoose.Types.ObjectId; adminId: string; session: ClientSession; updatePurchasePrice?: boolean }
): Promise<number> {
  let moved = 0;
  for (const line of lines) {
    if (line.qty <= 0) continue;
    const product: any = await Product.findById(line.productId).session(ctx.session).lean();
    const variant = findVariantById(variantsFromProductDoc(product), line.variantId);
    const prev = Number(variant?.stock) || 0;
    const ok =
      direction === "IN"
        ? await incrementVariantStock(line.productId, line.variantId, line.qty, { session: ctx.session })
        : await decrementVariantStock(line.productId, line.variantId, line.qty, { session: ctx.session });
    if (!ok) throw new ConfirmError(`Couldn't update stock for "${product?.productName || line.item.name}".`, 409);

    if (ctx.updatePurchasePrice && num(line.item.rate) > 0) {
      await Product.updateOne(
        { _id: line.productId, "variations._id": new mongoose.Types.ObjectId(line.variantId) },
        { $set: { "variations.$.purchasePrice": r2(num(line.item.rate)) } },
        { session: ctx.session }
      );
    }
    await StockLedger.create(
      [
        {
          product: line.productId,
          variationId: line.variantId,
          sku: line.sku,
          quantity: line.qty,
          type: direction,
          source,
          referenceId: ctx.scanId,
          previousStock: prev,
          newStock: direction === "IN" ? prev + line.qty : Math.max(0, prev - line.qty),
          admin: ctx.adminId,
        },
      ],
      { session: ctx.session }
    );
    moved++;
  }
  return moved;
}

const purchaseMode = (bill: ReviewBill): "Cash" | "Credit" | "Online" =>
  bill.paymentMode === "cash" ? "Cash" : bill.paymentMode === "credit" || (!bill.paymentMode && bill.paymentStatus !== "paid") ? "Credit" : "Online";

/** Same record shape Admin POS → Purchase Entry saves, so Purchase Report lists scanned bills too. */
function purchaseEntryRecord(scan: IScannedDocument, bill: ReviewBill, lines: StockLine[]) {
  const byItem = new Map(lines.map((l) => [l.item, l]));
  const items = bill.items
    .filter((it) => it.action !== "skip")
    .map((it, idx) => {
      const line = byItem.get(it);
      const qty = num(it.quantity);
      const rate = num(it.rate);
      return {
        id: `${scan._id}-${idx}`,
        productId: line?.productId || "",
        baseProductId: line?.productId || "",
        productName: it.name || "",
        isVariant: !!line?.variantId,
        variationId: line?.variantId,
        mrp: num(it.mrp),
        retailPrice: num(it.sellingPrice) || num(it.mrp),
        wholesalePrice: 0,
        purchasePrice: rate,
        qty,
        currentQty: 0,
        includingGST: false,
        billDiscount: num(it.discount),
        billDiscountType: "₹",
        gstPercent: num(it.taxRate),
        barcode: it.barcode || "",
        mfgDate: "",
        expiry: it.expiry || "",
        hsn: it.hsn || "",
        batch: it.batch || "",
        packOf: 1,
        additionalOpen: false,
      };
    });
  const t = bill.totals;
  const tax = num(t.cgst) + num(t.sgst) + num(t.igst) + num(t.cess);
  const gross = items.reduce((s, i) => s + i.qty * i.purchasePrice, 0);
  return {
    id: `${SCAN_ENTRY_PREFIX}${scan._id}`,
    type: "purchase",
    supplier: {
      name: bill.party.name || "",
      phone: bill.party.phone || "",
      address: bill.party.address || "",
      notes: bill.invoiceNumber ? `Bill no. ${bill.invoiceNumber}` : "",
      gstNumber: bill.party.gstin || "",
      openingBalance: "0",
      openingBalanceType: "Payment",
    },
    paymentMode: purchaseMode(bill),
    date: bill.invoiceDate || new Date().toISOString().slice(0, 10),
    items,
    totals: {
      grossAmount: r2(num(t.subtotal) || gross),
      discountAmount: r2(num(t.discount) + items.reduce((s, i) => s + i.billDiscount, 0)),
      taxAmount: r2(tax),
      roundOff: r2(num(t.roundOff)),
      netAmount: r2(num(t.grandTotal)),
    },
    createdAt: new Date().toISOString(),
    invoiceNumber: bill.invoiceNumber || "",
    source: "scan",
    scanId: String(scan._id),
  };
}

/** Find or create the supplier, then post the bill (and any payment) to the supplier ledger. */
async function postSupplierLedger(scan: IScannedDocument, bill: ReviewBill, session: ClientSession) {
  let supplier: any = bill.party.supplierId ? await SupplierLedger.findById(bill.party.supplierId).session(session) : null;
  if (bill.party.supplierId && !supplier) throw new ConfirmError("The chosen supplier no longer exists. Pick another.", 409);
  if (!supplier) {
    const phone = (bill.party.phone || "").replace(/\D/g, "").slice(-10);
    [supplier] = await SupplierLedger.create(
      [
        {
          name: bill.party.name,
          phone: phone || "0000000000",
          address: bill.party.address || undefined,
          gstNumber: bill.party.gstin || undefined,
          isAdmin: true,
          notes: "Added from Scan Bill",
        },
      ],
      { session }
    );
  }
  // A ledger post for this scan already exists (e.g. a retried request): don't post twice
  const existing = await SupplierTransaction.findOne({ referenceId: String(scan._id), supplier: supplier._id }).session(session).lean();
  if (existing) return { supplierId: supplier._id, amount: 0 };

  const total = r2(num(bill.totals.grandTotal));
  const paid = r2(resolvePaid(bill));
  const label = `${bill.invoiceNumber ? `Bill ${bill.invoiceNumber}` : "Purchase bill"} (scanned)`;
  let balance = Number(supplier.currentBalance) || 0;
  const date = bill.invoiceDate ? new Date(`${bill.invoiceDate}T12:00:00Z`) : new Date();
  const txns: any[] = [];
  if (total > 0) {
    balance = r2(balance + total);
    txns.push({ supplier: supplier._id, type: SupplierTransactionType.PURCHASE, amount: total, balanceAfter: balance, description: label, date, referenceId: String(scan._id) });
  }
  if (paid > 0) {
    balance = r2(balance - paid);
    txns.push({
      supplier: supplier._id,
      type: SupplierTransactionType.PAYMENT,
      amount: -paid,
      balanceAfter: balance,
      description: `Paid${bill.paymentMode ? ` by ${bill.paymentMode.toUpperCase()}` : ""} against ${label}`,
      date,
      referenceId: String(scan._id),
    });
  }
  if (txns.length) await SupplierTransaction.create(txns, { session, ordered: true });
  supplier.currentBalance = balance;
  await supplier.save({ session });
  return { supplierId: supplier._id, amount: r2(total - paid) };
}

export async function confirmScan(
  scanId: string,
  adminId: string,
  body: { data?: unknown; syncLedger?: boolean }
): Promise<ConfirmResult> {
  if (!mongoose.Types.ObjectId.isValid(scanId)) throw new ConfirmError("Scan not found", 404);
  const scan = await ScannedDocument.findById(scanId);
  if (!scan) throw new ConfirmError("Scan not found", 404);
  if (scan.status === "confirmed") return { alreadyConfirmed: true, scan };
  if (scan.status === "discarded") throw new ConfirmError("This scan was discarded.", 409);
  if (scan.status === "processing") throw new ConfirmError("This scan is still being read. Wait for it to finish.", 409);

  const parsed = ReviewBillSchema.safeParse(body.data ?? scan.data);
  if (!parsed.success) {
    throw new ConfirmError(
      "Some fields are invalid.",
      400,
      parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`)
    );
  }
  const bill = parsed.data;
  const blockers = confirmBlockers(bill);
  if (blockers.length) throw new ConfirmError("Fix these before saving.", 400, blockers);

  const syncLedger = bill.docType === "purchase" && body.syncLedger !== false;
  const createdProducts = await createNewProducts(scan, bill);

  const session = await mongoose.startSession();
  let alreadyConfirmed = false;
  try {
    await session.withTransaction(async () => {
      alreadyConfirmed = false;
      // The idempotency gate: only one confirm can move this scan out of draft/failed
      const claimed = await ScannedDocument.findOneAndUpdate(
        { _id: scan._id, status: { $in: ["draft", "failed"] } },
        { $set: { status: "confirmed" } },
        { session, new: true }
      );
      if (!claimed) {
        alreadyConfirmed = true;
        return;
      }

      const ctx = { scanId: scan._id as mongoose.Types.ObjectId, adminId, session };
      const sync: Record<string, any> = {
        target: bill.docType,
        at: new Date(),
        by: adminId,
        createdProducts: [...(scan.sync?.createdProducts || []), ...createdProducts],
      };

      if (bill.docType === "purchase") {
        const lines = await resolveStockLines(bill.items, session);
        sync.stockMovements = await moveStock(lines, "IN", "RESTOCK", { ...ctx, updatePurchasePrice: true });
        const record = purchaseEntryRecord(claimed, bill, lines);
        await AdminPurchaseEntry.create(
          [{ admin: adminId, entryId: record.id, type: "purchase", date: record.date, data: record }],
          { session }
        );
        sync.purchaseEntryId = record.id;
        if (syncLedger) {
          const ledger = await postSupplierLedger(claimed, bill, session);
          sync.supplierId = ledger.supplierId;
          sync.ledgerAmount = ledger.amount;
        }
      } else if (bill.docType === "stock_slip") {
        const lines = await resolveStockLines(bill.items, session);
        sync.stockMovements = await moveStock(lines, bill.stockDirection === "out" ? "OUT" : "IN", "MANUAL", ctx);
      } else if (bill.docType === "sales") {
        const lines = await resolveStockLines(bill.items, session);
        const sale = await createScannedSale(claimed, bill, lines, { adminId, session });
        sync.orderId = sale.orderId;
        sync.orderNumber = sale.orderNumber;
        sync.customerId = sale.customerId;
        sync.stockMovements = await moveStock(lines, "OUT", "POS", { ...ctx, scanId: sale.orderId });
      }
      // expense: stored with the scan only (there's no expense module yet)

      claimed.set({
        data: bill,
        docType: bill.docType,
        sync,
        partyName: bill.party.name || undefined,
        invoiceNumber: bill.invoiceNumber || undefined,
        invoiceDate: bill.invoiceDate || undefined,
        grandTotal: typeof bill.totals.grandTotal === "number" ? bill.totals.grandTotal : undefined,
      });
      await claimed.save({ session });
    });
  } finally {
    await session.endSession();
  }

  const fresh = await ScannedDocument.findById(scan._id);
  return { alreadyConfirmed, scan: fresh! };
}

/** Post a confirmed purchase to the supplier ledger later (confirmed earlier with the ledger off). */
export async function syncScanToLedger(scanId: string, supplierId?: string): Promise<ConfirmResult> {
  if (!mongoose.Types.ObjectId.isValid(scanId)) throw new ConfirmError("Scan not found", 404);
  const session = await mongoose.startSession();
  let already = false;
  try {
    await session.withTransaction(async () => {
      const scan = await ScannedDocument.findById(scanId).session(session);
      if (!scan) throw new ConfirmError("Scan not found", 404);
      if (scan.status !== "confirmed") throw new ConfirmError("Confirm the bill first.", 409);
      if (scan.docType !== "purchase") throw new ConfirmError("Only purchase bills go to the supplier ledger.", 400);
      if (scan.sync?.supplierId) {
        already = true;
        return;
      }
      const bill = ReviewBillSchema.parse(scan.data);
      if (supplierId) bill.party.supplierId = supplierId;
      if (!bill.party.supplierId && !bill.party.name) throw new ConfirmError("Enter the supplier name or pick a saved supplier.", 400);
      const ledger = await postSupplierLedger(scan, bill, session);
      scan.set({ "sync.supplierId": ledger.supplierId, "sync.ledgerAmount": ledger.amount, data: bill });
      await scan.save({ session });
    });
  } finally {
    await session.endSession();
  }
  const fresh = await ScannedDocument.findById(scanId);
  return { alreadyConfirmed: already, scan: fresh! };
}
