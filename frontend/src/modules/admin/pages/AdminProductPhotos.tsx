import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ImageOff, Images, Loader2, Pencil, Search } from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import {
  getGstReturnStores,
  getProductPhotos,
  GstStoreOption,
  markProductPhotoReal,
  PhotoStatus,
  ProductPhotoRow,
} from "../../../services/api/admin/gstReturnBackupService";

const TABS: Array<{ id: PhotoStatus | "all"; label: string }> = [
  { id: "demo", label: "Demo picture" },
  { id: "missing", label: "No picture" },
  { id: "real", label: "Real photo" },
  { id: "all", label: "All" },
];
const BADGE: Record<PhotoStatus, string> = {
  demo: "bg-amber-50 text-amber-800 border-amber-200",
  missing: "bg-red-50 text-red-700 border-red-200",
  real: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
const LABEL: Record<PhotoStatus, string> = { demo: "Demo picture", missing: "No picture", real: "Real photo" };

/**
 * Products that still show a demo picture (the generated icon cards from the sample data) or no
 * picture at all, so the team knows which ones need a real photo. Edit opens the product to upload one.
 */
export default function AdminProductPhotos() {
  const { showToast } = useToast();
  const [stores, setStores] = useState<GstStoreOption[]>([]);
  const [sellerId, setSellerId] = useState("");
  const [status, setStatus] = useState<PhotoStatus | "all">("demo");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ProductPhotoRow[]>([]);
  const [counts, setCounts] = useState<Record<PhotoStatus, number>>({ demo: 0, missing: 0, real: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGstReturnStores().then(setStores).catch(() => undefined);
  }, []);

  // Search after typing stops
  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getProductPhotos({ status, sellerId: sellerId || undefined, search: query || undefined });
      setRows(d.products);
      setCounts(d.counts);
      setTotal(d.total);
    } catch (e) {
      showToast((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Couldn't check product photos", "error");
    } finally {
      setLoading(false);
    }
  }, [status, sellerId, query, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const markReal = async (r: ProductPhotoRow) => {
    try {
      await markProductPhotoReal(r.image, true);
      showToast(`"${r.name}" marked as a real photo`, "success");
      load();
    } catch {
      showToast("Couldn't update", "error");
    }
  };

  const needAttention = counts.demo + counts.missing;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Images size={22} /> Product Photos
        </h1>
        <p className="text-sm text-gray-500">
          Products still showing a demo picture or no picture. Open one with Edit and upload a real photo: it then shows everywhere (customer app, admin, seller).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["demo", "missing", "real"] as PhotoStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-lg border px-4 py-3 text-left transition-shadow hover:shadow-sm ${status === s ? "ring-2 ring-[var(--primary-color)]" : ""} ${BADGE[s]}`}
          >
            <div className="text-xs font-semibold">{LABEL[s]}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{counts[s]}</div>
            <div className="text-[11px] opacity-80">of {total} products</div>
          </button>
        ))}
      </div>
      {!loading && needAttention > 0 && (
        <p className="text-sm text-gray-600">
          <b>{needAttention}</b> product{needAttention === 1 ? "" : "s"} need{needAttention === 1 ? "s" : ""} a real photo.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex gap-1 rounded-lg border border-gray-200 p-1" style={{ backgroundColor: "#ffffff" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setStatus(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${status === t.id ? "bg-[var(--primary-dark)] text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
          <option value="">All stores</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
          <input className="rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm" placeholder="Search product" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 py-8 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Checking product photos… (the first check can take a minute)
        </p>
      ) : rows.length === 0 ? (
        <p className="flex items-center gap-2 py-8 text-sm text-emerald-700">
          <CheckCircle2 size={16} /> Nothing here.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col overflow-hidden rounded-xl border border-gray-200" style={{ backgroundColor: "#ffffff" }}>
              <div className="flex aspect-square items-center justify-center bg-gray-50">
                {r.image ? (
                  <img src={r.image} alt={r.name} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <ImageOff size={32} className="text-gray-300" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                <div className="line-clamp-2 text-sm font-semibold text-gray-900">{r.name}</div>
                <div className="truncate text-xs text-gray-500">
                  {r.store}
                  {!r.live && " · not live"}
                </div>
                <span className={`w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold ${BADGE[r.status]}`}>{LABEL[r.status]}</span>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  <Link
                    to={`/admin/product/edit/${r.id}`}
                    className="flex items-center gap-1 rounded-lg bg-[var(--primary-dark)] px-2.5 py-1 text-xs font-semibold text-white"
                    style={{ color: "#ffffff" }}
                  >
                    <Pencil size={12} /> Edit
                  </Link>
                  {r.status === "demo" && (
                    <button type="button" onClick={() => markReal(r)} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50" title="This picture is a real photo: stop flagging it">
                      It's a real photo
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
