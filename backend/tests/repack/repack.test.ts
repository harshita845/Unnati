import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import Product from "../../src/models/Product";
import Repack from "../../src/models/Repack";
import RepackRule from "../../src/models/RepackRule";
import StockLedger from "../../src/models/StockLedger";
import { createRepack, previewRepack, RepackError } from "../../src/services/repackService";
import { parsePackQuantity, suggestSourcePerPack } from "../../src/utils/packQuantity";

/**
 * The client's example: a store buys a 50 kg bag of rice and sells it as 1 kg and 5 kg packets.
 * Repacking 20 x 1 kg and 4 x 5 kg must leave 10 kg of bulk, add the packets to stock, cost each
 * packet correctly, and leave an audit trail — and it must never oversell the bulk.
 */

const uri = fs.readFileSync(`${process.env.TEST_URI_FILE}`, "utf8").trim();
if (!uri.startsWith("mongodb://127.0.0.1:")) throw new Error("Refusing to run against a non-local database");

const store = new mongoose.Types.ObjectId();
const otherStore = new mongoose.Types.ObjectId();
const adminId = new mongoose.Types.ObjectId();
const actor = { type: "Admin" as const, id: String(adminId), name: "Admin" };
let rice: any; // variations: loose (bulk, counted in kg), 1 kg packet, 5 kg packet
let ids: { product: string; loose: string; one: string; five: string };

const variation = (value: string, name: string, stock: number, purchasePrice?: number) => ({
  _id: new mongoose.Types.ObjectId(),
  variationType: name,
  name,
  value,
  price: 100,
  discPrice: 90,
  stock,
  ...(purchasePrice !== undefined ? { purchasePrice } : {}),
});

const stockOf = async (productId: string, variationId: string) => {
  const p: any = await Product.findById(productId).lean();
  return p.variations.find((v: any) => String(v._id) === variationId).stock;
};
const costOf = async (productId: string, variationId: string) => {
  const p: any = await Product.findById(productId).lean();
  return p.variations.find((v: any) => String(v._id) === variationId).purchasePrice;
};

const clientExample = (extra: any = {}) => ({
  sellerId: String(store),
  source: { productId: ids.product, variationId: ids.loose },
  outputs: [
    { productId: ids.product, variationId: ids.one, packs: 20, sourcePerPack: 1, packagingCostPerPack: 2 },
    { productId: ids.product, variationId: ids.five, packs: 4, sourcePerPack: 5, packagingCostPerPack: 5 },
  ],
  ...extra,
});

before(async () => {
  await mongoose.connect(uri, { dbName: "unnati_repack_test" });
});

after(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([Product.deleteMany({}), Repack.deleteMany({}), RepackRule.deleteMany({}), StockLedger.deleteMany({})]);
  const loose = variation("1 kg", "Loose", 50, 40); // 50 kg of bulk rice at ₹40/kg
  const one = variation("1 kg", "Packet", 0);
  const five = variation("5 kg", "Packet", 0);
  rice = await Product.create({
    productName: "Sona Masoori Rice",
    seller: store,
    category: new mongoose.Types.ObjectId(),
    status: "Active",
    publish: true,
    variations: [loose, one, five],
  } as any);
  ids = { product: String(rice._id), loose: String(loose._id), one: String(one._id), five: String(five._id) };
});

test("the client's example: 50 kg into 20 x 1 kg and 4 x 5 kg leaves 10 kg of bulk", async () => {
  const record: any = await createRepack(clientExample(), actor);

  assert.equal(await stockOf(ids.product, ids.loose), 10, "bulk goes down by the 40 kg used");
  assert.equal(await stockOf(ids.product, ids.one), 20, "20 one-kilo packets are created");
  assert.equal(await stockOf(ids.product, ids.five), 4, "4 five-kilo packets are created");

  assert.equal(record.source.totalUsed, 40);
  assert.equal(record.source.stockBefore, 50);
  assert.equal(record.source.stockAfter, 10);
  assert.equal(record.totals.packsCreated, 24);
  assert.match(record.repackNumber, /^RPK-\d{8}-\d{3}$/);
});

