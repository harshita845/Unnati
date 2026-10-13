import Brand from "../../models/Brand";
import Tax from "../../models/Tax";
import HeaderCategory from "../../models/HeaderCategory";
import Category from "../../models/Category";
import SubCategory from "../../models/SubCategory";
import Shop from "../../models/Shop";

/**
 * Bulk import / API clients write names ("Amul", "GST 5%", "Grocery") where the product form sends
 * ids. This swaps a name for the matching id (case-insensitive, exact) so the product is saved with
 * its brand / tax / sub category / header category / store, and reports what it couldn't find
 * instead of silently dropping it.
 */
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exactName = (name: string) => new RegExp(`^\\s*${escapeRegex(name.replace(/\s+/g, " ").trim()).replace(/\\? /g, "\\s+")}\\s*$`, "i");
const isId = (v: unknown) => typeof v === "string" && /^[a-fA-F0-9]{24}$/.test(v);
const asName = (v: unknown): string => {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return !t || t === "-" || isId(t) ? "" : t;
};

/** Which body key carries the value (the form uses `brandId`, imports use `brand`) */
const pick = (body: Record<string, any>, keys: string[]) => keys.find((k) => asName(body[k]));

export async function resolveReferenceNames(body: Record<string, any>): Promise<string[]> {
  const warnings: string[] = [];
  const notFound = (what: string, value: string, effect = "left blank") => warnings.push(`${what} "${value}" was not found, so it was ${effect}`);

  const brandKey = pick(body, ["brandId", "brand"]);
  if (brandKey) {
    const name = asName(body[brandKey]);
    const hit: any = await Brand.findOne({ name: exactName(name) }).select("_id").lean();
    if (hit) body[brandKey] = String(hit._id);
    else {
      delete body[brandKey];
      notFound("Brand", name);
    }
  }

  const taxKey = pick(body, ["taxId", "tax"]);
  if (taxKey) {
    const name = asName(body[taxKey]);
    let hit: any = await Tax.findOne({ name: exactName(name) }).select("_id").lean();
    if (!hit && /^\d+(\.\d+)?\s*%?$/.test(name)) {
      hit = await Tax.findOne({ percentage: Number(name.replace("%", "")) }).select("_id").lean();
    }
    if (hit) body[taxKey] = String(hit._id);
    else {
      delete body[taxKey];
      notFound("Tax", name);
    }
  }

  const headerName = asName(body.headerCategoryId);
  if (headerName) {
    const hit: any = await HeaderCategory.findOne({ name: exactName(headerName) }).select("_id").lean();
    if (hit) body.headerCategoryId = String(hit._id);
    else {
      delete body.headerCategoryId;
      notFound("Header category", headerName, "set from the category instead");
    }
  }

  const shopName = asName(body.shopId);
  if (shopName) {
    const hit: any = await Shop.findOne({ name: exactName(shopName) }).select("_id").lean();
    if (hit) body.shopId = String(hit._id);
    else {
      delete body.shopId;
      notFound("Store", shopName);
    }
  }

  // Sub category: a child of the chosen category (new hierarchy) or a legacy sub category of it
  const subKey = pick(body, ["subcategoryId", "subcategory"]);
  if (subKey) {
    const name = asName(body[subKey]);
    const categoryId = [body.categoryId, body.category].find(isId);
    if (!categoryId) {
      delete body[subKey];
      warnings.push(`Sub category "${name}" needs a valid Category on the same row, so it was left blank`);
    } else {
      const rx = exactName(name);
      const child: any = await Category.findOne({ name: rx, parentId: categoryId }).select("_id").lean();
      const legacy: any = child ? null : await SubCategory.findOne({ name: rx, category: categoryId }).select("_id").lean();
      const hit = child || legacy;
      if (hit) body[subKey] = String(hit._id);
      else {
        delete body[subKey];
        notFound("Sub category", name);
      }
    }
  }

  // Sub sub category (stored as an id by the product form): same lookup under the chosen sub category
  const subSubName = asName(body.subSubCategoryId ?? body.subSubCategory);
  const subId = [body.subcategoryId, body.subcategory].find(isId);
  if (subSubName && subId) {
    const hit: any = await Category.findOne({ name: exactName(subSubName), parentId: subId }).select("_id").lean();
    if (hit) {
      if (body.subSubCategoryId !== undefined) body.subSubCategoryId = String(hit._id);
      else body.subSubCategory = String(hit._id);
    }
  }

  return warnings;
}
