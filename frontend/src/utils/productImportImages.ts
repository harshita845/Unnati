/**
 * Bulk product import: images from the user's computer, and per-variant images.
 *
 * The spreadsheet's image cells may hold a web link (kept as is) or a file name / laptop path
 * such as "rice.jpg" or "D:\Images\rice.jpg". A browser can't open a path written in a file, so
 * the user also selects the images (or the folder holding them); names are matched to those
 * files (by file name, ignoring case and the folder part), uploaded once, and the cells are
 * rewritten to the uploaded links before the products are created.
 *
 * "40. Variation Images" gives each variant its own picture:
 *   500g: rice-500.jpg; 1kg: rice-1kg.jpg      (or  Weight: 500g = rice-500.jpg)
 *
 * Rows that repeat the same product (same category + product name), each naming a variant,
 * are merged into one product with several variants. This is the layout the product export
 * writes (one row per variant), so an exported file can be imported back unchanged.
 */

export const VARIATION_IMAGES_COLUMN = "40. Variation Images";

const COLUMN_ALIASES = {
  main: ["29. Main Image", "Main Image", "mainImage", "main_image", "29. Image", "Image", "Img", "PRODUCT_IMAGE", "PRODUCT_MAIN_IMAGE"],
  gallery1: ["30. Gallery Image 1", "Gallery Image 1", "Gallery Image1", "Galleary Image 1", "Galleary Image1", "galleryImage1"],
  gallery2: ["31. Gallery Image 2", "Gallery Image 2", "Gallery Image2", "Galleary Image 2", "Galleary Image2", "galleryImage2"],
  gallery3: ["32. Gallery Image 3", "Gallery Image 3", "Gallery Image3", "Galleary Image 3", "Galleary Image3", "galleryImage3"],
  variationImages: [VARIATION_IMAGES_COLUMN, "Variation Images", "Variant Images", "Variation Image", "Variant Image", "VARIATION_IMAGES"],
  productName: ["4. Product Name", "Product Name", "productName", "PRODUCT_NAME", "Name"],
  category: ["1. Category", "Category", "category"],
  subCategory: ["2. Sub Cat", "Sub Cat", "Sub Category", "subcategory"],
};

/** "29. Main Image" / "Main Image" / "main_image" -> "mainimage" */
const normHeader = (h: string) => String(h).toLowerCase().replace(/^\s*\d+\s*\.\s*/, "").replace(/[^a-z0-9]/g, "");

/** The actual header key in this row for a column (any of its aliases), if present. */
export function findColumnKey(row: Record<string, unknown>, aliases: string[]): string | undefined {
  const wanted = new Set(aliases.map(normHeader));
  return Object.keys(row).find((k) => wanted.has(normHeader(k)));
}

const cell = (row: Record<string, unknown>, aliases: string[]) => {
  const k = findColumnKey(row, aliases);
  const v = k ? row[k] : undefined;
  return v === undefined || v === null ? "" : String(v).trim();
};

export const isRemoteImage = (ref: string) => /^(https?:)?\/\//i.test(ref.trim()) || /^data:image\//i.test(ref.trim());

