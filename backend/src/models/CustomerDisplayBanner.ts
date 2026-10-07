import mongoose, { Schema, Document } from "mongoose";

/** A promotional slide (image or video) on the POS Customer Display. */
export interface ICustomerDisplayBanner extends Document {
  title: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  mediaPublicId?: string;
  posterUrl?: string;
  durationSeconds: number;
  sortOrder: number;
  isActive: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  terminals: string[];
  campaign?: mongoose.Types.ObjectId | null;
  link?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerDisplayBannerSchema = new Schema<ICustomerDisplayBanner>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    mediaType: { type: String, enum: ["image", "video"], required: true },
    mediaUrl: { type: String, required: [true, "Media file is required"], trim: true },
    mediaPublicId: { type: String, trim: true },
    posterUrl: { type: String, trim: true },
    // Images only; videos always play to the end
    durationSeconds: { type: Number, default: 5, min: [2, "Minimum 2 seconds"], max: [120, "Maximum 120 seconds"] },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    // Terminal codes ("1", "2"...). Empty = every terminal.
    terminals: { type: [String], default: [] },
    campaign: { type: Schema.Types.ObjectId, ref: "CustomerDisplayCampaign", default: null },
    link: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

CustomerDisplayBannerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
CustomerDisplayBannerSchema.index({ sortOrder: 1, createdAt: -1 });
CustomerDisplayBannerSchema.index({ campaign: 1 });

export default mongoose.model<ICustomerDisplayBanner>("CustomerDisplayBanner", CustomerDisplayBannerSchema);
