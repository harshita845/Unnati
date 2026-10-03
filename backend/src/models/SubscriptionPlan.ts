import mongoose, { Document, Schema } from "mongoose";

export const PLAN_DURATION_UNITS = ["day", "month", "year"] as const;
export type PlanDurationUnit = (typeof PLAN_DURATION_UNITS)[number];

/**
 * A subscription plan created by Super Admin. Sellers buy it to sell in the
 * plan's categories. `limits` are enforced by the app; `features` are text shown to sellers.
 */
export interface ISubscriptionPlan extends Document {
  name: string;
  description?: string;
  price: number;
  durationValue: number;
  durationUnit: PlanDurationUnit;
  categories: mongoose.Types.ObjectId[];
  features: string[];
  limits: {
    maxProducts?: number | null; // null/undefined = unlimited
    commissionPercent?: number | null; // null/undefined = seller's normal commission
    featuredStore: boolean;
  };
  isActive: boolean;
  sortOrder: number;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema = new Schema<ISubscriptionPlan>(
  {
    name: { type: String, required: [true, "Plan name is required"], trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: [true, "Price is required"], min: [0, "Price cannot be negative"] },
    durationValue: {
      type: Number,
      required: [true, "Duration is required"],
      min: [1, "Duration must be at least 1"],
      validate: { validator: Number.isInteger, message: "Duration must be a whole number" },
    },
    durationUnit: { type: String, enum: PLAN_DURATION_UNITS, required: true },
    categories: {
      type: [{ type: Schema.Types.ObjectId, ref: "Category" }],
      validate: { validator: (v: unknown[]) => Array.isArray(v) && v.length > 0, message: "Select at least one category" },
    },
    features: { type: [{ type: String, trim: true }], default: [] },
    limits: {
      maxProducts: { type: Number, min: [1, "Max products must be at least 1"], default: null },
      commissionPercent: {
        type: Number,
        min: [0, "Commission cannot be negative"],
        max: [100, "Commission cannot exceed 100%"],
        default: null,
      },
      featuredStore: { type: Boolean, default: false },
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

SubscriptionPlanSchema.index({ isActive: 1, categories: 1 });

export default mongoose.model<ISubscriptionPlan>("SubscriptionPlan", SubscriptionPlanSchema);
