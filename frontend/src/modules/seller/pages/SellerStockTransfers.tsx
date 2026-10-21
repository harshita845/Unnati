import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Truck, XCircle } from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import { answerIncomingTransfer, getIncomingTransfers } from "../../../services/api/seller/sellerStockTransferService";
import type { StockTransferRecord } from "../../../services/api/admin/gstReturnBackupService";
import { SELLER_STOCK_TRANSFER_EVENT } from "../components/StockTransferBanner";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const apiMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
const STATUS_STYLE: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-800",
  Accepted: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-red-50 text-red-700",
  Cancelled: "bg-gray-100 text-gray-600",
};

/** Stock sent to this store by the admin: accept to add it to your stock, or reject to send it back */
export default function SellerStockTransfers() {
  const { showToast } = useToast();
  const [transfers, setTransfers] = useState<StockTransferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTransfers(await getIncomingTransfers());
    } catch (e) {
      showToast(apiMessage(e, "Couldn't load stock transfers"), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
    // A transfer sent / cancelled while this page is open shows up at once
    window.addEventListener(SELLER_STOCK_TRANSFER_EVENT, load);
    return () => window.removeEventListener(SELLER_STOCK_TRANSFER_EVENT, load);
  }, [load]);

  const answer = async (t: StockTransferRecord, action: "accept" | "reject") => {
    let note: string | undefined;
    if (action === "accept") {
      if (!window.confirm(`Accept ${t.transferNumber}? ${t.totalQuantity} unit(s) are added to your stock.`)) return;
    } else {
      const reason = window.prompt(`Reject ${t.transferNumber}? The stock goes back to ${t.fromSeller?.storeName || "the sending store"}.\n\nReason (optional):`, "");
      if (reason === null) return;
      note = reason.trim() || undefined;
    }
    setBusy(t._id);
    try {
      const res = await answerIncomingTransfer(t._id, action, note);
      showToast(res.message, "success");
      window.dispatchEvent(new CustomEvent(SELLER_STOCK_TRANSFER_EVENT, { detail: "answered" }));
    } catch (e) {
      showToast(apiMessage(e, "Couldn't update the transfer"), "error");
    } finally {
      setBusy(null);
    }
  };

  const pending = transfers.filter((t) => t.status === "Pending");
  const done = transfers.filter((t) => t.status !== "Pending");

  const card = (t: StockTransferRecord) => (
    <li key={t._id} className="rounded-xl border border-gray-200 p-4" style={{ backgroundColor: "#ffffff" }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-gray-900">{t.transferNumber}</div>
          <div className="text-xs text-gray-500">
            From <b>{t.fromSeller?.storeName || "-"}</b> · {when(t.createdAt)}
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[t.status || "Accepted"]}`}>
          {t.status === "Pending" ? "Waiting for you" : t.status || "Accepted"}
        </span>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-gray-800">
        {t.items.map((it, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span>
              {it.productName}
              {it.variantName ? ` · ${it.variantName}` : ""}
              {it.createdInDestination && <span className="ml-1 rounded bg-sky-50 px-1 text-[10px] font-semibold text-sky-700">new in your store</span>}
            </span>
            <b className="tabular-nums">× {it.quantity}</b>
          </li>
        ))}
      </ul>
      {t.note && <p className="mt-2 text-xs italic text-gray-500">Note: {t.note}</p>}
      {t.responseNote && <p className="mt-1 text-xs italic text-gray-500">Your reason: {t.responseNote}</p>}
      {t.status === "Pending" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy === t._id}
            onClick={() => answer(t, "accept")}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary-dark)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === t._id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Accept {t.totalQuantity} unit{t.totalQuantity === 1 ? "" : "s"}
          </button>
          <button
            type="button"
            disabled={busy === t._id}
            onClick={() => answer(t, "reject")}
            className="flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            <XCircle size={15} /> Reject
          </button>
        </div>
      ) : (
        t.respondedAt && <p className="mt-2 text-xs text-gray-400">{t.status} on {when(t.respondedAt)}</p>
      )}
    </li>
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Truck size={22} /> Stock Transfers
        </h1>
        <p className="text-sm text-gray-500">Stock sent to your store. Accept it to add it to your stock, or reject it to send it back.</p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </p>
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-bold text-gray-900">Waiting for you ({pending.length})</h2>
            {pending.length ? <ul className="grid gap-3 md:grid-cols-2">{pending.map(card)}</ul> : <p className="text-sm text-gray-400">Nothing to accept right now.</p>}
          </section>
          {done.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold text-gray-900">Earlier transfers</h2>
              <ul className="grid gap-3 md:grid-cols-2">{done.map(card)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
