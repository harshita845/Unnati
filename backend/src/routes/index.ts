import { Router } from "express";
import adminAuthRoutes from "./adminAuthRoutes";
import sellerAuthRoutes from "./sellerAuthRoutes";
import dashboardRoutes from "./dashboardRoutes";
import customerAuthRoutes from "./customerAuthRoutes";
import deliveryRoutes from "./deliveryRoutes";
import deliveryAuthRoutes from "./deliveryAuthRoutes";
import fcmRoutes from "../modules/notification/routes/fcmRoutes";

// ... (other imports)
import { authenticate, requireUserType } from "../middleware/auth";
import customerRoutes from "./customerRoutes";
import sellerRoutes from "./sellerRoutes";
import uploadRoutes from "./uploadRoutes";
import productRoutes from "./productRoutes";
import headerCategoryRoutes from "./headerCategoryRoutes";
import categoryRoutes from "./categoryRoutes";
import orderRoutes from "./orderRoutes";
import returnRoutes from "./returnRoutes";
import reportRoutes from "./reportRoutes";
import walletRoutes from "./walletRoutes";
import taxRoutes from "./taxRoutes";
import customerProductRoutes from "./customerProductRoutes";
import customerCategoryRoutes from "./customerCategoryRoutes";
import customerCouponRoutes from "./customerCouponRoutes";
import customerAddressRoutes from "./customerAddressRoutes";
import customerHomeRoutes from "./customerHomeRoutes";
import customerCartRoutes from "./customerCartRoutes";
import wishlistRoutes from "./wishlistRoutes";
import productReviewRoutes from "./productReviewRoutes";
import bannerRoutes from "./bannerRoutes";
import flashDealRoutes from "./flashDealRoutes";
import adminRoutes from "./adminRoutes";
import searchRoutes from "./searchRoutes";
import enquiryRoutes from "./enquiryRoutes";
import customerTrackingRoutes from "../modules/customer/routes/trackingRoutes";
import deliveryTrackingRoutes from "../modules/delivery/routes/trackingRoutes";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  updateOrderNotes,
  initiateOnlineOrder,
  verifyOnlinePayment,
  abandonOnlinePayment,
  refreshDeliveryOtp,
  requestReturnOrReplace
} from "../modules/customer/controllers/customerOrderController";

const router = Router();

