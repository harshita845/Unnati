import mongoose from "mongoose";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Seller from "../models/Seller";
import GSTReportEntry from "../models/GSTReportEntry";

/**
 * GSTR-1 and GSTR-3B for one store (one GSTIN) and one month, built from:
 *   - Sales: the store's Delivered orders dated in the month (online and POS). Prices include GST,
 *     the same way the GST Sales Report works out taxable value and tax.
 *   - Purchases (input tax credit): the store's GST Purchase Register rows dated in the month.
 * Customers don't give a GSTIN at checkout, so every sale is B2C (Table 4 B2B stays empty).
 * Intra-state vs inter-state: the store's state (first 2 digits of its GSTIN) against the
 * delivery address state; unknown either way = intra-state (CGST + SGST).
 */

export class GstReturnError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

/** GST state codes */
const STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const CODE_BY_NAME: Record<string, string> = Object.fromEntries(Object.entries(STATE_CODES).map(([c, n]) => [norm(n), c]));
// Common spellings
Object.assign(CODE_BY_NAME, { orissa: "21", pondicherry: "34", newdelhi: "07", nctofdelhi: "07", jk: "01", ap: "37", ts: "36", tg: "36", up: "09", mp: "23" });

const codeFromGstin = (gstin?: string | null) => {
  const c = String(gstin || "").trim().slice(0, 2);
  return STATE_CODES[c] ? c : null;
};
const codeFromState = (state?: string | null) => (state ? CODE_BY_NAME[norm(state)] || null : null);
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Month "YYYY-MM" → its first and last instant in Indian time */
const monthRange = (month: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(month || "");
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new GstReturnError(400, "Choose a month (YYYY-MM)");
  const IST = 330 * 60 * 1000;
  const start = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1) - IST);
  const end = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1) - IST - 1);
  return { start, end };
};

/** The admin's own store, or a seller store */
async function loadStore(sellerId?: string) {
  const store: any = sellerId
    ? mongoose.isValidObjectId(sellerId)
      ? await Seller.findById(sellerId).select("storeName taxNumber category city").lean()
      : null
    : await Seller.findOne({ category: "Admin" }).select("storeName taxNumber category city").lean();
  if (!store) throw new GstReturnError(404, "Store not found");
  return store;
}

interface SaleLine {
  invoice: string;
  invoiceDate: Date;
  invoiceValue: number;
  pos: string; // place of supply state code
  inter: boolean;
  hsn: string;
  description: string;
  qty: number;
  rate: number;
  value: number;
  taxable: number;
  igst: number;
  cgst: number;
  sgst: number;
}

