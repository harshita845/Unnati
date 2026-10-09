import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inToIso, isoToIN, lineAmount, liveChecks, summarize, confidenceTone } from '../billMath';
import { outputSize } from '../imagePrep';
import { amountToIndianWords, parseAmountInWords } from '../../../../utils/amountInWords';

const item = (o: any) => ({ name: 'x', quantity: 1, rate: 0, amount: 0, action: 'link', ...o });
const bill = (o: any = {}) => ({
  docType: 'purchase',
  items: [item({ quantity: 20, rate: 25, amount: 500 }), item({ quantity: 10, rate: 240, amount: 2400 }), item({ quantity: 12, rate: 135, discount: 20, amount: 1600 })],
  totals: { subtotal: 4500, cgst: 100, sgst: 100, roundOff: 0, grandTotal: 4700 },
  amountInWords: 'Rupees Four Thousand Seven Hundred Only',
  ...o,
});

test('line amount = qty × rate − discount', () => {
  assert.equal(lineAmount({ quantity: 12, rate: 135, discount: 20 }), 1600);
  assert.equal(lineAmount({ quantity: 3, rate: 33.333, discount: null }), 100);
});

test('clean bill: totals agree, no live warnings', () => {
  const s = summarize(bill() as any);
  assert.equal(s.lineSum, 4500);
  assert.equal(s.computedTotal, 4700);
  assert.equal(s.wordsAmount, 4700);
  assert.equal(s.totalQty, 42);
  assert.deepEqual(liveChecks(bill() as any), []);
});

test('misread total and words are caught live', () => {
  const codes = liveChecks(bill({ totals: { subtotal: 4500, cgst: 100, sgst: 90, grandTotal: 4900 } }) as any).map((c) => c.code);
  assert.deepEqual(codes.sort(), ['CGST_SGST_UNEQUAL', 'TOTAL_MISMATCH', 'WORDS_MISMATCH']);
});

test('tax-inclusive retail bill (no separate tax) is fine', () => {
  assert.deepEqual(liveChecks(bill({ totals: { subtotal: 4500, grandTotal: 4500 }, amountInWords: null }) as any), []);
});

test('DD/MM/YYYY ⇄ ISO', () => {
  assert.equal(isoToIN('2026-10-04'), '04/10/2026');
  assert.equal(inToIso('4/10/26'), '2026-10-04');
  assert.equal(inToIso('31/02/2026'), null);
  assert.equal(inToIso('2026-10-04'), null);
});

test('confidence tones', () => {
  assert.equal(confidenceTone(0.95), 'high');
  assert.equal(confidenceTone(0.7), 'medium');
  assert.equal(confidenceTone(0.3), 'low');
  assert.equal(confidenceTone(null), null);
});

test('image prep: rotate, crop, cap the long edge', () => {
  assert.deepEqual(outputSize(4000, 3000, { rotation: 0, crop: null }), { width: 2400, height: 1800, scale: 0.6, rotW: 4000, rotH: 3000 });
  const r = outputSize(4000, 3000, { rotation: 90, crop: null });
  assert.equal(r.width, 1800);
  assert.equal(r.height, 2400);
  const c = outputSize(1000, 800, { rotation: 0, crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 } });
  assert.deepEqual([c.width, c.height], [500, 400]);
});

test('amount in words (frontend copy) round-trips', () => {
  for (const n of [1, 99.5, 4700, 123456.78, 10000000]) assert.equal(parseAmountInWords(amountToIndianWords(n)), n);
});
