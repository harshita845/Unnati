import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import Category from "../models/Category";
import HeaderCategory from "../models/HeaderCategory";
import Product from "../models/Product";
import Seller from "../models/Seller";

// Explicitly load .env from backend root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const LOG_FILE = path.join(
  __dirname,
  "../../seed_grocery_staples_products.log"
);

function log(msg: any) {
  const message = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} - ${message}\n`);
  console.log(message);
}

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/Unnati Stores";
const SELLER_MOBILE = "9111966732";
const FRONTEND_ASSETS_PATH = path.join(__dirname, "../../../frontend/public");
const PRODUCT_IMAGES_BASE = path.join(
  FRONTEND_ASSETS_PATH,
  "Image-20251130T081301Z-1-001",
  "Image",
  "product",
  "product"
);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper to upload to Cloudinary
async function uploadToCloudinary(
  localPath: string,
  folder: string = "products"
): Promise<string | null> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    log("Cloudinary not configured, using local path");
    return localPath.startsWith("http")
      ? localPath
      : `/assets/${path.basename(localPath)}`;
  }

  let fullPath: string | null = null;
  if (path.isAbsolute(localPath) && fs.existsSync(localPath)) {
    fullPath = localPath;
  } else {
    const possiblePaths = [
      path.join(FRONTEND_ASSETS_PATH, localPath.replace("/assets/", "")),
      path.join(__dirname, "../../../frontend/public", localPath.replace("/assets/", "")),
      localPath.startsWith("/") ? localPath : path.join(FRONTEND_ASSETS_PATH, localPath),
    ];

    for (const tryPath of possiblePaths) {
      if (fs.existsSync(tryPath)) {
        fullPath = tryPath;
        break;
      }
    }
  }

  if (!fullPath) {
    log(`Warning: File not found for ${localPath}`);
    return null;
  }

  try {
    const result = await cloudinary.uploader.upload(fullPath, {
      folder: `Unnati Stores/${folder}`,
      resource_type: "image",
      use_filename: true,
      unique_filename: false,
    });
    log(`Uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error: any) {
    log(`Cloudinary upload failed: ${error.message}`);
    return null;
  }
}

// Product data for each subcategory mapping (4 categories x 5 products = 20 products)
const productData: Record<
  string,
  Array<{ name: string; imagePath?: string; pack?: string }>
> = {
  "Rice & Rice Products": [
    {
      name: "Daawat Pulav Basmati Rice (Slender Grains)",
      imagePath: "Atta, Rice & Dal/Rice/Daawat Pulav Basmati Rice (Slender Grains)",
      pack: "1 kg",
    },
    {
      name: "India Gate Kolam Rice",
      imagePath: "Atta, Rice & Dal/Rice/India Gate Kolam Rice",
      pack: "1 kg",
    },
    {
      name: "Basmati Rice Premium",
      imagePath: "Atta, Rice & Dal/Rice",
      pack: "1 kg",
    },
    {
      name: "Sona Masoori Rice",
      imagePath: "Atta, Rice & Dal/Rice",
      pack: "1 kg",
    },
    {
      name: "Brown Rice Organic",
      imagePath: "Atta, Rice & Dal/Rice",
      pack: "500 g",
    },
  ],
  "Wheat & Atta": [
    {
      name: "Aashirvaad Superior MP Whole Wheat Atta",
      imagePath: "Atta, Rice & Dal/Atta/Aashirvaad Superior MP Whole Wheat Atta",
      pack: "5 kg",
    },
    {
      name: "Fortune Chakki Fresh (100% Atta, 0% Maida) Atta",
      imagePath: "Atta, Rice & Dal/Atta/Fortune Chakki Fresh (100% Atta, 0% Maida) Atta",
      pack: "5 kg",
    },
    {
      name: "Multigrain Atta",
      imagePath: "Atta, Rice & Dal/Atta",
      pack: "5 kg",
    },
    {
      name: "Organic Wheat Flour",
      imagePath: "Atta, Rice & Dal/Atta",
      pack: "5 kg",
    },
    {
      name: "Whole Wheat Atta Premium",
      imagePath: "Atta, Rice & Dal/Atta",
      pack: "5 kg",
    },
  ],
  "Pulses & Dals": [
    {
      name: "Tata Sampann Unpolished Kali Urad (Sabut)",
      imagePath: "Atta, Rice & Dal/Toor, Urad & Chana/Tata Sampann Unpolished Kali Urad (Sabut)",
      pack: "1 kg",
    },
    {
      name: "Tata Sampann Unpolished Yellow Moong Dal (Dhuli) Split",
      imagePath: "Atta, Rice & Dal/Moong & Masoor/Tata Sampann Unpolished Yellow Moong Dal (Dhuli) Split",
      pack: "1 kg",
    },
    {
      name: "Chana Dal Split",
      imagePath: "Atta, Rice & Dal/Toor, Urad & Chana",
      pack: "1 kg",
    },
    {
      name: "Toor Dal Premium",
      imagePath: "Atta, Rice & Dal/Toor, Urad & Chana",
      pack: "500 g",
    },
    {
      name: "Masoor Dal Red",
      imagePath: "Atta, Rice & Dal/Moong & Masoor",
      pack: "1 kg",
    },
  ],
  "Cereals & Muesli": [
    {
      name: "Cornflakes Classic",
      imagePath: "Breakast & Instant Food/Cornflakes",
      pack: "500 g",
    },
    {
      name: "Oats Instant",
      imagePath: "Breakast & Instant Food/Oats",
      pack: "500 g",
    },
    {
      name: "Muesli Fruit & Nut",
      imagePath: "Breakast & Instant Food/Muesli",
      pack: "500 g",
    },
    {
      name: "Wheat Flakes",
      imagePath: "Breakast & Instant Food/Cornflakes",
      pack: "500 g",
    },
    {
      name: "Granola Crunchy",
      imagePath: "Breakast & Instant Food/Muesli",
      pack: "400 g",
    },
  ],
};

