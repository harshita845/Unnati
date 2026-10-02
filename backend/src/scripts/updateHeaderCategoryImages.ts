import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import HeaderCategory from "../models/HeaderCategory";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/Unnati Stores";

const imageMap: Record<string, string> = {
  grocery: "/dairy.jpg",
  dairy: "/dairy.jpg",
  winter: "/cold.jpg",
  cold: "/cold.jpg",
  beverages: "/cold.jpg",
  fashion: "/shirt1.jpg",
  clothing: "/shirt1.jpg",
  beauty: "/personal.jpg",
  personal: "/personal.jpg",
  wedding: "/women.jpg",
  women: "/women.jpg",
  household: "/bucket.jpg",
  cleaning: "/bucket.jpg",
  bucket: "/bucket.jpg"
};

async function updateHeaderCategoryImages() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const categories = await HeaderCategory.find({});
    console.log(`Found ${categories.length} header categories`);

    for (const cat of categories) {
      const slug = (cat.slug || cat.name || '').toLowerCase();
      let matchedImage: string | null = null;

      for (const [key, img] of Object.entries(imageMap)) {
        if (slug.includes(key)) {
          matchedImage = img;
          break;
        }
      }

      if (matchedImage) {
        cat.image = matchedImage;
        await cat.save();
        console.log(`Updated Header Category '${cat.name}' (${cat.slug}) -> image: ${matchedImage}`);
      }
    }

    console.log("Finished updating header category images.");
    await mongoose.disconnect();
  } catch (error) {
    console.error("Error updating header category images:", error);
    process.exit(1);
  }
}

updateHeaderCategoryImages();
