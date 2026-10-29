import mongoose, { Document, Schema } from "mongoose";

/**
 * One scanned bill (Admin POS → Scan Bill): the uploaded files, what the AI read, the edited
 * version the person reviews, and what it was synced to once confirmed.
 *
 * status: processing → draft (review) → syncing → confirmed
 *                    ↘ failed (AI error; can still be filled manually and confirmed)
 *         draft/failed → discarded
 */

export type ScanStatus = "processing" | "draft" | "failed" | "syncing" | "confirmed" | "discarded";
export type ScanDocType = "purchase" | "sales" | "stock_slip" | "expense" | "unknown";

export interface IScanFile {
  publicId?: string;
  resourceType?: string;
  deliveryType?: string;
  format?: string;
  mimeType: string;
  bytes?: number;
  pages?: number;
  originalName?: string;
}

export interface IScannedDocument extends Document {
  /** Set for admin scans (the admin's own store) */
  admin?: mongoose.Types.ObjectId;
  /** Set for a seller's own scans (Scan Bill in the seller panel) */
  seller?: mongoose.Types.ObjectId;
  status: ScanStatus;
  docType: ScanDocType;
  files: IScanFile[];
  provider?: string;
  aiModel?: string;
  /** What the AI returned (normalized), kept unchanged for audit */
  extracted?: any;
  /** The current, edited bill (what confirm uses) */
  data?: any;
  warnings: Array<{ code: string; severity: string; message: string; field?: string }>;
  matches?: any;
  confidence?: number;
  /** Party + bill number (or party + date + total), for duplicate detection */
  fingerprint?: string;
  duplicateOf?: mongoose.Types.ObjectId;
  error?: string;
  /** Number of AI calls this document used (scan + re-scans + repair retries) */
  aiCalls: number;
  repaired: boolean;
  usage?: { inputTokens?: number; outputTokens?: number; ms?: number };
  /** Searchable copies of the key fields for the history table */
  partyName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  grandTotal?: number;
  sync?: {
    target?: string;
    at?: Date;
    by?: mongoose.Types.ObjectId;
    purchaseEntryId?: string;
    orderId?: mongoose.Types.ObjectId;
    orderNumber?: string;
    supplierId?: mongoose.Types.ObjectId;
    customerId?: mongoose.Types.ObjectId;
    stockMovements?: number;
    createdProducts?: mongoose.Types.ObjectId[];
    ledgerAmount?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ScanFileSchema = new Schema<IScanFile>(
  {
    publicId: String,
    resourceType: String,
    deliveryType: String,
    format: String,
    mimeType: { type: String, required: true },
    bytes: Number,
    pages: Number,
    originalName: String,
  },
  { _id: false }
);

const ScannedDocumentSchema = new Schema<IScannedDocument>(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: function (this: any) {
        return !this.seller;
      },
    },
    seller: { type: Schema.Types.ObjectId, ref: "Seller", default: undefined },
    status: {
      type: String,
      enum: ["processing", "draft", "failed", "syncing", "confirmed", "discarded"],
      default: "processing",
    },
    docType: { type: String, enum: ["purchase", "sales", "stock_slip", "expense", "unknown"], default: "unknown" },
    files: { type: [ScanFileSchema], default: [] },
    provider: String,
    aiModel: String,
    extracted: Schema.Types.Mixed,
    data: Schema.Types.Mixed,
    warnings: {
      type: [{ _id: false, code: String, severity: String, message: String, field: String }],
      default: [],
    },
    matches: Schema.Types.Mixed,
    confidence: Number,
    fingerprint: String,
    duplicateOf: { type: Schema.Types.ObjectId, ref: "ScannedDocument" },
    error: String,
    aiCalls: { type: Number, default: 0 },
    repaired: { type: Boolean, default: false },
    usage: { inputTokens: Number, outputTokens: Number, ms: Number },
    partyName: { type: String, trim: true },
    invoiceNumber: { type: String, trim: true },
    invoiceDate: String,
    grandTotal: Number,
    sync: {
      target: String,
      at: Date,
      by: { type: Schema.Types.ObjectId, ref: "Admin" },
      purchaseEntryId: String,
      orderId: { type: Schema.Types.ObjectId, ref: "Order" },
      orderNumber: String,
      supplierId: { type: Schema.Types.ObjectId, ref: "SupplierLedger" },
      customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
      stockMovements: Number,
      createdProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],
      ledgerAmount: Number,
    },
  },
  { timestamps: true }
);

ScannedDocumentSchema.index({ createdAt: -1 });
ScannedDocumentSchema.index({ seller: 1, createdAt: -1 });
ScannedDocumentSchema.index({ status: 1, createdAt: -1 });
ScannedDocumentSchema.index({ fingerprint: 1 });

const ScannedDocument =
  (mongoose.models.ScannedDocument as mongoose.Model<IScannedDocument>) ||
  mongoose.model<IScannedDocument>("ScannedDocument", ScannedDocumentSchema);

export default ScannedDocument;
