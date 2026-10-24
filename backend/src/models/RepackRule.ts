import mongoose, { Document, Schema } from "mongoose";

/**
 * The conversion a store uses for a bulk item and a pack size: how much bulk one pack takes, and
 * the packaging cost per pack. Ratios differ by product (one box holds 100 bolts, another 50), so
 * each store keeps its own. Saved automatically every time a repack uses it, so the next repack of
 * the same item starts pre-filled.
 */
export interface IRepackRule extends Document {
  seller: mongoose.Types.ObjectId;
  sourceProduct: mongoose.Types.ObjectId;
  sourceVariationId: mongoose.Types.ObjectId;
  targetProduct: mongoose.Types.ObjectId;
  targetVariationId: mongoose.Types.ObjectId;
  sourcePerPack: number;
  packagingCostPerPack: number;
  lastUsedAt: Date;
}

const RepackRuleSchema = new Schema<IRepackRule>(
  {
    seller: { type: Schema.Types.ObjectId, ref: "Seller", required: true },
    sourceProduct: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sourceVariationId: { type: Schema.Types.ObjectId, required: true },
    targetProduct: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    targetVariationId: { type: Schema.Types.ObjectId, required: true },
    sourcePerPack: { type: Number, required: true, min: 0 },
    packagingCostPerPack: { type: Number, default: 0, min: 0 },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

RepackRuleSchema.index({ seller: 1, sourceVariationId: 1, targetVariationId: 1 }, { unique: true });

export default mongoose.model<IRepackRule>("RepackRule", RepackRuleSchema);