/** "D:\Images\Rice 1kg.JPG" -> "rice 1kg.jpg" (the key used to match a selected file) */
export const imageFileKey = (ref: string) => {
  const name = String(ref).trim().replace(/^["']|["']$/g, "").split(/[\\/]/).pop() || "";
  try {
    return decodeURIComponent(name).trim().toLowerCase();
  } catch {
    return name.trim().toLowerCase();
  }
};

const IMAGE_REF = /^(https?:\/\/\S+|[A-Za-z]:[\\/].+|[\\/].+|.+\.(jpe?g|png|webp|gif|avif|bmp|jfif))$/i;

export interface VariationImageEntry {
  /** As written: "500g" or "Weight: 500g" */
  value: string;
  ref: string;
}

/**
 * "500g: a.jpg; Weight: 1kg: D:\Images\b.jpg; 2kg = https://x/c.jpg" -> entries. A colon inside a
 * drive letter (D:\) or a link (https:) is never taken as the separator.
 */
export function parseVariationImages(raw: unknown): VariationImageEntry[] {
  const out: VariationImageEntry[] = [];
  for (const part of String(raw ?? "").split(/[;\n]/)) {
    const entry = part.trim();
    if (!entry) continue;
    const eq = entry.indexOf("=");
    if (eq > 0) {
      const value = entry.slice(0, eq).trim();
      const ref = entry.slice(eq + 1).trim();
      if (value && ref) out.push({ value, ref });
      continue;
    }
    // Try each colon from the right; skip ones that belong to "D:\" or "https:"
    for (let i = entry.lastIndexOf(":"); i > 0; i = entry.lastIndexOf(":", i - 1)) {
      const left = entry.slice(0, i).trimEnd();
      const right = entry.slice(i + 1).trim();
      const driveColon = /(^|[\s:=])[A-Za-z]$/.test(left) && /^[\\/]/.test(right);
      const schemeColon = /(^|[\s:=])https?$/i.test(left) && right.startsWith("//");
      if (driveColon || schemeColon) continue;
      if (left && IMAGE_REF.test(right)) {
        out.push({ value: left.trim(), ref: right });
        break;
      }
    }
  }
  return out;
}

export const serializeVariationImages = (entries: VariationImageEntry[]) => entries.map((e) => `${e.value}: ${e.ref}`).join("; ");

/** Does a written variant label ("500g" / "Weight: 500g") name this variant? */
export function variantMatches(label: string, variant: { value?: unknown; variationType?: unknown; name?: unknown }) {
  const l = label.trim().toLowerCase();
  const value = String(variant.value ?? "").trim().toLowerCase();
  if (!value) return false;
  if (l === value) return true;
  const type = String(variant.variationType ?? variant.name ?? "").trim().toLowerCase();
  if (type && l === `${type}: ${value}`) return true;
  return l.split(":").pop()!.trim() === value;
}

export interface ImageRefReport {
  /** Distinct local file references found (keys), with an example of how they were written */
  localRefs: Map<string, string>;
  matched: Map<string, File>;
  missing: string[];
}

/** Which local images the sheet uses, and which of them are among the selected files. */
export function checkImageRefs(rows: Record<string, unknown>[], files: File[]): ImageRefReport {
  const byName = new Map<string, File>();
  for (const f of files) byName.set(f.name.trim().toLowerCase(), f);
  const localRefs = new Map<string, string>();
  const add = (ref: string) => {
    if (!ref || isRemoteImage(ref)) return;
    const key = imageFileKey(ref);
    if (key && !localRefs.has(key)) localRefs.set(key, ref);
  };
  for (const row of rows) {
    add(cell(row, COLUMN_ALIASES.main));
    add(cell(row, COLUMN_ALIASES.gallery1));
    add(cell(row, COLUMN_ALIASES.gallery2));
    add(cell(row, COLUMN_ALIASES.gallery3));
    for (const e of parseVariationImages(cell(row, COLUMN_ALIASES.variationImages))) add(e.ref);
  }
  const matched = new Map<string, File>();
  const missing: string[] = [];
  for (const [key, written] of localRefs) {
    const f = byName.get(key);
    if (f) matched.set(key, f);
    else missing.push(written);
  }
  return { localRefs, matched, missing };
}

const IMAGE_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", jfif: "image/jpeg", png: "image/png", webp: "image/webp" };

/** The file's image type, from the browser or (when it gives none, as some PCs do) the extension. */
const imageTypeOf = (file: File) => {
  if (/^image\/(jpeg|png|webp)$/i.test(file.type)) return file.type.toLowerCase();
  return IMAGE_TYPES[(file.name.split(".").pop() || "").toLowerCase()] || file.type;
};

/**
 * Shrink big photos before upload: uploads must stay under Vercel's 4.5 MB body limit.
 * JPG/PNG/WebP all work; a PNG that is still too big after resizing is sent as JPG.
 */
export async function prepareImageForUpload(file: File, maxEdge = 1600, maxBytes = 1.5 * 1024 * 1024): Promise<File> {
  const type = imageTypeOf(file);
  if (typeof document === "undefined" || !/^image\/(jpeg|png|webp)$/.test(type)) return file;
  // Same bytes, but with a type the server accepts
  const typed = type === file.type ? file : new File([file], file.name, { type });
  const url = URL.createObjectURL(typed);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Couldn't read ${file.name}`));
      el.src = url;
    });
    let scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && typed.size <= maxBytes) return typed;

    const encode = async (as: "image/png" | "image/jpeg", quality: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d")!;
      if (as === "image/jpeg") {
        ctx.fillStyle = "#fff"; // transparent PNG areas become white, not black
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, as, quality));
    };

    const base = file.name.replace(/\.[^.]+$/, "");
    if (type === "image/png") {
      const png = await encode("image/png", 1);
      if (png && png.size <= maxBytes) return new File([png], file.name, { type: "image/png" });
    }
    for (const [quality, shrink] of [[0.85, 1], [0.75, 1], [0.7, 0.75], [0.65, 0.6]] as const) {
      scale *= shrink;
      const jpg = await encode("image/jpeg", quality);
      if (jpg && (jpg.size <= maxBytes || quality === 0.65)) return new File([jpg], `${base}.jpg`, { type: "image/jpeg" });
    }
    return typed;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Upload every matched image once (a few at a time) and return file key -> link.
 * `upload` is the app's uploadImage(file) -> { secureUrl/url }.
 */