// Helper to find first available image in a directory (searches recursively)
async function findImageInDirectory(dirPath: string): Promise<string | null> {
  const possibleExtensions = [".jpg", ".jpeg", ".png", ".webp"];

  const possiblePaths = [
    path.join(PRODUCT_IMAGES_BASE, dirPath),
    path.join(FRONTEND_ASSETS_PATH, dirPath.replace("/assets/", "")),
    dirPath.startsWith("/") ? dirPath : path.join(FRONTEND_ASSETS_PATH, dirPath),
  ];

  const searchForImages = (searchPath: string): string | null => {
    if (!fs.existsSync(searchPath)) {
      return null;
    }

    try {
      const items = fs.readdirSync(searchPath);

      for (const item of items) {
        const itemPath = path.join(searchPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (possibleExtensions.includes(ext)) {
            log(`Found image: ${itemPath}`);
            return itemPath;
          }
        }
      }

      for (const item of items) {
        const itemPath = path.join(searchPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          const found = searchForImages(itemPath);
          if (found) return found;
        }
      }
    } catch (error) {
      log(`Error reading directory ${searchPath}: ${error}`);
    }

    return null;
  };

  for (const tryPath of possiblePaths) {
    const found = searchForImages(tryPath);
    if (found) return found;
  }

  return null;
}

