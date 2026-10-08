/**
 * The bill snapshot shown on a Customer Display. The cashier sends it; the server keeps only
 * these whitelisted fields so nothing else from the POS (cost prices, customer data, staff)
 * can leak onto the customer-facing screen.
 */

export type DisplayPhase = "idle" | "billing" | "payment" | "paid";

export interface DisplayItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  mrp: number;
  lineTotal: number;
}

export interface DisplayState {
  phase: DisplayPhase;
  billNo: string;
  /** Name of the saved customer being billed (name only: no phone, address or dues). */
  customerName: string;
  items: DisplayItem[];
  totals: { itemCount: number; subtotal: number; discount: number; tax: number; grandTotal: number };
  payment: { method: string; amount: number } | null;
  /** Monotonic per terminal; screens ignore anything older than what they already show. */
  seq: number;
  /** Epoch ms when the cashier produced this snapshot. */
  at: number;
}

const PHASES: DisplayPhase[] = ["idle", "billing", "payment", "paid"];
const MAX_ITEMS = 300;

const money = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const count = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : 0;
};
const text = (v: unknown, max: number): string => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, max) : "");

export const emptyDisplayState = (seq = 0): DisplayState => ({
  phase: "idle",
  billNo: "",
  customerName: "",
  items: [],
  totals: { itemCount: 0, subtotal: 0, discount: 0, tax: 0, grandTotal: 0 },
  payment: null,
  seq,
  at: Date.now(),
});

/** Returns a clean DisplayState, or null when the input isn't a usable snapshot. */
export const sanitizeDisplayState = (input: any): DisplayState | null => {
  if (!input || typeof input !== "object") return null;
  const seq = Number(input.seq);
  if (!Number.isFinite(seq) || seq <= 0) return null;

  const phase: DisplayPhase = PHASES.includes(input.phase) ? input.phase : "idle";
  const items: DisplayItem[] = (Array.isArray(input.items) ? input.items : []).slice(0, MAX_ITEMS).map((it: any, i: number) => ({
    id: text(it?.id, 80) || String(i),
    name: text(it?.name, 120),
    qty: count(it?.qty),
    unitPrice: money(it?.unitPrice),
    mrp: money(it?.mrp),
    lineTotal: money(it?.lineTotal),
  }));
  const totals = input.totals || {};
  const payment =
    input.payment && typeof input.payment === "object"
      ? { method: text(input.payment.method, 30), amount: money(input.payment.amount) }
      : null;

  return {
    phase,
    billNo: text(input.billNo, 40),
    customerName: text(input.customerName, 80),
    items,
    totals: {
      itemCount: count(totals.itemCount),
      subtotal: money(totals.subtotal),
      discount: money(totals.discount),
      tax: money(totals.tax),
      grandTotal: money(totals.grandTotal),
    },
    payment: phase === "payment" || phase === "paid" ? payment : null,
    seq,
    at: Number.isFinite(Number(input.at)) ? Number(input.at) : Date.now(),
  };
};
