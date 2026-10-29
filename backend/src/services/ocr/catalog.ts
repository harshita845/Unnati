import Product from "../../models/Product";
import SupplierLedger from "../../models/SupplierLedger";
import Customer from "../../models/Customer";
import { variantsFromProductDoc } from "../../modules/product/variantHelpers";
import { CatalogEntry, ItemMatch, matchItems, matchParty, PartyEntry, PartyMatch } from "./match";
import type { Extraction } from "./schema";
import type { ScanOwner } from "./owner";

/**
 * Same product set the POS sells and purchases against, one row per variant: all active products
 * for the admin, only the seller's own for a seller.
 */
export async function loadCatalog(owner: ScanOwner): Promise<CatalogEntry[]> {
  const products: any[] = await Product.find({ status: "Active", ...(owner.kind === "seller" ? { seller: owner.sellerId } : {}) })
    .select("productName variations hsnCode gst barcode sku")
    .lean();
  const rows: CatalogEntry[] = [];
  for (const p of products) {
    const variants = variantsFromProductDoc(p);
    const many = variants.length > 1;
    for (const v of variants.length ? variants : [{} as any]) {
      rows.push({
        productId: String(p._id),
        variationId: v?._id ? String(v._id) : undefined,
        name: p.productName,
        variant: many ? String(v.value || v.name || "") : undefined,
        sku: v.sku || p.sku || undefined,
        barcodes: [...(Array.isArray(v.barcode) ? v.barcode : []), ...(Array.isArray(p.barcode) ? p.barcode : p.barcode ? [p.barcode] : [])].map(String),
        hsn: p.hsnCode || undefined,
        mrp: Number(v.compareAtPrice ?? v.price) || undefined,
        price: Number(v.discPrice ?? v.price) || undefined,
        purchasePrice: Number(v.purchasePrice) || undefined,
        stock: Number(v.stock) || 0,
        gst: Number.isFinite(Number(p.gst)) ? Number(p.gst) : undefined,
      });
    }
  }
  return rows;
}

export async function loadSuppliers(owner: ScanOwner): Promise<PartyEntry[]> {
  const rows: any[] = await SupplierLedger.find(owner.kind === "seller" ? { sellerId: owner.sellerId, isAdmin: false } : { isAdmin: true }).select("name phone gstNumber address currentBalance").lean();
  return rows.map((s) => ({ id: String(s._id), name: s.name, phone: s.phone, gstin: s.gstNumber, address: s.address, balance: s.currentBalance }));
}

export async function loadCustomers(party: Extraction["party"]): Promise<PartyEntry[]> {
  // Customers can be many: narrow by phone or a name prefix first, then fuzzy-rank
  const or: any[] = [];
  const phone = (party.phone || "").replace(/\D/g, "").slice(-10);
  if (phone.length === 10) or.push({ phone: new RegExp(`${phone}$`) });
  const word = (party.name || "").trim().split(/\s+/)[0];
  if (word && word.length >= 2) or.push({ name: new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") });
  if (!or.length) return [];
  const rows: any[] = await Customer.find({ $or: or, email: { $ne: "walkin@pos.com" } })
    .select("name phone address creditBalance")
    .limit(50)
    .lean();
  return rows.map((c) => ({ id: String(c._id), name: c.name, phone: c.phone, address: c.address, balance: c.creditBalance }));
}

export interface ScanMatches {
  items: ItemMatch[];
  party: PartyMatch;
}

export async function computeMatches(e: Extraction, owner: ScanOwner): Promise<ScanMatches> {
  if (e.docType === "expense") return { items: [], party: { status: "new", candidates: [] } };
  const [catalog, parties] = await Promise.all([
    e.items.length ? loadCatalog(owner) : Promise.resolve([]),
    // Customers are shared app accounts: sales bills stay admin-only
    e.docType === "sales" ? (owner.kind === "seller" ? Promise.resolve([]) : loadCustomers(e.party)) : loadSuppliers(owner),
  ]);
  return {
    items: matchItems(e.items, catalog),
    party: matchParty(e.party, parties),
  };
}
