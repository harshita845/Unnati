import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Truck } from "lucide-react";
import { getIncomingTransfers } from "../../../services/api/seller/sellerStockTransferService";

/** Fired when a transfer arrives live, or after the store answers one: banner and list refresh */
export const SELLER_STOCK_TRANSFER_EVENT = "seller-stock-transfer-changed";

/**
 * Shown on every seller page while a stock transfer is waiting for this store to accept it, so a
 * store that was offline when it was sent still finds out. Highlighted when one has just arrived.
 */
export default function StockTransferBanner() {
  const location = useLocation();
  const [pending, setPending] = useState<{ count: number; units: number; from: string }>({ count: 0, units: 0, from: "" });
  const [fresh, setFresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = (await getIncomingTransfers()).filter((t) => t.status === "Pending");
      setPending({
        count: list.length,
        units: list.reduce((s, t) => s + (t.totalQuantity || 0), 0),
        from: [...new Set(list.map((t) => t.fromSeller?.storeName).filter(Boolean))].join(", "),
      });
    } catch {
      // No access to stock (plan / staff permissions): nothing to show
      setPending({ count: 0, units: 0, from: "" });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, location.pathname]);

  useEffect(() => {
    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail === "arrived") setFresh(true);
      load();
    };
    window.addEventListener(SELLER_STOCK_TRANSFER_EVENT, onChange);
    return () => window.removeEventListener(SELLER_STOCK_TRANSFER_EVENT, onChange);
  }, [load]);

  if (!pending.count || location.pathname.startsWith("/seller/product/stock-transfers")) return null;

  return (
    <div
      role="status"
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
        fresh ? "animate-pulse border-sky-400 bg-sky-50 text-sky-900" : "border-sky-200 bg-sky-50 text-sky-900"
      }`}
    >
      <span className="flex items-center gap-2">
        <Truck size={18} className="shrink-0" />
        <span>
          {fresh && <b>New: </b>}
          <b>
            {pending.count} stock transfer{pending.count === 1 ? "" : "s"}
          </b>{" "}
          ({pending.units} unit{pending.units === 1 ? "" : "s"}){pending.from ? ` from ${pending.from}` : ""} waiting for you to accept.
        </span>
      </span>
      <Link
        to="/seller/product/stock-transfers"
        onClick={() => setFresh(false)}
        className="rounded-lg bg-sky-600 px-4 py-1.5 font-semibold text-white hover:bg-sky-700"
        style={{ color: "#ffffff" }}
      >
        Review
      </Link>
    </div>
  );
}
