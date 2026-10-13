/**
 * Every product-form field that bulk import and export must carry, in ONE table, so the template,
 * the import, the export and the field guide can never drift apart.
 *
 *  - CORE fields live in the original columns (2. Sub Cat, 13. Tax Cat, 23. Brand, 33/34 dates ...);
 *    here they are read more carefully (names, dates, "-" placeholders).
 *  - EXTRA fields are the columns 41 onward (short description, video, SEO, returns, warranty ...).
 *
 * Headers are matched by name (the "NN." number and punctuation are ignored), so
 * "41. Short Description", "Short Description" and "short_description" all work. Blank cells are
 * left out of the payload so defaults and existing values are never overwritten.
 */
import { findColumnKey } from "./productImportImages";

export const EXTRA_FIELD_FIRST_NUMBER = 41;

type Parsed = { value?: unknown; warning?: string };

interface ExtraField {
  /** Plain header used by exports; the template shows it numbered ("41. Short Description") */
  name: string;
  aliases?: string[];
  /** Key in the product payload */
  key: string;
  read: (raw: string) => Parsed;
  write: (product: any) => string;
  /** What to type, shown in the template's field guide */
  hint: string;
  example: string;
}

const text = (raw: string): Parsed => (raw ? { value: raw } : {});

const YES = new Set(["yes", "y", "true", "1", "on", "enabled", "active"]);
const NO = new Set(["no", "n", "false", "0", "off", "disabled", "inactive"]);
export const parseYesNo = (raw: string): Parsed => {
  const v = raw.trim().toLowerCase();
  if (!v) return {};
  if (YES.has(v)) return { value: true };
  if (NO.has(v)) return { value: false };
  return { warning: `must be Yes or No (found "${raw}")` };
};

const wholeNumber = (raw: string): Parsed => {
  if (!raw) return {};
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? { value: Math.floor(n) } : { warning: `must be a number (found "${raw}")` };
};

const oneOf = (map: Record<string, string>, label: string) => (raw: string): Parsed => {
  const v = raw.trim().toLowerCase();
  if (!v) return {};
  if (map[v]) return { value: map[v] };
  return { warning: `must be ${label} (found "${raw}")` };
};

const TAX_VISIBILITY: Record<string, string> = {
  included: "included", include: "included", inclusive: "included",
  excluded: "excluded", exclude: "excluded", exclusive: "excluded",
  hidden: "hidden", hide: "hidden", none: "hidden",
};
const WARRANTY: Record<string, string> = { none: "None", warranty: "Warranty", guarantee: "Guarantee" };

const yesNo = (v: unknown) => (v ? "Yes" : "No");
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const title = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

