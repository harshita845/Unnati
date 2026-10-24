import api from "./config";

/** Admin works across stores; a seller only ever repacks their own store (the server takes it from the login). */
export type RepackScope = "admin" | "seller";

const base = (scope: RepackScope) => (scope === "admin" ? "/admin/repacks" : "/seller/repacks");

export interface PackContent {
  amount: number;
  unit: string;
  dimension: "mass" | "volume" | "length" | "count";
  base: number;
}

export interface RepackVariant {
  variationId: string;
  label: string;
  value: string;
  stock: number;
  sku: string;
  purchasePrice: number;
  content: PackContent | null;
}

export interface RepackProduct {
  productId: string;
  productName: string;
  image: string;
  variants: RepackVariant[];
}

export interface RepackStore {
  id: string;
  name: string;
  isAdminStore: boolean;
}

export interface RepackRuleOption {
  productId: string;
  variationId: string;
  productName: string;
  variantLabel: string;
  stock: number;
  sourcePerPack: number;
  packagingCostPerPack: number;
  lastUsedAt: string;
}

export interface RepackOutputInput {
  productId: string;
  variationId: string;
  packs: number;
  sourcePerPack: number;
  packagingCostPerPack?: number;
}

export interface RepackRequest {
  sellerId?: string;
  source: { productId: string; variationId: string };
  outputs: RepackOutputInput[];
  wastage?: number;
  batchNo?: string;
  note?: string;
  updateCost?: boolean;
}

export interface RepackSourceResult {
  product: string;
  variationId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  unitCost: number;
  stockBefore: number;
  usedForPacks: number;
  wastage: number;
  totalUsed: number;
  stockAfter: number;
}

export interface RepackOutputResult {
  product: string;
  variationId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  packs: number;
  sourcePerPack: number;
  suggestedSourcePerPack?: number | null;
  sourceUsed?: number;
  stockBefore: number;
  stockAfter: number;
  sourceCostPerPack: number;
  packagingCostPerPack: number;
  wastageCostPerPack: number;
  costPerPack: number;
  previousCost?: number;
  newCost?: number;
}

export interface RepackTotals {
  packsCreated: number;
  sourceCost: number;
  packagingCost: number;
  wastageCost: number;
  totalCost: number;
}

export interface RepackPreview {
  sellerId: string;
  batchNo: string;
  note: string;
  source: RepackSourceResult;
  outputs: RepackOutputResult[];
  totals: RepackTotals;
  warnings: string[];
}

export interface RepackRecord {
  _id: string;
  repackNumber: string;
  seller: { _id: string; storeName: string } | string;
  batchNo?: string;
  note?: string;
  source: RepackSourceResult;
  outputs: RepackOutputResult[];
  totals: RepackTotals;
  costUpdated: boolean;
  performedBy: { type: "Admin" | "Seller"; id: string; name: string };
  createdAt: string;
}

export const getRepackStores = async (): Promise<RepackStore[]> =>
  (await api.get("/admin/repacks/stores")).data.data;

export const getRepackProducts = async (scope: RepackScope, sellerId: string, search = ""): Promise<RepackProduct[]> =>
  (await api.get(`${base(scope)}/products`, { params: { sellerId: scope === "admin" ? sellerId : undefined, search } })).data.data;

export const getRepackRules = async (scope: RepackScope, sellerId: string, sourceVariationId: string): Promise<RepackRuleOption[]> =>
  (await api.get(`${base(scope)}/rules`, { params: { sellerId: scope === "admin" ? sellerId : undefined, sourceVariationId } })).data.data;

export const previewRepack = async (scope: RepackScope, body: RepackRequest): Promise<RepackPreview> =>
  (await api.post(`${base(scope)}/preview`, body)).data.data;

export const createRepack = async (scope: RepackScope, body: RepackRequest): Promise<{ message: string; data: RepackRecord }> =>
  (await api.post(base(scope), body)).data;

export const listRepacks = async (scope: RepackScope, sellerId?: string): Promise<RepackRecord[]> =>
  (await api.get(base(scope), { params: { sellerId: scope === "admin" && sellerId ? sellerId : undefined } })).data.data;

export const getRepackById = async (scope: RepackScope, id: string): Promise<RepackRecord> =>
  (await api.get(`${base(scope)}/${id}`)).data.data;
