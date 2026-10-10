import api from '../config';

/** Admin POS → Scan Bill (AI bill reading). Backend: /api/v1/admin/pos/ocr */

const BASE = '/admin/pos/ocr';
/** One scan can take up to ~45 s of AI time; the shared client times out at 20 s */
const SCAN_TIMEOUT_MS = 90_000;

export type ScanDocType = 'purchase' | 'sales' | 'stock_slip' | 'expense' | 'unknown';
export type ScanStatus = 'processing' | 'draft' | 'failed' | 'syncing' | 'confirmed' | 'discarded';
export type PaymentMode = 'cash' | 'upi' | 'card' | 'bank' | 'cheque' | 'credit' | 'other';
export type PaymentStatus = 'paid' | 'unpaid' | 'partial';
export type ItemAction = 'link' | 'create' | 'skip';
export type MatchStatus = 'matched' | 'similar' | 'new';

export const DOC_TYPE_LABEL: Record<ScanDocType, string> = {
  purchase: 'Purchase bill',
  sales: 'Sales bill',
  stock_slip: 'Stock slip',
  expense: 'Expense',
  unknown: 'Not sure',
};

export interface BillItem {
  name: string | null;
  hsn?: string | null;
  barcode?: string | null;
  quantity: number | null;
  unit?: string | null;
  rate: number | null;
  mrp?: number | null;
  sellingPrice?: number | null;
  discount?: number | null;
  taxRate?: number | null;
  taxAmount?: number | null;
  amount: number | null;
  batch?: string | null;
  expiry?: string | null;
  confidence?: number | null;
  action: ItemAction;
  productId?: string | null;
  variationId?: string | null;
  categoryId?: string | null;
}

export interface BillTotals {
  subtotal?: number | null;
  discount?: number | null;
  cgst?: number | null;
  sgst?: number | null;
  igst?: number | null;
  cess?: number | null;
  otherCharges?: number | null;
  roundOff?: number | null;
  grandTotal?: number | null;
}

export interface BillConfidence {
  overall?: number | null;
  invoiceNumber?: number | null;
  invoiceDate?: number | null;
  party?: number | null;
  items?: number | null;
  totals?: number | null;
}

export interface ReviewBill {
  docType: ScanDocType;
  documentTitle?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  party: {
    name?: string | null;
    gstin?: string | null;
    phone?: string | null;
    address?: string | null;
    state?: string | null;
    supplierId?: string | null;
    customerId?: string | null;
  };
  items: BillItem[];
  totals: BillTotals;
  amountInWords?: string | null;
  paymentMode?: PaymentMode | null;
  paymentStatus?: PaymentStatus | null;
  amountPaid?: number | null;
  notes?: string | null;
  stockDirection?: 'in' | 'out';
  expenseCategory?: string | null;
  confidence?: BillConfidence;
}

export interface ScanWarning {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
}

export interface MatchCandidate {
  productId: string;
  variationId?: string;
  name: string;
  variant?: string;
  sku?: string;
  mrp?: number;
  price?: number;
  purchasePrice?: number;
  stock?: number;
  score: number;
  reason: 'barcode' | 'sku' | 'name';
}

export interface ItemMatch {
  status: MatchStatus;
  best?: MatchCandidate;
  candidates: MatchCandidate[];
}

export interface PartyCandidate {
  id: string;
  name: string;
  phone?: string;
  gstin?: string;
  address?: string;
  balance?: number;
  score: number;
  reason: 'gstin' | 'phone' | 'name';
}

export interface ScanMatches {
  items: ItemMatch[];
  party: { status: MatchStatus; best?: PartyCandidate; candidates: PartyCandidate[] };
}

export interface ScanFile {
  publicId?: string;
  mimeType: string;
  format?: string;
  bytes?: number;
  pages?: number;
  originalName?: string;
  previewUrls?: string[];
  originalUrl?: string | null;
}

