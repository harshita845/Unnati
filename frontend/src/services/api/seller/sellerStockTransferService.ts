import api from "../config";
import type { StockTransferRecord } from "../admin/gstReturnBackupService";

/** Stock transfers sent to this store */
export const getIncomingTransfers = async (): Promise<StockTransferRecord[]> => (await api.get("/seller/stock-transfers")).data.data;

/** Accept (stock is added to this store) or reject (stock goes back to the sending store) */
export const answerIncomingTransfer = async (id: string, action: "accept" | "reject", note?: string): Promise<{ message: string }> =>
  (await api.post(`/seller/stock-transfers/${id}/${action}`, { note })).data;
