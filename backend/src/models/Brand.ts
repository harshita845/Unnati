import mongoose, { Document, Schema } from "mongoose";
import { announceChangesOn } from "../socket/contentBroadcast";

export interface IBrand extends Document {
  name: string;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BrandSchema = new Schema<IBrand>(
  {
    name: {
      type: String,
      required: [true, "Brand name is required"],
      trim: true,
      unique: true,
    },
    image: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);


announceChangesOn(BrandSchema, "categories");

const Brand = mongoose.model<IBrand>("Brand", BrandSchema);

export default Brand;
