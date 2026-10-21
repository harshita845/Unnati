import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { gstReturnStores } from "../../../services/gstReturnService";
import { StockTransferError, acceptTransfer, listTransfers, returnTransfer, transferStock, transferableProducts } from "../../../services/stockTransferService";

/** Live alert to the receiving store's seller panel (it also gets a waiting-transfer banner) */
const alertStore = (req: Request, t: any, event: "STOCK_TRANSFER" | "STOCK_TRANSFER_CANCELLED") => {
  const io = req.app.get("io");
  if (!io || !t) return;
  io.to(`seller-${String(t.toSeller?._id || t.toSeller)}`).emit("seller-notification", {
    type: event,
    transferId: String(t._id),
    transferNumber: t.transferNumber,
    totalQuantity: t.totalQuantity,
    items: (t.items || []).map((i: any) => ({ productName: i.productName, variantName: i.variantName, quantity: i.quantity })),
    link: "/seller/product/stock-transfers",
  });
};

const handle = (res: Response, error: unknown) => {
  if (error instanceof StockTransferError) return res.status(error.statusCode).json({ success: false, message: error.message });
  throw error;
};

// GET /admin/stock-transfers?sellerId=
export const getTransfers = asyncHandler(async (req: Request, res: Response) => {
  return res.json({ success: true, data: await listTransfers(req.query.sellerId ? String(req.query.sellerId) : undefined) });
});

// GET /admin/stock-transfers/stores
export const getTransferStores = asyncHandler(async (_req: Request, res: Response) => {
  return res.json({ success: true, data: await gstReturnStores() });
});

// GET /admin/stock-transfers/products?sellerId=&search=
export const getTransferProducts = asyncHandler(async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await transferableProducts(String(req.query.sellerId || ""), String(req.query.search || "")) });
  } catch (error) {
    return handle(res, error);
  }
});

// POST /admin/stock-transfers  { fromSellerId, toSellerId, items: [{ productId, variationId, quantity }], note }
export const createTransfer = asyncHandler(async (req: Request, res: Response) => {
  try {
    const transfer = await transferStock({ ...req.body, adminId: req.user?.userId });
    alertStore(req, transfer, "STOCK_TRANSFER");
    return res.status(201).json({ success: true, message: `Transfer ${transfer.transferNumber} sent. Stock arrives when the receiving store accepts it.`, data: transfer });
  } catch (error) {
    return handle(res, error);
  }
});

const adminActor = (req: Request) => ({ type: "Admin" as const, id: String(req.user?.userId), name: "Admin" });

// POST /admin/stock-transfers/:id/accept   (only when the receiving store is the admin's own store)
export const acceptTransferAsAdmin = asyncHandler(async (req: Request, res: Response) => {
  try {
    const t = await acceptTransfer(req.params.id, adminActor(req), req.body?.note);
    return res.json({ success: true, message: `${t.transferNumber} accepted. Stock added.`, data: t });
  } catch (error) {
    return handle(res, error);
  }
});

// POST /admin/stock-transfers/:id/reject   (admin's own store as receiver)
export const rejectTransferAsAdmin = asyncHandler(async (req: Request, res: Response) => {
  try {
    const t = await returnTransfer(req.params.id, adminActor(req), "reject", req.body?.note);
    return res.json({ success: true, message: `${t.transferNumber} rejected. Stock returned to the sending store.`, data: t });
  } catch (error) {
    return handle(res, error);
  }
});

// POST /admin/stock-transfers/:id/cancel   (while pending)
export const cancelTransfer = asyncHandler(async (req: Request, res: Response) => {
  try {
    const t = await returnTransfer(req.params.id, adminActor(req), "cancel", req.body?.note);
    alertStore(req, t, "STOCK_TRANSFER_CANCELLED");
    return res.json({ success: true, message: `${t.transferNumber} cancelled. Stock returned to the sending store.`, data: t });
  } catch (error) {
    return handle(res, error);
  }
});
