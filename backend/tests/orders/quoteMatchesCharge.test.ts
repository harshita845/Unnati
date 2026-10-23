import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import AppSettings from "../../src/models/AppSettings";
import Customer from "../../src/models/Customer";
import Order from "../../src/models/Order";
import Product from "../../src/models/Product";
import Seller from "../../src/models/Seller";
import { placeOrder, quoteOrder } from "../../src/services/orderPlacementService";

/**
 * The money rule: what the checkout screen is told (quoteOrder) must equal what the customer is
 * charged (placeOrder). Every case here places a real order and compares the two, line by line.
 */

const uri = fs.readFileSync(`${process.env.TEST_URI_FILE}`, "utf8").trim();
if (!uri.startsWith("mongodb://127.0.0.1:")) throw new Error("Refusing to run against a non-local database");

const id = () => new mongoose.Types.ObjectId();
const sellerId = id();
const customerId = id();
let dupatta: any, thali: any;

const address = { address: "1 Test St", city: "Hyderabad", state: "Telangana", pincode: "500001", latitude: 17.4, longitude: 78.47 };
const product = (name: string, price: number, disc: number, stock = 50) => ({
  _id: id(),
  productName: name,
  seller: sellerId,
  status: "Active",
  publish: true,
  variations: [{ _id: id(), variationType: "Size", value: "Std", price, discPrice: disc, compareAtPrice: price, stock }],
});

before(async () => {
  await mongoose.connect(uri);
  await Seller.collection.insertOne({
    _id: sellerId, storeName: "Test Store", status: "Approved", email: "s@t.local", mobile: "9000000001",
    location: { type: "Point", coordinates: [78.47, 17.4] }, serviceRadiusKm: 20,
  } as any);
  await Customer.collection.insertOne({ _id: customerId, name: "Test", email: "c@t.local", phone: "9000000002", totalOrders: 0 } as any);
  dupatta = product("Embroidered Wedding Dupatta", 1499, 1199);
  thali = product("Decorated Pooja Thali", 599, 449);
  await Product.collection.insertMany([dupatta, thali]);
});
after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

beforeEach(async () => {
  await Order.deleteMany({});
  await Customer.updateOne({ _id: customerId }, { $set: { totalOrders: 0 } });
  await Product.updateOne({ _id: dupatta._id }, { $set: { "variations.0.stock": 50 } });
  await Product.updateOne({ _id: thali._id }, { $set: { "variations.0.stock": 50 } });
});

const line = (p: any, quantity: number) => ({ product: { id: String(p._id) }, variantId: String(p.variations[0]._id), quantity });

/** Quote the cart, then place it, and insist the two agree */
async function quoteThenPlace(body: any, online = false) {
  const quote = await quoteOrder(String(customerId), { ...body, paymentMethod: online ? "Razorpay" : "COD" });
  const { order } = await placeOrder({ userId: String(customerId), body: { ...body, address, paymentMethod: online ? "Razorpay" : "COD" }, online }, null);
  assert.equal(quote.total, order.total, `total: quote ${quote.total} vs charged ${order.total}`);
  assert.equal(quote.subtotal, order.subtotal, "subtotal");
  assert.equal(quote.platformFee, order.platformFee, "platform fee");
  assert.equal(quote.deliveryFee, order.shipping, "delivery fee");
  assert.equal(quote.totalDiscount, order.discount, "discount");
  assert.equal(quote.giftPackagingFee, order.giftPackagingFee, "gift packaging");
  assert.equal(quote.tipAmount, order.tipAmount, "tip");
  return { quote, order };
}

test("the quoted total is the amount charged, and the lines add up to it", async () => {
  await AppSettings.deleteMany({});
  await AppSettings.collection.insertOne({ deliveryCharges: 0, freeDeliveryThreshold: 199, platformFee: 0 } as any);
  const items = [line(dupatta, 2), line(thali, 1)];
  const { quote, order } = await quoteThenPlace({ items });
  // 1199 x 2 + 449
  assert.equal(quote.subtotal, 2847);
  assert.equal(quote.total, 2847);
  assert.equal(order.total, 2847);
  assert.equal(quote.items.reduce((s: number, l: any) => s + l.lineTotal, 0), quote.subtotal);
});

