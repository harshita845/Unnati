import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThermalReceiptContent } from '../ThermalReceiptContent';
import { cleanBillItemName, formatBillDate, getReceiptPageCss, getThermalReceiptWidthMm } from '../../../utils/sellerPosBillSettings';

/** Visible text of the rendered bill, whitespace collapsed */
const text = (el: React.ReactElement) =>
  renderToStaticMarkup(el)
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const items = [
  { productName: 'Tata Salt 1 kg - Default', qty: 2, price: 28, compareAtPrice: 30, hsnCode: '2501', gst: 5 },
  { productName: 'Surf Excel (Default)', qty: 1, price: 118, hsnCode: '3402', gst: 18 },
];
const gstStore = { shopName: 'Unnati Mart', gst: { enabled: true, text: '36AAPFU0939F1ZW' }, qrSettings: { enabled: true, url: 'data:image/png;base64,AA', size: 'medium' as const, alignment: 'center' as const } };

test('GST-registered store prints a TAX INVOICE with HSN, GST summary and words', () => {
  const t = text(<ThermalReceiptContent settings={gstStore} data={{ invoiceNum: 'POS-1', date: '9/10/2026', time: '14:05', paymentMethod: 'UPI', items, total: 174 }} />);
  assert.match(t, /Tax Invoice/);
  assert.match(t, /Invoice No\.: POS-1/);
  assert.match(t, /Date: 09\/10\/2026 14:05/);
  assert.match(t, /Payment Mode: UPI/);
  assert.match(t, /Status: Paid/);
  assert.match(t, /HSN 2501 · GST 5%/);
  assert.match(t, /HSN 3402 · GST 18%/);
  // 56 incl 5% → taxable 53.33, tax 2.67 → CGST/SGST 1.33 each; 118 incl 18% → 100 + 18 → 9 + 9
  assert.match(t, /5% 53\.33 1\.33 1\.33/);
  assert.match(t, /18% 100\.00 9\.00 9\.00/);
  assert.match(t, /Grand Total: ₹174\.00/);
  assert.match(t, /Rupees One Hundred Seventy Four Only/);
  assert.match(t, /Scan to pay/);
});

test('column says Rate (not Sp), amounts use ₹, "Default" is hidden', () => {
  const t = text(<ThermalReceiptContent settings={gstStore} data={{ paymentMethod: 'Cash', items, total: 174 }} />);
  assert.match(t, / Rate /);
  assert.doesNotMatch(t, /\bSp\b/);
  assert.doesNotMatch(t, /Default/);
  assert.doesNotMatch(t, /\bRs\b/);
  assert.match(t, /Tata Salt 1 kg/);
  assert.match(t, /Total MRP: ₹/);
});

test('no GSTIN → ESTIMATE, no HSN or GST table; credit sale shows Unpaid', () => {
  const t = text(<ThermalReceiptContent settings={{ shopName: 'Unnati Mart' }} data={{ paymentMethod: 'Credit', items, total: 174 }} />);
  assert.match(t, /Estimate/);
  assert.doesNotMatch(t, /Tax Invoice/);
  assert.doesNotMatch(t, /HSN/);
  assert.doesNotMatch(t, /CGST/);
  assert.match(t, /Payment Mode: Credit/);
  assert.match(t, /Status: Unpaid/);
});

test('reprint passes the real status; estimate header can be turned off', () => {
  const t = text(<ThermalReceiptContent settings={{ showEstimatedBillHeader: false }} data={{ paymentMethod: 'Credit', paymentStatus: 'Paid', items, total: 174 }} />);
  assert.match(t, /Status: Paid/);
  assert.doesNotMatch(t, /Estimate/);
});

test('helpers: date, item name, page size', () => {
  assert.equal(formatBillDate('9/10/2026'), '09/10/2026');
  assert.equal(formatBillDate('2026-10-09T10:00:00Z'), '09/10/2026');
  assert.equal(formatBillDate(new Date(2026, 9, 9)), '09/10/2026');
  assert.equal(formatBillDate('Today'), 'Today');
  assert.equal(cleanBillItemName('Salt - Default'), 'Salt');
  assert.equal(cleanBillItemName('Default: Salt'), 'Salt');
  assert.equal(cleanBillItemName('Atta - 5 kg'), 'Atta - 5 kg');
  assert.equal(cleanBillItemName('Default Pack Biscuits'), 'Default Pack Biscuits');
  assert.match(getReceiptPageCss('A4'), /size: A4/);
  assert.match(getReceiptPageCss('58mm'), /margin: 0/);
  assert.equal(getThermalReceiptWidthMm('A4'), '190mm');
  assert.equal(getThermalReceiptWidthMm('58mm'), '48mm');
  assert.equal(getThermalReceiptWidthMm('80mm'), '72mm');
});

test('Seller Name prints the biller from the bill, never the old typed setting, and follows the toggle', () => {
  const bill = { invoiceNum: 'POS-2', date: '9/10/2026', time: '10:00', paymentMethod: 'Cash', items, total: 174, sellerName: 'Priya (Cashier)' };
  const typed = { shopName: 'Unnati Mart', sellerName: 'yashwant' };
  const on = text(<ThermalReceiptContent settings={typed} data={bill} />);
  assert.match(on, /Seller Name: Priya \(Cashier\)/);
  assert.doesNotMatch(on, /yashwant/);
  const off = text(<ThermalReceiptContent settings={{ ...typed, showSellerName: false }} data={bill} />);
  assert.doesNotMatch(off, /Seller Name/);
  const noBiller = text(<ThermalReceiptContent settings={typed} data={{ ...bill, sellerName: '' }} />);
  assert.doesNotMatch(noBiller, /Seller Name|yashwant/);
});
