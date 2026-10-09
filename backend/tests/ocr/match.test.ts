import { test } from "node:test";
import assert from "node:assert/strict";
import { matchItems, matchParty, normalizeName, CatalogEntry } from "../../src/services/ocr/match";
import { confirmBlockers, resolvePaid, ReviewBillSchema } from "../../src/services/ocr/review";

const catalog: CatalogEntry[] = [
  { productId: "p1", variationId: "v1", name: "TATA Salt 1 kg", barcodes: ["8901058000016"] },
  { productId: "p2", variationId: "v2", name: "Aashirvaad Whole Wheat Atta", variant: "5 kg" },
  { productId: "p2", variationId: "v3", name: "Aashirvaad Whole Wheat Atta", variant: "10 kg" },
  { productId: "p3", variationId: "v4", name: "Fortune Sunflower Refined Oil 1L", sku: "FSO-1L" },
  { productId: "p4", variationId: "v5", name: "Surf Excel Easy Wash 1kg" },
];

test("normalizeName unifies units and punctuation", () => {
  assert.equal(normalizeName("Tata Salt 1Kg."), "tata salt 1 kg");
  assert.equal(normalizeName("Oil 1 Ltr"), "oil 1 l");
  assert.equal(normalizeName("Biscuit 100gm"), "biscuit 100 g");
});

test("barcode / SKU hits are matched", () => {
  const [a, b] = matchItems([{ name: "anything", barcode: "8901058000016" }, { name: "x", barcode: "fso-1l" }], catalog);
  assert.equal(a.status, "matched");
  assert.equal(a.best!.productId, "p1");
  assert.equal(a.best!.reason, "barcode");
  assert.equal(b.best!.productId, "p3");
});

test("close names match, variants pick the right size, nonsense is new", () => {
  const [salt, atta, oil, unknown] = matchItems(
    [{ name: "Tata Salt 1Kg", barcode: null }, { name: "Aashirvaad Atta 5kg", barcode: null }, { name: "Fortune Sunflower Oil 1 Ltr", barcode: null }, { name: "Zebra Crossing Paint", barcode: null }],
    catalog
  );
  assert.equal(salt.status, "matched");
  assert.equal(salt.best!.productId, "p1");
  assert.ok(["matched", "similar"].includes(atta.status));
  assert.equal(atta.best!.variationId, "v2");
  assert.ok(["matched", "similar"].includes(oil.status));
  assert.equal(oil.best!.productId, "p3");
  assert.equal(unknown.status, "new");
});

test("party: GSTIN beats name, phone next, then fuzzy name", () => {
  const parties = [
    { id: "s1", name: "Sri Lakshmi Traders", gstin: "36AAPFU0939F1ZW", phone: "9848012345" },
    { id: "s2", name: "Lakshmi General Stores", phone: "9000000000" },
  ];
  assert.equal(matchParty({ name: "Totally Different", gstin: "36aapfu0939f1zw", phone: null }, parties).best!.id, "s1");
  assert.equal(matchParty({ name: null, gstin: null, phone: "+91 90000 00000" }, parties).best!.id, "s2");
  const byName = matchParty({ name: "Sri Laxmi Traders", gstin: null, phone: null }, parties);
  assert.equal(byName.best!.id, "s1");
  assert.notEqual(byName.status, "new");
  assert.equal(matchParty({ name: "Reliance Fresh", gstin: null, phone: null }, parties).status, "new");
});

test("confirm blockers and paid amount", () => {
  const bill = ReviewBillSchema.parse({
    docType: "purchase",
    party: { name: "Sri Lakshmi Traders" },
    items: [
      { name: "Tata Salt", quantity: 2, rate: 25, amount: 50, action: "link" },
      { name: "", quantity: 0, action: "create" },
    ],
    totals: { grandTotal: 50 },
  });
  const blockers = confirmBlockers(bill);
  assert.equal(blockers.length, 3); // line 1 no product, line 2 qty + name
  assert.equal(resolvePaid({ ...bill, paymentStatus: "paid", amountPaid: null }), 50);
  assert.equal(resolvePaid({ ...bill, paymentMode: "credit", paymentStatus: null, amountPaid: null }), 0);
  assert.equal(resolvePaid({ ...bill, amountPaid: 80 }), 50);
  assert.deepEqual(confirmBlockers({ ...bill, docType: "expense" }), []);
  assert.ok(confirmBlockers({ ...bill, docType: "unknown" }).some((b) => /bill type/.test(b)));
});

test("blank money fields stay blank (never become ₹0)", () => {
  const bill = ReviewBillSchema.parse({ docType: "purchase", amountPaid: null, totals: { grandTotal: "175", discount: "" }, items: [{ name: "x", quantity: "", rate: null }] });
  assert.equal(bill.amountPaid, null);
  assert.equal(bill.totals.grandTotal, 175);
  assert.equal(bill.totals.discount, null);
  assert.equal(bill.items[0].quantity, null);
  assert.equal(resolvePaid({ ...bill, paymentStatus: "paid" }), 175);
});
