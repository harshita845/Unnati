import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLabelLayout, labelSlot, labelPageCount, normalizeLabelLayout, initialLabelLayout } from '../barcodeLabelLayout';

test("client's reference: 2 × 50.8 × 25 mm on a roll, 1.3 mm side margins, no gap → 104.2 × 25 mm page (their tool shows 104.1 from its own rounding)", () => {
  const l = computeLabelLayout({ paper: 'roll', columns: 2, rows: 1, labelWidth: 50.8, labelHeight: 25, marginTop: 0, marginBottom: 0, marginLeft: 1.3, marginRight: 1.3, gapX: 0, gapY: 0 });
  assert.equal(l.pageWidth, 104.2); // 1.3 + 50.8 + 50.8 + 1.3
  assert.equal(l.pageHeight, 25);
  assert.equal(l.perPage, 2);
  assert.deepEqual(labelSlot(l, 0), { page: 0, x: 1.3, y: 0 });
  assert.deepEqual(labelSlot(l, 1), { page: 0, x: 52.1, y: 0 });
  assert.deepEqual(labelSlot(l, 2), { page: 1, x: 1.3, y: 0 }, 'third label starts the next row/page');
});

test('gap between labels and all four margins move the labels', () => {
  const l = computeLabelLayout({ paper: 'roll', columns: 3, rows: 2, labelWidth: 38, labelHeight: 25, marginTop: 2, marginBottom: 3, marginLeft: 4, marginRight: 5, gapX: 3, gapY: 1.5 });
  assert.equal(l.pageWidth, 4 + 3 * 38 + 2 * 3 + 5);
  assert.equal(l.pageHeight, 2 + 2 * 25 + 1.5 + 3);
  assert.deepEqual(labelSlot(l, 1), { page: 0, x: 4 + 38 + 3, y: 2 });
  assert.deepEqual(labelSlot(l, 3), { page: 0, x: 4, y: 2 + 25 + 1.5 });
  assert.equal(labelPageCount(l, 13), 3);
});

test('A4: rows that fit between margins, and a clear problem when labels are too wide', () => {
  const ok = computeLabelLayout({ paper: 'a4', columns: 3, labelWidth: 60, labelHeight: 40, marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10, gapX: 5, gapY: 5 });
  assert.equal(ok.pageWidth, 210);
  assert.equal(ok.rowsPerPage, 6); // (277 + 5) / 45 = 6.26
  assert.deepEqual(ok.problems, []);
  const wide = computeLabelLayout({ paper: 'a4', columns: 4, labelWidth: 60, labelHeight: 40, marginLeft: 10, marginRight: 10, gapX: 5 });
  assert.equal(wide.problems.length, 1);
  assert.match(wide.problems[0], /wider than A4/);
});

test('bad values never break printing', () => {
  const l = normalizeLabelLayout({ columns: 99 as any, rows: -2, labelWidth: NaN, marginLeft: -4, gapX: '3' as any, paper: 'banana' as any });
  assert.equal(l.columns, 4);
  assert.equal(l.rows, 1);
  assert.equal(l.labelWidth, 50);
  assert.equal(l.marginLeft, 0);
  assert.equal(l.gapX, 3);
  assert.equal(l.paper, 'roll');
});

test('saved Barcode Settings page setup and label size are used as the starting point', () => {
  const l = initialLabelLayout({ width: 50.8, height: 25, layout: { paper: 'roll', columns: 2, marginLeft: 1.3, marginRight: 1.3, gapX: 0 } });
  assert.equal(l.labelWidth, 50.8);
  assert.equal(l.labelHeight, 25);
  assert.equal(l.marginLeft, 1.3);
  assert.equal(l.gapX, 0);
});
