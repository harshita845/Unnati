import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReviewBill } from '../../../services/api/admin/scanBillService';
import { DOC_TYPE_LABEL } from '../../../services/api/admin/scanBillService';
import { amountToIndianWords } from '../../../utils/amountInWords';
import { isoToIN } from './billMath';

/** A4 PDF of a reviewed bill. jsPDF's built-in fonts have no ₹ glyph, so amounts use "Rs." */

const money = (n?: number | null) => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
const MODE_LABEL: Record<string, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank transfer', cheque: 'Cheque', credit: 'Credit', other: 'Other' };
const STATUS_LABEL: Record<string, string> = { paid: 'Paid', unpaid: 'Unpaid', partial: 'Partly paid' };

export function exportBillPdf(bill: ReviewBill, fileName: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFont('helvetica', 'bold').setFontSize(14).text(bill.documentTitle || DOC_TYPE_LABEL[bill.docType], 14, y);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110);
  doc.text('Scanned bill (Unnati Admin POS)', W - 14, y, { align: 'right' });
  doc.setTextColor(0);
  y += 8;

  const p = bill.party || {};
  const left = [
    `${bill.docType === 'sales' ? 'Customer' : 'Supplier'}: ${p.name || '-'}`,
    p.gstin ? `GSTIN: ${p.gstin}` : '',
    p.phone ? `Phone: ${p.phone}` : '',
    p.address ? `Address: ${p.address}` : '',
  ].filter(Boolean);
  const right = [
    `Bill no.: ${bill.invoiceNumber || '-'}`,
    `Date: ${isoToIN(bill.invoiceDate) || '-'}`,
    `Payment Mode: ${bill.paymentMode ? MODE_LABEL[bill.paymentMode] : '-'}`,
    `Status: ${bill.paymentStatus ? STATUS_LABEL[bill.paymentStatus] : '-'}`,
  ];
  doc.setFontSize(9.5);
  left.forEach((line, i) => doc.text(doc.splitTextToSize(line, 110)[0], 14, y + i * 5));
  right.forEach((line, i) => doc.text(line, W - 14, y + i * 5, { align: 'right' }));
  y += Math.max(left.length, right.length) * 5 + 3;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Item', 'HSN', 'Qty', 'Rate', 'Disc.', 'GST %', 'Amount']],
    body: bill.items.map((it, i) => [
      String(i + 1),
      it.name || '',
      it.hsn || '',
      it.quantity ?? '',
      money(it.rate),
      money(it.discount),
      it.taxRate ?? '',
      money(it.amount),
    ]),
    styles: { fontSize: 8.5, cellPadding: 1.6 },
    headStyles: { fillColor: [109, 187, 45] },
    columnStyles: { 0: { cellWidth: 8 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  const t = bill.totals || {};
  const rows: Array<[string, number | null | undefined]> = [
    ['Subtotal', t.subtotal],
    ['Discount', t.discount],
    ['CGST', t.cgst],
    ['SGST', t.sgst],
    ['IGST', t.igst],
    ['Cess', t.cess],
    ['Other charges', t.otherCharges],
    ['Round off', t.roundOff],
  ];
  doc.setFontSize(9.5);
  for (const [label, v] of rows) {
    if (typeof v !== 'number' || !v) continue;
    doc.text(label, W - 60, y);
    doc.text(`Rs. ${money(v)}`, W - 14, y, { align: 'right' });
    y += 5;
  }
  doc.setFont('helvetica', 'bold').setFontSize(11);
  doc.text('Grand total', W - 60, y + 1);
  doc.text(`Rs. ${money(t.grandTotal)}`, W - 14, y + 1, { align: 'right' });
  y += 8;
  if (typeof t.grandTotal === 'number') {
    doc.setFont('helvetica', 'italic').setFontSize(9);
    doc.text(doc.splitTextToSize(amountToIndianWords(t.grandTotal), W - 28), 14, y);
    y += 6;
  }
  if (bill.notes) {
    doc.setFont('helvetica', 'normal').setFontSize(9);
    doc.text(doc.splitTextToSize(`Notes: ${bill.notes}`, W - 28), 14, y);
  }
  doc.save(fileName);
}
