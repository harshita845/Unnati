import mongoose, { Schema, Document } from "mongoose";

/** A named set of Customer Display banners scheduled together (e.g. "Diwali week"). */
export interface ICustomerDisplayCampaign extends Document {
  name: string;
  description?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerDisplayCampaignSchema = new Schema<ICustomerDisplayCampaign>(
  {
    name: {
      type: String,
      required: [true, "Campaign name is required"],
      trim: true,
      maxlength: [80, "Campaign name cannot exceed 80 characters"],
    },
    description: { type: String, trim: true, maxlength: 300 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CustomerDisplayCampaignSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

export default mongoose.model<ICustomerDisplayCampaign>("CustomerDisplayCampaign", CustomerDisplayCampaignSchema);