export async function buildGstReturns(month: string, sellerId?: string) {
  const { start, end } = monthRange(month);
  const store = await loadStore(sellerId);
  const isAdminStore = store.category === "Admin";
  const gstin: string = String(store.taxNumber || "").trim().toUpperCase();
  const storeState = codeFromGstin(gstin);
  const warnings: string[] = [];
  if (!gstin) warnings.push(`${store.storeName} has no GSTIN saved. Add it in the store's details (Tax number).`);
  else if (!storeState) warnings.push(`GSTIN "${gstin}" doesn't start with a valid state code, so every sale is treated as intra-state.`);

  // ---------------- Sales
  const orders: any[] = await Order.find({
    orderDate: { $gte: start, $lte: end },
    status: "Delivered",
  })
    .select("orderNumber orderDate total deliveryAddress items")
    .lean();
  const orderById = new Map(orders.map((o) => [String(o._id), o]));
  const items: any[] = await OrderItem.find({
    order: { $in: orders.map((o) => o._id) },
    seller: store._id,
    status: { $nin: ["Cancelled", "Returned"] },
  })
    .populate({ path: "product", select: "hsnCode tax", populate: { path: "tax", select: "percentage" } })
    .lean();

  let missingHsn = 0;
  let unknownState = 0;
  const lines: SaleLine[] = [];
  for (const it of items) {
    const order = orderById.get(String(it.order));
    if (!order) continue;
    const rate = Number(it.gst ?? it.product?.tax?.percentage ?? 0) || 0;
    const value = Number(it.total) || 0;
    const tax = rate > 0 ? (typeof it.gstAmount === "number" ? it.gstAmount : (value * rate) / (100 + rate)) : 0;
    const taxable = value - tax;
    const custState = codeFromState(order.deliveryAddress?.state);
    if (!custState) unknownState++;
    const pos = custState || storeState || "";
    const inter = !!(storeState && custState && custState !== storeState);
    const hsn = String(it.hsnCode || it.product?.hsnCode || "").trim();
    if (!hsn) missingHsn++;
    lines.push({
      invoice: order.orderNumber,
      invoiceDate: order.orderDate,
      invoiceValue: Number(order.total) || 0,
      pos,
      inter,
      hsn,
      description: it.productName || "",
      qty: Number(it.quantity) || 0,
      rate,
      value,
      taxable,
      igst: inter ? tax : 0,
      cgst: inter ? 0 : tax / 2,
      sgst: inter ? 0 : tax / 2,
    });
  }
  if (missingHsn) warnings.push(`${missingHsn} sold item line(s) have no HSN code. Add HSN codes to those products.`);
  if (unknownState) warnings.push(`${unknownState} sold item line(s) have no delivery state; treated as sales within ${storeState ? STATE_CODES[storeState] : "the store's state"}.`);

  // Table 5: B2C Large = inter-state invoices worth more than ₹1,00,000 (from Aug 2024)
  const B2CL_LIMIT = 100000;
  const isB2CL = (l: SaleLine) => l.inter && l.invoiceValue > B2CL_LIMIT;

  const b2clMap = new Map<string, any>();
  const b2csMap = new Map<string, any>();
  const hsnMap = new Map<string, any>();
  for (const l of lines) {
    if (isB2CL(l)) {
      const key = `${l.invoice}|${l.rate}`;
      const row = b2clMap.get(key) || { invoiceNumber: l.invoice, invoiceDate: l.invoiceDate, invoiceValue: l.invoiceValue, placeOfSupply: l.pos, rate: l.rate, taxable: 0, igst: 0 };
      row.taxable += l.taxable;
      row.igst += l.igst;
      b2clMap.set(key, row);
    } else {
      const key = `${l.inter ? "INTER" : "INTRA"}|${l.pos}|${l.rate}`;
      const row = b2csMap.get(key) || { supplyType: l.inter ? "Inter-state" : "Intra-state", placeOfSupply: l.pos, rate: l.rate, taxable: 0, igst: 0, cgst: 0, sgst: 0 };
      row.taxable += l.taxable;
      row.igst += l.igst;
      row.cgst += l.cgst;
      row.sgst += l.sgst;
      b2csMap.set(key, row);
    }
    const hkey = `${l.hsn || "-"}|${l.rate}`;
    const h = hsnMap.get(hkey) || { hsn: l.hsn || "", description: l.description, uqc: "NOS", rate: l.rate, quantity: 0, totalValue: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0 };
    h.quantity += l.qty;
    h.totalValue += l.value;
    h.taxable += l.taxable;
    h.igst += l.igst;
    h.cgst += l.cgst;
    h.sgst += l.sgst;
    hsnMap.set(hkey, h);
  }
  const round = (row: any) => {
    for (const k of ["taxable", "igst", "cgst", "sgst", "totalValue", "invoiceValue"]) if (typeof row[k] === "number") row[k] = r2(row[k]);
    if (row.placeOfSupply !== undefined) row.placeOfSupplyName = STATE_CODES[row.placeOfSupply] || "";
    return row;
  };
  const b2cl = [...b2clMap.values()].map(round);
  const b2cs = [...b2csMap.values()].map(round).sort((a, b) => a.placeOfSupply.localeCompare(b.placeOfSupply) || a.rate - b.rate);
  const hsn = [...hsnMap.values()].map(round).sort((a, b) => b.taxable - a.taxable);

  // Table 13: documents issued (the month's invoices, and orders cancelled in the month)
  const invoiceNumbers = [...new Set(lines.map((l) => l.invoice))].sort();
  const cancelledOrders: any[] = await Order.find({ orderDate: { $gte: start, $lte: end }, status: { $in: ["Cancelled", "Rejected"] } }).select("_id").lean();
  const cancelled = cancelledOrders.length
    ? (await OrderItem.distinct("order", { order: { $in: cancelledOrders.map((o) => o._id) }, seller: store._id })).length
    : 0;
  const documents = {
    from: invoiceNumbers[0] || "",
    to: invoiceNumbers[invoiceNumbers.length - 1] || "",
    total: invoiceNumbers.length + cancelled,
    cancelled,
    netIssued: invoiceNumbers.length,
  };

  const sum = (rows: any[], k: string) => r2(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0));
  const outward = {
    taxable: r2(sum(b2cl, "taxable") + sum(b2cs, "taxable")),
    igst: r2(sum(b2cl, "igst") + sum(b2cs, "igst")),
    cgst: sum(b2cs, "cgst"),
    sgst: sum(b2cs, "sgst"),
  };

  // ---------------- Purchases → input tax credit (GSTR-3B Table 4)
  const purchases: any[] = await GSTReportEntry.find({
    ...(isAdminStore ? { isAdmin: true } : { sellerId: store._id }),
    date: { $gte: start, $lte: end },
  }).lean();
  const itc = { igst: 0, cgst: 0, sgst: 0 };
  let purchaseTaxable = 0;
  for (const p of purchases) {
    const gst = ["slab5Gst", "slab12Gst", "slab18Gst", "slab28Gst", "customGst"].reduce((s, k) => s + (Number(p[k]) || 0), 0);
    purchaseTaxable += ["slab5Amount", "slab12Amount", "slab18Amount", "slab28Amount", "customAmount"].reduce((s, k) => s + (Number(p[k]) || 0), 0);
    const supplierState = codeFromGstin(p.supplierGstNumber);
    if (storeState && supplierState && supplierState !== storeState) itc.igst += gst;
    else {
      itc.cgst += gst / 2;
      itc.sgst += gst / 2;
    }
  }
  itc.igst = r2(itc.igst);
  itc.cgst = r2(itc.cgst);
  itc.sgst = r2(itc.sgst);

  // Table 3.2: inter-state supplies to unregistered persons, by place of supply
  const interByState = new Map<string, { placeOfSupply: string; placeOfSupplyName: string; taxable: number; igst: number }>();
  for (const l of lines.filter((x) => x.inter)) {
    const row = interByState.get(l.pos) || { placeOfSupply: l.pos, placeOfSupplyName: STATE_CODES[l.pos] || "", taxable: 0, igst: 0 };
    row.taxable += l.taxable;
    row.igst += l.igst;
    interByState.set(l.pos, row);
  }

  // Table 6.1: set-off of credit against tax (IGST credit first to IGST, then CGST, then SGST;
  // CGST credit to CGST then IGST; SGST credit to SGST then IGST; CGST and SGST never cross)
  const due = { igst: outward.igst, cgst: outward.cgst, sgst: outward.sgst };
  const credit = { ...itc };
  const use = (from: keyof typeof credit, to: keyof typeof due) => {
    const n = Math.min(credit[from], due[to]);
    credit[from] = r2(credit[from] - n);
    due[to] = r2(due[to] - n);
  };
  use("igst", "igst");
  use("igst", "cgst");
  use("igst", "sgst");
  use("cgst", "cgst");
  use("cgst", "igst");
  use("sgst", "sgst");
  use("sgst", "igst");

  return {
    period: month,
    store: { id: String(store._id), name: store.storeName, gstin, state: storeState ? STATE_CODES[storeState] : "" },
    warnings,
    gstr1: {
      b2b: [] as any[],
      b2cl,
      b2cs,
      hsn,
      documents,
      totals: { ...outward, invoices: invoiceNumbers.length },
    },
    gstr3b: {
      outwardTaxable: outward, // 3.1(a)
      interStateUnregistered: [...interByState.values()].map((r) => ({ ...r, taxable: r2(r.taxable), igst: r2(r.igst) })), // 3.2
      itc: { ...itc, purchaseBills: purchases.length, purchaseTaxable: r2(purchaseTaxable) }, // 4(A)(5)
      payable: due, // tax still to pay in cash after using credit
      creditCarriedForward: credit,
    },
  };
}

/** Stores to choose from: the admin's own store first, then sellers */
export async function gstReturnStores() {
  const sellers: any[] = await Seller.find({ status: "Approved" }).select("storeName taxNumber category").sort({ storeName: 1 }).lean();
  return sellers
    .map((s) => ({ id: String(s._id), name: s.storeName, gstin: s.taxNumber || "", isAdminStore: s.category === "Admin" }))
    .sort((a, b) => Number(b.isAdminStore) - Number(a.isAdminStore));
}
