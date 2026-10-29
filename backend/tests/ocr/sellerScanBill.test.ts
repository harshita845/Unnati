import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import Product from "../../src/models/Product";
import Category from "../../src/models/Category";
import HeaderCategory from "../../src/models/HeaderCategory";
import Seller from "../../src/models/Seller";
import SellerSubscription from "../../src/models/SellerSubscription";
import SubscriptionPlan from "../../src/models/SubscriptionPlan";
import SupplierLedger from "../../src/models/SupplierLedger";
import ScannedDocument from "../../src/models/ScannedDocument";
import StockLedger from "../../src/models/StockLedger";
import SellerPurchaseEntry from "../../src/models/SellerPurchaseEntry";
import AdminPurchaseEntry from "../../src/models/AdminPurchaseEntry";
import { getSellerScanBillAccess, ScanOwner } from "../../src/services/ocr/owner";
import { computeMatches } from "../../src/services/ocr/catalog";
import { confirmScan, ConfirmError } from "../../src/services/ocr/confirm";
import { emptyExtraction } from "../../src/services/ocr/schema";
import * as ocr from "../../src/modules/ocr/ocrController";

/**
 * Scan Bill in the seller panel is a premium plan feature. One store must never see or change
 * another store's products, suppliers or scans, and the plan's monthly allowance must hold.
 */

const uri = fs.readFileSync(`${process.env.TEST_URI_FILE}`, "utf8").trim();
if (!uri.startsWith("mongodb://127.0.0.1:")) throw new Error("Refusing to run against a non-local database");

const DAY = 24 * 60 * 60 * 1000;
const oid = () => new mongoose.Types.ObjectId();
let sellerA: any, sellerB: any, adminStore: any, premium: any, basic: any, category: any, uncovered: any;
let productA: any, productB: any, supplierA: any, supplierB: any;
const adminId = String(oid());
const ownerA = (): ScanOwner => ({ kind: "seller", sellerId: String(sellerA._id) });
const ownerB = (): ScanOwner => ({ kind: "seller", sellerId: String(sellerB._id) });
const admin: ScanOwner = { kind: "admin", adminId };

// Inserted directly: only the fields Scan Bill reads (the full sign-up form isn't under test)
const makeSeller = async (storeName: string, mobile: string, extra: any = {}) => {
  const doc = { _id: oid(), sellerName: storeName, storeName, mobile, email: `${mobile}@t.local`, category: "Hardware", city: "Challapalli", status: "Approved", ...extra };
  await Seller.collection.insertOne(doc as any);
  return doc;
};

const product = (seller: any, name: string, stock: number) =>
  Product.create({
    productName: name,
    seller: seller._id,
    category: category._id,
    status: "Active",
    publish: true,
    variations: [{ _id: oid(), variationType: "Standard", name: "Standard", value: "1 pc", price: 100, discPrice: 90, stock }],
  } as any);

const stockOf = async (p: any) => ((await Product.findById(p._id).lean()) as any).variations[0].stock;

/** A draft scan owned by `owner` holding a purchase bill for `qty` of `p`. */
const draftPurchase = async (owner: ScanOwner, p: any, qty: number, party: any = { name: "Sri Ram Traders" }) => {
  const data = {
    ...emptyExtraction("purchase"),
    party,
    items: [{ name: p.productName, quantity: qty, rate: 50, amount: qty * 50, action: "link", productId: String(p._id), variationId: String(p.variations[0]._id) }],
    totals: { grandTotal: qty * 50 },
  };
  return ScannedDocument.create({
    ...(owner.kind === "seller" ? { seller: owner.sellerId } : { admin: owner.adminId }),
    status: "draft",
    docType: "purchase",
    provider: "manual",
    data,
  } as any);
};