export const EXTRA_FIELDS: ExtraField[] = [
  { name: "Short Description", key: "smallDescription", read: text, write: (p) => str(p.smallDescription), hint: "One or two lines shown under the product name", example: "Fresh long-grain basmati" },
  { name: "Product Video", key: "video", read: text, write: (p) => str(p.video), hint: "Link to a video (YouTube or direct link)", example: "https://youtu.be/xxxx" },
  { name: "Header Category", aliases: ["Header Cat"], key: "headerCategoryId", read: text, write: (p) => str(p.headerCategoryName), hint: "Header category name (as in Header Category setup). Blank = taken from the Category", example: "Grocery & Kitchen" },
  { name: "Tax Visibility", aliases: ["Tax Visibility Label", "Tax Preference"], key: "taxPreference", read: oneOf(TAX_VISIBILITY, "Included, Excluded or Hidden"), write: (p) => title(str(p.taxPreference)), hint: "Included, Excluded or Hidden", example: "Included" },
  { name: "Popular", key: "popular", read: parseYesNo, write: (p) => yesNo(p.popular), hint: "Yes / No: show in Popular", example: "No" },
  { name: "Deal of the Day", key: "dealOfDay", read: parseYesNo, write: (p) => yesNo(p.dealOfDay), hint: "Yes / No", example: "No" },
  { name: "Enquiry Only", aliases: ["Enquiry Only Mode"], key: "isEnquiryOnly", read: parseYesNo, write: (p) => yesNo(p.isEnquiryOnly), hint: "Yes / No: customers send an enquiry instead of ordering", example: "No" },
  { name: "Shop by Store Only", aliases: ["Show in Shop by Store only", "Shop by Store"], key: "isShopByStoreOnly", read: parseYesNo, write: (p) => yesNo(p.isShopByStoreOnly), hint: "Yes / No: only visible inside a Shop by Store page", example: "No" },
  { name: "Store Name", aliases: ["Select Store", "Shop Name"], key: "shopId", read: text, write: (p) => str(p.shopName), hint: "Store name, needed when Shop by Store Only is Yes", example: "Pooja Store" },
  {
    name: "Tags",
    key: "tags",
    read: (raw) => {
      const tags = raw.split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
      return tags.length ? { value: tags } : {};
    },
    write: (p) => (Array.isArray(p.tags) ? p.tags.join(", ") : str(p.tags)),
    hint: "Comma-separated words",
    example: "rice, basmati, grain",
  },
  { name: "SEO Title", key: "seoTitle", read: text, write: (p) => str(p.seoTitle), hint: "Page title for search engines", example: "Buy Basmati Rice Online" },
  { name: "SEO Keywords", key: "seoKeywords", read: text, write: (p) => str(p.seoKeywords), hint: "Comma-separated keywords", example: "basmati, rice" },
  { name: "SEO Description", key: "seoDescription", read: text, write: (p) => str(p.seoDescription), hint: "Short description for search results", example: "Premium aged basmati rice" },
  { name: "SEO Image Alt", key: "seoImageAlt", read: text, write: (p) => str(p.seoImageAlt), hint: "Alt text of the main image", example: "Pack of basmati rice" },
  { name: "Manufacturer", key: "manufacturer", read: text, write: (p) => str(p.manufacturer), hint: "Maker of the product", example: "India Gate" },
  { name: "Made In", aliases: ["Country of Origin"], key: "madeIn", read: text, write: (p) => str(p.madeIn), hint: "Country / place of origin", example: "India" },
  { name: "Marketer", aliases: ["Customer Care"], key: "marketer", read: text, write: (p) => str(p.marketer), hint: "Marketed-by name or customer-care contact", example: "care@store.com" },
  { name: "Shelf Life", key: "shelfLife", read: text, write: (p) => str(p.shelfLife), hint: "How long it stays good", example: "12 months" },
  { name: "FSSAI Lic No", aliases: ["FSSAI", "FSSAI License"], key: "fssaiLicNo", read: text, write: (p) => str(p.fssaiLicNo), hint: "14-digit FSSAI licence number", example: "10019022003456" },
  { name: "Returnable", aliases: ["Is Returnable"], key: "isReturnable", read: parseYesNo, write: (p) => yesNo(p.isReturnable), hint: "Yes / No", example: "Yes" },
  { name: "Max Return Days", key: "maxReturnDays", read: wholeNumber, write: (p) => (p.maxReturnDays === undefined || p.maxReturnDays === null ? "" : str(p.maxReturnDays)), hint: "Days allowed for return", example: "7" },
  { name: "Return Policy", aliases: ["Return Policy Text"], key: "returnPolicyText", read: text, write: (p) => str(p.returnPolicyText), hint: "Return policy text", example: "Unopened items only" },
  { name: "Warranty Type", key: "warrantyType", read: oneOf(WARRANTY, "None, Warranty or Guarantee"), write: (p) => str(p.warrantyType), hint: "None, Warranty or Guarantee", example: "None" },
  { name: "Warranty Duration", key: "warrantyDuration", read: text, write: (p) => str(p.warrantyDuration), hint: "e.g. 1 year (when Warranty Type is set)", example: "1 year" },
  { name: "Max Allowed Qty", aliases: ["Total Allowed Quantity", "Max Qty"], key: "totalAllowedQuantity", read: wholeNumber, write: (p) => (p.totalAllowedQuantity === undefined || p.totalAllowedQuantity === null ? "" : str(p.totalAllowedQuantity)), hint: "Most units one customer can buy in an order", example: "10" },
];

export const extraFieldHeaders = (numbered: boolean) =>
  EXTRA_FIELDS.map((f, i) => (numbered ? `${EXTRA_FIELD_FIRST_NUMBER + i}. ${f.name}` : f.name));

/** Export cells for the extra columns, in header order */
export const extraFieldCells = (product: any): string[] => EXTRA_FIELDS.map((f) => f.write(product || {}));

// ---------------------------------------------------------------------------------------------

/** Excel dates arrive as serial numbers, text as dd/mm/yyyy or yyyy-mm-dd: store yyyy-mm-dd like the product form does. */
export function normalizeDateCell(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const serial = Math.floor(Number(v));
    if (serial >= 20000 && serial <= 80000) return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
  }
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(v);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(v);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return v;
}

