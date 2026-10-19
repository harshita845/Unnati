import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Search, X } from "lucide-react";
import { getTopInsights, type TopProductInsight, type TopSearchInsight } from "../../../services/api/admin/adminDashboardService";

type Kind = "products" | "searches";

const DAYS = 30;
const ymd = (d: Date) => d.toISOString().split("T")[0];
const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * Sales & Summary: "Top 15 sold products" and "Top 15 searched items" for the last month.
 * Each button opens a list; a product opens in the product editor.
 */
export default function TopInsightsButtons() {
  const navigate = useNavigate();
  const [open, setOpen] = useState<Kind | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<{ topProducts: TopProductInsight[]; topSearches: TopSearchInsight[] } | null>(null);
  // One request per opening: a failure isn't retried in a loop, only when the list is opened again
  const requested = useRef(false);

  // Loaded once, the first time either list is opened
  useEffect(() => {
    if (!open) {
      requested.current = false;
      return;
    }
    if (data || requested.current) return;
    requested.current = true;
    setLoading(true);
    setError("");
    const end = new Date();
    const start = new Date(Date.now() - (DAYS - 1) * 86400000);
    getTopInsights(ymd(start), ymd(end))
      .then((res) => (res.success ? setData(res.data) : setError(res.message || "Could not load the list")))
      .catch(() => setError("Could not load the list. Try again."))
      .finally(() => setLoading(false));
  }, [open, data]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const btn =
    "flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-left text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:border-[var(--primary-color)] hover:bg-[var(--primary-alpha-10)]";

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={btn} onClick={() => setOpen("products")}>
          <Package size={18} className="text-[var(--primary-color)]" />
          <span>
            Top 15 Sold Products
            <span className="block text-[11px] font-medium text-gray-400">Last {DAYS} days</span>
          </span>
        </button>
        <button type="button" className={btn} onClick={() => setOpen("searches")}>
          <Search size={18} className="text-[var(--primary-color)]" />
          <span>
            Top 15 Searched Items
            <span className="block text-[11px] font-medium text-gray-400">Last {DAYS} days</span>
          </span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(null)}>
          <div
            // Width and white background set inline: the admin theme (premium.css) stretches any
            // white rounded box, and any max-w-* box, to 100% width with !important
            style={{ width: "100%", maxWidth: 672, backgroundColor: "#ffffff" }}
            className="flex max-h-[85vh] flex-col rounded-2xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="top-insights-title"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 id="top-insights-title" className="text-lg font-bold text-gray-900">
                  {open === "products" ? "Top 15 Sold Products" : "Top 15 Searched Items"}
                </h2>
                <p className="text-xs text-gray-500">
                  Last {DAYS} days · {open === "products" ? "by quantity sold (cancelled and returned orders excluded)" : "what customers typed in the app's search"}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-3">
              {loading && <p className="py-8 text-center text-sm text-gray-500">Loading…</p>}
              {!loading && error && <p className="py-8 text-center text-sm text-red-600">{error}</p>}

              {!loading && !error && data && open === "products" && (
                data.topProducts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">No products sold in the last {DAYS} days.</p>
                ) : (
                  <ol className="divide-y divide-gray-100">
                    {data.topProducts.map((p, i) => (
                      <li key={`${p.productId || p.name}-${i}`}>
                        <button
                          type="button"
                          disabled={!p.productId}
                          onClick={() => p.productId && navigate(`/admin/product/edit/${p.productId}`)}
                          className="flex w-full items-center gap-3 py-2.5 text-left enabled:hover:bg-gray-50 disabled:cursor-default"
                          title={p.productId ? "Open this product" : undefined}
                        >
                          <span className="w-6 text-center text-sm font-bold text-gray-400">{i + 1}</span>
                          {p.image ? (
                            <img src={p.image} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-gray-100 object-cover" />
                          ) : (
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                              <Package size={16} />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-gray-900">{p.name || "Product"}</span>
                            <span className="block text-xs text-gray-500">
                              {p.orders} order{p.orders === 1 ? "" : "s"} · {inr(p.revenue)}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-sm font-bold tabular-nums text-gray-900">{p.quantity}</span>
                            <span className="block text-[11px] text-gray-400">sold</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )
              )}

              {!loading && !error && data && open === "searches" && (
                data.topSearches.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">No searches in the last {DAYS} days.</p>
                ) : (
                  <ol className="divide-y divide-gray-100">
                    {data.topSearches.map((s, i) => (
                      <li key={`${s.query}-${i}`} className="flex items-center gap-3 py-2.5">
                        <span className="w-6 text-center text-sm font-bold text-gray-400">{i + 1}</span>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                          <Search size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-gray-900">“{s.query}”</span>
                          <span className="block text-xs text-gray-500">
                            Last searched {new Date(s.lastSearchedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            {s.noResults > 0 && <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">no results {s.noResults}×</span>}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-bold tabular-nums text-gray-900">{s.count}</span>
                          <span className="block text-[11px] text-gray-400">searches</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