test("each packet is costed: its share of the bulk plus its packaging", async () => {
  const record: any = await createRepack(clientExample(), actor);
  const one = record.outputs.find((o: any) => String(o.variationId) === ids.one);
  const five = record.outputs.find((o: any) => String(o.variationId) === ids.five);

  assert.equal(one.costPerPack, 42, "1 kg x ₹40 + ₹2 packaging");
  assert.equal(five.costPerPack, 205, "5 kg x ₹40 + ₹5 packaging");
  assert.equal(record.totals.sourceCost, 1600, "40 kg x ₹40");
  assert.equal(record.totals.packagingCost, 60, "20 x ₹2 + 4 x ₹5");
  assert.equal(record.totals.totalCost, 1660);
  // the packet's purchase price is updated so profit reports use the real cost
  assert.equal(await costOf(ids.product, ids.one), 42);
  assert.equal(await costOf(ids.product, ids.five), 205);
});

test("wastage comes out of the bulk and its cost is shared across the packets made", async () => {
  // 0.5 kg spilt: ₹20 of rice, shared by how much bulk each pack size used (20 kg each)
  const record: any = await createRepack(clientExample({ wastage: 0.5 }), actor);

  assert.equal(await stockOf(ids.product, ids.loose), 9.5, "40 kg packed + 0.5 kg wasted");
  assert.equal(record.totals.wastageCost, 20);
  const one = record.outputs.find((o: any) => String(o.variationId) === ids.one);
  const five = record.outputs.find((o: any) => String(o.variationId) === ids.five);
  assert.equal(one.costPerPack, 42.5, "₹10 of wastage over 20 packets adds 50 paise each");
  assert.equal(five.costPerPack, 207.5, "₹10 of wastage over 4 packets adds ₹2.50 each");
  assert.equal(record.totals.totalCost, 1680);
});

test("the stock ledger records the bulk going out and every pack size coming in", async () => {
  const record: any = await createRepack(clientExample(), actor);
  const entries: any[] = await StockLedger.find({ referenceId: record._id }).lean();

  assert.equal(entries.length, 3);
  const out = entries.find((e) => e.type === "OUT");
  assert.equal(out.source, "REPACK");
  assert.equal(out.quantity, 40);
  assert.equal(out.previousStock, 50);
  assert.equal(out.newStock, 10);
  const ins = entries.filter((e) => e.type === "IN");
  assert.deepEqual(ins.map((e) => e.quantity).sort((a, b) => a - b), [4, 20]);
  assert.ok(entries.every((e) => String(e.seller) === String(store)), "every movement belongs to the store");
});

test("asking for more than the bulk holds is refused and nothing moves", async () => {
  const tooMuch = clientExample({
    outputs: [{ productId: ids.product, variationId: ids.five, packs: 12, sourcePerPack: 5 }], // 60 kg
  });
  await assert.rejects(createRepack(tooMuch, actor), (e: unknown) => e instanceof RepackError && /Not enough bulk stock/.test((e as Error).message));
  assert.equal(await stockOf(ids.product, ids.loose), 50);
  assert.equal(await stockOf(ids.product, ids.five), 0);
  assert.equal(await Repack.countDocuments(), 0);
  assert.equal(await StockLedger.countDocuments(), 0);
});

test("two people repacking the same bulk at once can never oversell it", async () => {
  // each wants 30 kg of the 50 kg: only one can have it
  const each = clientExample({ outputs: [{ productId: ids.product, variationId: ids.one, packs: 30, sourcePerPack: 1 }] });
  const results = await Promise.allSettled([createRepack(each, actor), createRepack(each, actor)]);

  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, "exactly one repack goes through");
  assert.equal(await stockOf(ids.product, ids.loose), 20, "bulk never goes below what was really used");
  assert.equal(await stockOf(ids.product, ids.one), 30);
  assert.equal(await Repack.countDocuments(), 1);
});

