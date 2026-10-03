import mongoose, { Document, Model, Schema } from "mongoose";

/**
 * Super Admin settings for seller subscriptions (single document).
 * Grace days and bill type here are defaults; each category can override them.
 */
export interface ISubscriptionSettings extends Document {
  graceDays: number;
  trialDays: number;
  reminderDays: number[];
  paymentMethods: { online: boolean; manual: boolean; wallet: boolean };
  gstPercent: number;
  /** Default bill type for categories that don't set one: true = GST invoice, false = payment receipt */
  invoiceEnabled: boolean;
  invoicePrefix: string;
  invoiceCounter: number;
  updatedBy?: mongoose.Types.ObjectId;
}

interface ISubscriptionSettingsModel extends Model<ISubscriptionSettings> {
  getSettings(): Promise<ISubscriptionSettings>;
}

const SubscriptionSettingsSchema = new Schema<ISubscriptionSettings>(
  {
    graceDays: { type: Number, default: 3, min: [0, "Grace days cannot be negative"], max: [90, "Grace days too large"] },
    trialDays: { type: Number, default: 30, min: [0, "Trial days cannot be negative"], max: [365, "Trial days too large"] },
    reminderDays: { type: [Number], default: [7, 3, 1] },
    paymentMethods: {
      online: { type: Boolean, default: true },
      manual: { type: Boolean, default: true },
      wallet: { type: Boolean, default: true },
    },
    gstPercent: { type: Number, default: 18, min: 0, max: 100 },
    invoiceEnabled: { type: Boolean, default: true },
    invoicePrefix: { type: String, default: "SUB", trim: true },
    invoiceCounter: { type: Number, default: 0 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

SubscriptionSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

export default mongoose.model<ISubscriptionSettings, ISubscriptionSettingsModel>(
  "SubscriptionSettings",
  SubscriptionSettingsSchema
);
