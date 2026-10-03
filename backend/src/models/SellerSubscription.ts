import mongoose, { Document, Schema } from "mongoose";

export const SUBSCRIPTION_STATUSES = ["PendingPayment", "Active", "Expired", "Cancelled"] as const;
export type SellerSubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * One paid (or trial) period of a plan for a seller. Renewals create a new record,
 * so the full history is kept. Plan details are copied in (`planSnapshot`) so later
 * edits to the plan don't change what the seller already bought.
 */
export interface ISellerSubscription extends Document {
  seller: mongoose.Types.ObjectId;
  plan?: mongoose.Types.ObjectId | null;
  planSnapshot: {
    name: string;
    price: number;
    durationValue: number;
    durationUnit: string;
    features: string[];
    limits: { maxProducts?: number | null; commissionPercent?: number | null; featuredStore: boolean };
  };
  categories: mongoose.Types.ObjectId[];
  isTrial: boolean;
  status: SellerSubscriptionStatus;
  startDate?: Date;
  endDate?: Date;
  renewedFrom?: mongoose.Types.ObjectId | null;
  payment: {
    method?: "Online" | "Manual" | "Wallet" | "Trial";
    gatewayOrderId?: string;
    paymentId?: string;
    reference?: string;
    paidAt?: Date;
    baseAmount: number;
    gstPercent: number;
    gstAmount: number;
    totalAmount: number;
  };
  invoiceNumber?: string;
  /** "gst" = GST invoice (GST charged), "receipt" = payment receipt without GST (set from the categories) */
  billType: "gst" | "receipt";
  activatedBy?: { type: "Seller" | "Admin" | "System"; id?: mongoose.Types.ObjectId };
  remindersSent: number[]; // "days before expiry" values already notified
  expiredNotifiedAt?: Date;
  productsHiddenAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SellerSubscriptionSchema = new Schema<ISellerSubscription>(
  {
    seller: { type: Schema.Types.ObjectId, ref: "Seller", required: true },
    plan: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", default: null },
    planSnapshot: {
      name: { type: String, required: true },
      price: { type: Number, default: 0 },
      durationValue: { type: Number, default: 0 },
      durationUnit: { type: String, default: "day" },
      features: { type: [String], default: [] },
      limits: {
        maxProducts: { type: Number, default: null },
        commissionPercent: { type: Number, default: null },
        featuredStore: { type: Boolean, default: false },
      },
    },
    categories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    isTrial: { type: Boolean, default: false },
    status: { type: String, enum: SUBSCRIPTION_STATUSES, default: "PendingPayment" },
    startDate: { type: Date },
    endDate: { type: Date },
    renewedFrom: { type: Schema.Types.ObjectId, ref: "SellerSubscription", default: null },
    payment: {
      method: { type: String, enum: ["Online", "Manual", "Wallet", "Trial"] },
      gatewayOrderId: { type: String },
      paymentId: { type: String },
      reference: { type: String, trim: true },
      paidAt: { type: Date },
      baseAmount: { type: Number, default: 0 },
      gstPercent: { type: Number, default: 0 },
      gstAmount: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
    },
    invoiceNumber: { type: String },
    billType: { type: String, enum: ["gst", "receipt"], default: "gst" },
    activatedBy: {
      type: { type: String, enum: ["Seller", "Admin", "System"] },
      id: { type: Schema.Types.ObjectId },
    },
    remindersSent: { type: [Number], default: [] },
    expiredNotifiedAt: { type: Date },
    productsHiddenAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true },
  },
  { timestamps: true }
);

SellerSubscriptionSchema.index({ seller: 1, status: 1, categories: 1 });
SellerSubscriptionSchema.index({ status: 1, endDate: 1 });
SellerSubscriptionSchema.index({ invoiceNumber: 1 }, { unique: true, sparse: true });

export default mongoose.model<ISellerSubscription>("SellerSubscription", SellerSubscriptionSchema);
