import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, Plus, Search, Trash2, Truck } from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import {
  answerStockTransfer,
  createStockTransfer,
  getStockTransfers,
  getTransferProducts,
  getTransferStores,
  GstStoreOption,
  StockTransferRecord,
  TransferProduct,
} from "../../../services/api/admin/gstReturnBackupService";

interface Line {
  productId: string;
  variationId: string;
  name: string;
  variant: string;
  available: number;
  quantity: number;
}

const apiMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const field = "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
const STATUS_STYLE: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-800",
  Accepted: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-red-50 text-red-700",
  Cancelled: "bg-gray-100 text-gray-600",
};

/**
 * Move stock from one store to another. Stock leaves the sending store and arrives in the
 * receiving store at once; if the receiving store doesn't have the product, it is added there.
 */
export default function AdminStockTransfer() {
  const { showToast } = useToast();
  const [stores, setStores] = useState<GstStoreOption[]>([]);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<TransferProduct[]>([]);
  const [searching, setSearching] = useState(false);
  // Bumped after a transfer so the stock shown on the left is fresh
  const [refresh, setRefresh] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<StockTransferRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [answering, setAnswering] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await getStockTransfers());
    } catch (e) {
      showToast(apiMessage(e, "Couldn't load transfers"), "error");
    } finally {
      setHistoryLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    getTransferStores()
      .then(setStores)
      .catch((e) => showToast(apiMessage(e, "Couldn't load stores"), "error"));
    loadHistory();
  }, [loadHistory, showToast]);

  // Products of the sending store that have stock (debounced search)
  useEffect(() => {
    if (!fromId) {
      setResults([]);
      return;
    }
    let stale = false;
    setSearching(true);
    const t = setTimeout(() => {
      getTransferProducts(fromId, search)
        .then((r) => !stale && setResults(r))
        .catch((e) => !stale && showToast(apiMessage(e, "Couldn't load products"), "error"))
        .finally(() => !stale && setSearching(false));
    }, 300);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [fromId, search, refresh, showToast]);

  const changeFrom = (id: string) => {
    setFromId(id);
    setLines([]);
    if (id === toId) setToId("");
  };

  const addLine = (p: TransferProduct, v: TransferProduct["variants"][number]) => {
    setLines((ls) =>
      ls.some((l) => l.variationId === v.variationId)
        ? ls
        : [...ls, { productId: p.productId, variationId: v.variationId, name: p.productName, variant: v.label, available: v.stock, quantity: 1 }]
    );
  };

  const problems = useMemo(() => {
    const out: string[] = [];
    if (!fromId || !toId) out.push("Choose both stores");
    if (!lines.length) out.push("Add at least one product");
    lines.forEach((l) => {
      if (!Number.isInteger(l.quantity) || l.quantity < 1) out.push(`${l.name}: enter a quantity`);
      else if (l.quantity > l.available) out.push(`${l.name}: only ${l.available} in stock`);
    });
    return out;
  }, [fromId, toId, lines]);

  const submit = async () => {
    if (problems.length) return showToast(problems[0], "error");
    const from = stores.find((s) => s.id === fromId)?.name;
    const to = stores.find((s) => s.id === toId)?.name;
    const total = lines.reduce((s, l) => s + l.quantity, 0);
    if (!window.confirm(`Send ${total} unit(s) from ${from} to ${to}? The stock leaves ${from} now and is added to ${to} when ${to} accepts it.`)) return;
    setSaving(true);
    try {
      const res = await createStockTransfer({
        fromSellerId: fromId,
        toSellerId: toId,
        items: lines.map((l) => ({ productId: l.productId, variationId: l.variationId, quantity: l.quantity })),
        note: note.trim() || undefined,
      });
      showToast(res.message, "success");
      setLines([]);
      setNote("");
      setRefresh((n) => n + 1);
      loadHistory();
    } catch (e) {
      showToast(apiMessage(e, "Transfer failed. No stock was changed."), "error");
    } finally {
      setSaving(false);
    }
  };

  const answer = async (t: StockTransferRecord, action: "accept" | "reject" | "cancel") => {
    const ask = {
      accept: `Accept ${t.transferNumber}? ${t.totalQuantity} unit(s) are added to ${t.toSeller?.storeName}.`,
      reject: `Reject ${t.transferNumber}? The stock goes back to ${t.fromSeller?.storeName}.`,
      cancel: `Cancel ${t.transferNumber}? The stock goes back to ${t.fromSeller?.storeName}.`,
    }[action];
    if (!window.confirm(ask)) return;
    setAnswering(t._id);
    try {
      const res = await answerStockTransfer(t._id, action);
      showToast(res.message, "success");
      loadHistory();
      setRefresh((n) => n + 1);
    } catch (e) {
      showToast(apiMessage(e, "Couldn't update the transfer"), "error");
    } finally {
      setAnswering(null);
    }
  };
  const adminStoreIds = new Set(stores.filter((s) => s.isAdminStore).map((s) => s.id));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Truck size={22} /> Stock Transfer
        </h1>
        <p className="text-sm text-gray-500">
          Send stock from one store to another. It leaves the sending store at once and arrives when the receiving store accepts it.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Left: stores and products of the sending store */}
        <div className="space-y-3 rounded-xl border border-gray-200 p-4" style={{ backgroundColor: "#ffffff" }}>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <label className="text-xs font-semibold text-gray-600">
              From store
              <select className={field} value={fromId} onChange={(e) => changeFrom(e.target.value)}>
                <option value="">Select</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <ArrowRight size={18} className="mb-2.5 text-gray-400" />
            <label className="text-xs font-semibold text-gray-600">
              To store
              <select className={field} value={toId} onChange={(e) => setToId(e.target.value)}>
                <option value="">Select</option>
                {stores
                  .filter((s) => s.id !== fromId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <label className="block text-xs font-semibold text-gray-600">
            Products in the sending store
            <div className="relative mt-1">
              <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
                placeholder={fromId ? "Search by name or SKU" : "Choose the sending store first"}
                disabled={!fromId}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </label>

          <div className="max-h-[420px] overflow-y-auto rounded-lg border border-gray-100">
            {!fromId ? (
              <p className="px-3 py-6 text-center text-sm text-gray-400">Choose the store to send from.</p>
            ) : searching ? (
              <p className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-gray-500">
                <Loader2 size={15} className="animate-spin" /> Loading…
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-gray-400">No products with stock{search ? ` matching "${search}"` : ""}.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {results.flatMap((p) =>
                  p.variants.map((v) => {
                    const added = lines.some((l) => l.variationId === v.variationId);
                    return (
                      <li key={v.variationId} className="flex items-center gap-3 px-3 py-2">
                        {p.image ? (
                          <img src={p.image} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                        ) : (
                          <div className="h-9 w-9 shrink-0 rounded bg-gray-100" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-gray-900">{p.productName}</div>
                          <div className="text-xs text-gray-500">
                            {v.label}
                            {v.sku ? ` · ${v.sku}` : ""} · <b>{v.stock}</b> in stock
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => addLine(p, v)}
                          disabled={added}
                          className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                        >
                          <Plus size={13} /> {added ? "Added" : "Add"}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Right: what will be moved */}
        <div className="flex flex-col rounded-xl border border-gray-200 p-4" style={{ backgroundColor: "#ffffff" }}>
          <h2 className="mb-2 text-sm font-bold text-gray-900">To transfer</h2>
          {lines.length === 0 ? (
            <p className="flex-1 py-6 text-center text-sm text-gray-400">Add products from the left.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="py-2">Product</th>
                  <th className="py-2 text-right">In stock</th>
                  <th className="w-28 py-2 text-right">Quantity</th>
                  <th className="w-8 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l, i) => (
                  <tr key={l.variationId}>
                    <td className="py-2">
                      <div className="font-semibold text-gray-900">{l.name}</div>
                      <div className="text-xs text-gray-500">{l.variant}</div>
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-600">{l.available}</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        min={1}
                        max={l.available}
                        value={l.quantity || ""}
                        onChange={(e) => {
                          const q = Math.floor(Number(e.target.value)) || 0;
                          setLines((ls) => ls.map((x, j) => (j === i ? { ...x, quantity: q } : x)));
                        }}
                        className={`w-24 rounded-lg border px-2 py-1 text-right text-sm ${l.quantity > l.available || l.quantity < 1 ? "border-red-400" : "border-gray-300"}`}
                        aria-label={`Quantity of ${l.name}`}
                      />
                    </td>
                    <td className="py-2 text-right">
                      <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${l.name}`}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <label className="mt-3 block text-xs font-semibold text-gray-600">
            Note (optional)
            <input className={field} value={note} maxLength={500} placeholder="e.g. Diwali restock" onChange={(e) => setNote(e.target.value)} />
          </label>
          <p className="mt-2 text-xs text-gray-500">
            The receiving store accepts the transfer from its panel (Stock Transfers). If it doesn't sell a product yet, the product is added there when it accepts.
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={saving || problems.length > 0}
            title={problems.join("\n")}
            className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-[var(--primary-dark)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
            Send {lines.reduce((s, l) => s + (l.quantity || 0), 0) || ""} unit{lines.reduce((s, l) => s + (l.quantity || 0), 0) === 1 ? "" : "s"}
          </button>
        </div>
      </div>

      {/* History */}
      <div className="rounded-xl border border-gray-200" style={{ backgroundColor: "#ffffff" }}>
        <div className="border-b border-gray-100 px-4 py-3 text-sm font-bold text-gray-900">Transfer history</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2">Transfer</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">From → To</th>
                <th className="px-4 py-2">Products</th>
                <th className="px-4 py-2 text-right">Units</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {historyLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    No transfers yet.
                  </td>
                </tr>
              ) : (
                history.map((t) => (
                  <tr key={t._id} className="align-top">
                    <td className="px-4 py-2 font-semibold text-gray-900">{t.transferNumber}</td>
                    <td className="px-4 py-2 text-gray-600">{when(t.createdAt)}</td>
                    <td className="px-4 py-2 text-gray-800">
                      {t.fromSeller?.storeName || "-"} → {t.toSeller?.storeName || "-"}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {t.items.map((it, i) => (
                        <div key={i}>
                          {it.productName}
                          {it.variantName ? ` · ${it.variantName}` : ""} × {it.quantity}
                          {it.createdInDestination && <span className="ml-1 rounded bg-sky-50 px-1 text-[10px] font-semibold text-sky-700">added to store</span>}
                        </div>
                      ))}
                      {t.note && <div className="text-xs italic text-gray-400">{t.note}</div>}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-gray-900">{t.totalQuantity}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[t.status || "Accepted"]}`}>
                        {t.status === "Pending" ? "Waiting for receiver" : t.status || "Accepted"}
                      </span>
                      {t.respondedAt && (
                        <div className="mt-1 text-[11px] text-gray-400">
                          {t.respondedBy?.name || t.respondedBy?.type} · {when(t.respondedAt)}
                        </div>
                      )}
                      {t.responseNote && <div className="text-[11px] italic text-gray-500">{t.responseNote}</div>}
                    </td>
                    <td className="px-4 py-2">
                      {t.status === "Pending" && (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {t.toSeller && adminStoreIds.has(t.toSeller._id) && (
                            <>
                              <button type="button" disabled={answering === t._id} onClick={() => answer(t, "accept")} className="rounded-lg bg-[var(--primary-dark)] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">
                                Accept
                              </button>
                              <button type="button" disabled={answering === t._id} onClick={() => answer(t, "reject")} className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-700 disabled:opacity-50">
                                Reject
                              </button>
                            </>
                          )}
                          <button type="button" disabled={answering === t._id} onClick={() => answer(t, "cancel")} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50">
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
