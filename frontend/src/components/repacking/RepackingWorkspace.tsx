import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  History,
  Loader2,
  Package,
  PackageOpen,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import {
  createRepack,
  getRepackById,
  getRepackProducts,
  getRepackRules,
  getRepackStores,
  listRepacks,
  previewRepack,
  RepackPreview,
  RepackProduct,
  RepackRecord,
  RepackRequest,
  RepackScope,
  RepackStore,
  RepackVariant,
} from "../../services/api/repackService";

/**
 * Repacking: turn bulk stock (a 50 kg bag, a quintal, a drum, a coil, a box of bolts) into smaller
 * packs inside one store. Five steps, following the client's spec:
 *   1. Select source   2. Define conversion   3. Calculate cost   4. Preview & confirm   5. Inventory updated
 * Every figure on steps 3–5 comes from the server, which uses the same calculation it posts with,
 * so what is confirmed here is exactly what happens to the stock.
 */

interface Source {
  productId: string;
  productName: string;
  variant: RepackVariant;
}

interface OutputLine {
  productId: string;
  productName: string;
  variant: RepackVariant;
  sourcePerPack: number;
  packs: number;
  packagingCostPerPack: number;
}

const STEPS = ["Select source", "Define conversion", "Calculate cost", "Preview & confirm", "Inventory updated"];

const field = "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
const card = "rounded-xl border border-gray-200 p-4";
const cardStyle = { backgroundColor: "#ffffff" };
const apiMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const qty = (n: number) => String(Math.round((Number(n) || 0) * 1000) / 1000);
const rupees = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** "Each pack uses 0.02 of the 50 kg bag" reads better as "= 1 kg" when the label says how much is in it. */
const equivalent = (source: RepackVariant, sourcePerPack: number) => {
  const c = source.content;
  if (!c || !(sourcePerPack > 0)) return "";
  return `= ${qty(c.amount * sourcePerPack)} ${c.unit}`;
};

const suggestRatio = (source: RepackVariant, target: RepackVariant) => {
  const s = source.content;
  const t = target.content;
  if (!s || !t || s.dimension !== t.dimension) return 0;
  return round6(t.base / s.base);
};

const storeName = (r: RepackRecord) => (typeof r.seller === "object" && r.seller ? r.seller.storeName : "");

