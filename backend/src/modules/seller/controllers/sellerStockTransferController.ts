import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Seller from "../../../models/Seller";
import { StockTransferError, acceptTransfer, listTransfers, returnTransfer } from "../../../services/stockTransferService";

const handle = (res: Response, error: unknown) => {
  if (error instanceof StockTransferError) return res.status(error.statusCode).json({ success: false, message: error.message });
  throw error;
};

const sellerActor = async (req: Request) => {
  const id = String(req.user?.userId);
  const seller: any = await Seller.findById(id).select("storeName").lean();
  return { type: "Seller" as const, id, name: seller?.storeName };
};

// GET /seller/stock-transfers  (transfers sent to this store)
export const getIncomingTransfers = asyncHandler(async (req: Request, res: Response) => {
  return res.json({ success: true, data: await listTransfers(String(req.user?.userId), true) });
});

// POST /seller/stock-transfers/:id/accept
export const acceptIncomingTransfer = asyncHandler(async (req: Request, res: Response) => {
  try {
    const t = await acceptTransfer(req.params.id, await sellerActor(req), req.body?.note);
    return res.json({ success: true, message: `${t.transferNumber} accepted. The stock is added to your store.`, data: t });
  } catch (error) {
    return handle(res, error);
  }
});

// POST /seller/stock-transfers/:id/reject
export const rejectIncomingTransfer = asyncHandler(async (req: Request, res: Response) => {
  try {
    const t = await returnTransfer(req.params.id, await sellerActor(req), "reject", req.body?.note);
    return res.json({ success: true, message: `${t.transferNumber} rejected. The stock goes back to the sending store.`, data: t });
  } catch (error) {
    return handle(res, error);
  }
});
