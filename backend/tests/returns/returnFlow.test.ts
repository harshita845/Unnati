import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import Customer from "../../src/models/Customer";
import OrderItem from "../../src/models/OrderItem";
import Product from "../../src/models/Product";
import Refund from "../../src/models/Refund";
import Return from "../../src/models/Return";
import { completeReturnRequest } from "../../src/services/returnCompletionService";

/**
 * A return is finished when the stock is back and the customer has their money. That used to happen
 * only if a delivery partner closed the task; a seller or admin pressing "Completed" moved nothing.
 * These tests go through completeReturnRequest, which is now the single path all three screens use.
 */

const uri = fs.readFileSync(`${process.env.TEST_URI_FILE}`, "utf8").trim();
if (!uri.startsWith("mongodb://127.0.0.1:")) throw new Error("Refusing to run against a non-local database");

const sellerId = new mongoose.Types.ObjectId();
const categoryId = new mongoose.Types.ObjectId();
let customerId: mongoose.Types.ObjectId;
let orderId: mongoose.Types.ObjectId;

const STARTING_STOCK = 5;
const UNIT_PRICE = 449;

/** A delivered order line for one product, plus the product it came from. */
async function deliveredLine(stock = STARTING_STOCK, quantity = 1) {
  const variantId = new mongoose.Types.ObjectId();
  const product: any = await Product.create({
    productName: "Decorated Pooja Thali",
    seller: sellerId,
    category: categoryId,
    status: "Active",
    publish: true,
    stock,
    variations: [{ _id: variantId, variationType: "Size", value: "Std", price: 599, discPrice: UNIT_PRICE, stock }],
  } as any);

  const orderItem: any = await OrderItem.create({
    order: orderId,
    product: product._id,
    seller: sellerId,
    variantId,
    productName: product.productName,
    quantity,
    unitPrice: UNIT_PRICE,
    total: UNIT_PRICE * quantity,
    status: "Delivered",
  } as any);

  return { product, orderItem, variantId };
}

async function request(orderItem: any, requestType: "Return" | "Replacement", quantity = 1) {
  return Return.create({
    order: orderId,
    orderItem: orderItem._id,
    customer: customerId,
    requestType,
    reason: "Damaged",
    quantity,
    status: "Approved",
  } as any);
}

const variantStock = async (productId: any, variantId: any) => {
  const p: any = await Product.findById(productId).lean();
  return p.variations.find((v: any) => String(v._id) === String(variantId)).stock;
};

const walletOf = async () => {
  const c: any = await Customer.findById(customerId).lean();
  return c.creditBalance || 0;
};

before(async () => {
  await mongoose.connect(uri, { dbName: "unnati_returns_test" });
});

after(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([
    Product.deleteMany({}),
    OrderItem.deleteMany({}),
    Return.deleteMany({}),
    Refund.deleteMany({}),
    Customer.deleteMany({}),
  ]);
  customerId = new mongoose.Types.ObjectId();
  orderId = new mongoose.Types.ObjectId();
  await Customer.collection.insertOne({
    _id: customerId,
    name: "Test Customer",
    email: "c@test.local",
    phone: "9000000001",
    creditBalance: 0,
  } as any);
});

test("completing a return refunds the customer and puts the item back in stock", async () => {
  const { product, orderItem, variantId } = await deliveredLine();
  const returnRequest: any = await request(orderItem, "Return");

  const result = await completeReturnRequest(returnRequest);

  assert.equal(result.refundIssued, UNIT_PRICE, "the customer must get the item's price back");
  assert.equal(await walletOf(), UNIT_PRICE, "the refund must reach the wallet, not just a status field");
  assert.equal(await variantStock(product._id, variantId), STARTING_STOCK + 1, "the returned unit is sellable again");

  const saved: any = await Return.findById(returnRequest._id);
  assert.equal(saved.status, "Completed");
  assert.ok(saved.refundId, "the refund record must be linked to the request");
  assert.equal((await OrderItem.findById(orderItem._id))!.status, "Returned");
  assert.equal(await Refund.countDocuments({ customer: customerId }), 1);
});