// Health check route
router.get("/health", (_req, res) => {
  res.json({
    status: "OK",
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes
router.use("/auth/admin", adminAuthRoutes);
router.use("/auth/seller", sellerAuthRoutes);
router.use("/auth/customer", customerAuthRoutes);
router.use("/auth/delivery", deliveryAuthRoutes);

// Delivery routes (protected)
router.use(
  "/delivery",
  authenticate,
  requireUserType("Delivery"),
  deliveryRoutes
);
router.use(
  "/delivery",
  authenticate,
  requireUserType("Delivery"),
  deliveryTrackingRoutes
);

// Customer routes - Specific routes MUST be registered before general /customer route
// to prevent Express from matching the broader route first
router.use("/search", searchRoutes);
router.use("/customer/products", customerProductRoutes);
router.use("/enquiries", enquiryRoutes);
router.use("/customer/categories", customerCategoryRoutes);

// Tracking routes (must be before general /customer/orders/:id route)
router.use("/customer", customerTrackingRoutes);

// Customer orders route - direct registration to avoid module loading issue
console.log("🔥 REGISTERING CUSTOMER ORDER ROUTES - RELOADED");
router.post(
  "/customer/orders",
  (_req, _res, next) => {
    console.log("✅ POST /customer/orders ROUTE MATCHED!");
    next();
  },
  authenticate,
  requireUserType("Customer"),
  createOrder
);
router.post("/customer/orders/initiate", authenticate, requireUserType("Customer"), initiateOnlineOrder);
router.post("/customer/orders/verify-payment", authenticate, requireUserType("Customer"), verifyOnlinePayment);
router.post("/customer/orders/:id/abandon-payment", authenticate, requireUserType("Customer"), abandonOnlinePayment);
router.get("/customer/orders", authenticate, requireUserType("Customer"), getMyOrders);
router.get("/customer/orders/:id", authenticate, requireUserType("Customer"), getOrderById);
router.post("/customer/orders/:id/cancel", authenticate, requireUserType("Customer"), cancelOrder);
router.post("/customer/orders/:id/refresh-otp", authenticate, requireUserType("Customer"), refreshDeliveryOtp);
router.patch("/customer/orders/:id/notes", authenticate, requireUserType("Customer"), updateOrderNotes);
router.post("/customer/orders/return-replace", authenticate, requireUserType("Customer"), requestReturnOrReplace);

router.use("/customer/coupons", customerCouponRoutes);
router.use("/customer/addresses", customerAddressRoutes);
router.use("/customer/home", customerHomeRoutes);
router.use("/customer/cart", customerCartRoutes);
router.use("/customer/wishlist", wishlistRoutes);
router.use("/customer/reviews", productReviewRoutes);
// General customer route (must be last to avoid intercepting specific routes)
// ... other imports
import customerVideoRoutes from "./customerVideoRoutes";

// ... existing code ...

// General customer route (must be last to avoid intercepting specific routes)
router.use("/customer/video-finds", customerVideoRoutes);

import customerFreeGiftRoutes from "./customerFreeGiftRoutes";
router.use("/customer/free-gift-rules", customerFreeGiftRoutes);

// Public Config Route
import { getPublicConfig } from "../modules/customer/controllers/customerConfigController";
router.get("/customer/config/public", getPublicConfig);
router.get("/customer/config", getPublicConfig);

router.use("/customer", customerRoutes);

// ... existing code ...


// Seller-panel access comes from the seller's subscription plan: block API calls for modules
// the plan doesn't include (Dashboard + Subscriptions are always available)
import { requireSellerModule } from "../middleware/sellerModuleAccess";
router.use("/seller/pos", requireSellerModule({ modules: ["pos"] }));
router.use("/seller/orders", requireSellerModule({ modules: ["orders", "pos", "reports"] }));
router.use("/orders", requireSellerModule({ modules: ["orders"], readModules: ["pos", "reports"] }));
router.use("/returns", requireSellerModule({ modules: ["requests"] }));
router.use("/seller/reports", requireSellerModule({ modules: ["reports", "payment-list", "staff-bill-report"] }));
router.use("/seller/attributes", requireSellerModule({ modules: ["attribute-setup"], readModules: ["product"] }));
router.use("/seller/variation-types", requireSellerModule({ modules: ["variation-setup"], readModules: ["product", "pos"] }));
router.use("/seller/storage-locations", requireSellerModule({ modules: ["storage-location"], readModules: ["product", "pos"] }));
router.use("/seller/inventory", requireSellerModule({ modules: ["product"], readModules: ["pos"] }));
router.use("/seller/wallet", requireSellerModule({ modules: ["wallet"], readModules: ["payment-list"] }));
router.use("/products", requireSellerModule({ modules: ["product"], readModules: ["pos", "orders", "requests"] }));
router.use("/categories", requireSellerModule({ modules: ["category", "subcategory"], openReads: true }));
router.use("/seller/taxes", requireSellerModule({ modules: ["product"], openReads: true }));
router.use("/admin/staff", requireSellerModule({ modules: ["manage-staff"], readModules: ["staff-bill-report", "pos"] }));

// Seller dashboard routes
router.use("/seller/dashboard", dashboardRoutes);

// Seller management routes (protected, admin only)
router.use("/sellers", sellerRoutes);

// Generate unique barcode routes
import { generateUniqueBarcode as adminGenBarcode, checkBarcodeUnique as adminCheckBarcode } from "../modules/admin/controllers/adminProductController";
import { generateUniqueBarcode as sellerGenBarcode, checkBarcodeUnique as sellerCheckBarcode } from "../modules/seller/controllers/productController";
router.get("/admin/products/generate-barcode", authenticate, requireUserType("Admin"), adminGenBarcode);
router.get("/products/generate-barcode", authenticate, requireUserType("Seller"), sellerGenBarcode);
router.get("/admin/products/check-barcode", authenticate, requireUserType("Admin"), adminCheckBarcode);
router.get("/products/check-barcode", authenticate, requireUserType("Seller"), sellerCheckBarcode);

// Admin routes (protected, admin only)
import adminSubscriptionRoutes from "./adminSubscriptionRoutes";
import sellerSubscriptionRoutes from "./sellerSubscriptionRoutes";
// Seller subscription plans: Super Admin manages plans/settings, sellers buy and renew
router.use("/admin/subscriptions", authenticate, requireUserType("Admin"), adminSubscriptionRoutes);
router.use("/seller/subscriptions", authenticate, requireUserType("Seller"), sellerSubscriptionRoutes);

// POS Customer Display: admin management + the customer-facing screen (terminal display key)
import { adminCustomerDisplayRoutes, publicCustomerDisplayRoutes } from "./customerDisplayRoutes";
router.use("/admin/customer-display", adminCustomerDisplayRoutes);
router.use("/customer-display", publicCustomerDisplayRoutes);

router.use("/admin", adminRoutes);

// Admin Variation Type Routes
import adminVariationTypeRoutes from "./adminVariationTypeRoutes";
router.use("/admin/variation-types", adminVariationTypeRoutes);

// Admin Storage Location Routes
import adminStorageLocationRoutes from "./adminStorageLocationRoutes";
router.use("/admin/storage-locations", adminStorageLocationRoutes);

// Upload routes (protected)
router.use("/upload", uploadRoutes);

// Product routes (protected, seller only)
router.use("/products", productRoutes);

// Category routes (protected, seller/admin)
router.use("/categories", categoryRoutes);

// Header Category Routes
router.use("/header-categories", headerCategoryRoutes);

// Order routes (protected, seller only)
router.use("/orders", orderRoutes);

// Return routes (protected, seller only)
router.use("/returns", returnRoutes);

// Report routes (protected, seller only)
router.use("/seller/reports", reportRoutes);

// Seller POS Routes
import sellerPOSRoutes from "./sellerPOSRoutes";
router.use("/seller/pos", sellerPOSRoutes);

// Seller Order Routes (Reports)
import sellerOrderRoutes from "./sellerOrderRoutes";
router.use("/seller/orders", sellerOrderRoutes);

// Seller Attribute Routes
import sellerAttributeRoutes from "./sellerAttributeRoutes";
router.use("/seller/attributes", sellerAttributeRoutes);

// Seller Variation Type Routes
import sellerVariationTypeRoutes from "./sellerVariationTypeRoutes";
router.use("/seller/variation-types", sellerVariationTypeRoutes);

// Seller Storage Location Routes
import sellerStorageLocationRoutes from "./sellerStorageLocationRoutes";
router.use("/seller/storage-locations", sellerStorageLocationRoutes);

// Seller Inventory Routes
import sellerInventoryRoutes from "./sellerInventoryRoutes";
router.use("/seller/inventory", sellerInventoryRoutes);

// Wallet routes (protected, seller only)
router.use("/seller/wallet", walletRoutes);

// POS dedicated routes
import { getPOSProducts } from "../modules/admin/controllers/adminProductController";
router.get("/pos/products", authenticate, requireUserType("Admin"), getPOSProducts);

// Tax routes (protected, seller/admin)
router.use("/seller/taxes", taxRoutes);

// Add more routes here
// router.use('/users', userRoutes);

// Theme routes (public read, admin write)
import themeRoutes from "./themeRoutes";
router.use("/theme", themeRoutes);

// Banner routes (public read, admin write)
router.use("/banners", bannerRoutes);
router.use("/flash-deals", flashDealRoutes);

// Notification routes
router.use("/notification", fcmRoutes);

export default router;