/** Calls a controller the way Express would and returns status + body. */
const call = async (handler: any, req: any) => {
  let status = 200;
  let body: any;
  const res: any = {
    status(s: number) {
      status = s;
      return res;
    },
    json(b: any) {
      body = b;
      return res;
    },
    setHeader() {},
    send(b: any) {
      body = b;
      return res;
    },
  };
  await new Promise<void>((resolve, reject) => {
    const done = () => resolve();
    res.json = ((orig) => (b: any) => {
      orig(b);
      done();
      return res;
    })(res.json);
    Promise.resolve(handler(req, res, (e: any) => (e ? reject(e) : resolve()))).catch(reject);
  });
  return { status, body };
};
const asSeller = (s: any, extra: any = {}) => ({ user: { userId: String(s._id), userType: "Seller" }, params: {}, query: {}, body: {}, ...extra });

before(async () => {
  await mongoose.connect(uri, { dbName: "unnati_seller_scan_test" });
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  await Promise.all([Product.init(), SupplierLedger.init(), ScannedDocument.init(), SellerPurchaseEntry.init(), AdminPurchaseEntry.init(), StockLedger.init()]);
  const hardware = await HeaderCategory.create({ name: "Electrical and Hardware", iconLibrary: "lucide", iconName: "box", slug: "eh", theme: "eh" } as any);
  const other = await HeaderCategory.create({ name: "Winter", iconLibrary: "lucide", iconName: "box", slug: "winter", theme: "winter" } as any);
  category = await Category.create({ name: "Plumbing Fittings", headerCategoryId: hardware._id, status: "Active" } as any);
  // A category whose header needs a plan this seller doesn't have
  uncovered = await Category.create({ name: "Woollen Wear", headerCategoryId: other._id, status: "Active", subscriptionEnabled: true } as any);

  sellerA = await makeSeller("Vijay Lakshmi Hardware", "9100000001");
  sellerB = await makeSeller("Other Store", "9100000002");
  adminStore = await makeSeller("Admin Store", "9999999999", { category: "Admin" });

  premium = await SubscriptionPlan.create({
    name: "yearly premium plan",
    price: 4999,
    durationValue: 1,
    durationUnit: "year",
    headerCategories: [hardware._id],
    limits: { scanBillEnabled: true, scanBillMonthlyLimit: 2 },
  } as any);
  basic = await SubscriptionPlan.create({ name: "Basic", price: 99, durationValue: 1, durationUnit: "month", headerCategories: [hardware._id] } as any);
  const sub = (seller: any, plan: any, endInDays: number) =>
    SellerSubscription.create({
      seller: seller._id,
      plan: plan._id,
      planSnapshot: { name: plan.name, price: plan.price, durationValue: 1, durationUnit: "year", limits: {} },
      headerCategories: [hardware._id],
      status: "Active",
      startDate: new Date(Date.now() - DAY),
      endDate: new Date(Date.now() + endInDays * DAY),
    } as any);
  await sub(sellerA, premium, 300);
  await sub(sellerB, basic, 30);

  productA = await product(sellerA, "CPVC Elbow 1 inch", 10);
  productB = await product(sellerB, "CPVC Elbow 1 inch", 7);
  supplierA = await SupplierLedger.create({ name: "Sri Ram Traders", phone: "9000000001", sellerId: sellerA._id, isAdmin: false } as any);
  supplierB = await SupplierLedger.create({ name: "Sri Ram Traders", phone: "9000000002", sellerId: sellerB._id, isAdmin: false } as any);
});

test("only a running plan with Scan Bill switched on gives access, with its monthly allowance", async () => {
  assert.deepEqual(await getSellerScanBillAccess(sellerA._id), { enabled: true, monthlyLimit: 2, planName: "yearly premium plan" });
  assert.equal((await getSellerScanBillAccess(sellerB._id)).enabled, false, "basic plan has no Scan Bill");

  // Switching it on for a plan reaches sellers who already bought it
  await SubscriptionPlan.updateOne({ _id: basic._id }, { $set: { "limits.scanBillEnabled": true, "limits.scanBillMonthlyLimit": 50 } });
  assert.equal((await getSellerScanBillAccess(sellerB._id)).monthlyLimit, 50);

  // Expired plan: no access (no grace period for a paid AI feature)
  await SellerSubscription.updateMany({ seller: sellerA._id }, { $set: { endDate: new Date(Date.now() - DAY) } });
  assert.equal((await getSellerScanBillAccess(sellerA._id)).enabled, false);
});