test("a handling fee set in settings is both quoted and charged", async () => {
  await AppSettings.deleteMany({});
  await AppSettings.collection.insertOne({ deliveryCharges: 0, freeDeliveryThreshold: 199, platformFee: 2 } as any);
  const { quote, order } = await quoteThenPlace({ items: [line(thali, 1)] });
  assert.equal(quote.platformFee, 2);
  assert.equal(quote.total, 451);
  assert.equal(order.total, 451);
});

test("delivery fee under the free-delivery threshold is quoted and charged", async () => {
  await AppSettings.deleteMany({});
  await AppSettings.collection.insertOne({ deliveryCharges: 40, freeDeliveryThreshold: 5000, platformFee: 0 } as any);
  const { quote } = await quoteThenPlace({ items: [line(thali, 1)] });
  assert.equal(quote.deliveryFee, 40);
  assert.equal(quote.total, 489);
});

test("online payment discount appears in both the quote and the charge", async () => {
  await AppSettings.deleteMany({});
  await AppSettings.collection.insertOne({
    deliveryCharges: 0, freeDeliveryThreshold: 199, platformFee: 0,
    onlinePaymentDiscount: { enabled: true, percentage: 10 },
  } as any);
  const { quote, order } = await quoteThenPlace({ items: [line(thali, 1)] }, true);
  assert.equal(quote.onlineDiscount, 44.9);
  assert.equal(quote.total, 404.1);
  assert.equal(order.total, 404.1);
});

test("tip and gift packaging use the fee from settings, not a number in the code", async () => {
  await AppSettings.deleteMany({});
  await AppSettings.collection.insertOne({ deliveryCharges: 0, freeDeliveryThreshold: 199, platformFee: 0, giftPackagingFee: 25 } as any);
  const { quote } = await quoteThenPlace({ items: [line(thali, 1)], tipAmount: 20, giftPackaging: true });
  assert.equal(quote.giftPackagingFee, 25);
  assert.equal(quote.tipAmount, 20);
  assert.equal(quote.total, 494);
});

test("the quote flags an item that cannot be ordered instead of quietly dropping it", async () => {
  await AppSettings.deleteMany({});
  await AppSettings.collection.insertOne({ deliveryCharges: 0, freeDeliveryThreshold: 199, platformFee: 0 } as any);
  await Product.updateOne({ _id: thali._id }, { $set: { "variations.0.stock": 1 } });
  const quote = await quoteOrder(String(customerId), { items: [line(thali, 5)], paymentMethod: "COD" });
  assert.equal(quote.blocking.length, 1);
  assert.match(quote.blocking[0], /Only 1 left in stock/);
});

/**
 * The reported bug: the checkout screen showed ₹4047 while the delivery app showed ₹4895 for
 * the same order. The screen had subtracted a discount the server never granted. The quote has to
 * report the promised figure as unavailable rather than show a total nobody will charge.
 */
test("a discount the server refuses is not in the quoted total either", async () => {
  await AppSettings.deleteMany({});
  await AppSettings.collection.insertOne({ deliveryCharges: 0, freeDeliveryThreshold: 199, platformFee: 0 } as any);
  const body = { items: [line(dupatta, 2), line(thali, 1)], couponCode: "NOSUCHCOUPON" };
  const quote = await quoteOrder(String(customerId), { ...body, paymentMethod: "COD" });
  assert.equal(quote.couponDiscount, 0, "a coupon that does not exist must not reduce the quote");
  assert.ok(quote.couponError, "the screen must be told why the coupon was not applied");
  assert.equal(quote.total, 2847, "the quote shows the real price, not the discounted one");

  // And the order cannot go through at some other number behind the customer's back
  await assert.rejects(
    placeOrder({ userId: String(customerId), body: { ...body, address, paymentMethod: "COD" }, online: false }, null),
    /Coupon not applied/
  );
  assert.equal(await Order.countDocuments(), 0);
});

test("quoting changes nothing: no order, no stock movement", async () => {
  await AppSettings.deleteMany({});
  await AppSettings.collection.insertOne({ deliveryCharges: 0, freeDeliveryThreshold: 199, platformFee: 0 } as any);
  const before: any = await Product.findById(thali._id).lean();
  await quoteOrder(String(customerId), { items: [line(thali, 2)], paymentMethod: "COD" });
  const after: any = await Product.findById(thali._id).lean();
  assert.equal(after.variations[0].stock, before.variations[0].stock);
  assert.equal(await Order.countDocuments(), 0);
});