export async function uploadMatchedImages(
  matched: Map<string, File>,
  upload: (file: File) => Promise<{ secureUrl?: string; url?: string }>,
  onProgress?: (done: number, total: number) => void
): Promise<{ urls: Map<string, string>; failed: { name: string; message: string }[] }> {
  const urls = new Map<string, string>();
  const failed: { name: string; message: string }[] = [];
  const entries = [...matched.entries()];
  let done = 0;
  let next = 0;
  const worker = async () => {
    while (next < entries.length) {
      const [key, file] = entries[next++];
      try {
        const res = await upload(await prepareImageForUpload(file));
        const link = res.secureUrl || res.url;
        if (!link) throw new Error("No link returned");
        urls.set(key, link);
      } catch (e: any) {
        failed.push({ name: file.name, message: e?.response?.data?.message || e?.message || "Upload failed" });
      }
      onProgress?.(++done, entries.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, entries.length) }, worker));
  return { urls, failed };
}

/** Replace local image references in the rows with uploaded links (returns new row objects). */
export function applyImageUrls(rows: Record<string, unknown>[], urls: Map<string, string>): Record<string, unknown>[] {
  const swap = (ref: string) => (ref && !isRemoteImage(ref) ? urls.get(imageFileKey(ref)) ?? ref : ref);
  return rows.map((row) => {
    const out = { ...row };
    for (const aliases of [COLUMN_ALIASES.main, COLUMN_ALIASES.gallery1, COLUMN_ALIASES.gallery2, COLUMN_ALIASES.gallery3]) {
      const k = findColumnKey(out, aliases);
      if (k && out[k]) out[k] = swap(String(out[k]).trim());
    }
    const vk = findColumnKey(out, COLUMN_ALIASES.variationImages);
    if (vk && out[vk]) {
      out[vk] = serializeVariationImages(parseVariationImages(out[vk]).map((e) => ({ ...e, ref: swap(e.ref) })));
    }
    return out;
  });
}

export interface PendingProduct {
  /** 1-based spreadsheet row */
  row: number;
  label: string;
  rawRow: Record<string, unknown>;
  payload: Record<string, any>;
}

export interface MergedProduct {
  rows: number[];
  label: string;
  payload: Record<string, any>;
}

const variantKey = (v: any) => `${String(v?.variationType ?? v?.name ?? "").trim().toLowerCase()}|${String(v?.value ?? "").trim().toLowerCase()}`;

/**
 * Give each variant its own picture from "40. Variation Images" (when the row names one); the
 * other variants get the row's Main Image and gallery (photos live on variants in the database).
 */
export function applyVariationImages(p: PendingProduct): void {
  const variations: any[] = Array.isArray(p.payload.variations) ? p.payload.variations : [];
  if (!variations.length) return;
  const entries = parseVariationImages(cell(p.rawRow, COLUMN_ALIASES.variationImages)).filter((e) => isRemoteImage(e.ref));
  const rowMain = String(p.payload.mainImage || "").trim();
  const rowGallery = (Array.isArray(p.payload.galleryImages) ? p.payload.galleryImages : []).filter(Boolean);
  for (const v of variations) {
    const hit = entries.find((e) => variantMatches(e.value, v)) || (variations.length === 1 && entries.length === 1 ? entries[0] : undefined);
    if (hit) {
      v.mainImage = hit.ref;
      v.image = hit.ref;
    } else if (!v.mainImage && !v.image && rowMain) {
      v.mainImage = rowMain;
      v.image = rowMain;
    }
    if ((!Array.isArray(v.galleryImages) || !v.galleryImages.length) && rowGallery.length) v.galleryImages = [...rowGallery];
  }
}

/**
 * Merge rows that are variants of the same product (same category, sub category and product
 * name, each with a variant). Each variant keeps its own row's price, stock, SKU, barcode and
 * picture. A variant repeated within a product is reported, not imported twice.
 */
