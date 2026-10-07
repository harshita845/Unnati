import mongoose, { Schema, Document } from "mongoose";

/** Look and behaviour of the POS Customer Display. One document for the whole store. */
export interface ICustomerDisplaySettings extends Document {
  showBanners: boolean;
  billSide: "left" | "right";
  billColumnWidth: number;
  fontScale: "small" | "medium" | "large";
  theme: {
    primary: string;
    background: string;
    panel: string;
    text: string;
    accent: string;
  };
  storeName: string;
  logoUrl: string;
  welcomeText: string;
  thankYouText: string;
  paidScreenSeconds: number;
  showUpiQr: boolean;
  defaultImageSeconds: number;
  defaultBanner: {
    mediaType: "image" | "video";
    mediaUrl: string;
  };
  /** Bumped on any banner/campaign/settings change so open screens refetch right away. */
  contentVersion: number;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const colorField = (fallback: string) => ({
  type: String,
  default: fallback,
  trim: true,
  validate: { validator: (v: string) => HEX_COLOR.test(v), message: "Colors must be hex values like #0f766e" },
});

const CustomerDisplaySettingsSchema = new Schema<ICustomerDisplaySettings>(
  {
    showBanners: { type: Boolean, default: true },
    billSide: { type: String, enum: ["left", "right"], default: "left" },
    billColumnWidth: { type: Number, default: 40, min: 30, max: 60 },
    fontScale: { type: String, enum: ["small", "medium", "large"], default: "medium" },
    theme: {
      primary: colorField("#0f766e"),
      background: colorField("#f1f5f9"),
      panel: colorField("#ffffff"),
      text: colorField("#0f172a"),
      accent: colorField("#f59e0b"),
    },
    // Empty = use the shop name / logo from POS Bill Settings
    storeName: { type: String, default: "", trim: true, maxlength: 80 },
    logoUrl: { type: String, default: "", trim: true },
    welcomeText: { type: String, default: "Welcome! Happy shopping", trim: true, maxlength: 120 },
    thankYouText: { type: String, default: "Thank you, visit again!", trim: true, maxlength: 120 },
    paidScreenSeconds: { type: Number, default: 8, min: 3, max: 60 },
    showUpiQr: { type: Boolean, default: true },
    defaultImageSeconds: { type: Number, default: 5, min: 2, max: 120 },
    defaultBanner: {
      mediaType: { type: String, enum: ["image", "video"], default: "image" },
      mediaUrl: { type: String, default: "", trim: true },
    },
    contentVersion: { type: Number, default: 1 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

export default mongoose.model<ICustomerDisplaySettings>("CustomerDisplaySettings", CustomerDisplaySettingsSchema);