test("a replacement sends another unit instead of money", async () => {
  const { product, orderItem, variantId } = await deliveredLine();
  const returnRequest: any = await request(orderItem, "Replacement");

  const result = await completeReturnRequest(returnRequest);

  assert.equal(result.replacementSent, true);
  assert.equal(result.refundIssued, null, "a fulfilled replacement must not also refund");
  assert.equal(await walletOf(), 0);
  // one unit came back, one went out
  assert.equal(await variantStock(product._id, variantId), STARTING_STOCK, "the swap must net to zero");
  assert.equal((await OrderItem.findById(orderItem._id))!.status, "Replaced");
});

test("a replacement with nothing left to send becomes a refund", async () => {
  // the only unit in stock is the one the customer is holding
  const { product, orderItem, variantId } = await deliveredLine(0);
  const returnRequest: any = await request(orderItem, "Replacement");

  const result = await completeReturnRequest(returnRequest);

  assert.equal(result.replacementSent, false);
  assert.equal(result.replacementUnavailable, true);
  assert.equal(result.refundIssued, UNIT_PRICE, "the customer must not be left with neither item nor money");
  assert.equal(await walletOf(), UNIT_PRICE);
  assert.equal(await variantStock(product._id, variantId), 1, "the returned unit is still restocked");
  assert.equal((await Return.findById(returnRequest._id))!.status, "Completed");
});

test("completing twice never pays twice", async () => {
  const { product, orderItem, variantId } = await deliveredLine();
  const returnRequest: any = await request(orderItem, "Return");

  await completeReturnRequest(returnRequest);
  const second = await completeReturnRequest(await Return.findById(returnRequest._id));

  assert.equal(second.applied, false, "an already-completed request must be left alone");
  assert.equal(await walletOf(), UNIT_PRICE, "the wallet must not be credited a second time");
  assert.equal(await variantStock(product._id, variantId), STARTING_STOCK + 1, "stock must not be restored twice");
  assert.equal(await Refund.countDocuments({ customer: customerId }), 1);
});

test("the seller and admin screens settle too, even though they write the status first", async () => {
  // Reproduces exactly what those controllers do: mark the record Completed, then settle it.
  // A status-based guard made this a no-op, so the customer was never paid.
  const { product, orderItem, variantId } = await deliveredLine();
  const returnRequest: any = await request(orderItem, "Return");
  returnRequest.status = "Completed";
  await returnRequest.save();

  const result = await completeReturnRequest(await Return.findById(returnRequest._id));

  assert.equal(result.applied, true, "writing the status first must not skip the settlement");
  assert.equal(result.refundIssued, UNIT_PRICE);
  assert.equal(await walletOf(), UNIT_PRICE, "the customer must be paid from these screens too");
  assert.equal(await variantStock(product._id, variantId), STARTING_STOCK + 1);
  assert.ok((await Return.findById(returnRequest._id))!.settledAt, "settlement must be recorded");
});

test("the refund agreed at approval wins over the line price", async () => {
  const { orderItem } = await deliveredLine();
  const returnRequest: any = await request(orderItem, "Return");
  returnRequest.refundAmount = 200; // admin approved a partial refund
  await returnRequest.save();

  const result = await completeReturnRequest(returnRequest);

  assert.equal(result.refundIssued, 200);
  assert.equal(await walletOf(), 200);
});

test("a multi-unit return refunds and restocks every unit", async () => {
  const { product, orderItem, variantId } = await deliveredLine(STARTING_STOCK, 3);
  const returnRequest: any = await request(orderItem, "Return", 3);

  const result = await completeReturnRequest(returnRequest);

  assert.equal(result.refundIssued, UNIT_PRICE * 3);
  assert.equal(await variantStock(product._id, variantId), STARTING_STOCK + 3);
});
