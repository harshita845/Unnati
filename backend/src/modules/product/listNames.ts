import HeaderCategory from "../../models/HeaderCategory";
import Shop from "../../models/Shop";
import Category from "../../models/Category";
import SubCategory from "../../models/SubCategory";

const idOf = (v: any): string => {
  const s = v && typeof v === "object" && v._id ? String(v._id) : String(v ?? "");
  return /^[a-fA-F0-9]{24}$/.test(s) ? s : "";
};

/**
 * Product lists carry ids for header category, store and sub sub category. Add their names
 * (`headerCategoryName`, `shopName`, `subSubCategoryName`) so exports and screens can show text.
 * Additive: existing fields are untouched.
 */
export async function attachListNames<T extends Record<string, any>>(products: T[]): Promise<T[]> {
  const headerIds = new Set<string>();
  const shopIds = new Set<string>();
  const subSubIds = new Set<string>();
  for (const p of products) {
    const h = idOf(p.headerCategoryId);
    if (h) headerIds.add(h);
    const s = idOf(p.shopId);
    if (s) shopIds.add(s);
    const ss = idOf(p.subSubCategory);
    if (ss) subSubIds.add(ss);
  }
  const [headers, shops, subSubs] = await Promise.all([
    headerIds.size ? HeaderCategory.find({ _id: { $in: [...headerIds] } }).select("name").lean() : [],
    shopIds.size ? Shop.find({ _id: { $in: [...shopIds] } }).select("name").lean() : [],
    subSubIds.size ? Category.find({ _id: { $in: [...subSubIds] } }).select("name").lean() : [],
  ]);
  const nameMap = (rows: any[]) => new Map(rows.map((r) => [String(r._id), r.name as string]));
  const hm = nameMap(headers as any[]);
  const sm = nameMap(shops as any[]);
  const ssm = nameMap(subSubs as any[]);
  for (const p of products as any[]) {
    p.headerCategoryName = hm.get(idOf(p.headerCategoryId)) || "";
    p.shopName = sm.get(idOf(p.shopId)) || "";
    p.subSubCategoryName = ssm.get(idOf(p.subSubCategory)) || (idOf(p.subSubCategory) ? "" : String(p.subSubCategory || ""));
  }
  return products;
}

/**
 * A product's sub category id can point at the category tree (child category) or the legacy sub
 * category collection. Replace the id by `{ _id, name }` from whichever holds it, so lists and
 * exports show the name either way.
 */
export async function attachSubcategories<T extends Record<string, any>>(products: T[]): Promise<T[]> {
  const ids = new Set<string>();
  for (const p of products) {
    const id = idOf(p.subcategory);
    if (id) ids.add(id);
  }
  if (!ids.size) return products;
  const [legacy, tree] = await Promise.all([
    SubCategory.find({ _id: { $in: [...ids] } }).select("name").lean(),
    Category.find({ _id: { $in: [...ids] } }).select("name").lean(),
  ]);
  const byId = new Map<string, { _id: string; name: string }>();
  for (const r of [...(legacy as any[]), ...(tree as any[])]) byId.set(String(r._id), { _id: String(r._id), name: r.name });
  for (const p of products as any[]) {
    const hit = byId.get(idOf(p.subcategory));
    if (hit) p.subcategory = hit;
  }
  return products;
}