export interface ScannedDocument {
  _id: string;
  status: ScanStatus;
  docType: ScanDocType;
  files: ScanFile[];
  provider?: string;
  aiModel?: string;
  extracted?: ReviewBill;
  data?: ReviewBill;
  warnings: ScanWarning[];
  matches?: ScanMatches | null;
  confidence?: number;
  duplicateOf?: string;
  error?: string;
  aiCalls: number;
  repaired?: boolean;
  usage?: { inputTokens?: number; outputTokens?: number; ms?: number };
  partyName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  grandTotal?: number;
  sync?: {
    target?: string;
    at?: string;
    purchaseEntryId?: string;
    orderId?: string;
    orderNumber?: string;
    supplierId?: string;
    customerId?: string;
    stockMovements?: number;
    createdProducts?: string[];
    ledgerAmount?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ScanHistoryRow extends Omit<ScannedDocument, 'files' | 'warnings' | 'data' | 'extracted' | 'matches'> {
  warningCount: number;
  pages: number;
  thumbnailUrl: string | null;
}

export interface ScanConfig {
  aiEnabled: boolean;
  provider: string | null;
  model: string | null;
  configError: string | null;
  storageEnabled: boolean;
  maxFiles: number;
  maxFileMb: number;
  allowedTypes: string[];
  timeoutMs: number;
}

export interface ScanUsage {
  month: string;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  scans: number;
  confirmed: number;
  failed: number;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  aiError?: string;
  alreadyConfirmed?: boolean;
  details?: string[];
  pagination?: { page: number; limit: number; total: number; pages: number };
}

export const getScanConfig = () => api.get<ApiResponse<ScanConfig>>(`${BASE}/config`).then((r) => r.data.data);
export const getScanUsage = () => api.get<ApiResponse<ScanUsage>>(`${BASE}/usage`).then((r) => r.data.data);

export interface UploadedScanFile {
  publicId: string;
  format?: string;
  mimeType: string;
  bytes: number;
  pages?: number;
  originalName?: string;
}

/** Upload one prepared file straight to Cloudinary (private), signed by the backend. */
export async function uploadScanFile(file: Blob, originalName: string, onProgress?: (pct: number) => void): Promise<UploadedScanFile> {
  let sig: { uploadUrl: string; apiKey: string; folder: string; type: string; timestamp: number; signature: string };
  try {
    const { data } = await api.post<ApiResponse<typeof sig>>(`${BASE}/upload-signature`);
    sig = data.data;
  } catch (e: any) {
    const status = e?.response?.status;
    const reason = e?.response?.data?.message || e?.message;
    throw new Error(`Couldn't sign the upload${status || reason ? ` (${[status, reason].filter(Boolean).join(': ')})` : ''}.`);
  }
  const form = new FormData();
  form.append('file', file, originalName);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  form.append('type', sig.type);

  const result = await new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', sig.uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: any = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* handled below */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.public_id) resolve(body);
      else reject(new Error(`Upload to storage failed (${[xhr.status, body?.error?.message].filter(Boolean).join(': ')}).`));
    };
    xhr.onerror = () => reject(new Error('Upload to storage failed (network error). Check your internet connection.'));
    xhr.send(form);
  });
  return {
    publicId: result.public_id,
    format: result.format,
    mimeType: file.type || 'image/jpeg',
    bytes: result.bytes,
    pages: result.pages,
    originalName,
  };
}

/** When the server has no file storage set up, small files go inline (base64) instead. */
export const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]+,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export type ScanFileInput = UploadedScanFile | { mimeType: string; dataBase64: string; originalName?: string };

export const scanBill = (files: ScanFileInput[], docType?: ScanDocType) =>
  api
    .post<ApiResponse<ScannedDocument>>(`${BASE}/scan`, { files, ...(docType && docType !== 'unknown' ? { docType } : {}) }, { timeout: SCAN_TIMEOUT_MS })
    .then((r) => r.data);

/** Type a bill in by hand. Pages, if given, are kept with it so the photo shows beside the form. */
export const startManualEntry = (docType: ScanDocType, files: ScanFileInput[] = []) =>
  api.post<ApiResponse<ScannedDocument>>(`${BASE}/scan`, { manual: true, docType, files }).then((r) => r.data.data);

export const rescanBill = (id: string, docType?: ScanDocType) =>
  api.post<ApiResponse<ScannedDocument>>(`${BASE}/${id}/rescan`, docType && docType !== 'unknown' ? { docType } : {}, { timeout: SCAN_TIMEOUT_MS }).then((r) => r.data);

export const getScan = (id: string) => api.get<ApiResponse<ScannedDocument>>(`${BASE}/${id}`).then((r) => r.data.data);

export const saveScan = (id: string, data: ReviewBill) => api.put<ApiResponse<ScannedDocument>>(`${BASE}/${id}`, { data }).then((r) => r.data.data);

export const rematchScan = (id: string, data: ReviewBill) => api.post<ApiResponse<ScanMatches>>(`${BASE}/${id}/rematch`, { data }).then((r) => r.data.data);

export const confirmScan = (id: string, data: ReviewBill, syncLedger: boolean) =>
  api.post<ApiResponse<ScannedDocument>>(`${BASE}/${id}/confirm`, { data, syncLedger }, { timeout: 60_000 }).then((r) => r.data);

export const syncScanLedger = (id: string, supplierId?: string) =>
  api.post<ApiResponse<ScannedDocument>>(`${BASE}/${id}/sync-ledger`, supplierId ? { supplierId } : {}).then((r) => r.data);

export const discardScan = (id: string) => api.delete<ApiResponse<unknown>>(`${BASE}/${id}`).then((r) => r.data);

export interface ScanHistoryQuery {
  status?: string;
  docType?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const listScans = (params: ScanHistoryQuery) =>
  api.get<ApiResponse<ScanHistoryRow[]>>(BASE, { params }).then((r) => ({ rows: r.data.data, pagination: r.data.pagination! }));

/** Download the CSV with the admin token (a plain link wouldn't carry it). */
export async function downloadScanCsv(id: string, fileName: string) {
  const res = await api.get(`${BASE}/${id}/export`, { params: { format: 'csv' }, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
