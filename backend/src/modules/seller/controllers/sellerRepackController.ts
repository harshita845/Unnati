import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Seller from "../../../models/Seller";
import {
  RepackError,
  createPackSize,
  createRepack,
  getRepack,
  listRepacks,
  previewRepack,
  repackRulesFor,
  repackableProducts,
} from "../../../services/repackService";

/** A seller repacks only their own store's stock: the store always comes from the login, never the request. */
const storeOf = (req: Request) => String(req.user?.userId);

const handle = (res: Response, error: unknown) => {
  if (error instanceof RepackError) return res.status(error.statusCode).json({ success: false, message: error.message });
  throw error;
};

export const getRepackProducts = asyncHandler(async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await repackableProducts(storeOf(req), String(req.query.search || "")) });
  } catch (error) {
    return handle(res, error);
  }
});

export const getRepackRules = asyncHandler(async (req: Request, res: Response) => {
  return res.json({ success: true, data: await repackRulesFor(storeOf(req), String(req.query.sourceVariationId || "")) });
});

export const previewRepackAsSeller = asyncHandler(async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await previewRepack({ ...req.body, sellerId: storeOf(req) }) });
  } catch (error) {
    return handle(res, error);
  }
});

export const createRepackAsSeller = asyncHandler(async (req: Request, res: Response) => {
  try {
    const seller: any = await Seller.findById(storeOf(req)).select("storeName sellerName").lean();
    const record = await createRepack(
      { ...req.body, sellerId: storeOf(req) },
      { type: "Seller", id: storeOf(req), name: seller?.sellerName || seller?.storeName || "Seller" }
    );
    return res.status(201).json({ success: true, message: `Repack ${record.repackNumber} posted`, data: record });
  } catch (error) {
    return handle(res, error);
  }
});

export const getRepacks = asyncHandler(async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await listRepacks(storeOf(req)) });
  } catch (error) {
    return handle(res, error);
  }
});

export const getRepackById = asyncHandler(async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await getRepack(req.params.id, storeOf(req)) });
  } catch (error) {
    return handle(res, error);
  }
});

export const createPackSizeAsSeller = asyncHandler(async (req: Request, res: Response) => {
  try {
    const data = await createPackSize({ ...req.body, sellerId: storeOf(req) });
    return res.status(201).json({ success: true, message: `Added the ${data.variant.label} size`, data });
  } catch (error) {
    return handle(res, error);
  }
});
