import type { ReviewBill } from '../../../services/api/admin/scanBillService';

/**
 * What still blocks Confirm, worded for the tooltip next to the button. Mirrors the server's
 * confirmBlockers (backend/src/services/ocr/review.ts), which stays the final check.
 */
export function confirmIssues(bill: ReviewBill, opts: { dateTextInvalid?: boolean } = {}): string[] {
  const out: string[] = [];
  if (bill.docType === 'unknown') out.push('Choose the bill type');
  const movesStock = bill.docType === 'purchase' || bill.docType === 'sales' || bill.docType === 'stock_slip' || bill.docType === 'unknown';
  if (movesStock) {
    if (!bill.items.length) out.push('Add at least one item');
    bill.items.forEach((it, i) => {
      if (it.action === 'skip') return;
      if (!it.quantity || it.quantity <= 0) out.push(`Line ${i + 1}: enter the quantity`);
      if (it.action === 'link' && !it.productId) out.push(`Line ${i + 1}: pick the product`);
      if (it.action === 'create' && !String(it.name || '').trim()) out.push(`Line ${i + 1}: name the new product`);
    });
    if (bill.docType === 'sales' && bill.items.length && !bill.items.some((i) => i.action !== 'skip')) {
      out.push('Link at least one item to a product');
    }
  }
  if (bill.docType === 'purchase' && !bill.party.supplierId && !String(bill.party.name || '').trim()) out.push('Enter the supplier');
  if (bill.docType !== 'stock_slip') {
    const t = bill.totals.grandTotal;
    if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) out.push('Enter the grand total');
  }
  if (opts.dateTextInvalid) out.push('Fix the bill date (DD/MM/YYYY)');
  return out;
}

/** Nothing typed in: no party, bill no., total, notes or items with content. */
export function isBillEmpty(bill?: Partial<ReviewBill> | null): boolean {
  if (!bill) return true;
  const p = bill.party || {};
  const hasText = (v: unknown) => typeof v === 'string' && v.trim() !== '';
  const items = (bill.items || []).filter((it) => hasText(it.name) || typeof it.amount === 'number' || typeof it.rate === 'number');
  return (
    !items.length &&
    !hasText(p.name) && !hasText(p.gstin) && !hasText(p.phone) && !p.supplierId && !p.customerId &&
    !hasText(bill.invoiceNumber) && !hasText(bill.notes) &&
    typeof bill.totals?.grandTotal !== 'number'
  );
}
