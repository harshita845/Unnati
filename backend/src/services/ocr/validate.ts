import { Extraction } from "./schema";
import { parseAmountInWords } from "./amountInWords";

/**
 * Clean-up and sanity checks on an extracted bill. Nothing here throws: every problem becomes a
 * warning the review screen shows next to the field, and the person decides.
 */

export type WarningSeverity = "error" | "warning" | "info";

export interface ScanWarning {
  code: string;
  severity: WarningSeverity;
  message: string;
  /** Dotted path of the field it is about (e.g. "items.2.amount"), for highlighting */
  field?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const val = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n : 0);
const has = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n);
/** Bills round per line and per total: allow ₹1 or 0.5%, whichever is bigger */
const close = (a: number, b: number, abs = 1, rel = 0.005) => Math.abs(a - b) <= Math.max(abs, Math.abs(b) * rel);

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Any common bill date → "YYYY-MM-DD" (Indian day-first order for numeric dates).
 * Returns null when it can't be read with certainty.
 */
export function normalizeDate(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  const build = (y: number, m: number, d: number) => {
    if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) return null; // 31/02
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return build(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) return build(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[\s-]*([a-z]{3,9})[,\s-]*(\d{2,4})/i);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return build(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
  m = s.match(/^([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/i);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return build(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
  return null;
}

/** "YYYY-MM-DD" → "DD/MM/YYYY" for display */
export const formatDateIN = (iso?: string | null) => {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || "";
};

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
};

export type GstinCheck = { valid: boolean; reason?: string; stateCode?: string; state?: string };

/** Format + state code + check digit (the official mod-36 checksum). */
export function validateGstin(input?: string | null): GstinCheck {
  const g = String(input ?? "").toUpperCase().replace(/\s/g, "");
  if (!g) return { valid: false, reason: "empty" };
  if (g.length !== 15) return { valid: false, reason: "A GSTIN has 15 characters" };
  if (!GSTIN_PATTERN.test(g)) return { valid: false, reason: "Not in GSTIN format (22AAAAA0000A1Z5)" };
  const stateCode = g.slice(0, 2);
  const state = GST_STATE_CODES[stateCode];
  if (!state) return { valid: false, reason: `Unknown state code ${stateCode}`, stateCode };
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = GSTIN_CHARS.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  const check = GSTIN_CHARS[(36 - (sum % 36)) % 36];
  if (check !== g[14]) return { valid: false, reason: "Check digit does not match (likely a misread character)", stateCode, state };
  return { valid: true, stateCode, state };
}

/** Tidy an extraction: ISO dates, upper-case GSTIN, digits-only phone, rounded money. */
export function normalizeExtraction(e: Extraction): Extraction {
  const money = (n: number | null) => (has(n) ? round2(n) : null);
  const gstin = e.party.gstin ? e.party.gstin.toUpperCase().replace(/[^0-9A-Z]/g, "") : null;
  const phoneDigits = e.party.phone ? e.party.phone.replace(/\D/g, "") : "";
  const phone = phoneDigits.length > 10 && phoneDigits.startsWith("91") ? phoneDigits.slice(-10) : phoneDigits || null;
  const gstState = gstin ? GST_STATE_CODES[gstin.slice(0, 2)] : undefined;
  return {
    ...e,
    invoiceDate: normalizeDate(e.invoiceDate) ?? e.invoiceDate,
    dueDate: normalizeDate(e.dueDate) ?? e.dueDate,
    party: { ...e.party, gstin, phone, state: e.party.state || gstState || null },
    items: e.items
      .filter((it) => it.name || has(it.amount) || has(it.rate))
      .map((it) => ({
        ...it,
        quantity: has(it.quantity) ? it.quantity : has(it.amount) && has(it.rate) && it.rate ? round2(it.amount / it.rate) : it.quantity,
        rate: money(it.rate),
        mrp: money(it.mrp),
        discount: money(it.discount),
        taxAmount: money(it.taxAmount),
        amount: money(it.amount),
        expiry: it.expiry,
      })),
    totals: Object.fromEntries(Object.entries(e.totals).map(([k, v]) => [k, money(v)])) as Extraction["totals"],
    amountPaid: money(e.amountPaid),
  };
}

/** Does a line add up? Accepts the usual layouts: amount before tax, after tax, or after tax amount. */
export function lineAddsUp(it: Extraction["items"][number]): boolean | null {
  if (!has(it.amount) || !has(it.rate)) return null;
  const qty = has(it.quantity) ? it.quantity : 1;
  const base = qty * it.rate - val(it.discount);
  const pctDisc = it.discount && it.discount < 100 ? qty * it.rate * (1 - it.discount / 100) : NaN;
  const candidates = [base, qty * it.rate, pctDisc];
  if (has(it.taxRate)) candidates.push(base * (1 + it.taxRate / 100), (Number.isFinite(pctDisc) ? pctDisc : base) * (1 + it.taxRate / 100));
  if (has(it.taxAmount)) candidates.push(base + it.taxAmount);
  return candidates.some((c) => Number.isFinite(c) && close(c, it.amount!, 1, 0.01));
}

export interface ValidateOptions {
  /** Today's date for the future-date check (injectable for tests) */
  today?: Date;
}

export function validateExtraction(e: Extraction, opts: ValidateOptions = {}): ScanWarning[] {
  const w: ScanWarning[] = [];
  const add = (code: string, severity: WarningSeverity, message: string, field?: string) =>
    w.push({ code, severity, message, ...(field ? { field } : {}) });
  const needsItems = e.docType === "purchase" || e.docType === "sales" || e.docType === "stock_slip";
  const t = e.totals;

  if (e.docType === "unknown") add("UNKNOWN_TYPE", "warning", "Couldn't tell what kind of bill this is. Pick the type before saving.", "docType");
  if (!e.invoiceNumber && e.docType !== "stock_slip") add("MISSING_INVOICE_NUMBER", "warning", "Bill number not found.", "invoiceNumber");

  // Dates
  if (!e.invoiceDate) add("MISSING_DATE", "warning", "Bill date not found.", "invoiceDate");
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(e.invoiceDate)) add("BAD_DATE", "warning", `Bill date "${e.invoiceDate}" couldn't be read. Enter it as DD/MM/YYYY.`, "invoiceDate");
  else {
    const today = opts.today ?? new Date();
    const d = new Date(`${e.invoiceDate}T00:00:00Z`);
    const tomorrow = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1);
    if (d.getTime() > tomorrow) add("FUTURE_DATE", "warning", `Bill date ${formatDateIN(e.invoiceDate)} is in the future. Check day and month.`, "invoiceDate");
    else if (today.getTime() - d.getTime() > 400 * 86400000) add("OLD_DATE", "info", `Bill is dated ${formatDateIN(e.invoiceDate)}, over a year ago.`, "invoiceDate");
  }

  // Party
  if (!e.party.name && e.docType !== "stock_slip") add("MISSING_PARTY", "warning", e.docType === "sales" ? "Customer name not found." : "Supplier name not found.", "party.name");
  if (e.party.gstin) {
    const g = validateGstin(e.party.gstin);
    if (!g.valid) add("GSTIN_INVALID", "error", `GSTIN ${e.party.gstin}: ${g.reason}.`, "party.gstin");
  }

  // Items
  if (needsItems && !e.items.length) add("NO_ITEMS", "error", "No items found on the bill. Add them before saving.", "items");
  e.items.forEach((it, i) => {
    if (!it.name) add("ITEM_NO_NAME", "warning", `Line ${i + 1}: item name missing.`, `items.${i}.name`);
    if (!has(it.quantity) || it.quantity <= 0) add("ITEM_NO_QTY", "warning", `Line ${i + 1}: quantity missing.`, `items.${i}.quantity`);
    if (lineAddsUp(it) === false) {
      add("LINE_MATH", "warning", `Line ${i + 1} (${it.name || "item"}): qty × rate doesn't match the amount ₹${it.amount}.`, `items.${i}.amount`);
    }
    if (has(it.confidence) && it.confidence < 0.5) add("ITEM_LOW_CONFIDENCE", "info", `Line ${i + 1}: hard to read, please check.`, `items.${i}`);
  });

  // Totals
  const lineSum = round2(e.items.reduce((s, it) => s + val(it.amount), 0));
  const taxes = val(t.cgst) + val(t.sgst) + val(t.igst) + val(t.cess);
  if (!has(t.grandTotal)) {
    add("MISSING_TOTAL", "error", "Grand total not found.", "totals.grandTotal");
  } else {
    if (e.items.length && has(t.subtotal) && !close(lineSum, t.subtotal) && !close(lineSum, t.grandTotal)) {
      add("SUBTOTAL_MISMATCH", "warning", `Items add up to ₹${lineSum} but the bill's subtotal is ₹${t.subtotal}. An item may be missing or misread.`, "totals.subtotal");
    }
    const base = has(t.subtotal) ? t.subtotal : lineSum;
    if (base > 0) {
      const extra = val(t.otherCharges) + val(t.roundOff) - val(t.discount);
      const withTax = round2(base + taxes + extra);
      const taxIncluded = round2(base + extra);
      if (!close(withTax, t.grandTotal) && !close(taxIncluded, t.grandTotal)) {
        add("TOTAL_MISMATCH", "warning", `Subtotal, tax and round-off give ₹${withTax}, but the grand total reads ₹${t.grandTotal}.`, "totals.grandTotal");
      }
    }
    const words = parseAmountInWords(e.amountInWords);
    if (words !== null && !close(words, t.grandTotal, 1, 0)) {
      add("WORDS_MISMATCH", "error", `Amount in words says ₹${words} but the grand total reads ₹${t.grandTotal}. One of them is misread.`, "totals.grandTotal");
    }
  }
  if (has(t.cgst) && has(t.sgst) && !close(t.cgst, t.sgst, 0.05, 0)) add("CGST_SGST_UNEQUAL", "warning", `CGST (₹${t.cgst}) and SGST (₹${t.sgst}) should be equal.`, "totals.cgst");
  if (val(t.igst) > 0 && val(t.cgst) + val(t.sgst) > 0) add("IGST_AND_CGST", "warning", "Bill shows both IGST and CGST/SGST. Usually it's one or the other.", "totals.igst");
  if (Math.abs(val(t.roundOff)) > 1) add("ROUND_OFF_LARGE", "warning", `Round-off of ₹${t.roundOff} is more than ₹1.`, "totals.roundOff");

  // Payment
  if (has(t.grandTotal)) {
    if (e.paymentStatus === "paid" && has(e.amountPaid) && e.amountPaid + 1 < t.grandTotal) {
      add("PAYMENT_INCONSISTENT", "warning", `Marked paid but only ₹${e.amountPaid} of ₹${t.grandTotal} is shown as paid.`, "paymentStatus");
    }
    if (has(e.amountPaid) && e.amountPaid > t.grandTotal + 1) add("OVERPAID", "warning", `Paid ₹${e.amountPaid} is more than the total ₹${t.grandTotal}.`, "amountPaid");
  }
  if (e.paymentMode === "credit" && e.paymentStatus === "paid") add("CREDIT_BUT_PAID", "info", "Payment mode is credit but status is paid. Check which is right.", "paymentStatus");

  // Confidence
  const c = e.confidence;
  if (has(c.overall) && c.overall < 0.6) add("LOW_CONFIDENCE", "warning", "The photo was hard to read. Check every field, or re-scan a clearer photo.");
  for (const k of ["invoiceNumber", "invoiceDate", "party", "totals"] as const) {
    const v = c[k];
    if (has(v) && v < 0.5) add("FIELD_LOW_CONFIDENCE", "info", `Low confidence on ${k === "party" ? "party details" : k === "invoiceNumber" ? "bill number" : k === "invoiceDate" ? "bill date" : "totals"}.`, k === "party" ? "party.name" : k === "totals" ? "totals.grandTotal" : k);
  }
  return w;
}

/** Same supplier + bill number (or same party, date and total) → probably scanned before. */
export function duplicateFingerprint(e: Pick<Extraction, "docType" | "invoiceNumber" | "invoiceDate" | "party" | "totals">): string | null {
  const party = (e.party.gstin || e.party.name || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  const inv = (e.invoiceNumber || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (party && inv) return `${e.docType}|${party}|${inv}`;
  if (party && e.invoiceDate && has(e.totals.grandTotal)) return `${e.docType}|${party}|${e.invoiceDate}|${e.totals.grandTotal}`;
  return null;
}
