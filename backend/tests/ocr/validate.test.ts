import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDate, normalizeExtraction, validateExtraction, validateGstin, duplicateFingerprint, lineAddsUp } from "../../src/services/ocr/validate";
import { parseExtraction } from "../../src/services/ocr/schema";
import { FAKE_SAMPLE_BILL } from "../../src/services/ocr/providers/fake";

const TODAY = new Date("2026-10-09T10:00:00Z");
const sample = () => normalizeExtraction(parseExtraction(JSON.stringify(FAKE_SAMPLE_BILL)));
const codes = (w: { code: string }[]) => w.map((x) => x.code).sort();

test("GSTIN check digit", () => {
  assert.equal(validateGstin("27AAPFU0939F1ZV").valid, true);
  assert.equal(validateGstin("36AAPFU0939F1ZW").state, "Telangana");
  assert.match(validateGstin("27AAPFU0939F1ZX").reason!, /Check digit/);
  assert.match(validateGstin("27AAPFU0939F1Z").reason!, /15 characters/);
  assert.match(validateGstin("99AAPFU0939F1ZV").reason!, /state code/);
  assert.match(validateGstin("27AAPF00939F1ZV").reason!, /format/);
});

test("dates are read day-first and returned as YYYY-MM-DD", () => {
  assert.equal(normalizeDate("04/10/2026"), "2026-10-04");
  assert.equal(normalizeDate("4-3-26"), "2026-03-04");
  assert.equal(normalizeDate("2026-10-04"), "2026-10-04");
  assert.equal(normalizeDate("05 Sept 2026"), "2026-09-05");
  assert.equal(normalizeDate("Mar 7, 2026"), "2026-03-07");
  assert.equal(normalizeDate("31/02/2026"), null);
  assert.equal(normalizeDate("13/13/2026"), null);
  assert.equal(normalizeDate("yesterday"), null);
});

test("a clean bill has no warnings", () => {
  const w = validateExtraction(sample(), { today: TODAY });
  assert.deepEqual(w, []);
});

test("normalize: phone, gstin, date", () => {
  const e = sample();
  assert.equal(e.party.phone, "9848012345");
  assert.equal(e.invoiceDate, "2026-10-04");
  assert.equal(e.party.gstin, "36AAPFU0939F1ZW");
});

test("catches misread totals, words, GSTIN, tax and dates", () => {
  const e = sample();
  e.totals.grandTotal = 4900; // misread 7 as 9
  e.party.gstin = "36AAPFU0939F1ZQ";
  e.totals.sgst = 90;
  e.invoiceDate = "2026-12-04"; // day/month swapped
  e.items[1].amount = 2600;
  const w = validateExtraction(e, { today: TODAY });
  for (const c of ["WORDS_MISMATCH", "TOTAL_MISMATCH", "GSTIN_INVALID", "CGST_SGST_UNEQUAL", "FUTURE_DATE", "LINE_MATH", "SUBTOTAL_MISMATCH"]) {
    assert.ok(codes(w).includes(c), `expected ${c} in ${codes(w)}`);
  }
  assert.equal(w.find((x) => x.code === "LINE_MATH")!.field, "items.1.amount");
});

test("missing essentials and payment contradictions", () => {
  const e = sample();
  e.items = [];
  e.totals.grandTotal = null;
  e.invoiceNumber = null;
  e.paymentMode = "credit";
  e.paymentStatus = "paid";
  e.confidence.overall = 0.4;
  const c = codes(validateExtraction(e, { today: TODAY }));
  for (const x of ["NO_ITEMS", "MISSING_TOTAL", "MISSING_INVOICE_NUMBER", "CREDIT_BUT_PAID", "LOW_CONFIDENCE"]) assert.ok(c.includes(x), x);
});

test("line maths accepts amount before tax, after tax, % discount", () => {
  const base = { name: "x", hsn: null, barcode: null, unit: null, mrp: null, taxAmount: null, batch: null, expiry: null, confidence: null };
  assert.equal(lineAddsUp({ ...base, quantity: 2, rate: 50, discount: 0, taxRate: 18, amount: 100 }), true);
  assert.equal(lineAddsUp({ ...base, quantity: 2, rate: 50, discount: 0, taxRate: 18, amount: 118 }), true);
  assert.equal(lineAddsUp({ ...base, quantity: 2, rate: 50, discount: 10, taxRate: null, amount: 90 }), true);
  assert.equal(lineAddsUp({ ...base, quantity: 2, rate: 50, discount: 10, taxRate: null, amount: 85 }), false);
  assert.equal(lineAddsUp({ ...base, quantity: 2, rate: null, discount: null, taxRate: null, amount: 85 }), null);
});

test("duplicate fingerprint ignores formatting", () => {
  const a = sample();
  const b = sample();
  b.invoiceNumber = "slt-2026-0457";
  assert.equal(duplicateFingerprint(a), duplicateFingerprint(b));
  b.invoiceNumber = "SLT/2026/0458";
  assert.notEqual(duplicateFingerprint(a), duplicateFingerprint(b));
});
