/**
 * Clean up duplicate products (same seller + category + name) left behind by earlier bulk imports:
 *   - one product per size            -> the sizes are combined into ONE product
 *   - an old copy of a re-imported one -> hidden
 *
 * Nothing is deleted. Leftover copies are only hidden (status Inactive, not published, with a note
 * in `inactiveReason`), so orders, stock history and reports that point at them keep working. Every
 * product it changes is saved in full to a backup file first, so it can be put back.
 *
 *   npx tsx src/scripts/mergeDuplicateProducts.ts           # dry run: prints the plan, changes nothing
 *   npx tsx src/scripts/mergeDuplicateProducts.ts --apply   # does it (uses MONGODB_URI from .env)
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db";
import Product from "../models/Product";

dotenv.config();

const APPLY = process.argv.includes("--apply");
const key = (v: any) => `${String(v?.variationType || "").trim().toLowerCase()}|${String(v?.value || "").trim().toLowerCase()}`;
const hasImage = (p: any) => !!p.mainImage || (p.variations || []).some((v: any) => v.mainImage || v.image);

interface Plan {
  name: string;
  primary: any;
  /** variants copied into the primary, with where they came from */
  moves: { from: any; variant: any }[];
  /** products to hide */
  hide: any[];
  /** variants of hidden products whose size the primary already has (nothing to move) */
  alreadyThere: { from: any; value: string }[];
}

async function main() {
  await connectDB();
  const groups = await Product.aggregate([
    { $group: { _id: { seller: "$seller", category: "$category", name: { $toLower: { $trim: { input: "$productName" } } } }, ids: { $push: "$_id" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);

  const plans: Plan[] = [];
  for (const g of groups) {
    const products: any[] = await Product.find({ _id: { $in: g.ids } }).lean();
    // Only products that are still live take part (a copy hidden earlier is already dealt with)
    const live = products.filter((p) => p.status === "Active" && p.publish !== false);
    if (live.length < 2) continue;
    // Keep: most sizes, then one with a photo, then the oldest (its id is the one orders know first)
    live.sort(
      (a, b) =>
        (b.variations?.length || 0) - (a.variations?.length || 0) ||
        Number(hasImage(b)) - Number(hasImage(a)) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
        String(a._id).localeCompare(String(b._id))
    );
    const [primary, ...rest] = live;
    const have = new Set((primary.variations || []).map(key));
    const plan: Plan = { name: primary.productName, primary, moves: [], hide: rest, alreadyThere: [] };
    for (const other of rest) {
      for (const v of other.variations || []) {
        if (have.has(key(v))) plan.alreadyThere.push({ from: other, value: v.value });
        else {
          have.add(key(v));
          plan.moves.push({ from: other, variant: v });
        }
      }
    }
    plans.push(plan);
  }

  const short = (id: any) => String(id).slice(-6);
  const describe = (p: any) => `${short(p._id)} [${(p.variations || []).map((v: any) => `${v.value}: stock ${v.stock}`).join(", ")}]`;
  console.log(`\n${APPLY ? "APPLYING" : "DRY RUN (nothing is changed)"}: ${plans.length} duplicate group(s)\n`);
  for (const pl of plans) {
    console.log(`• ${pl.name}`);
    console.log(`    keep      ${describe(pl.primary)}`);
    for (const m of pl.moves) console.log(`    add size  ${m.variant.value} (price ${m.variant.price}, stock ${m.variant.stock}) from ${short(m.from._id)} -> kept product; its stock there is set to 0 so it isn't counted twice`);
    for (const a of pl.alreadyThere) console.log(`    same size ${a.value} from ${short(a.from._id)} already in the kept product`);
    for (const h of pl.hide) console.log(`    hide      ${describe(h)}`);
  }
  if (!plans.length) console.log("Nothing to do.");

  if (!APPLY) {
    console.log("\nRe-run with --apply to do this. A backup file of every changed product is written first.");
    await mongoose.disconnect();
    return;
  }

  const touched = new Map<string, any>();
  for (const pl of plans) {
    touched.set(String(pl.primary._id), pl.primary);
    for (const h of pl.hide) touched.set(String(h._id), h);
  }
  const backupFile = path.resolve(process.cwd(), `duplicate-merge-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupFile, JSON.stringify([...touched.values()], null, 2));
  console.log(`\nBackup written: ${backupFile}`);

  for (const pl of plans) {
    for (const m of pl.moves) {
      const copy = { ...m.variant, _id: new mongoose.Types.ObjectId() };
      await Product.collection.updateOne({ _id: pl.primary._id }, { $push: { variations: copy } as any });
      // The size now lives in the kept product: zero it (and free its barcode) in the old copy
      await Product.collection.updateOne(
        { _id: m.from._id, "variations._id": m.variant._id },
        { $set: { "variations.$.stock": 0, "variations.$.barcode": [] } }
      );
    }
    for (const h of pl.hide) {
      await Product.collection.updateOne(
        { _id: h._id },
        { $set: { status: "Inactive", publish: false, inactiveReason: `Duplicate of "${pl.name}" (${short(pl.primary._id)}); hidden by cleanup` } }
      );
    }
  }
  console.log("Done. Restore any product by writing its backup copy back, or ask for an undo script.");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
