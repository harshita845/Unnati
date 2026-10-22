import mongoose, { Document, Schema } from 'mongoose';

export interface IBanner extends Document {
  position: 'Main Banner' | 'Popup Banner' | 'Main Section Banner' | 'Deal of the Day' | 'Flash Deals' | 'Footer Banner';
  resourceType: 'Category' | 'Product' | 'None';
  resourceId?: string; // ID of the category or product
  resourceName?: string; // Store name for easier display, optional
  imageUrl: string;
  isActive: boolean;
  categoryName?: string;
  title?: string;
  subtitle?: string;
  redirectType?: string;
  redirectValue?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bannerSchema = new Schema<IBanner>(
  {
    position: {
      type: String,
      required: true,
      enum: ['Main Banner', 'Popup Banner', 'Main Section Banner', 'Deal of the Day', 'Flash Deals', 'Footer Banner'],
    },
    resourceType: {
      type: String,
      required: true,
      enum: ['Category', 'Product', 'None'],
      default: 'None',
    },
    resourceId: {
      type: String,
      required: false,
    },
    resourceName: {
      type: String,
      required: false,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    title: {
      type: String,
      required: false,
    },
    subtitle: {
      type: String,
      required: false,
    },
    categoryName: {
      type: String,
      required: false,
    },
    redirectType: {
      type: String,
      required: false,
    },
    redirectValue: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Banner = mongoose.model<IBanner>('Banner', bannerSchema);
export default Banner;
