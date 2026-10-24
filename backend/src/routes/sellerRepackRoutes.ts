import { Router } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import {
  createPackSizeAsSeller,
  createRepackAsSeller,
  getRepackById,
  getRepackProducts,
  getRepackRules,
  getRepacks,
  previewRepackAsSeller,
} from "../modules/seller/controllers/sellerRepackController";

// Repack this store's bulk stock into smaller packs
const router = Router();
router.use(authenticate);
router.use(requireUserType("Seller"));

router.get("/products", getRepackProducts);
router.get("/rules", getRepackRules);
router.post("/preview", previewRepackAsSeller);
router.post("/pack-size", createPackSizeAsSeller);
router.get("/", getRepacks);
router.post("/", createRepackAsSeller);
router.get("/:id", getRepackById);

export default router;