export function mergeVariantRows(pending: PendingProduct[], fillKeys: string[] = []): { products: MergedProduct[]; duplicates: { row: number; label: string; message: string }[] } {
  const groups = new Map<string, PendingProduct[]>();
  const order: string[] = [];
  // Same category + product name = same product. A Sub Cat left blank on a variant row doesn't split
  // it; two different Sub Cats do.
  const open = new Map<string, { key: string; sub: string }[]>();
  pending.forEach((p, idx) => {
    applyVariationImages(p);
    const hasVariant = Array.isArray(p.payload.variations) && p.payload.variations.length > 0;
    const name = String(p.payload.productName || "").trim().toLowerCase();
    let key = `__single_${idx}`;
    if (hasVariant && name) {
      const base = `${cell(p.rawRow, COLUMN_ALIASES.category).toLowerCase()}|${name}`;
      const sub = cell(p.rawRow, COLUMN_ALIASES.subCategory).toLowerCase();
      const candidates = open.get(base) || [];
      const hit = candidates.find((c) => !c.sub || !sub || c.sub === sub);
      if (hit) {
        if (!hit.sub) hit.sub = sub;
        key = hit.key;
      } else {
        key = `${base}|${candidates.length}`;
        candidates.push({ key, sub });
        open.set(base, candidates);
      }
    }
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(p);
  });

  const products: MergedProduct[] = [];
  const duplicates: { row: number; label: string; message: string }[] = [];
  for (const key of order) {
    const group = groups.get(key)!;
    if (group.length === 1) {
      products.push({ rows: [group[0].row], label: group[0].label, payload: group[0].payload });
      continue;
    }
    const first = group[0];
    const merged: Record<string, any> = { ...first.payload, variations: [] };
    const seen = new Set<string>();
    const rows: number[] = [];
    for (const g of group) {
      for (const v of g.payload.variations || []) {
        const k = variantKey(v);
        if (seen.has(k)) {
          duplicates.push({ row: g.row, label: g.label, message: `Variant "${v.value}" is already in this product (row ${first.row}); skipped` });
          continue;
        }
        seen.add(k);
        // Each variant already carries its own row's pictures (applyVariationImages)
        merged.variations.push({ ...v });
      }
      rows.push(g.row);
    }
    // A variant whose own row has no photo uses the product's Main Image (typed on any of its rows)
    const groupMain = group.map((g) => String(g.payload.mainImage || "").trim()).find(Boolean);
    if (groupMain) {
      for (const v of merged.variations) {
        if (!v.mainImage && !v.image) {
          v.mainImage = groupMain;
          v.image = groupMain;
        }
      }
    }
    // Product-level fields typed on only one of the variant rows still apply to the product
    for (const key of fillKeys) {
      const blank = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      if (!blank(merged[key])) continue;
      const donor = group.find((g) => !blank(g.payload[key]));
      if (donor) merged[key] = donor.payload[key];
    }
    products.push({ rows, label: first.label, payload: merged });
  }
  return { products, duplicates };
}

/** Text for the export / template: "500g: link" for a variant with its own picture. */
export const variationImageCell = (variantValue: unknown, ownImage: unknown) => {
  const value = String(variantValue ?? "").trim();
  const img = String(ownImage ?? "").trim();
  return value && img ? `${value}: ${img}` : "";
};

/**
 * Before creating products: upload the sheet's local images and put the links into the rows.
 * Images that weren't selected (or failed to upload) are left out after the user agrees.
 * Returns null if the user cancels.
 */
export async function resolveSheetImages(
  rows: Record<string, unknown>[],
  files: File[],
  upload: (file: File) => Promise<{ secureUrl?: string; url?: string }>,
  hooks: {
    onProgress?: (done: number, total: number) => void;
    confirm?: (message: string) => boolean;
  } = {}
): Promise<{ rows: Record<string, unknown>[]; uploaded: number; skipped: string[] } | null> {
  const report = checkImageRefs(rows, files);
  if (report.localRefs.size === 0) return { rows, uploaded: 0, skipped: [] };
  const ask = hooks.confirm ?? (() => true);
  if (report.missing.length) {
    const list = report.missing.slice(0, 8).join("\n");
    const ok = ask(
      `${report.missing.length} image${report.missing.length === 1 ? "" : "s"} in the sheet ${report.missing.length === 1 ? "wasn't" : "weren't"} found among the selected photos:\n\n${list}${report.missing.length > 8 ? "\n…" : ""}\n\nImport anyway without ${report.missing.length === 1 ? "it" : "them"}?`
    );
    if (!ok) return null;
  }
  const { urls, failed } = await uploadMatchedImages(report.matched, upload, hooks.onProgress);
  if (failed.length) {
    const ok = ask(
      `${failed.length} image${failed.length === 1 ? "" : "s"} couldn't be uploaded:\n\n${failed.slice(0, 5).map((f) => `${f.name}: ${f.message}`).join("\n")}\n\nImport anyway without ${failed.length === 1 ? "it" : "them"}?`
    );
    if (!ok) return null;
  }
  // Leave out what couldn't be found or uploaded (never save a laptop path as an image)
  for (const key of report.localRefs.keys()) if (!urls.has(key)) urls.set(key, "");
  const resolved = applyImageUrls(rows, urls).map((row) => {
    const vk = findColumnKey(row, COLUMN_ALIASES.variationImages);
    if (vk && row[vk]) row[vk] = serializeVariationImages(parseVariationImages(row[vk]).filter((e) => e.ref));
    return row;
  });
  return {
    rows: resolved,
    uploaded: [...urls.values()].filter(Boolean).length,
    skipped: [...report.missing, ...failed.map((f) => f.name)],
  };
}
