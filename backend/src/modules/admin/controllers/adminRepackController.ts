import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { gstReturnStores } from "../../../services/gstReturnService";
import {
  RepackError,
  createRepack,
  getRepack,
  listRepacks,
  previewRepack,
  repackRulesFor,
  repackableProducts,
} from "../../../services/repackService";

const handle = (res: Response, error: unknown) => {
  if (error instanceof RepackError) return res.status(error.statusCode).json({ success: false, message: error.message });
  throw error;
};

// GET /admin/repacks/stores
export const getRepackStores = asyncHandler(async (_req: Request, res: Response) => {
  return res.json({ success: true, data: await gstReturnStores() });
});

// GET /admin/repacks/products?sellerId=&search=
export const getRepackProducts = asyncHandler(async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await repackableProducts(String(req.query.sellerId || ""), String(req.query.search || "")) });
  } catch (error) {
    return handle(res, error);
  }
});

// GET /admin/repacks/rules?sellerId=&sourceVariationId=
export const getRepackRules = asyncHandler(async (req: Request, res: Response) => {
  return res.json({ success: true, data: await repackRulesFor(String(req.query.sellerId || ""), String(req.query.sourceVariationId || "")) });
});

// POST /admin/repacks/preview   (same body as POST /admin/repacks; changes nothing)
export const previewRepackAsAdmin = asyncHandler(async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await previewRepack(req.body) });
  } catch (error) {
    return handle(res, error);
  }
});

// POST /admin/repacks  { sellerId, source: { productId, variationId }, outputs: [...], wastage, batchNo, note, updateCost }
export const createRepackAsAdmin = asyncHandler(async (req: Request, res: Response) => {
  try {
    const record = await createRepack(req.body, { type: "Admin", id: String(req.user?.userId), name: "Admin" });
    return res.status(201).json({ success: true, message: `Repack ${record.repackNumber} posted`, data: record });
  } catch (error) {
    return handle(res, error);
  }
});

// GET /admin/repacks?sellerId=
export const getRepacks = asyncHandler(async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await listRepacks(req.query.sellerId ? String(req.query.sellerId) : undefined) });
  } catch (error) {
    return handle(res, error);
  }
});

// GET /admin/repacks/:id
export const getRepackById = asyncHandler(async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await getRepack(req.params.id) });
  } catch (error) {
    return handle(res, error);
  }
});
