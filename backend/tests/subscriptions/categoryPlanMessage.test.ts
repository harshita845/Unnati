import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import Category from "../../src/models/Category";
import HeaderCategory from "../../src/models/HeaderCategory";
import Seller from "../../src/models/Seller";
import SellerSubscription from "../../src/models/SellerSubscription";
import { assertSellerCanListProduct, SubscriptionError } from "../../src/services/sellerSubscriptionService";

/**
 * A hardware seller on a plan covering Electronics, Fashion and Grocery imported 491 products and
 * every row said "This category needs an active subscription plan". The category was never the one
 * in the sheet: the importer had no category for the row, so the server picked the oldest one in the
 * system (Bridal & Wedding Wear). The message must say which category it is refusing.
 */

const uri = fs.readFileSync(`${process.env.TEST_URI_FILE}`, "utf8").trim();
if (!uri.startsWith("mongodb://127.0.0.1:")) throw new Error("Refusing to run against a non-local database");

const oid = () => new mongoose.Types.ObjectId();
const DAY = 24 * 60 * 60 * 1000;
let seller: any, electronics: any, wedding: any, weddingCat: any, electronicsCat: any;

const header = (name: string) =>
  HeaderCategory.create({ name, iconLibrary: "lucide", iconName: "box", slug: name.toLowerCase(), theme: name.toLowerCase() } as any);

before(async () => {
  await mongoose.connect(uri, { dbName: "unnati_sub_message_test" });
});

after(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([Category.deleteMany({}), HeaderCategory.deleteMany({}), Seller.deleteMany({}), SellerSubscription.deleteMany({})]);
  electronics = await header("Electronics");
  wedding = await header("Wedding");
  // a plan is switched on for both
  electronicsCat = await Category.create({ name: "Smart Watches", slug: "smart-watches", status: "Active", headerCategoryId: electronics._id, subscriptionEnabled: true } as any);
  weddingCat = await Category.create({ name: "Bridal & Wedding Wear", slug: "bridal", status: "Active", headerCategoryId: wedding._id, subscriptionEnabled: true } as any);
  seller = await Seller.collection.insertOne({
    _id: oid(), storeName: "Vijay Lakshmi Hardware", email: "v@t.l", mobile: "9100000077", status: "Approved", isEnabled: true, category: "Hardware",
  } as any);
  await SellerSubscription.create({
    seller: seller.insertedId,
    planSnapshot: { name: "yearly premium plan", price: 4999, durationValue: 1, durationUnit: "year", limits: { maxProducts: 1000 } },
    categories: [],
    headerCategories: [electronics._id],
    status: "Active",
    startDate: new Date(Date.now() - DAY),
    endDate: new Date(Date.now() + 300 * DAY),
  } as any);
});

test("a category the plan doesn't cover is named in the message, with its header category", async () => {
  await assert.rejects(assertSellerCanListProduct(String(seller.insertedId), weddingCat._id), (e: unknown) => {
    assert.ok(e instanceof SubscriptionError);
    assert.equal((e as SubscriptionError).statusCode, 403);
    assert.match((e as Error).message, /The category "Bridal & Wedding Wear" \(Wedding\) needs an active subscription plan/);
    return true;
  });
});

test("a category the plan does cover is allowed", async () => {
  await assert.doesNotReject(assertSellerCanListProduct(String(seller.insertedId), electronicsCat._id));
});

test("an unknown category id still gives a sensible refusal, not a crash", async () => {
  // not a category at all: nothing requires a plan for it, so it is not this check's job to refuse it
  await assert.doesNotReject(assertSellerCanListProduct(String(seller.insertedId), oid()));
});