test("matching a bill only offers the seller's own products and suppliers", async () => {
  const bill: any = { ...emptyExtraction("purchase"), party: { name: "Sri Ram Traders" }, items: [{ name: "CPVC Elbow 1 inch", quantity: 1 }] };
  const matches = await computeMatches(bill, ownerA());
  const productIds = matches.items[0].candidates.map((c: any) => c.productId);
  assert.ok(productIds.includes(String(productA._id)));
  assert.ok(!productIds.includes(String(productB._id)), "another store's product must never be offered");
  const supplierIds = matches.party.candidates.map((c: any) => c.id);
  assert.ok(supplierIds.includes(String(supplierA._id)));
  assert.ok(!supplierIds.includes(String(supplierB._id)), "another store's supplier must never be offered");
});

test("a seller's confirmed purchase updates only their stock, purchase report and supplier ledger", async () => {
  const scan = await draftPurchase(ownerA(), productA, 5, { name: "Sri Ram Traders", supplierId: String(supplierA._id) });
  const result = await confirmScan(String(scan._id), ownerA(), {});
  assert.equal(result.alreadyConfirmed, false);
  assert.equal(await stockOf(productA), 15);
  assert.equal(await stockOf(productB), 7, "the other store's stock is untouched");

  const ledger: any = await StockLedger.findOne({ referenceId: scan._id }).lean();
  assert.equal(String(ledger.seller), String(sellerA._id));
  assert.equal(await SellerPurchaseEntry.countDocuments({ seller: sellerA._id }), 1, "lands in the seller's Purchase Report");
  assert.equal(await AdminPurchaseEntry.countDocuments({}), 0, "not in the admin's");
  assert.equal(((await SupplierLedger.findById(supplierA._id).lean()) as any).currentBalance, 250);
  assert.equal(((await SupplierLedger.findById(supplierB._id).lean()) as any).currentBalance || 0, 0);

  // Confirming twice adds nothing
  assert.equal((await confirmScan(String(scan._id), ownerA(), {})).alreadyConfirmed, true);
  assert.equal(await stockOf(productA), 15);
});

test("a new supplier from a seller's bill belongs to that seller", async () => {
  const scan = await draftPurchase(ownerA(), productA, 1, { name: "New Pipes Co", phone: "9888877777" });
  await confirmScan(String(scan._id), ownerA(), {});
  const created: any = await SupplierLedger.findOne({ name: "New Pipes Co" }).lean();
  assert.equal(String(created.sellerId), String(sellerA._id));
  assert.equal(created.isAdmin, false);
});

test("a seller can't move another store's stock, even by sending its product id", async () => {
  const scan = await draftPurchase(ownerA(), productB, 3);
  await assert.rejects(() => confirmScan(String(scan._id), ownerA(), {}), (e: any) => e instanceof ConfirmError && e.status === 403);
  assert.equal(await stockOf(productB), 7);
  assert.equal(((await ScannedDocument.findById(scan._id).lean()) as any).status, "draft", "nothing was saved");
});

test("a seller can't post to another store's supplier", async () => {
  const scan = await draftPurchase(ownerA(), productA, 1, { name: "Sri Ram Traders", supplierId: String(supplierB._id) });
  await assert.rejects(() => confirmScan(String(scan._id), ownerA(), {}), (e: any) => e instanceof ConfirmError && e.status === 409);
  assert.equal(await stockOf(productA), 10, "the whole save rolled back");
});

test("a seller can't open or save another store's scan", async () => {
  const scan = await draftPurchase(ownerA(), productA, 2);
  await assert.rejects(() => confirmScan(String(scan._id), ownerB(), {}), (e: any) => e instanceof ConfirmError && e.status === 404);
  const got = await call(ocr.getScan, asSeller(sellerB, { params: { id: String(scan._id) } }));
  assert.equal(got.status, 404);
  const mine = await call(ocr.getScan, asSeller(sellerA, { params: { id: String(scan._id) } }));
  assert.equal(mine.status, 200);
});

