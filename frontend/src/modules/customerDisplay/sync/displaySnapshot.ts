import type { DisplayItem, DisplayPhase, DisplayState } from './displayTypes';

/** A POS cart line, reduced to what the customer may see. */
export interface PosLineInput {
  id: string;
  name: string;
  qty: number;
  /** Selling price per unit (GST inclusive, as charged) */
  unitPrice: number;
  mrp?: number;
  /** GST % included in the price, if known */
  gstPercent?: number;
}

export interface SnapshotInput {
  phase: DisplayPhase;
  billNo?: string;
  /** Saved customer's name; leave empty for walk-ins */
  customerName?: string;
  lines: PosLineInput[];
  paymentMethod?: string;
}

const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

/** Next sequence number: time-based so a reloaded POS tab never goes backwards. */
export const nextSeq = (last: number, now: number = Date.now()) => Math.max(now, last + 1);

/**
 * Builds the customer-facing bill from POS lines. Totals follow the POS: prices already
 * include GST, so the grand total is Σ price × qty and GST is the included part.
 * Items are listed oldest first (the POS adds new lines at the top).
 */
export const buildDisplayState = (input: SnapshotInput, seq: number, now: number = Date.now()): DisplayState => {
  const lines = input.lines.filter((l) => l && Number(l.qty) > 0);
  const items: DisplayItem[] = lines
    .slice()
    .reverse()
    .map((l) => {
      const qty = Number(l.qty) || 0;
      const unitPrice = round2(Number(l.unitPrice) || 0);
      const mrp = round2(Math.max(Number(l.mrp) || 0, unitPrice));
      return { id: String(l.id), name: String(l.name || 'Item'), qty, unitPrice, mrp, lineTotal: round2(unitPrice * qty) };
    });

  let subtotal = 0;
  let grandTotal = 0;
  let tax = 0;
  let itemCount = 0;
  lines.forEach((l, i) => {
    const item = items[items.length - 1 - i];
    subtotal += item.mrp * item.qty;
    grandTotal += item.lineTotal;
    itemCount += item.qty;
    const gst = Number(l.gstPercent);
    if (Number.isFinite(gst) && gst > 0) tax += (item.lineTotal * gst) / (100 + gst);
  });

  const phase: DisplayPhase = items.length === 0 && input.phase !== 'paid' ? 'idle' : input.phase;
  return {
    phase,
    billNo: input.billNo || '',
    customerName: input.customerName || '',
    items,
    totals: {
      itemCount: round2(itemCount),
      subtotal: round2(subtotal),
      discount: round2(Math.max(subtotal - grandTotal, 0)),
      tax: round2(tax),
      grandTotal: round2(grandTotal),
    },
    payment:
      phase === 'payment' || phase === 'paid'
        ? { method: input.paymentMethod || '', amount: round2(grandTotal) }
        : null,
    seq,
    at: now,
  };
};

/** A screen applies a snapshot only if it's newer than what it shows (messages can arrive twice or out of order). */
export const isNewerState = (current: DisplayState | null, incoming: DisplayState | null | undefined): incoming is DisplayState =>
  !!incoming && typeof incoming.seq === 'number' && (!current || incoming.seq > current.seq);

/** Content-only fingerprint, used to skip publishing when nothing visible changed. */
export const stateFingerprint = (s: DisplayState) =>
  JSON.stringify([s.phase, s.billNo, s.customerName || '', s.items, s.totals, s.payment]);

export type ScreenView = { phase: 'idle' } | { phase: 'billing' | 'payment' | 'paid'; state: DisplayState };

/**
 * What the customer screen shows. A paid bill stays up (`paidHold`) for its full thank-you
 * time even though the cashier's cart is emptied right away, unless the next customer's bill starts.
 */
export const resolveScreenView = (state: DisplayState | null, paidHold: DisplayState | null): ScreenView => {
  const hasBill = !!state && state.items.length > 0;
  const newBillAfterPaid = hasBill && state!.phase !== 'paid' && (!paidHold || state!.seq > paidHold.seq);
  if (paidHold && !newBillAfterPaid) return { phase: 'paid', state: paidHold };
  if (!state || !hasBill || state.phase === 'idle' || state.phase === 'paid') return { phase: 'idle' };
  return { phase: state.phase, state };
};

/** Should a newly received paid snapshot start the thank-you screen? (Not when reopening hours later.) */
export const shouldHoldPaid = (state: DisplayState, holdSeconds: number, now: number = Date.now()) =>
  state.phase === 'paid' && state.items.length > 0 && now - state.at < (holdSeconds + 5) * 1000;

/** Ids of items that are new or changed qty/total between two snapshots (for the highlight animation). */
export const changedItemIds = (prev: DisplayState | null, next: DisplayState): string[] => {
  const before = new Map((prev?.items || []).map((i) => [i.id, i]));
  return next.items
    .filter((i) => {
      const old = before.get(i.id);
      return !old || old.qty !== i.qty || old.lineTotal !== i.lineTotal;
    })
    .map((i) => i.id);
};
