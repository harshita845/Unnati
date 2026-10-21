import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Order from "../../src/models/Order";
import OrderItem from "../../src/models/OrderItem";
import Seller from "../../src/models/Seller";
import GSTReportEntry from "../../src/models/GSTReportEntry";
import { buildGstReturns } from "../../src/services/gstReturnService";

// The models' queries are replaced with fixed data: no database is touched

const id = () => new mongoose.Types.ObjectId();
const storeId = id();
const restore: Array<() => void> = [];
afterEach(() => restore.splice(0).forEach((f) => f()));

/** A chainable query stub resolving to `rows` */
const q = (rows: any) => {
  const chain: any = { select: () => chain, populate: () => chain, sort: () => chain, lean: () => Promise.resolve(rows), then: (r: any, j: any) => Promise.resolve(rows).then(r, j) };
  return chain;
};
const stub = (model: any, method: string, impl: any) => {
  const orig = model[method];
  model[method] = impl;
  restore.push(() => (model[method] = orig));
};

function setup(opts: { gstin?: string; orders: any[]; items: any[]; purchases?: any[] }) {
  stub(Seller, "findOne", () => q({ _id: storeId, storeName: "Admin Store", taxNumber: opts.gstin ?? "36AABCU9603R1ZM", category: "Admin" }));
  stub(Order, "find", (filter: any) => q(filter.status === "Delivered" ? opts.orders : []));
  stub(OrderItem, "find", () => q(opts.items));
  stub(OrderItem, "distinct", () => Promise.resolve([]));
  stub(GSTReportEntry, "find", () => q(opts.purchases || []));
}

const order = (n: string, total: number, state: string) => ({ _id: id(), orderNumber: n, orderDate: new Date("2026-10-05T06:00:00Z"), total, deliveryAddress: { state } });
const item = (o: any, total: number, gst: number, hsn = "1001", qty = 1) => ({ order: o._id, seller: storeId, total, gst, hsnCode: hsn, quantity: qty, productName: "Thing" });

test("in-state sale: taxable value and tax are split from the GST-inclusive price into CGST + SGST", async () => {
  const o = order("ORD1", 1180, "Telangana");
  setup({ orders: [o], items: [item(o, 1180, 18)] });
  const r = await buildGstReturns("2026-10");
  assert.deepEqual(r.gstr1.b2cs, [{ supplyType: "Intra-state", placeOfSupply: "36", placeOfSupplyName: "Telangana", rate: 18, taxable: 1000, igst: 0, cgst: 90, sgst: 90 }]);
  assert.equal(r.gstr1.b2cl.length, 0);
  assert.deepEqual(r.gstr3b.outwardTaxable, { taxable: 1000, igst: 0, cgst: 90, sgst: 90 });
});

test("out-of-state sale is IGST; over ₹1 lakh it goes to B2C Large, at or under to B2C Small", async () => {
  const big = order("ORD2", 118000.01, "Karnataka");
  const small = order("ORD3", 1180, "Karnataka");
  setup({ orders: [big, small], items: [item(big, 118000.01, 18), item(small, 1180, 18)] });
  const r = await buildGstReturns("2026-10");
  assert.equal(r.gstr1.b2cl.length, 1);
  assert.equal(r.gstr1.b2cl[0].invoiceNumber, "ORD2");
  assert.equal(r.gstr1.b2cl[0].placeOfSupply, "29");
  assert.equal(r.gstr1.b2cs.length, 1);
  assert.equal(r.gstr1.b2cs[0].supplyType, "Inter-state");
  assert.equal(r.gstr1.b2cs[0].igst, 180);
  assert.equal(r.gstr3b.interStateUnregistered[0].placeOfSupplyName, "Karnataka");
});

test("HSN summary groups by HSN and rate, adding quantities and values", async () => {
  const a = order("ORD4", 2360, "Telangana");
  setup({ orders: [a], items: [item(a, 1180, 18, "1001", 2), item(a, 1180, 18, "1001", 3), item(a, 105, 5, "0402", 1)] });
  const r = await buildGstReturns("2026-10");
  const h = r.gstr1.hsn.find((x: any) => x.hsn === "1001")!;
  assert.equal(h.quantity, 5);
  assert.equal(h.taxable, 2000);
  assert.equal(r.gstr1.hsn.length, 2);
  assert.equal(r.gstr1.documents.netIssued, 1);
});

test("credit set-off: IGST credit pays IGST, then CGST, then SGST; leftover is carried forward", async () => {
  const o = order("ORD5", 11800, "Telangana"); // CGST 900 + SGST 900 due
  setup({
    orders: [o],
    items: [item(o, 11800, 18)],
    // Out-of-state supplier (Karnataka GSTIN): ₹1,500 IGST credit
    purchases: [{ supplierGstNumber: "29AAAAA0000A1Z5", slab18Amount: 8333.33, slab18Gst: 1500 }],
  });
  const r = await buildGstReturns("2026-10");
  assert.deepEqual(r.gstr3b.itc, { igst: 1500, cgst: 0, sgst: 0, purchaseBills: 1, purchaseTaxable: 8333.33 });
  assert.deepEqual(r.gstr3b.payable, { igst: 0, cgst: 0, sgst: 300 });
  assert.deepEqual(r.gstr3b.creditCarriedForward, { igst: 0, cgst: 0, sgst: 0 });
});

test("warnings: missing GSTIN, missing HSN, unknown delivery state", async () => {
  const o = order("ORD6", 100, "");
  setup({ gstin: "", orders: [o], items: [item(o, 100, 0, "")] });
  const r = await buildGstReturns("2026-10");
  assert.equal(r.warnings.length, 3);
});

test("a bad month is refused", async () => {
  await assert.rejects(buildGstReturns("2026-13"), /Choose a month/);
});
