import mongoose, { Document, Schema } from "mongoose";

/**
 * What a product picture is, by its URL: looked up once from Cloudinary (format and size) and
 * kept, so the Product Photos page doesn't ask Cloudinary again for pictures it already checked.
 * markedReal: an admin said this flagged picture is in fact a real photo.
 */
export interface IProductImageCheck extends Document {
  url: string;
  format?: string;
  width?: number;
  height?: number;
  markedReal: boolean;
  checkedAt: Date;
}

const ProductImageCheckSchema = new Schema<IProductImageCheck>({
  url: { type: String, required: true, unique: true },
  format: { type: String },
  width: { type: Number },
  height: { type: Number },
  markedReal: { type: Boolean, default: false },
  checkedAt: { type: Date, default: Date.now },
});

export default mongoose.model<IProductImageCheck>("ProductImageCheck", ProductImageCheckSchema);
