import mongoose, { Document, Schema } from "mongoose";

/**
 * Stock sent from one store to another by an admin. The stock leaves the sending store when the
 * transfer is sent (Pending) and arrives in the receiving store only when that store accepts it.
 * Rejected by the receiver or cancelled by the admin: the stock goes back to the sending store.
 */
export type StockTransferStatus = "Pending" | "Accepted" | "Rejected" | "Cancelled";
export interface IStockTransferItem {
  productName: string;
  variantName?: string;
  sku?: string;
  quantity: number;
  fromProduct: mongoose.Types.ObjectId;
  fromVariation: mongoose.Types.ObjectId;
  /** Set when the receiving store accepts */
  toProduct?: mongoose.Types.ObjectId;
  toVariation?: mongoose.Types.ObjectId;
  /** The receiving store didn't have this product: a copy was added to it */
  createdInDestination: boolean;
}

export interface IStockTransfer extends Document {
  transferNumber: string;
  fromSeller: mongoose.Types.ObjectId;
  toSeller: mongoose.Types.ObjectId;
  items: IStockTransferItem[];
  totalQuantity: number;
  status: StockTransferStatus;
  note?: string;
  createdBy?: mongoose.Types.ObjectId;
  /** Who accepted / rejected / cancelled it, and when */
  respondedBy?: { type: "Admin" | "Seller"; id: mongoose.Types.ObjectId; name?: string };
  respondedAt?: Date;
  responseNote?: string;
  createdAt: Date;
}

const StockTransferSchema = new Schema<IStockTransfer>(
  {
    transferNumber: { type: String, required: true, unique: true },
    fromSeller: { type: Schema.Types.ObjectId, ref: "Seller", required: true },
    toSeller: { type: Schema.Types.ObjectId, ref: "Seller", required: true },
    items: [
      {
        _id: false,
        productName: { type: String, required: true },
        variantName: { type: String },
        sku: { type: String },
        quantity: { type: Number, required: true, min: 1 },
        fromProduct: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        fromVariation: { type: Schema.Types.ObjectId, required: true },
        toProduct: { type: Schema.Types.ObjectId, ref: "Product" },
        toVariation: { type: Schema.Types.ObjectId },
        createdInDestination: { type: Boolean, default: false },
      },
    ],
    totalQuantity: { type: Number, default: 0 },
    status: { type: String, enum: ["Pending", "Accepted", "Rejected", "Cancelled"], default: "Pending" },
    respondedBy: {
      type: { type: String, enum: ["Admin", "Seller"] },
      id: { type: Schema.Types.ObjectId },
      name: { type: String },
    },
    respondedAt: { type: Date },
    responseNote: { type: String, trim: true, maxlength: 500 },
    note: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

StockTransferSchema.index({ createdAt: -1 });
StockTransferSchema.index({ fromSeller: 1, createdAt: -1 });
StockTransferSchema.index({ toSeller: 1, createdAt: -1 });
StockTransferSchema.index({ toSeller: 1, status: 1 });

export default mongoose.model<IStockTransfer>("StockTransfer", StockTransferSchema);
