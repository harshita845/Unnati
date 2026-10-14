import { Router } from "express";
import { getHomeContent, getStoreProducts, getLowestPricesProducts, getAvailableCities } from "../modules/customer/controllers/customerHomeController";

const router = Router();

// Public routes
router.get("/", getHomeContent);
router.get("/cities", getAvailableCities);
router.get("/lowest-prices", getLowestPricesProducts);
router.get("/store/:storeId", getStoreProducts);

export default router;