test("stock in another store can't be used", async () => {
  const theirs: any = await Product.create({
    productName: "Rice",
    seller: otherStore,
    category: new mongoose.Types.ObjectId(),
    status: "Active",
    publish: true,
    variations: [variation("1 kg", "Packet", 0)],
  } as any);
  const crossStore = clientExample({
    outputs: [{ productId: String(theirs._id), variationId: String(theirs.variations[0]._id), packs: 5, sourcePerPack: 1 }],
  });
  await assert.rejects(createRepack(crossStore, actor), /isn't in this store/);
  assert.equal(await stockOf(ids.product, ids.loose), 50);
});

test("bags into packets: a 1 kg packet uses 1/50 of a 50 kg bag", async () => {
  const bag = variation("50 kg", "Bag", 2, 2000); // 2 bags at ₹2000 each
  await Product.updateOne({ _id: rice._id }, { $push: { variations: bag } });

  const preview = await previewRepack({
    sellerId: String(store),
    source: { productId: ids.product, variationId: String(bag._id) },
    outputs: [{ productId: ids.product, variationId: ids.one, packs: 10, sourcePerPack: 0.02 }],
  });
  assert.equal(preview.outputs[0].suggestedSourcePerPack, 0.02, "the labels suggest the right ratio");
  assert.equal(preview.source.totalUsed, 0.2, "ten packets use a fifth of a bag");
  assert.equal(preview.outputs[0].costPerPack, 40, "₹2000 bag / 50");
  assert.equal(preview.warnings.length, 0);

  await createRepack(
    { sellerId: String(store), source: { productId: ids.product, variationId: String(bag._id) }, outputs: [{ productId: ids.product, variationId: ids.one, packs: 10, sourcePerPack: 0.02 }] },
    actor
  );
  assert.equal(await stockOf(ids.product, String(bag._id)), 1.8);
});

test("packets already on the shelf are averaged into the new cost", async () => {
  await Product.updateOne({ _id: rice._id, "variations._id": ids.one }, { $set: { "variations.$.stock": 10, "variations.$.purchasePrice": 30 } });
  await createRepack(clientExample({ outputs: [{ productId: ids.product, variationId: ids.one, packs: 20, sourcePerPack: 1, packagingCostPerPack: 2 }] }), actor);
  // (10 x ₹30 + 20 x ₹42) / 30
  assert.equal(await costOf(ids.product, ids.one), 38);
  assert.equal(await stockOf(ids.product, ids.one), 30);
});

test("previewing changes nothing, and flags a ratio that disagrees with the labels", async () => {
  const preview = await previewRepack(
    clientExample({ outputs: [{ productId: ids.product, variationId: ids.five, packs: 2, sourcePerPack: 2 }] }) // a "5 kg" pack set to use 2 kg
  );
  assert.equal(preview.source.stockAfter, 46);
  assert.equal(preview.warnings.length, 1, "a 5 kg pack using 2 kg of bulk is almost certainly a typo");
  assert.match(preview.warnings[0], /labels suggest 5/);
  assert.equal(await stockOf(ids.product, ids.loose), 50, "a preview never moves stock");
  assert.equal(await Repack.countDocuments(), 0);
});

test("each conversion is remembered for the store, so the next repack starts pre-filled", async () => {
  await createRepack(clientExample(), actor);
  const rules: any[] = await RepackRule.find({ seller: store }).lean();
  assert.equal(rules.length, 2);
  const five = rules.find((r) => String(r.targetVariationId) === ids.five);
  assert.equal(five.sourcePerPack, 5);
  assert.equal(five.packagingCostPerPack, 5);
});

test("packs must be whole numbers, and an item can't be repacked into itself", async () => {
  await assert.rejects(
    previewRepack(clientExample({ outputs: [{ productId: ids.product, variationId: ids.one, packs: 2.5, sourcePerPack: 1 }] })),
    /whole number of packs/
  );
  await assert.rejects(
    previewRepack(clientExample({ outputs: [{ productId: ids.product, variationId: ids.loose, packs: 2, sourcePerPack: 1 }] })),
    /can't be the same item/
  );
});

test("pack labels are read in any common unit", () => {
  assert.equal(suggestSourcePerPack("1 Quintal", "1 kg"), 0.01, "quintal to kilo");
  assert.equal(suggestSourcePerPack("50 kg Bag", "500 g"), 0.01);
  assert.equal(suggestSourcePerPack("1 Ltr", "500 ml"), 0.5, "drum/litre style");
  assert.equal(suggestSourcePerPack("15 Ltr Tin", "1 Litre"), 0.066667);
  assert.equal(suggestSourcePerPack("90 m Coil", "1 Mtr"), 0.011111, "coil to metre");
  assert.equal(suggestSourcePerPack("Box", "1 piece"), null, "a box's count isn't in its label: entered by hand");
  assert.equal(suggestSourcePerPack("1 kg", "1 Ltr"), null, "weight and volume can't be compared");
  assert.deepEqual(parsePackQuantity("Pack of 2 dozen")?.base, 24);
});
