import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 120000,
});

// Validate configuration
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.warn("Cloudinary credentials not found in environment variables");
}

export default cloudinary;

// Folder structure constants
export const CLOUDINARY_FOLDERS = {
  PRODUCTS: "Unnati Stores/products",
  PRODUCT_GALLERY: "Unnati Stores/products/gallery",
  CATEGORIES: "Unnati Stores/categories",
  SUBCATEGORIES: "Unnati Stores/subcategories",
  COUPONS: "Unnati Stores/coupons",
  SELLERS: "Unnati Stores/sellers",
  SELLER_PROFILE: "Unnati Stores/sellers/profile",
  SELLER_DOCUMENTS: "Unnati Stores/sellers/documents",
  DELIVERY: "Unnati Stores/delivery",
  DELIVERY_DOCUMENTS: "Unnati Stores/delivery/documents",
  STORES: "Unnati Stores/stores",
  USERS: "Unnati Stores/users",
} as const;
