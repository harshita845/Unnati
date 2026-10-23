/**
 * One-time clean-up: move store pictures that were saved as text (data:image/...) inside seller
 * records over to Cloudinary, leaving only a link behind.
 *
 *   npm run migrate:seller-images              -> report only, changes nothing
 *   npm run migrate:seller-images -- --apply   -> back up, upload, then update the records
 *
 * With --apply the original values are first written to backend/backups/ so the change can be undone.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import Seller from "../models/Seller";
import { uploadImage } from "../services/cloudinaryService";
import { CLOUDINARY_FOLDERS } from "../config/cloudinary";
import { SELLER_IMAGE_FIELDS, isInlineImage } from "../services/inlineImageService";

const apply = process.argv.includes("--apply");
const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.host} / ${mongoose.connection.name}`);
  console.log(apply ? "MODE: APPLY (will change data)\n" : "MODE: dry run (nothing will change)\n");

  const sellers: any[] = await Seller.collection
    .find({ $or: SELLER_IMAGE_FIELDS.map((f) => ({ [f]: { $regex: "^data:image/" } })) })
    .project({ storeName: 1, ...Object.fromEntries(SELLER_IMAGE_FIELDS.map((f) => [f, 1])) })
    .toArray();

  if (sellers.length === 0) {
    console.log("No seller has an image stored as text. Nothing to do.");
    return;
  }

  let totalBytes = 0;
  const unique = new Set<string>();
  for (const s of sellers) {
    console.log(`${s.storeName || s._id}`);
    for (const f of SELLER_IMAGE_FIELDS) {
      if (isInlineImage(s[f])) {
        totalBytes += s[f].length;
        unique.add(s[f]);
        console.log(`   ${f.padEnd(12)} ${kb(s[f].length)}`);
      }
    }
  }
  console.log(`\n${sellers.length} seller(s), ${kb(totalBytes)} stored as text, ${unique.size} distinct picture(s) to upload.`);

  if (!apply) {
    console.log("\nRun again with --apply to upload them and replace the text with links.");
    return;
  }

  // Back up the originals before touching anything
  const dir = path.resolve(__dirname, "../../backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `seller-images-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      sellers.map((s) => ({ _id: String(s._id), ...Object.fromEntries(SELLER_IMAGE_FIELDS.map((f) => [f, s[f] ?? null])) })),
      null,
      1
    )
  );
  console.log(`\nBackup written: ${file}`);

  const uploaded = new Map<string, string>();
  for (const s of sellers) {
    const $set: Record<string, string> = {};
    for (const f of SELLER_IMAGE_FIELDS) {
      const value = s[f];
      if (!isInlineImage(value)) continue;
      let url = uploaded.get(value);
      if (!url) {
        url = (await uploadImage(value, { folder: CLOUDINARY_FOLDERS.SELLER_PROFILE })).secureUrl;
        uploaded.set(value, url);
        console.log(`   uploaded ${f} for ${s.storeName || s._id} -> ${url}`);
      }
      $set[f] = url;
    }
    if (Object.keys($set).length > 0) {
      await Seller.collection.updateOne({ _id: s._id }, { $set });
      console.log(`   updated ${s.storeName || s._id}: ${Object.keys($set).join(", ")}`);
    }
  }
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("Failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