export default function RepackingWorkspace({ scope }: { scope: RepackScope }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<"new" | "history">("new");
  const [step, setStep] = useState(0);

  // store (admin only: a seller always works in their own store)
  const [stores, setStores] = useState<RepackStore[]>([]);
  const [sellerId, setSellerId] = useState("");
  const storeReady = scope === "seller" || !!sellerId;

  // product search
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<RepackProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickerFor, setPickerFor] = useState<"source" | "output">("source");

  // the repack being built
  const [source, setSource] = useState<Source | null>(null);
  const [batchNo, setBatchNo] = useState("");
  const [outputs, setOutputs] = useState<OutputLine[]>([]);
  const [wastage, setWastage] = useState(0);
  const [note, setNote] = useState("");
  const [updateCost, setUpdateCost] = useState(true);

  // server results
  const [preview, setPreview] = useState<RepackPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState<RepackRecord | null>(null);

  // history
  const [history, setHistory] = useState<RepackRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detail, setDetail] = useState<RepackRecord | null>(null);

  useEffect(() => {
    if (scope !== "admin") return;
    getRepackStores()
      .then((s) => {
        setStores(s);
        const own = s.find((x) => x.isAdminStore);
        if (own) setSellerId(own.id);
      })
      .catch((e) => showToast(apiMessage(e, "Couldn't load stores"), "error"));
  }, [scope, showToast]);

  // search the store's items (debounced)
  useEffect(() => {
    if (!storeReady) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      getRepackProducts(scope, sellerId, search)
        .then((r) => !cancelled && setResults(r))
        .catch((e) => !cancelled && showToast(apiMessage(e, "Couldn't load items"), "error"))
        .finally(() => !cancelled && setSearching(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [scope, sellerId, search, storeReady, showToast]);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    listRepacks(scope, sellerId || undefined)
      .then(setHistory)
      .catch((e) => showToast(apiMessage(e, "Couldn't load repack history"), "error"))
      .finally(() => setHistoryLoading(false));
  }, [scope, sellerId, showToast]);

  useEffect(() => {
    if (tab === "history" && storeReady) loadHistory();
  }, [tab, storeReady, loadHistory]);

  const resetAll = () => {
    setStep(0);
    setSource(null);
    setBatchNo("");
    setOutputs([]);
    setWastage(0);
    setNote("");
    setUpdateCost(true);
    setPreview(null);
    setPreviewError("");
    setPosted(null);
    setSearch("");
    setPickerFor("source");
  };

  const changeStore = (id: string) => {
    setSellerId(id);
    resetAll();
  };

  /** Choosing the bulk item pre-fills the pack sizes this store used last time, or the item's other sizes. */
  const chooseSource = async (p: RepackProduct, v: RepackVariant) => {
    setSource({ productId: p.productId, productName: p.productName, variant: v });
    setPreview(null);
    let lines: OutputLine[] = [];
    try {
      const rules = await getRepackRules(scope, sellerId, v.variationId);
      lines = rules.map((r) => {
        const fromList = results.find((x) => x.productId === r.productId)?.variants.find((x) => x.variationId === r.variationId);
        return {
          productId: r.productId,
          productName: r.productName,
          variant: fromList || { variationId: r.variationId, label: r.variantLabel, value: "", stock: r.stock, sku: "", purchasePrice: 0, content: null },
          sourcePerPack: r.sourcePerPack,
          packs: 0,
          packagingCostPerPack: r.packagingCostPerPack,
        };
      });
    } catch {
      /* no saved conversions yet */
    }
    if (lines.length === 0) {
      // the same product's other sizes, with the ratio read from their labels. Bulk may be a 50 kg bag
      // (a 1 kg pack uses 0.02 of it) or loose stock counted in kilos (a 5 kg pack uses 5), so any
      // comparable size is offered; rows left at 0 packs are simply ignored
      lines = p.variants
        .filter((x) => x.variationId !== v.variationId)
        .map((x) => ({ productId: p.productId, productName: p.productName, variant: x, sourcePerPack: suggestRatio(v, x), packs: 0, packagingCostPerPack: 0 }))
        .filter((l) => l.sourcePerPack > 0);
    }
    setOutputs(lines);
  };

  const addOutput = (p: RepackProduct, v: RepackVariant) => {
    if (!source) return;
    if (v.variationId === source.variant.variationId) {
      showToast("That's the bulk item itself — pick a pack size to make from it.", "error");
      return;
    }
    if (outputs.some((o) => o.variant.variationId === v.variationId)) return;
    setOutputs((ls) => [
      ...ls,
      { productId: p.productId, productName: p.productName, variant: v, sourcePerPack: suggestRatio(source.variant, v), packs: 0, packagingCostPerPack: 0 },
    ]);
    setPreview(null);
  };

  const patchOutput = (i: number, patch: Partial<OutputLine>) => {
    setOutputs((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
    setPreview(null);
  };

  // live usage while typing (the server re-checks everything)
  const available = source?.variant.stock || 0;
  const usedForPacks = round6(outputs.reduce((s, o) => s + (o.packs || 0) * (o.sourcePerPack || 0), 0));
  const totalUsed = round6(usedForPacks + (wastage || 0));
  const remaining = round6(available - totalUsed);
  const activeOutputs = outputs.filter((o) => o.packs > 0);

  const conversionProblems = useMemo(() => {
    const p: string[] = [];
    if (activeOutputs.length === 0) p.push("Enter how many packs to make");
    outputs.forEach((o) => {
      if (o.packs > 0 && !(o.sourcePerPack > 0)) p.push(`Set how much bulk one ${o.variant.label} pack uses`);
      if (o.packs && !Number.isInteger(o.packs)) p.push("Packs must be whole numbers");
    });
    if (remaining < -1e-9) p.push(`That needs ${qty(totalUsed)}, but only ${qty(available)} is in stock`);
    return p;
  }, [activeOutputs.length, outputs, remaining, totalUsed, available]);

  const request = (): RepackRequest => ({
    ...(scope === "admin" ? { sellerId } : {}),
    source: { productId: source!.productId, variationId: source!.variant.variationId },
    outputs: activeOutputs.map((o) => ({
      productId: o.productId,
      variationId: o.variant.variationId,
      packs: o.packs,
      sourcePerPack: o.sourcePerPack,
      packagingCostPerPack: o.packagingCostPerPack || 0,
    })),
    wastage: wastage || 0,
    batchNo: batchNo.trim() || undefined,
    note: note.trim() || undefined,
    updateCost,
  });

  // Each change asks the server again; only the newest answer may be shown, so a slow reply to an
  // earlier keystroke can never overwrite the numbers for what is on screen now
  const previewSeq = useRef(0);
  const runPreview = async () => {
    if (!source) return;
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError("");
    try {
      const result = await previewRepack(scope, request());
      if (seq === previewSeq.current) setPreview(result);
    } catch (e) {
      if (seq !== previewSeq.current) return;
      setPreview(null);
      setPreviewError(apiMessage(e, "Couldn't calculate the repack"));
    } finally {
      if (seq === previewSeq.current) setPreviewing(false);
    }
  };

  // steps 3 and 4 always show fresh server numbers, recalculated shortly after typing stops
  useEffect(() => {
    if (!(step === 2 || step === 3) || preview || !source || conversionProblems.length > 0) return;
    const t = setTimeout(runPreview, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, preview, outputs, wastage, updateCost, note, batchNo]);

  const post = async () => {
    if (!source) return;
    setPosting(true);
    try {
      const res = await createRepack(scope, request());
      setPosted(res.data);
      setStep(4);
      showToast(res.message, "success");
    } catch (e) {
      showToast(apiMessage(e, "Couldn't post the repack"), "error");
      setPreview(null); // stock may have changed: recalculate before trying again
    } finally {
      setPosting(false);
    }
  };

  const openDetail = async (id: string) => {
    try {
      setDetail(await getRepackById(scope, id));
    } catch (e) {
      showToast(apiMessage(e, "Couldn't open the repack"), "error");
    }
  };

  // ---------------------------------------------------------------- pieces

  const itemPicker = (mode: "source" | "output") => (
    <div className="space-y-2">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
        <input
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
          placeholder={storeReady ? "Search by name or SKU" : "Choose the store first"}
          disabled={!storeReady}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={mode === "source" ? "Search bulk items" : "Search pack sizes"}
        />
      </div>
      <div className="max-h-[360px] overflow-y-auto rounded-lg border border-gray-100">
        {!storeReady ? (
          <p className="px-3 py-6 text-center text-sm text-gray-400">Choose the store first.</p>
        ) : searching ? (
          <p className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-gray-500">
            <Loader2 size={15} className="animate-spin" /> Loading…
          </p>
        ) : results.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-gray-400">No items{search ? ` matching "${search}"` : ""}.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {results.flatMap((p) =>
              p.variants
                .filter((v) => (mode === "source" ? v.stock > 0 : v.variationId !== source?.variant.variationId))
                .map((v) => {
                  const picked =
                    mode === "source" ? source?.variant.variationId === v.variationId : outputs.some((o) => o.variant.variationId === v.variationId);
                  return (
                    <li key={v.variationId} className="flex items-center gap-3 px-3 py-2">
                      {p.image ? <img src={p.image} alt="" className="h-9 w-9 shrink-0 rounded object-cover" /> : <div className="h-9 w-9 shrink-0 rounded bg-gray-100" />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-gray-900">{p.productName}</div>
                        <div className="text-xs text-gray-500">
                          {v.label}
                          {v.sku ? ` · ${v.sku}` : ""} · <b>{qty(v.stock)}</b> in stock
                          {mode === "source" && v.purchasePrice > 0 ? ` · cost ${rupees(v.purchasePrice)}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={picked}
                        onClick={() => (mode === "source" ? chooseSource(p, v) : addOutput(p, v))}
                        className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                      >
                        {mode === "source" ? (picked ? "Selected" : "Select") : picked ? "Added" : (<><Plus size={13} /> Add</>)}
                      </button>
                    </li>
                  );
                })
            )}
          </ul>
        )}
      </div>
    </div>
  );

  const sourceSummary = source && (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
      <PackageOpen size={18} className="shrink-0 text-gray-500" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-gray-900">
          {source.productName} — {source.variant.label}
        </div>
        <div className="text-xs text-gray-500">
          <b>{qty(available)}</b> in stock{source.variant.purchasePrice > 0 ? ` · cost ${rupees(source.variant.purchasePrice)} each` : " · no purchase price set"}
          {batchNo ? ` · batch ${batchNo}` : ""}
        </div>
      </div>
    </div>
  );

  const usageBar = source && (
    <div className={`rounded-lg px-3 py-2 text-sm ${remaining < -1e-9 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
      Uses <b>{qty(totalUsed)}</b> of <b>{qty(available)}</b> in stock
      {wastage > 0 ? ` (incl. ${qty(wastage)} wastage)` : ""} · <b>{qty(Math.max(remaining, 0))}</b> left
      {remaining < -1e-9 ? ` — ${qty(-remaining)} short` : ""}
    </div>
  );

  const previewBox = (
    <>
      {previewing && (
        <p className="flex items-center gap-2 py-6 text-sm text-gray-500">
          <Loader2 size={15} className="animate-spin" /> Calculating…
        </p>
      )}
      {previewError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{previewError}</p>}
      {preview && preview.warnings.length > 0 && (
        <ul className="space-y-1">
          {preview.warnings.map((w) => (
            <li key={w} className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {w}
            </li>
          ))}
        </ul>
      )}
    </>
  );

  // ---------------------------------------------------------------- steps

  const stepSource = (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={`${card} space-y-3`} style={cardStyle}>
        {scope === "admin" && (
          <label className="block text-xs font-semibold text-gray-600">
            Store / warehouse
            <select className={field} value={sellerId} onChange={(e) => changeStore(e.target.value)}>
              <option value="">Select</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isAdminStore ? " (your store)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="text-xs font-semibold text-gray-600">Bulk item to repack</div>
        {itemPicker("source")}
      </div>
      <div className={`${card} flex flex-col gap-3`} style={cardStyle}>
        <h2 className="text-sm font-bold text-gray-900">Source</h2>
        {source ? sourceSummary : <p className="py-6 text-center text-sm text-gray-400">Select the bulk stock to repack, e.g. "Rice — 50 kg Bag".</p>}
        <label className="block text-xs font-semibold text-gray-600">
          Batch / lot no. (optional)
          <input className={field} value={batchNo} maxLength={60} placeholder="e.g. Farmer lot 2026-10-A" onChange={(e) => setBatchNo(e.target.value)} />
        </label>
        <p className="text-xs text-gray-500">
          Bulk stock is counted in the item's own units: if "50 kg Bag" has 2 in stock, that's 2 bags. Fractions are allowed, so part of a bag can be
          repacked.
        </p>
        <button
          type="button"
          disabled={!source}
          onClick={() => {
            setSearch("");
            setPickerFor("output");
            setStep(1);
          }}
          className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-[var(--primary-dark)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Next: define conversion <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );

  const stepConversion = source && (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className={`${card} space-y-3`} style={cardStyle}>
        {sourceSummary}
        <h2 className="text-sm font-bold text-gray-900">Pack sizes to make</h2>
        {outputs.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Add the pack sizes to make from the list on the right.</p>
        ) : (
          <div className="space-y-3">
            {outputs.map((o, i) => {
              const perSource = o.sourcePerPack > 0 ? round6(1 / o.sourcePerPack) : 0;
              const suggested = suggestRatio(source.variant, o.variant);
              const others = round6(usedForPacks - (o.packs || 0) * (o.sourcePerPack || 0) + (wastage || 0));
              const max = o.sourcePerPack > 0 ? Math.max(0, Math.floor(round6((available - others) / o.sourcePerPack))) : 0;
              return (
                <div key={o.variant.variationId} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start gap-2">
                    <Package size={16} className="mt-0.5 shrink-0 text-gray-500" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-gray-900">
                        {o.productName} — {o.variant.label}
                      </div>
                      <div className="text-xs text-gray-500">{qty(o.variant.stock)} in stock now</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOutputs((ls) => ls.filter((_, j) => j !== i))}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove ${o.variant.label}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <label className="text-xs font-semibold text-gray-600">
                      Each pack uses
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={o.sourcePerPack || ""}
                        onChange={(e) => patchOutput(i, { sourcePerPack: round6(Number(e.target.value) || 0) })}
                        className={`${field} ${o.packs > 0 && !(o.sourcePerPack > 0) ? "border-red-400" : ""}`}
                      />
                      <span className="mt-0.5 block font-normal text-gray-500">
                        of "{source.variant.label}" {equivalent(source.variant, o.sourcePerPack)}
                      </span>
                    </label>
                    <label className="text-xs font-semibold text-gray-600">
                      or 1 "{source.variant.label}" makes
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={perSource || ""}
                        onChange={(e) => {
                          const n = Number(e.target.value) || 0;
                          patchOutput(i, { sourcePerPack: n > 0 ? round6(1 / n) : 0 });
                        }}
                        className={field}
                      />
                      <span className="mt-0.5 block font-normal text-gray-500">packs (e.g. one box holds 100 bolts)</span>
                    </label>
                    <label className="text-xs font-semibold text-gray-600">
                      Number of packs
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={o.packs || ""}
                        onChange={(e) => patchOutput(i, { packs: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                        className={`${field} ${o.packs > max ? "border-red-400" : ""}`}
                      />
                      <button type="button" onClick={() => patchOutput(i, { packs: max })} className="mt-0.5 font-semibold text-[var(--primary-dark)] hover:underline">
                        Max {max}
                      </button>
                    </label>
                  </div>
                  {suggested > 0 && Math.abs(suggested - o.sourcePerPack) > suggested * 0.01 && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                      <AlertTriangle size={13} /> The labels suggest {qty(suggested)} per pack.
                      <button type="button" onClick={() => patchOutput(i, { sourcePerPack: suggested })} className="font-semibold underline">
                        Use it
                      </button>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {usageBar}
        <div className="flex gap-2">
          <button type="button" onClick={() => setStep(0)} className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">
            <ArrowLeft size={16} /> Back
          </button>
          <button
            type="button"
            disabled={conversionProblems.length > 0}
            title={conversionProblems.join("\n")}
            onClick={() => {
              setPreview(null);
              setStep(2);
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--primary-dark)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Next: calculate cost <ArrowRight size={16} />
          </button>
        </div>
        {conversionProblems.length > 0 && activeOutputs.length > 0 && <p className="text-xs text-red-600">{conversionProblems[0]}</p>}
      </div>
      <div className={`${card} space-y-2`} style={cardStyle}>
        <h2 className="text-sm font-bold text-gray-900">Add a pack size</h2>
        <p className="text-xs text-gray-500">Any item or size in this store, e.g. "Rice — 1 kg Packet". Create the pack product first if it doesn't exist yet.</p>
        {pickerFor === "output" && itemPicker("output")}
      </div>
    </div>
  );

  const stepCost = source && (
    <div className={`${card} space-y-4`} style={cardStyle}>
      {sourceSummary}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-gray-600">
          Wastage while repacking (optional)
          <input
            type="number"
            min={0}
            step="any"
            value={wastage || ""}
            onChange={(e) => {
              setWastage(round6(Math.max(0, Number(e.target.value) || 0)));
              setPreview(null);
            }}
            className={field}
          />
          <span className="mt-0.5 block font-normal text-gray-500">
            In "{source.variant.label}" units {equivalent(source.variant, wastage)} — spillage, torn bags. Comes out of the bulk; its cost is shared across the packs.
          </span>
        </label>
        <label className="block text-xs font-semibold text-gray-600">
          Note (optional)
          <input className={field} value={note} maxLength={500} placeholder="e.g. Repacked by Ramesh, morning shift" onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold text-gray-900">Packaging cost per pack</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {activeOutputs.map((o) => {
            const i = outputs.indexOf(o);
            return (
              <label key={o.variant.variationId} className="block text-xs font-semibold text-gray-600">
                {o.productName} — {o.variant.label} ({o.packs} packs)
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2 text-sm text-gray-400">₹</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={o.packagingCostPerPack || ""}
                    onChange={(e) => patchOutput(i, { packagingCostPerPack: Math.max(0, Number(e.target.value) || 0) })}
                    className="block w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm"
                    placeholder="Pouch, label, sealing"
                  />
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {usageBar}
      {previewBox}
      {preview && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="py-2">Pack</th>
                <th className="py-2 text-right">Bulk cost</th>
                <th className="py-2 text-right">Packaging</th>
                <th className="py-2 text-right">Wastage share</th>
                <th className="py-2 text-right">Cost per pack</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {preview.outputs.map((o) => (
                <tr key={o.variationId}>
                  <td className="py-2">
                    <div className="font-semibold text-gray-900">
                      {o.productName} — {o.variantLabel}
                    </div>
                    <div className="text-xs text-gray-500">{o.packs} packs</div>
                  </td>
                  <td className="py-2 text-right tabular-nums">{rupees(o.sourceCostPerPack)}</td>
                  <td className="py-2 text-right tabular-nums">{rupees(o.packagingCostPerPack)}</td>
                  <td className="py-2 text-right tabular-nums">{rupees(o.wastageCostPerPack)}</td>
                  <td className="py-2 text-right font-bold tabular-nums">{rupees(o.costPerPack)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 text-sm">
                <td className="py-2 font-semibold" colSpan={4}>
                  Total ({rupees(preview.totals.sourceCost)} bulk + {rupees(preview.totals.packagingCost)} packaging + {rupees(preview.totals.wastageCost)} wastage)
                </td>
                <td className="py-2 text-right font-bold tabular-nums">{rupees(preview.totals.totalCost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} className="mt-1" />
        <span>
          Update each pack's purchase price to its new average cost
          <span className="block text-xs text-gray-500">Keeps profit reports right. Packs already on the shelf are averaged in.</span>
        </span>
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">
          <ArrowLeft size={16} /> Back
        </button>
        {!preview && !previewing ? (
          <button type="button" onClick={runPreview} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--primary-dark)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-dark)]">
            Recalculate
          </button>
        ) : (
          <button
            type="button"
            disabled={!preview || previewing}
            onClick={() => setStep(3)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--primary-dark)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Next: preview <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );

  const stepPreview = source && (
    <div className={`${card} space-y-4`} style={cardStyle}>
      <h2 className="text-sm font-bold text-gray-900">Before and after</h2>
      {previewBox}
      {preview && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="py-2">Item</th>
                  <th className="py-2 text-right">Before</th>
                  <th className="py-2 text-right">Change</th>
                  <th className="py-2 text-right">After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-red-50/40">
                  <td className="py-2">
                    <div className="font-semibold text-gray-900">
                      {preview.source.productName} — {preview.source.variantLabel}
                    </div>
                    <div className="text-xs text-gray-500">
                      Bulk{preview.source.wastage > 0 ? ` · ${qty(preview.source.usedForPacks)} packed + ${qty(preview.source.wastage)} wastage` : ""}
                    </div>
                  </td>
                  <td className="py-2 text-right tabular-nums">{qty(preview.source.stockBefore)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-red-700">−{qty(preview.source.totalUsed)}</td>
                  <td className="py-2 text-right font-bold tabular-nums">{qty(preview.source.stockAfter)}</td>
                </tr>
                {preview.outputs.map((o) => (
                  <tr key={o.variationId} className="bg-emerald-50/40">
                    <td className="py-2">
                      <div className="font-semibold text-gray-900">
                        {o.productName} — {o.variantLabel}
                      </div>
                      <div className="text-xs text-gray-500">
                        {rupees(o.costPerPack)} per pack{updateCost && o.newCost !== undefined ? ` · purchase price → ${rupees(o.newCost)}` : ""}
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums">{qty(o.stockBefore)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-emerald-700">+{o.packs}</td>
                    <td className="py-2 text-right font-bold tabular-nums">{qty(o.stockAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              Packs created <b className="block text-lg">{preview.totals.packsCreated}</b>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              Bulk used <b className="block text-lg">{qty(preview.source.totalUsed)}</b>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              Total cost <b className="block text-lg">{rupees(preview.totals.totalCost)}</b>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Repacking is an internal stock movement — not a sale or a purchase. It's recorded in the stock ledger and in repack history with your name and the time.
          </p>
        </>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => setStep(2)} className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">
          <ArrowLeft size={16} /> Back
        </button>
        <button
          type="button"
          disabled={!preview || posting || previewing}
          onClick={post}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--primary-dark)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {posting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Confirm and update inventory
        </button>
      </div>
    </div>
  );

  const recordView = (r: RepackRecord) => (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>{when(r.createdAt)}</span>
        {storeName(r) && <span>{storeName(r)}</span>}
        <span>
          by {r.performedBy?.name || r.performedBy?.type} ({r.performedBy?.type})
        </span>
        {r.batchNo && <span>Batch {r.batchNo}</span>}
      </div>
      <div className="rounded-lg bg-red-50/60 px-3 py-2">
        <b>
          {r.source.productName} — {r.source.variantLabel}
        </b>
        : {qty(r.source.stockBefore)} → {qty(r.source.stockAfter)} (used {qty(r.source.totalUsed)}
        {r.source.wastage > 0 ? `, incl. ${qty(r.source.wastage)} wastage` : ""})
      </div>
      <ul className="space-y-1">
        {r.outputs.map((o) => (
          <li key={String(o.variationId)} className="rounded-lg bg-emerald-50/60 px-3 py-2">
            <b>
              {o.productName} — {o.variantLabel}
            </b>
            : +{o.packs} ({qty(o.stockBefore)} → {qty(o.stockAfter)}) · {qty(o.sourcePerPack)} bulk per pack · {rupees(o.costPerPack)} per pack
          </li>
        ))}
      </ul>
      <div className="text-xs text-gray-600">
        Bulk {rupees(r.totals.sourceCost)} + packaging {rupees(r.totals.packagingCost)} + wastage {rupees(r.totals.wastageCost)} ={" "}
        <b>{rupees(r.totals.totalCost)}</b>
        {r.costUpdated ? " · pack purchase prices updated" : " · purchase prices left unchanged"}
      </div>
      {r.note && <p className="text-xs text-gray-600">Note: {r.note}</p>}
    </div>
  );

  const stepDone = posted && (
    <div className={`${card} space-y-4`} style={cardStyle}>
      <div className="flex items-center gap-2 text-emerald-700">
        <CheckCircle2 size={22} />
        <h2 className="text-lg font-bold">Repack {posted.repackNumber} posted</h2>
      </div>
      {recordView(posted)}
      <div className="flex gap-2">
        <button type="button" onClick={resetAll} className="flex-1 rounded-lg bg-[var(--primary-dark)] px-4 py-2.5 text-sm font-semibold text-white">
          New repack
        </button>
        <button
          type="button"
          onClick={() => {
            resetAll();
            setTab("history");
          }}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700"
        >
          <History size={16} /> History
        </button>
      </div>
    </div>
  );

  const historyView = (
    <div className={`${card} space-y-3`} style={cardStyle}>
      {scope === "admin" && (
        <label className="block max-w-sm text-xs font-semibold text-gray-600">
          Store
          <select className={field} value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
            <option value="">All stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {historyLoading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-gray-500">
          <Loader2 size={15} className="animate-spin" /> Loading…
        </p>
      ) : history.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">No repacks yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="py-2">Repack</th>
                <th className="py-2">Bulk used</th>
                <th className="py-2">Packs made</th>
                <th className="py-2 text-right">Total cost</th>
                <th className="py-2">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((r) => (
                <tr key={r._id} className="cursor-pointer hover:bg-gray-50" onClick={() => openDetail(r._id)}>
                  <td className="py-2">
                    <div className="font-semibold text-[var(--primary-dark)]">{r.repackNumber}</div>
                    <div className="text-xs text-gray-500">
                      {when(r.createdAt)}
                      {scope === "admin" && storeName(r) ? ` · ${storeName(r)}` : ""}
                    </div>
                  </td>
                  <td className="py-2">
                    {qty(r.source.totalUsed)} × {r.source.productName} {r.source.variantLabel}
                  </td>
                  <td className="py-2 text-xs text-gray-700">
                    {r.outputs.map((o) => `${o.packs} × ${o.variantLabel || o.productName}`).join(", ")}
                  </td>
                  <td className="py-2 text-right tabular-nums">{rupees(r.totals.totalCost)}</td>
                  <td className="py-2 text-xs text-gray-600">{r.performedBy?.name || r.performedBy?.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <PackageOpen size={22} /> Repacking
          </h1>
          <p className="text-sm text-gray-500">
            Turn bulk stock into smaller packs — a 50 kg bag into 1 kg and 5 kg packets, a drum into litres, a box into pieces.
          </p>
        </div>
        <div className="flex rounded-lg border border-gray-200 p-0.5 text-sm" role="tablist">
          {(["new", "history"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 font-semibold ${tab === t ? "bg-[var(--primary-dark)] text-white" : "text-gray-600"}`}
            >
              {t === "new" ? "New repack" : "History"}
            </button>
          ))}
        </div>
      </div>

      {tab === "new" ? (
        <>
          <ol className="flex flex-wrap gap-2 text-xs">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${
                  i === step ? "bg-[var(--primary-dark)] text-white" : i < step ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                <span>{i + 1}</span> {s}
              </li>
            ))}
          </ol>
          {step === 0 && stepSource}
          {step === 1 && stepConversion}
          {step === 2 && stepCost}
          {step === 3 && stepPreview}
          {step === 4 && stepDone}
        </>
      ) : (
        historyView
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl p-5 shadow-xl" style={cardStyle} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Repack ${detail.repackNumber}`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Repack {detail.repackNumber}</h2>
              <button type="button" onClick={() => setDetail(null)} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {recordView(detail)}
          </div>
        </div>
      )}
    </div>
  );
}