async function seedProducts() {
  try {
    await mongoose.connect(MONGO_URI);
    log("Connected to MongoDB");

    // 1. Find Unnati Test Seller
    log(`\nFinding seller with mobile: ${SELLER_MOBILE}`);
    const seller = await Seller.findOne({ mobile: SELLER_MOBILE });

    if (!seller) {
      log(`❌ Seller not found with mobile number: ${SELLER_MOBILE}`);
      process.exit(1);
    }

    log(`✅ Found seller: ${seller.sellerName} (${seller.storeName}) [ID: ${seller._id}]`);

    // 2. Find Grocery header category
    log(`\nFinding Grocery header category...`);
    const groceryHeader = await HeaderCategory.findOne({
      slug: "grocery",
      status: "Published",
    });

    if (!groceryHeader) {
      log(`❌ Grocery header category not found or not Published`);
      process.exit(1);
    }

    log(`✅ Found header category: ${groceryHeader.name} [ID: ${groceryHeader._id}]`);

    // 3. Find Grocery Category 1 root category
    log(`\nFinding "Grocery Category 1" root category...`);
    const rootCategory = await Category.findOne({
      name: "Grocery Category 1",
      headerCategoryId: groceryHeader._id,
      parentId: null,
    });

    if (!rootCategory) {
      log(`❌ "Grocery Category 1" category not found under Grocery header category`);
      process.exit(1);
    }

    log(`✅ Found root category: ${rootCategory.name} [ID: ${rootCategory._id}]`);

    // 4. Find all 4 subcategories under Grocery Category 1
    log(`\nFinding subcategories under ${rootCategory.name}...`);
    const subcategories = await Category.find({
      parentId: rootCategory._id,
      status: "Active",
    }).sort({ order: 1 });

    if (subcategories.length === 0) {
      log(`❌ No subcategories found under ${rootCategory.name}`);
      process.exit(1);
    }

    log(`✅ Found ${subcategories.length} subcategories:`);
    subcategories.forEach((sub) => {
      log(`  - ${sub.name} [ID: ${sub._id}]`);
    });

    const subcategoryKeys = [
      "Rice & Rice Products",
      "Wheat & Atta",
      "Pulses & Dals",
      "Cereals & Muesli",
    ];

    let totalProductsCreated = 0;

    // 5. Seed products for each subcategory
    for (let index = 0; index < subcategories.length; index++) {
      const subcategoryDoc = subcategories[index];
      const productKey = subcategoryKeys[index] || "Rice & Rice Products";
      const products = productData[productKey] || [];

      log(`\n--- Seeding products for Subcategory: ${subcategoryDoc.name} (Mapped from ${productKey}) ---`);

      for (let i = 0; i < products.length; i++) {
        const productInfo = products[i];
        const productName = productInfo.name;

        // Idempotency check: check if product already exists
        const existingProduct = await Product.findOne({
          productName,
          category: rootCategory._id,
          subcategory: subcategoryDoc._id,
          seller: seller._id,
        });

        if (existingProduct) {
          log(`  ⚠️ Product "${productName}" already exists. Skipping...`);
          continue;
        }

        // Find or resolve image URL
        let productImage: string | null = null;
        if (productInfo.imagePath) {
          const foundImagePath = await findImageInDirectory(productInfo.imagePath);
          if (foundImagePath) {
            productImage = await uploadToCloudinary(foundImagePath, "products");
          }
        }

        // High quality fallback image if local upload not available
        if (!productImage || productImage.includes("placeholder")) {
          productImage = "https://images.unsplash.com/photo-1586201375761-83865001e31c?q=80&w=600&auto=format&fit=crop";
        }

        const basePrice = 50 + Math.floor(Math.random() * 450);
        const discountPercent = 5 + Math.floor(Math.random() * 20);
        const discountedPrice = Math.round(basePrice * (1 - discountPercent / 100));
        const stock = 20 + Math.floor(Math.random() * 80);

        await Product.create({
          productName,
          seller: seller._id,
          headerCategoryId: groceryHeader._id,
          category: rootCategory._id,
          subcategory: subcategoryDoc._id,
          mainImage: productImage,
          price: basePrice,
          compareAtPrice: basePrice,
          stock: stock,
          pack: productInfo.pack || "1 unit",
          publish: true,
          popular: false,
          dealOfDay: false,
          status: "Active",
          isReturnable: true,
          maxReturnDays: 7,
          totalAllowedQuantity: 10,
          smallDescription: `Premium quality ${productName.toLowerCase()} - ${productInfo.pack || "1 unit"}`,
          tags: [
            "grocery",
            "staples",
            "grains",
            subcategoryDoc.name.toLowerCase().replace(/\s+/g, "-"),
            "premium",
          ],
          variations: [
            {
              name: "Standard",
              value: productInfo.pack || "1 unit",
              price: basePrice,
              discPrice: discountedPrice,
              stock: stock,
              status: "Available",
            },
          ],
          rating: 0,
          reviewsCount: 0,
          discount: discountPercent,
          requiresApproval: false,
        });

        totalProductsCreated++;
        log(`  ✅ Created: ${productName} (Price: ₹${basePrice}, Disc: ${discountPercent}%, Stock: ${stock})`);
      }
    }

    log("\n✅ Product seeding completed successfully!");
    log(`Summary:`);
    log(`- Seller: ${seller.sellerName} (${seller.storeName})`);
    log(`- Header Category: ${groceryHeader.name}`);
    log(`- Root Category: ${rootCategory.name}`);
    log(`- Subcategories processed: ${subcategories.length}`);
    log(`- Total products created: ${totalProductsCreated}`);

    process.exit(0);
  } catch (error: any) {
    log(`❌ Seeding failed: ${error.message}`);
    log(error.stack);
    process.exit(1);
  }
}

seedProducts();
