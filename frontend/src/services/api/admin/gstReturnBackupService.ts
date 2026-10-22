import api from "../config";

// ---------------- GST returns (GSTR-1, GSTR-3B)

export interface GstStoreOption {
  id: string;
  name: string;
  gstin: string;
  isAdminStore: boolean;
}

export interface TaxSplit {
  igst: number;
  cgst: number;
  sgst: number;
}

export interface GstReturns {
  period: string;
  store: { id: string; name: string; gstin: string; state: string };
  warnings: string[];
  gstr1: {
    b2b: unknown[];
    b2cl: Array<{ invoiceNumber: string; invoiceDate: string; invoiceValue: number; placeOfSupply: string; placeOfSupplyName: string; rate: number; taxable: number; igst: number }>;
    b2cs: Array<TaxSplit & { supplyType: string; placeOfSupply: string; placeOfSupplyName: string; rate: number; taxable: number }>;
    hsn: Array<TaxSplit & { hsn: string; description: string; uqc: string; rate: number; quantity: number; totalValue: number; taxable: number }>;
    documents: { from: string; to: string; total: number; cancelled: number; netIssued: number };
    totals: TaxSplit & { taxable: number; invoices: number };
  };
  gstr3b: {
    outwardTaxable: TaxSplit & { taxable: number };
    interStateUnregistered: Array<{ placeOfSupply: string; placeOfSupplyName: string; taxable: number; igst: number }>;
    itc: TaxSplit & { purchaseBills: number; purchaseTaxable: number };
    payable: TaxSplit;
    creditCarriedForward: TaxSplit;
  };
}

export const getGstReturnStores = async (): Promise<GstStoreOption[]> =>
  (await api.get("/admin/reports/gst-returns/stores")).data.data;

/** month: YYYY-MM; sellerId empty = the admin's own store */
export const getGstReturns = async (month: string, sellerId?: string): Promise<GstReturns> =>
  (await api.get("/admin/reports/gst-returns", { params: { month, ...(sellerId ? { sellerId } : {}) } })).data.data;

/** Seller app: the logged-in seller's own store */
export const getSellerGstReturns = async (month: string): Promise<GstReturns> =>
  (await api.get("/seller/reports/gst-returns", { params: { month } })).data.data;

// ---------------- Data backup (Super Admin)

export interface BackupFile {
  collectionName: string;
  part: number;
  documents: number;
  bytes: number;
}

export interface DataBackupRecord {
  _id: string;
  status: "running" | "done" | "failed";
  trigger: "manual" | "scheduled";
  startedBy?: { firstName?: string; lastName?: string; email?: string } | null;
  startedAt: string;
  finishedAt?: string;
  files: BackupFile[];
  totalDocuments: number;
  totalBytes: number;
  collectionsCount: number;
  error?: string;
}

export const listBackups = async (): Promise<{ data: DataBackupRecord[]; keep: number }> => {
  const res = await api.get("/admin/backups");
  return { data: res.data.data, keep: res.data.keep };
};

/** A full backup can take a while: allow up to 5 minutes */
export const startBackup = async (): Promise<DataBackupRecord> =>
  (await api.post("/admin/backups", {}, { timeout: 5 * 60 * 1000 })).data.data;

export const getBackupFileLink = async (backupId: string, index: number): Promise<{ url: string; fileName: string }> =>
  (await api.get(`/admin/backups/${backupId}/files/${index}/download`)).data.data;

// ---------------- Stock transfers between stores

export interface TransferProduct {
  productId: string;
  productName: string;
  image: string;
  variants: Array<{ variationId: string; label: string; stock: number; sku: string }>;
}

export interface StockTransferRecord {
  _id: string;
  transferNumber: string;
  fromSeller: { _id: string; storeName: string } | null;
  toSeller: { _id: string; storeName: string } | null;
  items: Array<{ productName: string; variantName?: string; sku?: string; quantity: number; createdInDestination: boolean }>;
  totalQuantity: number;
  status?: "Pending" | "Accepted" | "Rejected" | "Cancelled";
  note?: string;
  createdBy?: { firstName?: string; lastName?: string } | null;
  respondedBy?: { type: "Admin" | "Seller"; name?: string } | null;
  respondedAt?: string;
  responseNote?: string;
  createdAt: string;
}

export const getTransferStores = async (): Promise<GstStoreOption[]> => (await api.get("/admin/stock-transfers/stores")).data.data;

export const getTransferProducts = async (sellerId: string, search: string): Promise<TransferProduct[]> =>
  (await api.get("/admin/stock-transfers/products", { params: { sellerId, search } })).data.data;

export const getStockTransfers = async (sellerId?: string): Promise<StockTransferRecord[]> =>
  (await api.get("/admin/stock-transfers", { params: sellerId ? { sellerId } : {} })).data.data;

export const createStockTransfer = async (data: {
  fromSellerId: string;
  toSellerId: string;
  items: Array<{ productId: string; variationId: string; quantity: number }>;
  note?: string;
}): Promise<{ message: string; data: StockTransferRecord }> => (await api.post("/admin/stock-transfers", data)).data;

/** Admin: cancel a pending transfer (stock goes back), or accept / reject one sent to the admin's own store */
export const answerStockTransfer = async (id: string, action: "accept" | "reject" | "cancel", note?: string): Promise<{ message: string }> =>
  (await api.post(`/admin/stock-transfers/${id}/${action}`, { note })).data;

// ---------------- Product Photos (demo / missing pictures)

export type PhotoStatus = "missing" | "demo" | "real";
export interface ProductPhotoRow {
  id: string;
  name: string;
  image: string;
  store: string;
  status: PhotoStatus;
  live: boolean;
}

export const getProductPhotos = async (params: { status?: PhotoStatus | "all"; sellerId?: string; search?: string }) =>
  (await api.get("/admin/product-photos", { params, timeout: 3 * 60 * 1000 })).data.data as {
    counts: Record<PhotoStatus, number>;
    total: number;
    products: ProductPhotoRow[];
  };

export const markProductPhotoReal = async (url: string, real = true) => (await api.post("/admin/product-photos/mark-real", { url, real })).data;
