import { amountToIndianWords, parseAmountInWords } from '../../../utils/amountInWords';
import type { BillItem, ReviewBill } from '../../../services/api/admin/scanBillService';

/** Live arithmetic for the Scan Bill review form (the server re-checks on save). */

export const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
const has = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const close = (a: number, b: number, abs = 1, rel = 0.005) => Math.abs(a - b) <= Math.max(abs, Math.abs(b) * rel);

/** qty × rate − discount, the amount a line shows before bill-level tax */
export const lineAmount = (it: Pick<BillItem, 'quantity' | 'rate' | 'discount'>) => r2(num(it.quantity) * num(it.rate) - num(it.discount));

export interface BillSummary {
  lineSum: number;
  taxTotal: number;
  /** subtotal − discount + taxes + other + round-off */
  computedTotal: number;
  /** Same, for bills whose line amounts already include GST */
  computedTaxIncluded: number;
  activeLines: number;
  totalQty: number;
  billTotal: number | null;
  wordsAmount: number | null;
  wordsForTotal: string;
}

export function summarize(bill: Pick<ReviewBill, 'items' | 'totals' | 'amountInWords'>): BillSummary {
  const t = bill.totals || {};
  const lineSum = r2(bill.items.reduce((s, it) => s + num(it.amount), 0));
  const taxTotal = r2(num(t.cgst) + num(t.sgst) + num(t.igst) + num(t.cess));
  const base = has(t.subtotal) ? t.subtotal : lineSum;
  const extra = num(t.otherCharges) + num(t.roundOff) - num(t.discount);
  const billTotal = has(t.grandTotal) ? t.grandTotal : null;
  return {
    lineSum,
    taxTotal,
    computedTotal: r2(base + taxTotal + extra),
    computedTaxIncluded: r2(base + extra),
    activeLines: bill.items.filter((i) => i.action !== 'skip').length,
    totalQty: r2(bill.items.filter((i) => i.action !== 'skip').reduce((s, it) => s + num(it.quantity), 0)),
    billTotal,
    wordsAmount: parseAmountInWords(bill.amountInWords),
    wordsForTotal: billTotal !== null ? amountToIndianWords(billTotal) : '',
  };
}

export interface LiveCheck {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  field: string;
}

/** Instant checks while typing (the full list comes back from the server on save). */
export function liveChecks(bill: Pick<ReviewBill, 'items' | 'totals' | 'amountInWords' | 'docType'>): LiveCheck[] {
  const s = summarize(bill);
  const out: LiveCheck[] = [];
  const t = bill.totals || {};
  if (bill.items.length && has(t.subtotal) && !close(s.lineSum, t.subtotal) && !(s.billTotal !== null && close(s.lineSum, s.billTotal))) {
    out.push({ code: 'SUBTOTAL_MISMATCH', severity: 'warning', field: 'totals.subtotal', message: `Items add up to ₹${s.lineSum}, subtotal says ₹${t.subtotal}.` });
  }
  if (s.billTotal !== null && (s.lineSum > 0 || has(t.subtotal)) && !close(s.computedTotal, s.billTotal) && !close(s.computedTaxIncluded, s.billTotal)) {
    out.push({ code: 'TOTAL_MISMATCH', severity: 'warning', field: 'totals.grandTotal', message: `Subtotal + tax + round-off = ₹${s.computedTotal}, grand total says ₹${s.billTotal}.` });
  }
  if (s.wordsAmount !== null && s.billTotal !== null && !close(s.wordsAmount, s.billTotal, 1, 0)) {
    out.push({ code: 'WORDS_MISMATCH', severity: 'error', field: 'totals.grandTotal', message: `Amount in words reads ₹${s.wordsAmount}, grand total is ₹${s.billTotal}.` });
  }
  if (has(t.cgst) && has(t.sgst) && !close(t.cgst, t.sgst, 0.05, 0)) {
    out.push({ code: 'CGST_SGST_UNEQUAL', severity: 'warning', field: 'totals.cgst', message: 'CGST and SGST should be equal.' });
  }
  return out;
}

/** "YYYY-MM-DD" ⇄ "DD/MM/YYYY" for the date inputs */
export const isoToIN = (iso?: string | null) => {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '';
};
export const inToIso = (s: string): string | null => {
  const m = s.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const mo = Number(m[2]);
  const d = Number(m[1]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

export const inr = (n?: number | null) =>
  has(n) ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

/** Confidence (0–1) → badge tone */
export const confidenceTone = (c?: number | null): 'high' | 'medium' | 'low' | null =>
  !has(c) ? null : c >= 0.85 ? 'high' : c >= 0.6 ? 'medium' : 'low';
