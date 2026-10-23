import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import Category from "../../src/models/Category";
import Product from "../../src/models/Product";
import { cache } from "../../src/utils/cache";

/**
 * Admin changes a picture, the customer app keeps showing the old one until someone reloads over
 * and over. Two things have to happen on every write, through any route: the server must drop the
 * copies it is answering from, and the open apps must be told to refetch.
 *
 * These tests write through the models directly — no controller — because that is the point: the
 * guarantee belongs to the model, so a route that forgets to call a notifier cannot reintroduce
 * the bug.
 */

const uri = fs.readFileSync(`${process.env.TEST_URI_FILE}`, "utf8").trim();
if (!uri.startsWith("mongodb://127.0.0.1:")) throw new Error("Refusing to run against a non-local database");

const sellerId = new mongoose.Types.ObjectId();
const categoryId = new mongoose.Types.ObjectId();

/** The keys the customer endpoints actually answer from. */
const CUSTOMER_KEYS = [
  "customer-categories-tree",
  "customer-categories-list-true",
  `customer-category-${categoryId}`,
  'search:hybrid:[["query","thali"]]',
];

const fillCache = () => {
  for (const key of CUSTOMER_KEYS) cache.set(key, { image: "old-photo.jpg" }, 10 * 60 * 1000);
};

const stillCached = () => CUSTOMER_KEYS.filter((key) => cache.get(key) !== null && cache.get(key) !== undefined);

const makeProduct = () => ({
  productName: "Decorated Pooja Thali",
  seller: sellerId,
  category: categoryId,
  status: "Active",
  publish: true,
  variations: [{ variationType: "Size", value: "Std", price: 599, discPrice: 449, stock: 10, mainImage: "old-photo.jpg" }],
});

before(async () => {
  // its own database: these tests wipe collections, and the suites run side by side
  await mongoose.connect(uri, { dbName: "unnati_live_updates_test" });
});

after(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Product.deleteMany({});
  await Category.deleteMany({});
});

test("changing a product photo drops the copies the customer app is served", async () => {
  const product: any = await Product.create(makeProduct() as any);
  fillCache();
  assert.equal(stillCached().length, CUSTOMER_KEYS.length, "cache should be warm before the edit");

  await Product.updateOne(
    { _id: product._id },
    { $set: { "variations.0.mainImage": "new-photo.jpg" } }
  );

  assert.deepEqual(stillCached(), [], "a stale copy here is what makes the old photo survive a reload");
});

test("the same holds for a save(), not just an update query", async () => {
  const product: any = await Product.create(makeProduct() as any);
  fillCache();

  product.variations[0].mainImage = "another-photo.jpg";
  await product.save();

  assert.deepEqual(stillCached(), [], "writes through save() must invalidate too");
});

test("changing a category image drops them as well", async () => {
  const category: any = await Category.create({ name: "Bridal Wear", slug: "bridal-wear", status: "Active", image: "old.jpg" } as any);
  fillCache();

  await Category.updateOne({ _id: category._id }, { $set: { image: "new.jpg" } });

  assert.deepEqual(stillCached(), [], "the category payloads are exactly what went stale");
});

test("deleting and bulk-inserting are covered too", async () => {
  const product: any = await Product.create(makeProduct() as any);

  fillCache();
  await Product.deleteOne({ _id: product._id });
  assert.deepEqual(stillCached(), [], "a removed product must not linger in a cached payload");

  fillCache();
  await Product.insertMany([makeProduct(), makeProduct()] as any);
  assert.deepEqual(stillCached(), [], "a bulk import must not leave the old list in place");
});

test("unrelated cached data is left alone", async () => {
  const product: any = await Product.create(makeProduct() as any);
  cache.set("orders-report-weekly", { rows: 3 }, 60 * 1000);
  fillCache();

  await Product.updateOne({ _id: product._id }, { $set: { productName: "Renamed" } });

  assert.deepEqual(stillCached(), []);
  assert.notEqual(cache.get("orders-report-weekly"), null, "invalidation must stay targeted");
});
