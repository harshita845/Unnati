import mongoose from "mongoose";
import HeaderCategory from "../models/HeaderCategory";
import Category from "../models/Category";

/**
 * Resolves all category and subcategory names under one or more Header Categories.
 * When a main header category is selected, automatically all categories and their
 * subcategories under it are included.
 */
export async function resolveAllCategoryNamesForHeader(
  headerIdentifiers: string | string[]
): Promise<{ headerNames: string[]; allCategoryNames: string[] }> {
  const identifiers = (Array.isArray(headerIdentifiers) ? headerIdentifiers : [headerIdentifiers])
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);

  if (identifiers.length === 0) {
    return { headerNames: [], allCategoryNames: [] };
  }

  // 1. Find HeaderCategory documents matching IDs, names, or slugs
  const orConditions: any[] = [];
  for (const idOrName of identifiers) {
    if (mongoose.isValidObjectId(idOrName)) {
      orConditions.push({ _id: new mongoose.Types.ObjectId(idOrName) });
    }
    const escaped = idOrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    orConditions.push({ name: { $regex: `^${escaped}$`, $options: "i" } });
    orConditions.push({ slug: idOrName.toLowerCase() });
  }

  const headerDocs = await HeaderCategory.find({ $or: orConditions })
    .select("_id name")
    .lean();

  const headerIds = headerDocs.map((h: any) => h._id);
  const headerNames = headerDocs.map((h: any) => h.name);

  // If no header docs matched, fallback to raw identifiers
  if (headerDocs.length === 0) {
    return { headerNames: identifiers, allCategoryNames: identifiers };
  }

  // 2. Find all categories directly under these header categories
  const directCats: any[] = await Category.find({
    $or: [
      { headerCategoryId: { $in: headerIds } },
      { name: { $in: headerNames } },
    ],
  })
    .select("_id name")
    .lean();

  const directCatIds = directCats.map((c) => c._id);
  const directCatNames = directCats.map((c) => c.name);

  // 3. Find all subcategories (level 1) whose parentId matches
  let subCatIds: any[] = [];
  let subCatNames: string[] = [];
  if (directCatIds.length > 0) {
    const subCats: any[] = await Category.find({
      parentId: { $in: directCatIds },
    })
      .select("_id name")
      .lean();
    subCatIds = subCats.map((c) => c._id);
    subCatNames = subCats.map((c) => c.name);
  }

  // 4. Find all sub-subcategories (level 2)
  let subSubCatNames: string[] = [];
  if (subCatIds.length > 0) {
    const subSubCats: any[] = await Category.find({
      parentId: { $in: subCatIds },
    })
      .select("_id name")
      .lean();
    subSubCatNames = subSubCats.map((c) => c.name);
  }

  const allNames = Array.from(
    new Set([
      ...headerNames,
      ...directCatNames,
      ...subCatNames,
      ...subSubCatNames,
    ])
  );

  return {
    headerNames,
    allCategoryNames: allNames,
  };
}