const cellText = (row: Record<string, unknown>, aliases: string[]) => {
  const k = findColumnKey(row, aliases);
  const v = k ? row[k] : undefined;
  return v === undefined || v === null ? "" : String(v).trim();
};

/**
 * Exports write "-" for an empty cell; importing that back must not save "-" as the HSN code,
 * delivery time, brand ... Turn those placeholders into real blanks (returns a new row).
 */
export function clearDashPlaceholders(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = typeof v === "string" && v.trim() === "-" ? "" : v;
  return out;
}

/** Variant name: "Weight: 500g"; the placeholder default variant stays "Standard" (as when no variant is typed) */
export const variantDisplayName = (type: string, value: string) =>
  type.trim().toLowerCase() === "standard" && value.trim().toLowerCase() === "default" ? "Standard" : `${type.trim()}: ${value.trim()}`;

export interface FieldWarning {
  field: string;
  message: string;
}

/**
 * Product fields from one sheet row, ready to merge into the create-product payload.
 * Names (brand, tax, sub category, header category, store) are sent as text: the server swaps them
 * for ids and reports any it can't find.
 */
export function readProductFields(row: Record<string, unknown>): { payload: Record<string, unknown>; warnings: FieldWarning[] } {
  const payload: Record<string, unknown> = {};
  const warnings: FieldWarning[] = [];

  // Original columns, read by name / alias
  const core: Array<[string, string[]]> = [
    ["subcategory", ["2. Sub Cat", "Sub Cat", "Sub Category", "subcategory"]],
    ["brand", ["23. Brand", "Brand", "Brand Name", "PRODUCT_BRAND"]],
    ["tax", ["13. Tax Cat", "Tax Cat", "Tax Info", "Tax"]],
    ["pack", ["10. Unit", "Unit", "Pack", "Pack / Unit Size", "Unit Size"]],
  ];
  for (const [key, aliases] of core) {
    const v = cellText(row, aliases);
    if (v) payload[key] = v;
  }
  const description = cellText(row, ["7. Desc", "Desc", "Description", "Full Description", "PRODUCT_DESCRIPTION"]);
  if (description) payload.description = description;

  const mfg = normalizeDateCell(cellText(row, ["33. Mfg Date", "Mfg Date", "Manufacturing Date", "mfgDate"]));
  if (mfg) payload.mfgDate = mfg;
  const exp = normalizeDateCell(cellText(row, ["34. Expiry Date", "Expiry Date", "Expiry", "expiryDate"]));
  if (exp) payload.expiryDate = exp;

  for (const f of EXTRA_FIELDS) {
    const raw = cellText(row, [f.name, ...(f.aliases || [])]);
    if (!raw) continue;
    const parsed = f.read(raw);
    if (parsed.warning) warnings.push({ field: f.name, message: `${parsed.warning}; left blank` });
    else if (parsed.value !== undefined) payload[f.key] = parsed.value;
  }
  return { payload, warnings };
}

/** Rows that repeat a product (one per variant) share these fields: take the first filled value */
export const PRODUCT_LEVEL_KEYS = [
  "subcategory", "brand", "tax", "pack", "description", "mfgDate", "expiryDate",
  ...EXTRA_FIELDS.map((f) => f.key),
];

// ---------------------------------------------------------------------------------------------

/** Rows for the template's "Field guide" sheet */
export const fieldGuideRows = (): string[][] => [
  ["Column", "What to type", "Example"],
  ["1. Category", "Category name exactly as in Category setup", "Grocery"],
  ["2. Sub Cat", "Sub category name under that category", "Rice & Grains"],
  ["4. Product Name", "Required. Repeat the same name on each variant row", "Basmati Rice"],
  ["7. Desc", "Full description", "Aged long-grain basmati rice..."],
  ["10. Unit", "Pack / unit size", "1 kg"],
  ["13. Tax Cat", "Tax name as in Taxes setup", "GST 5%"],
  ["14. GST", "GST percent", "5"],
  ["23. Brand", "Brand name as in Brand setup", "India Gate"],
  ["28. Variations", "Variant type and value: Type: value (several: separate with ;)", "Weight: 500g"],
  ["33. Mfg Date / 34. Expiry Date", "Date as 31/12/2026 or 2026-12-31", "31/12/2026"],
  ["36. City / 37. Warehouse / 38. Room / 6. Rack", "Storage location of the product", "Hyderabad"],
  ["39. Status", "Active = published, Inactive = hidden", "Active"],
  ...EXTRA_FIELDS.map((f, i) => [`${EXTRA_FIELD_FIRST_NUMBER + i}. ${f.name}`, f.hint, f.example]),
];
