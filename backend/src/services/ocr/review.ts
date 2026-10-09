import { z } from "zod";
import { DOC_TYPES, PAYMENT_MODES, PAYMENT_STATUSES } from "./schema";

/**
 * The bill as the person edited it on the review screen (PUT /:id and POST /:id/confirm).
 * Strict about what changes stock and money; lenient about everything else.
 */

/** "" / null / undefined → null (a blank field stays blank, never ₹0); "12.5" → 12.5 */
const blankToNull = (v: unknown) => (v === "" || v === null || v === undefined ? null : v);
const optMoney = z.preprocess(blankToNull, z.coerce.number().finite().nullable()).optional();
const optStr = z.union([z.string().trim().max(500), z.null()]).optional();
const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

export const ReviewItemSchema = z.object({
  name: z.string().trim().max(300).nullable().optional(),
  hsn: optStr,
  barcode: optStr,
  quantity: z.preprocess(blankToNull, z.coerce.number().finite().min(0).max(1_000_000).nullable()).optional(),
  unit: optStr,
  rate: optMoney,
  mrp: optMoney,
  sellingPrice: optMoney,
  discount: optMoney,
  taxRate: z.preprocess(blankToNull, z.coerce.number().min(0).max(100).nullable()).optional(),
  taxAmount: optMoney,
  amount: optMoney,
  batch: optStr,
  expiry: optStr,
  confidence: z.number().nullable().optional(),
  /** link: an existing product · create: make a new product · skip: no stock change */
  action: z.enum(["link", "create", "skip"]).default("skip"),
  productId: objectId.nullable().optional(),
  variationId: objectId.nullable().optional(),
  categoryId: objectId.nullable().optional(),
});

export const ReviewBillSchema = z.object({
  docType: z.enum(DOC_TYPES),
  documentTitle: optStr,
  invoiceNumber: optStr,
  invoiceDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"), z.null()]).optional(),
  dueDate: optStr,
  party: z
    .object({
      name: optStr,
      gstin: optStr,
      phone: optStr,
      address: optStr,
      state: optStr,
      supplierId: objectId.nullable().optional(),
      customerId: objectId.nullable().optional(),
    })
    .default({}),
  items: z.array(ReviewItemSchema).max(500).default([]),
  totals: z
    .object({
      subtotal: optMoney,
      discount: optMoney,
      cgst: optMoney,
      sgst: optMoney,
      igst: optMoney,
      cess: optMoney,
      otherCharges: optMoney,
      roundOff: optMoney,
      grandTotal: optMoney,
    })
    .default({}),
  amountInWords: optStr,
  paymentMode: z.enum(PAYMENT_MODES).nullable().optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).nullable().optional(),
  amountPaid: optMoney,
  notes: z.union([z.string().max(2000), z.null()]).optional(),
  /** Stock slips: goods coming in (default) or going out */
  stockDirection: z.enum(["in", "out"]).optional(),
  /** Expense category label (expenses are stored only) */
  expenseCategory: optStr,
  confidence: z.any().optional(),
});

export type ReviewBill = z.infer<typeof ReviewBillSchema>;
export type ReviewItem = z.infer<typeof ReviewItemSchema>;

/** Problems that must be fixed before confirm (warnings from validate.ts only advise). */
export function confirmBlockers(bill: ReviewBill): string[] {
  const out: string[] = [];
  if (bill.docType === "unknown") out.push("Choose the bill type (purchase, sales, stock slip or expense).");
  const movesStock = bill.docType === "purchase" || bill.docType === "sales" || bill.docType === "stock_slip" || bill.docType === "unknown";
  if (movesStock) {
    const active = bill.items.filter((i) => i.action !== "skip");
    if (!bill.items.length) out.push("Add at least one item.");
    bill.items.forEach((it, i) => {
      if (it.action === "skip") return;
      if (!it.quantity || it.quantity <= 0) out.push(`Line ${i + 1}: quantity must be more than 0.`);
      if (it.action === "link" && !it.productId) out.push(`Line ${i + 1}: pick the product, create it, or skip the line.`);
      if (it.action === "create" && !it.name) out.push(`Line ${i + 1}: a new product needs a name.`);
    });
    if (bill.docType === "sales" && !active.length) out.push("Link at least one item to a product (or record it as an expense).");
  }
  if (bill.docType !== "stock_slip") {
    const total = bill.totals.grandTotal;
    if (typeof total !== "number" || !Number.isFinite(total) || total < 0) out.push("Enter the grand total.");
  }
  if (bill.docType === "purchase" && !bill.party.supplierId && !bill.party.name) out.push("Enter the supplier name or pick a saved supplier.");
  return out;
}

/** What was actually paid, from mode/status/amountPaid (credit bills are unpaid unless stated). */
export function resolvePaid(bill: Pick<ReviewBill, "paymentMode" | "paymentStatus" | "amountPaid" | "totals">): number {
  const total = Number(bill.totals.grandTotal) || 0;
  if (typeof bill.amountPaid === "number" && Number.isFinite(bill.amountPaid)) return Math.max(0, Math.min(total, bill.amountPaid));
  if (bill.paymentStatus === "paid") return total;
  if (bill.paymentStatus === "unpaid" || bill.paymentMode === "credit") return 0;
  return 0;
}