test("history lists only the seller's own scans, and the admin's leaves sellers' out", async () => {
  await draftPurchase(ownerA(), productA, 1, { name: "A bill" });
  await draftPurchase(ownerB(), productB, 1, { name: "B bill" });
  await draftPurchase(admin, productA, 1, { name: "Admin bill" });
  await ScannedDocument.updateMany({}, [{ $set: { partyName: "$data.party.name" } }]);

  const a = await call(ocr.listScans, asSeller(sellerA));
  assert.deepEqual(a.body.data.map((r: any) => r.partyName), ["A bill"]);
  const adminList = await call(ocr.listScans, { user: { userId: adminId, userType: "Admin" }, params: {}, query: {}, body: {} });
  assert.deepEqual(adminList.body.data.map((r: any) => r.partyName), ["Admin bill"]);
});

test("the plan's monthly allowance stops new AI scans, before any AI call", async () => {
  await ScannedDocument.create({ seller: sellerA._id, status: "confirmed", docType: "purchase", aiCalls: 2, provider: "test" } as any);
  const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex").toString("base64");
  const res = await call(ocr.scanBill, asSeller(sellerA, { body: { files: [{ dataBase64: png, mimeType: "image/png" }] } }));
  assert.equal(res.status, 429);
  assert.equal(res.body.code, "MONTHLY_LIMIT");
  assert.match(res.body.message, /all 2 scans/);
  // Typing a bill in by hand is never limited
  const manual = await call(ocr.scanBill, asSeller(sellerA, { body: { manual: true, docType: "purchase" } }));
  assert.equal(manual.status, 201);
  assert.equal(String(manual.body.data.seller), String(sellerA._id));

  const usage = await call(ocr.getUsage, asSeller(sellerA));
  assert.equal(usage.body.data.used, 2);
  assert.equal(usage.body.data.limit, 2);
});

test("sales bills stay admin-only", async () => {
  const scan = await draftPurchase(ownerA(), productA, 1);
  await ScannedDocument.updateOne({ _id: scan._id }, { $set: { "data.docType": "sales", docType: "sales" } });
  await assert.rejects(() => confirmScan(String(scan._id), ownerA(), {}), (e: any) => e instanceof ConfirmError && e.status === 400);
  assert.equal(await stockOf(productA), 10);
});

test("new products from a seller's bill follow their plan and start unpublished", async () => {
  const create = async (categoryId: string | null) => {
    const scan = await ScannedDocument.create({
      seller: sellerA._id,
      status: "draft",
      docType: "purchase",
      provider: "manual",
      data: { ...emptyExtraction("purchase"), party: { name: "X" }, items: [{ name: "Ball Valve", quantity: 4, rate: 80, action: "create", categoryId }], totals: { grandTotal: 320 } },
    } as any);
    return confirmScan(String(scan._id), ownerA(), {});
  };
  await assert.rejects(() => create(null), (e: any) => e instanceof ConfirmError && /choose a category/.test(e.message), "no guessed category for sellers");
  await assert.rejects(() => create(String(uncovered._id)), (e: any) => e instanceof ConfirmError && /Woollen Wear/.test(e.message));
  await create(String(category._id));
  const made: any = await Product.findOne({ productName: "Ball Valve" }).lean();
  assert.equal(String(made.seller), String(sellerA._id));
  assert.equal(made.publish, false);
  assert.equal(made.variations[0].stock, 4);
});

test("the admin's Scan Bill works as before", async () => {
  const scan = await draftPurchase(admin, productA, 2);
  await confirmScan(String(scan._id), admin, {});
  assert.equal(await stockOf(productA), 12);
  assert.equal(await AdminPurchaseEntry.countDocuments({}), 1);
  const supplier: any = await SupplierLedger.findOne({ isAdmin: true }).lean();
  assert.equal(supplier.name, "Sri Ram Traders");
});
