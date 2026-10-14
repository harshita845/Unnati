import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { runExtraction } from "../../src/services/ocr/extract";
import { FakeOcrProvider, FAKE_SAMPLE_BILL } from "../../src/services/ocr/providers/fake";
import { setOcrProviderForTests } from "../../src/services/ocr/providers";
import { confirmBlockers, ReviewBillSchema } from "../../src/services/ocr/review";
import type { DocType } from "../../src/services/ocr/schema";

// The Purchase bill / Sales bill / Stock slip / Expense buttons on Scan Bill

const file = { mimeType: "image/jpeg", data: Buffer.from("fake image") };
const PRODUCT_ID = "6ac4e9a2f6085eb24733e3d4";
afterEach(() => setOcrProviderForTests(null));

const bill = (docType: DocType, extra: Record<string, unknown> = {}) =>
  ReviewBillSchema.parse({
    docType,
    party: { name: "Sharma Traders" },
    items: [{ name: "Rice 5kg", quantity: 2, rate: 300, amount: 600, action: "link", productId: PRODUCT_ID }],
    totals: { grandTotal: 600 },
    ...extra,
  });

for (const [type, said] of [
  ["purchase", /purchase bill from a supplier/],
  ["sales", /sales bill the store gave a customer/],
  ["stock_slip", /stock slip/],
  ["expense", /expense bill/],
] as const) {
  test(`${type}: the chosen type reaches the AI and is kept on the result`, async () => {
    const fake = new FakeOcrProvider([JSON.stringify({ ...FAKE_SAMPLE_BILL, docType: "unknown" })]);
    setOcrProviderForTests(fake);
    const out = await runExtraction([file], { docTypeHint: type });
    assert.match(fake.calls[0].prompt, said);
    assert.equal(out.extraction.docType, type);
  });

  test(`${type}: a complete bill can be saved`, () => {
    assert.deepEqual(confirmBlockers(bill(type)), []);
  });
}

test("no type chosen: the AI's own reading is kept", async () => {
  setOcrProviderForTests(new FakeOcrProvider([JSON.stringify({ ...FAKE_SAMPLE_BILL, docType: "sales" })]));
  const out = await runExtraction([file], { docTypeHint: null });
  assert.equal(out.extraction.docType, "sales");
});

test("a bill still marked 'Not sure' can't be saved", () => {
  assert.ok(confirmBlockers(bill("unknown")).some((m) => /Choose the bill type/.test(m)));
});

test("purchase needs a supplier; the other types don't", () => {
  const noParty = { party: {} };
  assert.ok(confirmBlockers(bill("purchase", noParty)).some((m) => /supplier/.test(m)));
  for (const t of ["sales", "stock_slip", "expense"] as const) assert.deepEqual(confirmBlockers(bill(t, noParty)), []);
});

test("stock slip saves without prices; the others need a grand total", () => {
  const noTotal = { totals: {} };
  assert.deepEqual(confirmBlockers(bill("stock_slip", noTotal)), []);
  for (const t of ["purchase", "sales", "expense"] as const) {
    assert.ok(confirmBlockers(bill(t, noTotal)).some((m) => /grand total/.test(m)), t);
  }
});

test("stock types need items; an expense doesn't", () => {
  const noItems = { items: [] };
  for (const t of ["purchase", "sales", "stock_slip"] as const) {
    assert.ok(confirmBlockers(bill(t, noItems)).some((m) => /at least one item/.test(m)), t);
  }
  assert.deepEqual(confirmBlockers(bill("expense", noItems)), []);
});

test("stock slip direction: in by default, out when chosen", () => {
  assert.equal(bill("stock_slip").stockDirection, undefined); // confirm treats missing as "in"
  assert.equal(bill("stock_slip", { stockDirection: "out" }).stockDirection, "out");
  assert.throws(() => bill("stock_slip", { stockDirection: "sideways" }));
});
