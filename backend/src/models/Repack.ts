import mongoose, { Document, Schema } from "mongoose";

/**
 * One repacking run: bulk stock of one item turned into smaller packs inside the same store.
 * This is an internal stock movement, not a sale or a purchase. The record keeps everything
 * needed to audit it later: what was used, what was made, the stock before and after on both
 * sides, how each packet's cost was worked out, and who did it and when.
 */

export interface IRepackOutput {
  product: mongoose.Types.ObjectId;
  variationId: mongoose.Types.ObjectId;
  productName: string;
  variantLabel: string;
  sku: string;
  packs: number;
  /** how much of the bulk item one pack uses, in the bulk item's own stock units */
  sourcePerPack: number;
  stockBefore: number;
  stockAfter: number;
  sourceCostPerPack: number;
  packagingCostPerPack: number;
  wastageCostPerPack: number;
  costPerPack: number;
  previousCost?: number;
  newCost?: number;
}

export interface IRepack extends Document {
  repackNumber: string;
  seller: mongoose.Types.ObjectId;
  batchNo?: string;
  note?: string;
  source: {
    product: mongoose.Types.ObjectId;
    variationId: mongoose.Types.ObjectId;
    productName: string;
    variantLabel: string;
    sku: string;
    unitCost: number;
    stockBefore: number;
    usedForPacks: number;
    wastage: number;
    totalUsed: number;
    stockAfter: number;
  };
  outputs: IRepackOutput[];
  totals: {
    packsCreated: number;
    sourceCost: number;
    packagingCost: number;
    wastageCost: number;
    totalCost: number;
  };
  costUpdated: boolean;
  performedBy: { type: "Admin" | "Seller"; id: mongoose.Types.ObjectId; name: string };
  createdAt: Date;
  updatedAt: Date;
}

const OutputSchema = new Schema<IRepackOutput>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variationId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true },
    variantLabel: { type: String, default: "" },
    sku: { type: String, default: "" },
    packs: { type: Number, required: true, min: 1 },
    sourcePerPack: { type: Number, required: true, min: 0 },
    stockBefore: { type: Number, required: true },
    stockAfter: { type: Number, required: true },
    sourceCostPerPack: { type: Number, default: 0 },
    packagingCostPerPack: { type: Number, default: 0 },
    wastageCostPerPack: { type: Number, default: 0 },
    costPerPack: { type: Number, default: 0 },
    previousCost: { type: Number },
    newCost: { type: Number },
  },
  { _id: false }
);

const RepackSchema = new Schema<IRepack>(
  {
    repackNumber: { type: String, required: true, unique: true },
    seller: { type: Schema.Types.ObjectId, ref: "Seller", required: true },
    batchNo: { type: String, trim: true },
    note: { type: String, trim: true },
    source: {
      product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
      variationId: { type: Schema.Types.ObjectId, required: true },
      productName: { type: String, required: true },
      variantLabel: { type: String, default: "" },
      sku: { type: String, default: "" },
      unitCost: { type: Number, default: 0 },
      stockBefore: { type: Number, required: true },
      usedForPacks: { type: Number, required: true },
      wastage: { type: Number, default: 0 },
      totalUsed: { type: Number, required: true },
      stockAfter: { type: Number, required: true },
    },
    outputs: { type: [OutputSchema], default: [] },
    totals: {
      packsCreated: { type: Number, default: 0 },
      sourceCost: { type: Number, default: 0 },
      packagingCost: { type: Number, default: 0 },
      wastageCost: { type: Number, default: 0 },
      totalCost: { type: Number, default: 0 },
    },
    costUpdated: { type: Boolean, default: true },
    performedBy: {
      type: { type: String, enum: ["Admin", "Seller"], required: true },
      id: { type: Schema.Types.ObjectId, required: true },
      name: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

RepackSchema.index({ seller: 1, createdAt: -1 });
RepackSchema.index({ "source.product": 1 });

export default mongoose.model<IRepack>("Repack", RepackSchema);
