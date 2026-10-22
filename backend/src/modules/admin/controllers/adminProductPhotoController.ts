import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { markPhotoReal, productPhotoReport } from "../../../services/productPhotoService";

// GET /admin/product-photos?status=demo|missing|real|all&sellerId=&search=
export const getProductPhotos = asyncHandler(async (req: Request, res: Response) => {
  const data = await productPhotoReport({
    sellerId: req.query.sellerId ? String(req.query.sellerId) : undefined,
    status: (req.query.status as any) || "all",
    search: req.query.search ? String(req.query.search) : undefined,
  });
  return res.json({ success: true, data });
});

// POST /admin/product-photos/mark-real  { url, real }
export const markProductPhotoReal = asyncHandler(async (req: Request, res: Response) => {
  if (!req.body?.url) return res.status(400).json({ success: false, message: "Picture missing" });
  await markPhotoReal(String(req.body.url), req.body.real !== false);
  return res.json({ success: true });
});
