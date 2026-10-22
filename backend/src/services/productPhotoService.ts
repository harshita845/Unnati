import mongoose from "mongoose";
import Product from "../models/Product";
import ProductImageCheck from "../models/ProductImageCheck";

/**
 * Product Photos (admin): which products still show a demo picture or none at all.
 * Demo pictures are the generated icon cards uploaded with the sample data: 800×800 PNGs in the
 * products folder. Real uploads are photos (JPG/WebP or other sizes). An admin can mark a flagged picture as real if the rule gets one wrong.
 */
export type PhotoStatus = "missing" | "demo" | "real";

const isCloudinary = (url: string) => /res\.cloudinary\.com\/.+\/upload\//.test(url);

async function lookUp(url: string) {
  if (!isCloudinary(url)) return {};
  try {
    const res = await fetch(url.replace("/upload/", "/upload/fl_getinfo/"), { signal: AbortSignal.timeout(10000) });
    const info: any = await res.json();
    return { format: String(info?.input?.format || url.split(".").pop() || "").toLowerCase(), width: Number(info?.input?.width) || undefined, height: Number(info?.input?.height) || undefined };
  } catch {
    return {};
  }
}

const verdict = (url: string, c: any): PhotoStatus => {
  if (!url) return "missing";
  if (c?.markedReal) return "real";
  if (c?.format === "png" && c?.width === 800 && c?.height === 800 && /\/products\//.test(decodeURIComponent(url))) return "demo";
  return "real";
};

export async function productPhotoReport(opts: { sellerId?: string; status?: PhotoStatus | "all"; search?: string }) {
  const filter: any = {};
  if (opts.sellerId && mongoose.isValidObjectId(opts.sellerId)) filter.seller = new mongoose.Types.ObjectId(opts.sellerId);
  if (opts.search?.trim()) filter.productName = { $regex: opts.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const products: any[] = await Product.find(filter)
    .select("productName mainImage seller status publish updatedAt")
    .populate("seller", "storeName")
    .sort({ updatedAt: -1 })
    .limit(2000)
    .lean();

  // Look up pictures not checked before (a few at a time), then keep the results
  const urls = [...new Set(products.map((p) => String(p.mainImage || "")).filter(Boolean))];
  const known = new Map((await ProductImageCheck.find({ url: { $in: urls } }).lean()).map((c: any) => [c.url, c]));
  const todo = urls.filter((u) => !known.has(u));
  for (let i = 0; i < todo.length; i += 8) {
    const batch = todo.slice(i, i + 8);
    const found = await Promise.all(batch.map(async (url) => ({ url, ...(await lookUp(url)) })));
    for (const f of found) {
      const saved = await ProductImageCheck.findOneAndUpdate({ url: f.url }, { $set: { ...f, checkedAt: new Date() } }, { upsert: true, new: true }).lean();
      known.set(f.url, saved);
    }
  }

  const rows = products.map((p) => {
    const url = String(p.mainImage || "");
    return {
      id: String(p._id),
      name: p.productName,
      image: url,
      store: p.seller?.storeName || "",
      status: verdict(url, known.get(url)),
      live: p.status === "Active" && p.publish !== false,
    };
  });
  const counts = { missing: 0, demo: 0, real: 0 } as Record<PhotoStatus, number>;
  rows.forEach((r) => counts[r.status]++);
  const status = opts.status && opts.status !== "all" ? opts.status : null;
  return { counts, total: rows.length, products: status ? rows.filter((r) => r.status === status) : rows };
}

/** Admin says a flagged picture is a real photo (or undoes that) */
export async function markPhotoReal(url: string, real: boolean) {
  if (!url) return;
  await ProductImageCheck.findOneAndUpdate({ url }, { $set: { markedReal: real } }, { upsert: true });
}
