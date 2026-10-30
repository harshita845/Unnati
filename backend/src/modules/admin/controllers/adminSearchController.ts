import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Order from "../../../models/Order";
import Product from "../../../models/Product";
import Customer from "../../../models/Customer";
import Seller from "../../../models/Seller";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";

export const globalSearch = asyncHandler(async (req: Request, res: Response) => {
  const query = (req.query.q || req.query.query || req.query.search || "").toString().trim();

  if (!query || query.length < 1) {
    return res.status(200).json({
      success: true,
      data: {
        orders: [],
        products: [],
        customers: [],
        sellers: [],
        categories: [],
        subcategories: [],
      },
    });
  }

  const sanitized = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(sanitized, "i");

  const [orders, products, customers, sellers, categories, subcategories] = await Promise.all([
    // Orders
    Order.find({
      $or: [
        { orderNumber: regex },
        { customerName: regex },
        { customerPhone: regex },
        { customerEmail: regex },
        { paymentMethod: regex },
        { status: regex },
      ],
    })
      .select("_id orderNumber customerName customerPhone total status paymentStatus orderDate createdAt")
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),

    // Products
    Product.find({
      $or: [
        { productName: regex },
        { sku: regex },
        { barcode: regex },
        { "variations.sku": regex },
        { "variations.barcode": regex },
      ],
    })
      .select("_id productName sku price discPrice compareAtPrice mainImage variations stock status category")
      .populate("category", "name")
      .limit(8)
      .lean(),

    // Customers
    Customer.find({
      $or: [
        { name: regex },
        { phone: regex },
        { email: regex },
        { refCode: regex },
      ],
    })
      .select("_id name phone email status totalOrders totalSpent createdAt")
      .limit(8)
      .lean(),

    // Sellers
    Seller.find({
      $or: [
        { storeName: regex },
        { sellerName: regex },
        { email: regex },
        { mobile: regex },
        { city: regex },
      ],
    })
      .select("_id storeName sellerName email mobile city status category")
      .limit(8)
      .lean(),

    // Categories
    Category.find({ name: regex })
      .select("_id name image status headerCategory")
      .limit(8)
      .lean(),

    // Subcategories
    SubCategory.find({
      $or: [{ name: regex }, { subcategoryName: regex }],
    })
      .select("_id name subcategoryName category image status")
      .populate("category", "name")
      .limit(8)
      .lean(),
  ]);

  // Format products to ensure image and price are readily available
  const formattedProducts = products.map((p: any) => {
    const firstVar = Array.isArray(p.variations) && p.variations[0];
    const image = p.mainImage || firstVar?.mainImage || firstVar?.image || "";
    const price = p.discPrice || p.price || firstVar?.discPrice || firstVar?.price || 0;
    return {
      _id: p._id,
      productName: p.productName,
      sku: p.sku || firstVar?.sku || "",
      price,
      image,
      stock: p.stock ?? firstVar?.stock ?? 0,
      status: p.status,
      categoryName: p.category?.name || "",
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      orders,
      products: formattedProducts,
      customers,
      sellers,
      categories,
      subcategories,
    },
  });
});

