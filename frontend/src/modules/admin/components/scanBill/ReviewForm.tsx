import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import {
  BillItem,
  confirmScan,
  discardScan,
  DOC_TYPE_LABEL,
  downloadScanCsv,
  rematchScan,
  rescanBill,
  ReviewBill,
  saveScan,
  ScanDocType,
  ScannedDocument,
  ScanWarning,
  syncScanLedger,
} from '../../../../services/api/admin/scanBillService';
import { amountToIndianWords } from '../../../../utils/amountInWords';
import { inr, inToIso, isoToIN, lineAmount, liveChecks, r2, summarize } from '../../scanBill/billMath';
import { exportBillPdf } from '../../scanBill/exportPdf';
import PartyField from './PartyField';
import ProductPicker, { optionKey } from './ProductPicker';
import { apiMessage, btn, ConfidenceDot, inputCls, StatusPill } from './scanBillUi';

interface Props {
  scan: ScannedDocument;
  /** Local object URLs of the pages (shown until the server previews load, or without storage) */
  localPreviews?: string[];
  categories: Array<{ _id: string; name: string }>;
  onUpdated: (scan: ScannedDocument) => void;
  onDiscarded: (id: string) => void;
  onOpenScan: (id: string) => void;
}

const EMPTY_ITEM: BillItem = { name: '', quantity: 1, rate: null, amount: null, action: 'skip' };
const PAYMENT_MODES: Array<[string, string]> = [['', 'Not shown'], ['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card'], ['bank', 'Bank transfer'], ['cheque', 'Cheque'], ['credit', 'Credit'], ['other', 'Other']];
const PAYMENT_STATUSES: Array<[string, string]> = [['', 'Not shown'], ['paid', 'Paid'], ['unpaid', 'Unpaid'], ['partial', 'Partly paid']];
const EXPENSE_CATEGORIES = ['Rent', 'Electricity', 'Transport', 'Salaries', 'Repairs', 'Internet & phone', 'Packaging', 'Other'];

const numOrNull = (v: string) => (v.trim() === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** Normalise the stored bill so every field the form edits exists */
function toBill(scan: ScannedDocument): ReviewBill {
  const d: any = scan.data || {};
  return {
    docType: d.docType || scan.docType || 'purchase',
    documentTitle: d.documentTitle ?? null,
    invoiceNumber: d.invoiceNumber ?? '',
    invoiceDate: d.invoiceDate ?? null,
    dueDate: d.dueDate ?? null,
    party: { name: '', gstin: '', phone: '', address: '', state: '', supplierId: null, customerId: null, ...(d.party || {}) },
    items: (d.items || []).map((it: any) => ({ ...EMPTY_ITEM, ...it, action: it.action || 'skip' })),
    totals: { ...(d.totals || {}) },
    amountInWords: d.amountInWords ?? '',
    paymentMode: d.paymentMode ?? null,
    paymentStatus: d.paymentStatus ?? null,
    amountPaid: d.amountPaid ?? null,
    notes: d.notes ?? '',
    stockDirection: d.stockDirection || 'in',
    expenseCategory: d.expenseCategory ?? null,
    confidence: scan.extracted?.confidence || d.confidence,
  };
}

const NumField = ({
  value,
  onChange,
  disabled,
  className = '',
  placeholder,
  ariaLabel,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) => (
  <input
    type="number"
    step="any"
    inputMode="decimal"
    aria-label={ariaLabel}
    className={`${inputCls} px-1.5 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${className}`}
    value={value ?? ''}
    placeholder={placeholder}
    disabled={disabled}
    onChange={(e) => onChange(numOrNull(e.target.value))}
    onWheel={(e) => (e.target as HTMLInputElement).blur()}
  />
);

export default function ReviewForm({ scan, localPreviews = [], categories, onUpdated, onDiscarded, onOpenScan }: Props) {
  const { showToast } = useToast();
  const [bill, setBill] = useState<ReviewBill>(() => toBill(scan));
  const [matches, setMatches] = useState(scan.matches || null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<null | 'save' | 'confirm' | 'ledger' | 'rescan' | 'discard' | 'rematch' | 'csv'>(null);
  const [confirmErrors, setConfirmErrors] = useState<string[]>([]);
  const [dateText, setDateText] = useState(isoToIN(bill.invoiceDate));
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLDivElement>(null);

  const locked = scan.status === 'confirmed' || scan.status === 'discarded' || scan.status === 'syncing';
  const isPurchase = bill.docType === 'purchase';
  const isSales = bill.docType === 'sales';
  const isExpense = bill.docType === 'expense';
  const isSlip = bill.docType === 'stock_slip';

  // A different scan (or a fresh server copy after save/re-scan) resets the form
  useEffect(() => {
    const b = toBill(scan);
    setBill(b);
    setDateText(isoToIN(b.invoiceDate));
    setMatches(scan.matches || null);
    setDirty(false);
    setConfirmErrors([]);
  }, [scan]);

  useEffect(() => {
    setPage(0);
    setZoom(1);
  }, [scan._id]);

  // Product labels for linked lines, from the match suggestions
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const m of matches?.items || []) {
      for (const c of m.candidates || []) next[optionKey(c.productId, c.variationId)] = c.variant ? `${c.name} · ${c.variant}` : c.name;
    }
    setLabels((l) => ({ ...next, ...l }));
  }, [matches]);

  const update = (patch: Partial<ReviewBill>) => {
    setBill((b) => ({ ...b, ...patch }));
    setDirty(true);
  };
  const updateTotals = (patch: Partial<ReviewBill['totals']>) => update({ totals: { ...bill.totals, ...patch } });
  const updateItem = (i: number, patch: Partial<BillItem>, recalc = false) => {
    setBill((b) => {
      const items = b.items.slice();
      const next = { ...items[i], ...patch };
      if (recalc && next.rate !== null && next.rate !== undefined && next.quantity !== null && next.quantity !== undefined) next.amount = lineAmount(next);
      items[i] = next;
      return { ...b, items };
    });
    setDirty(true);
  };
  const removeItem = (i: number) => {
    setBill((b) => ({ ...b, items: b.items.filter((_, j) => j !== i) }));
    setMatches((m) => (m ? { ...m, items: m.items.filter((_, j) => j !== i) } : m));
    setDirty(true);
  };
  const addItem = () => {
    setBill((b) => ({ ...b, items: [...b.items, { ...EMPTY_ITEM }] }));
    setDirty(true);
  };

  const summary = useMemo(() => summarize(bill), [bill]);
  const live = useMemo(() => liveChecks(bill), [bill]);
  // Server warnings until the next save, plus instant arithmetic checks (no duplicates by code)
  const warnings: ScanWarning[] = useMemo(() => {
    const liveCodes = new Set(live.map((l) => l.code));
    const arithmetic = new Set(['SUBTOTAL_MISMATCH', 'TOTAL_MISMATCH', 'WORDS_MISMATCH', 'CGST_SGST_UNEQUAL']);
    const server = (scan.warnings || []).filter((w) => !(dirty && arithmetic.has(w.code)) && !liveCodes.has(w.code));
    return [...live, ...server].sort((a, b) => ['error', 'warning', 'info'].indexOf(a.severity) - ['error', 'warning', 'info'].indexOf(b.severity));
  }, [scan.warnings, live, dirty]);

  const focusField = (field?: string) => {
    if (!field) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${field}"], [data-field="${field.split('.').slice(0, 2).join('.')}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (el?.querySelector('input,select,textarea') as HTMLElement | null)?.focus();
  };

  const conf = bill.confidence || {};
  const previews = (scan.files || []).flatMap((f) => f.previewUrls || []);
  const pages = previews.length ? previews : localPreviews;
  const fileBase = `bill-${(bill.invoiceNumber || scan._id).replace(/[^A-Za-z0-9_-]+/g, '_')}`;

  // ------------------------------------------------------------------ actions
  const save = async (silent = false) => {
    setBusy('save');
    try {
      const fresh = await saveScan(scan._id, { ...bill, invoiceDate: bill.invoiceDate || null });
      onUpdated(fresh);
      if (!silent) showToast('Draft saved', 'success');
      return fresh;
    } catch (e) {
      showToast(apiMessage(e, "Couldn't save the draft"), 'error');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const confirm = async (syncLedger: boolean) => {
    setBusy(syncLedger ? 'ledger' : 'confirm');
    setConfirmErrors([]);
    try {
      const res = await confirmScan(scan._id, { ...bill, invoiceDate: bill.invoiceDate || null }, syncLedger);
      onUpdated(res.data);
      showToast(res.alreadyConfirmed ? 'This bill was already saved. Nothing was added again.' : 'Bill saved', 'success');
    } catch (e: any) {
      const details: string[] = e?.response?.data?.details || [];
      setConfirmErrors(details.length ? details : [apiMessage(e, "Couldn't save the bill")]);
      showToast(e?.response?.data?.message || "Couldn't save the bill. Nothing was changed.", 'error');
    } finally {
      setBusy(null);
    }
  };

  const syncLedgerLater = async () => {
    setBusy('ledger');
    try {
      const res = await syncScanLedger(scan._id, bill.party.supplierId || undefined);
      onUpdated(res.data);
      showToast(res.message || 'Added to the supplier ledger', 'success');
    } catch (e) {
      showToast(apiMessage(e, "Couldn't update the supplier ledger"), 'error');
    } finally {
      setBusy(null);
    }
  };

  const rescan = async () => {
    if (dirty && !window.confirm('Re-scanning replaces your edits with a fresh AI read. Continue?')) return;
    setBusy('rescan');
    try {
      const res = await rescanBill(scan._id, bill.docType);
      onUpdated(res.data);
      showToast(res.aiError ? res.aiError : 'Bill read again', res.aiError ? 'error' : 'success');
    } catch (e) {
      showToast(apiMessage(e, "Couldn't re-scan"), 'error');
    } finally {
      setBusy(null);
    }
  };

  const discard = async () => {
    if (!window.confirm('Discard this scan? The uploaded photos are deleted too.')) return;
    setBusy('discard');
    try {
      await discardScan(scan._id);
      showToast('Scan discarded', 'success');
      onDiscarded(scan._id);
    } catch (e) {
      showToast(apiMessage(e, "Couldn't discard"), 'error');
    } finally {
      setBusy(null);
    }
  };

  const rematch = async () => {
    setBusy('rematch');
    try {
      const m = await rematchScan(scan._id, bill);
      setMatches(m);
      // Lines still unlinked that now have a clear match get linked
      setBill((b) => ({
        ...b,
        items: b.items.map((it, i) => {
          const best = m.items[i]?.status === 'matched' ? m.items[i].best : undefined;
          return it.action === 'skip' && best ? { ...it, action: 'link', productId: best.productId, variationId: best.variationId ?? null } : it;
        }),
      }));
      setDirty(true);
      showToast('Items matched again', 'success');
    } catch (e) {
      showToast(apiMessage(e, "Couldn't match items"), 'error');
    } finally {
      setBusy(null);
    }
  };

  const csv = async () => {
    setBusy('csv');
    try {
      if (dirty && !locked) await save(true);
      await downloadScanCsv(scan._id, `${fileBase}.csv`);
    } catch (e) {
      showToast(apiMessage(e, "Couldn't export"), 'error');
    } finally {
      setBusy(null);
    }
  };

  const ledgerPending = scan.status === 'confirmed' && scan.docType === 'purchase' && !scan.sync?.supplierId;
  const unlinked = bill.items.filter((i) => i.action === 'skip').length;
  const dupWarning = warnings.find((w) => w.code === 'DUPLICATE');

  // ------------------------------------------------------------------ render
  return (
    <div ref={formRef} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Bill image */}
        <section>
          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">
                {pages.length ? `Page ${page + 1} of ${pages.length}` : 'No image'}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button type="button" className={btn.ghost} onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label="Zoom out">
                  <ZoomOut size={15} />
                </button>
                <span className="w-9 text-center text-[11px] text-gray-500">{Math.round(zoom * 100)}%</span>
                <button type="button" className={btn.ghost} onClick={() => setZoom((z) => Math.min(4, z + 0.5))} aria-label="Zoom in">
                  <ZoomIn size={15} />
                </button>
                {scan.files?.[0]?.originalUrl && (
                  <a href={scan.files[0].originalUrl} target="_blank" rel="noreferrer" className={btn.ghost}>
                    Original
                  </a>
                )}
              </div>
            </div>
            <div className={`${pages.length ? "h-[52vh]" : "h-24"} overflow-auto rounded-lg bg-gray-100`}>
              {pages[page] ? (
                <img src={pages[page]} alt={`Bill page ${page + 1}`} style={{ width: `${zoom * 100}%` }} className="mx-auto block max-w-none" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">{scan.provider === 'manual' ? 'Manual entry: no photo' : 'Preview not available'}</div>
              )}
            </div>
            {pages.length > 1 && (
              <div className="mt-2 flex gap-1.5 overflow-x-auto">
                {pages.map((src, i) => (
                  <button key={src} type="button" onClick={() => setPage(i)} className={`h-14 w-11 shrink-0 overflow-hidden rounded border-2 ${i === page ? 'border-[#6DBB2D]' : 'border-transparent'}`}>
                    <img src={src} alt={`Page ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Form */}
        <section className="min-w-0 space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <select
              className={`${inputCls} w-auto font-semibold`}
              value={bill.docType}
              disabled={locked}
              onChange={(e) => update({ docType: e.target.value as ScanDocType })}
              aria-label="Bill type"
              data-field="docType"
            >
              {(['purchase', 'sales', 'stock_slip', 'expense', 'unknown'] as ScanDocType[]).map((t) => (
                <option key={t} value={t}>
                  {DOC_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <StatusPill status={scan.status} />
            {typeof conf.overall === 'number' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                <ConfidenceDot value={conf.overall} /> {Math.round(conf.overall * 100)}% sure
              </span>
            )}
            {scan.provider && scan.provider !== 'manual' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400" title={scan.aiModel}>
                <Sparkles size={12} /> Read by AI{scan.repaired ? ' (2 tries)' : ''}
              </span>
            )}
            {dirty && !locked && <span className="ml-auto text-[11px] font-medium text-amber-600">Unsaved changes</span>}
          </div>

          {scan.status === 'failed' && (
            <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">AI couldn't read this bill</div>
                <div className="text-xs">{scan.error || 'Unknown error'} Fill in the bill below, or re-scan with a clearer photo.</div>
              </div>
            </div>
          )}
          {dupWarning && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
              <Copy size={16} className="shrink-0" />
              <span className="flex-1">{dupWarning.message}</span>
              {scan.duplicateOf && (
                <button type="button" className="text-xs font-semibold underline" onClick={() => onOpenScan(scan.duplicateOf!)}>
                  Open the earlier scan
                </button>
              )}
            </div>
          )}
          {scan.status === 'confirmed' && <SavedSummary scan={scan} />}

          {/* Bill details */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-gray-900">Bill details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {!isSlip && (
                <div className="sm:col-span-2" data-field="party.name">
                  <PartyField
                    kind={isSales ? 'customer' : 'supplier'}
                    party={bill.party}
                    match={matches?.party}
                    confidence={conf.party}
                    disabled={locked}
                    onChange={(party) => update({ party })}
                  />
                </div>
              )}
              <div data-field="invoiceNumber">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                  Bill no. <ConfidenceDot value={conf.invoiceNumber} />
                </label>
                <input className={inputCls} value={bill.invoiceNumber || ''} disabled={locked} onChange={(e) => update({ invoiceNumber: e.target.value })} />
              </div>
              <div data-field="invoiceDate">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                  Bill date (DD/MM/YYYY) <ConfidenceDot value={conf.invoiceDate} />
                </label>
                <input
                  className={`${inputCls} ${dateText && !inToIso(dateText) ? 'border-red-400' : ''}`}
                  value={dateText}
                  placeholder="DD/MM/YYYY"
                  disabled={locked}
                  onChange={(e) => {
                    setDateText(e.target.value);
                    update({ invoiceDate: inToIso(e.target.value) });
                  }}
                />
                {dateText && !inToIso(dateText) && <p className="mt-0.5 text-[11px] text-red-600">Use DD/MM/YYYY, e.g. 04/10/2026</p>}
              </div>
              {!isSlip && (
                <>
                  <div data-field="party.gstin">
                    <label className="mb-1 block text-xs font-semibold text-gray-600">GSTIN</label>
                    <input
                      className={`${inputCls} uppercase`}
                      value={bill.party.gstin || ''}
                      maxLength={15}
                      disabled={locked}
                      onChange={(e) => update({ party: { ...bill.party, gstin: e.target.value.toUpperCase() } })}
                    />
                  </div>
                  <div data-field="party.phone">
                    <label className="mb-1 block text-xs font-semibold text-gray-600">Phone</label>
                    <input className={inputCls} inputMode="tel" value={bill.party.phone || ''} disabled={locked} onChange={(e) => update({ party: { ...bill.party, phone: e.target.value } })} />
                  </div>
                  <div className="sm:col-span-2" data-field="party.address">
                    <label className="mb-1 block text-xs font-semibold text-gray-600">Address</label>
                    <input className={inputCls} value={bill.party.address || ''} disabled={locked} onChange={(e) => update({ party: { ...bill.party, address: e.target.value } })} />
                  </div>
                </>
              )}
              {isSlip && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Goods are</label>
                  <select className={inputCls} value={bill.stockDirection || 'in'} disabled={locked} onChange={(e) => update({ stockDirection: e.target.value as 'in' | 'out' })}>
                    <option value="in">Coming in (add stock)</option>
                    <option value="out">Going out (reduce stock)</option>
                  </select>
                </div>
              )}
              {isExpense && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Expense category</label>
                  <select className={inputCls} value={bill.expenseCategory || ''} disabled={locked} onChange={(e) => update({ expenseCategory: e.target.value || null })}>
                    <option value="">Choose…</option>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Items */}
      {!isExpense && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm" data-field="items">
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-bold text-gray-900">Items ({bill.items.length})</h3>
            <ConfidenceDot value={conf.items} />
            {unlinked > 0 && !locked && <span className="text-[11px] text-amber-700">{unlinked} not linked: no stock change for those</span>}
            {!locked && (
              <div className="ml-auto flex gap-1.5">
                <button type="button" className={btn.ghost} onClick={rematch} disabled={busy !== null || !bill.items.length}>
                  {busy === 'rematch' ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Re-match
                </button>
                <button type="button" className={btn.ghost} onClick={addItem}>
                  <Plus size={13} /> Add line
                </button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <style>{ITEMS_TABLE_CSS}</style>
              <table className="scanbill-items w-full min-w-[1100px] table-fixed text-xs">
              <colgroup>
                <col className="w-8" />
                <col />
                <col className="w-16" />
                <col className="w-16" />
                <col className="w-20" />
                <col className="w-20" />
                <col className="w-16" />
                <col className="w-14" />
                <col className="w-24" />
                <col className="w-60" />
                <col className="w-10" />
              </colgroup>
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Item on bill</th>
                  <th className="px-2 py-2 text-left">HSN</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">Rate</th>
                  <th className="px-2 py-2 text-right">MRP</th>
                  <th className="px-2 py-2 text-right">Disc ₹</th>
                  <th className="px-2 py-2 text-right">GST %</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                  <th className="px-2 py-2 text-left">Product in catalogue</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bill.items.map((it, i) => {
                  const lineWarn = warnings.some((w) => w.field?.startsWith(`items.${i}.`) || w.field === `items.${i}`);
                  return (
                    <tr key={i} className={`border-t border-gray-100 align-top ${lineWarn ? 'bg-amber-50/60' : ''}`} data-field={`items.${i}`}>
                      <td className="px-2 py-2 text-gray-400">
                        <div className="flex items-center gap-1">
                          {i + 1}
                          <ConfidenceDot value={it.confidence} />
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <input className={inputCls} value={it.name || ''} disabled={locked} onChange={(e) => updateItem(i, { name: e.target.value })} aria-label={`Line ${i + 1} name`} />
                        {(it.batch || it.expiry) && (
                          <div className="mt-0.5 text-[10px] text-gray-400">
                            {it.batch ? `Batch ${it.batch}` : ''} {it.expiry ? `Exp ${it.expiry}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <input className={inputCls} value={it.hsn || ''} disabled={locked} onChange={(e) => updateItem(i, { hsn: e.target.value })} aria-label={`Line ${i + 1} HSN`} />
                      </td>
                      <td className="px-1 py-1.5">
                        <NumField value={it.quantity} disabled={locked} onChange={(v) => updateItem(i, { quantity: v }, true)} ariaLabel={`Line ${i + 1} quantity`} />
                        {it.unit && <div className="mt-0.5 text-right text-[10px] text-gray-400">{it.unit}</div>}
                      </td>
                      <td className="px-1 py-1.5">
                        <NumField value={it.rate} disabled={locked} onChange={(v) => updateItem(i, { rate: v }, true)} ariaLabel={`Line ${i + 1} rate`} />
                      </td>
                      <td className="px-1 py-1.5">
                        <NumField value={it.mrp} disabled={locked} onChange={(v) => updateItem(i, { mrp: v })} ariaLabel={`Line ${i + 1} MRP`} />
                      </td>
                      <td className="px-1 py-1.5">
                        <NumField value={it.discount} disabled={locked} onChange={(v) => updateItem(i, { discount: v }, true)} ariaLabel={`Line ${i + 1} discount`} />
                      </td>
                      <td className="px-1 py-1.5">
                        <NumField value={it.taxRate} disabled={locked} onChange={(v) => updateItem(i, { taxRate: v })} ariaLabel={`Line ${i + 1} GST`} />
                      </td>
                      <td className="px-1 py-1.5" data-field={`items.${i}.amount`}>
                        <NumField
                          value={it.amount}
                          disabled={locked}
                          onChange={(v) => updateItem(i, { amount: v })}
                          className={warnings.some((w) => w.field === `items.${i}.amount`) ? 'border-amber-400' : ''}
                          ariaLabel={`Line ${i + 1} amount`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <ProductPicker
                          item={it}
                          match={matches?.items?.[i]}
                          labels={labels}
                          categories={categories}
                          disabled={locked}
                          onChange={(patch, label) => {
                            if (label) setLabels((l) => ({ ...l, [label.key]: label.label }));
                            updateItem(i, patch);
                          }}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        {!locked && (
                          <button type="button" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => removeItem(i)} aria-label={`Remove line ${i + 1}`}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!bill.items.length && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                      No items yet.{' '}
                      {!locked && (
                        <button type="button" className="font-semibold text-[#4f8f1c] hover:underline" onClick={addItem}>
                          Add the first line
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-6 border-t border-gray-100 px-4 py-2 text-xs text-gray-600">
            <span>Total qty: <b className="tabular-nums">{summary.totalQty}</b></span>
            <span>Items add up to: <b className="tabular-nums">{inr(summary.lineSum)}</b></span>
          </div>
        </div>
      )}

      {/* Totals, words, payment */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-gray-900">
            Totals & GST <ConfidenceDot value={conf.totals} />
          </h3>
          <div className="space-y-2">
            {(
              [
                ['subtotal', 'Subtotal (before tax)'],
                ['discount', 'Bill discount'],
                ['cgst', 'CGST ₹'],
                ['sgst', 'SGST ₹'],
                ['igst', 'IGST ₹'],
                ['cess', 'Cess ₹'],
                ['otherCharges', 'Other charges'],
                ['roundOff', 'Round off (±)'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2" data-field={`totals.${key}`}>
                <label className="flex-1 text-xs text-gray-600">{label}</label>
                <div className="w-36 shrink-0">
                  <NumField value={bill.totals[key]} disabled={locked} onChange={(v) => updateTotals({ [key]: v })} ariaLabel={label} />
                </div>
              </div>
            ))}
            {!locked && bill.items.length > 0 && bill.totals.subtotal !== summary.lineSum && (
              <button type="button" className="text-[11px] font-semibold text-[#4f8f1c] hover:underline" onClick={() => updateTotals({ subtotal: summary.lineSum })}>
                Use items total {inr(summary.lineSum)} as subtotal
              </button>
            )}
            <div className="flex items-center gap-2 border-t border-gray-100 pt-2" data-field="totals.grandTotal">
              <label className="flex-1 text-sm font-bold text-gray-900">Grand total</label>
              <div className="w-36 shrink-0">
                <NumField
                  className={`font-bold ${warnings.some((w) => w.field === 'totals.grandTotal') ? 'border-amber-400' : ''}`}
                  value={bill.totals.grandTotal}
                  disabled={locked}
                  onChange={(v) => updateTotals({ grandTotal: v })}
                  ariaLabel="Grand total"
                />
              </div>
            </div>
            {!locked && summary.billTotal !== null && Math.abs(summary.computedTotal - summary.billTotal) > 1 && Math.abs(summary.computedTaxIncluded - summary.billTotal) > 1 && (
              <button type="button" className="text-[11px] font-semibold text-[#4f8f1c] hover:underline" onClick={() => updateTotals({ grandTotal: summary.computedTotal })}>
                Use calculated total {inr(summary.computedTotal)}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-bold text-gray-900">Amount in words</h3>
            <label className="mb-1 block text-[11px] text-gray-500">As printed on the bill</label>
            <input className={inputCls} value={bill.amountInWords || ''} disabled={locked} onChange={(e) => update({ amountInWords: e.target.value })} placeholder="Rupees … Only" />
            {summary.billTotal !== null && (
              <div className="mt-2 flex items-start gap-1.5 text-[11px]">
                {summary.wordsAmount === null ? (
                  <Info size={13} className="mt-0.5 shrink-0 text-gray-400" />
                ) : Math.abs(summary.wordsAmount - summary.billTotal) <= 1 ? (
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle size={13} className="mt-0.5 shrink-0 text-red-600" />
                )}
                <span className="text-gray-600">
                  Grand total in words: <i>{amountToIndianWords(summary.billTotal)}</i>
                  {summary.wordsAmount !== null && Math.abs(summary.wordsAmount - summary.billTotal) > 1 && (
                    <span className="block font-semibold text-red-600">Printed words say {inr(summary.wordsAmount)}. Check the total.</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {!isSlip && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-gray-900">Payment</h3>
              <div className="grid grid-cols-2 gap-3">
                <div data-field="paymentMode">
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Payment Mode</label>
                  <select className={inputCls} value={bill.paymentMode || ''} disabled={locked} onChange={(e) => update({ paymentMode: (e.target.value || null) as ReviewBill['paymentMode'] })}>
                    {PAYMENT_MODES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div data-field="paymentStatus">
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Status</label>
                  <select className={inputCls} value={bill.paymentStatus || ''} disabled={locked} onChange={(e) => update({ paymentStatus: (e.target.value || null) as ReviewBill['paymentStatus'] })}>
                    {PAYMENT_STATUSES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2" data-field="amountPaid">
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Amount paid (if shown)</label>
                  <NumField value={bill.amountPaid} disabled={locked} onChange={(v) => update({ amountPaid: v })} placeholder={bill.paymentStatus === 'paid' ? 'Full amount' : '0'} ariaLabel="Amount paid" />
                  {summary.billTotal !== null && (
                    <p className="mt-1 text-[11px] text-gray-500">
                      {isPurchase ? 'Balance owed to the supplier' : 'Balance due'}:{' '}
                      <b>
                        {inr(
                          r2(
                            summary.billTotal -
                              (typeof bill.amountPaid === 'number' ? Math.min(bill.amountPaid, summary.billTotal) : bill.paymentStatus === 'paid' ? summary.billTotal : 0)
                          )
                        )}
                      </b>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="mb-1 block text-xs font-semibold text-gray-600">Notes</label>
        <textarea className={`${inputCls} min-h-[56px]`} value={bill.notes || ''} disabled={locked} onChange={(e) => update({ notes: e.target.value })} />
      </div>

      {/* Warnings */}
      {(warnings.length > 0 || confirmErrors.length > 0) && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" aria-live="polite">
          <h3 className="mb-2 text-sm font-bold text-gray-900">Check before saving</h3>
          <ul className="space-y-1.5">
            {confirmErrors.map((m) => (
              <li key={m} className="flex gap-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
                <AlertCircle size={14} className="mt-0.5 shrink-0" /> {m}
              </li>
            ))}
            {warnings.map((w, i) => (
              <li key={`${w.code}-${i}`}>
                <button
                  type="button"
                  onClick={() => focusField(w.field)}
                  className={`flex w-full gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs ${
                    w.severity === 'error' ? 'bg-red-50 text-red-800' : w.severity === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-gray-50 text-gray-600'
                  }`}
                >
                  {w.severity === 'error' ? <AlertCircle size={14} className="mt-0.5 shrink-0" /> : w.severity === 'warning' ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <Info size={14} className="mt-0.5 shrink-0" />}
                  <span>{w.message}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="sticky bottom-0 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        {!locked && (
          <>
            <button type="button" className={btn.danger} onClick={discard} disabled={busy !== null}>
              {busy === 'discard' ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Discard
            </button>
            {scan.files?.some((f) => f.publicId) && (
              <button type="button" className={btn.secondary} onClick={rescan} disabled={busy !== null}>
                {busy === 'rescan' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Re-scan
              </button>
            )}
          </>
        )}
        <button type="button" className={btn.secondary} onClick={csv} disabled={busy !== null}>
          {busy === 'csv' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} CSV
        </button>
        <button type="button" className={btn.secondary} onClick={() => exportBillPdf(bill, `${fileBase}.pdf`)} disabled={busy !== null}>
          <FileText size={15} /> PDF
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          {!locked && (
            <>
              <button type="button" className={btn.secondary} onClick={() => save()} disabled={busy !== null || !dirty}>
                {busy === 'save' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save draft
              </button>
              <button type="button" className={isPurchase ? btn.secondary : btn.primary} onClick={() => confirm(false)} disabled={busy !== null}>
                {busy === 'confirm' ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Confirm & Save
              </button>
              {isPurchase && (
                <button type="button" className={btn.primary} onClick={() => confirm(true)} disabled={busy !== null} title="Save stock and the purchase entry, and add the bill to the supplier ledger">
                  {busy === 'ledger' ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Confirm & Sync to Ledger
                </button>
              )}
            </>
          )}
          {ledgerPending && (
            <button type="button" className={btn.primary} onClick={syncLedgerLater} disabled={busy !== null}>
              {busy === 'ledger' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Sync to Ledger
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The admin theme (styles/premium.css) gives every td 12×16 px padding and every input 42 px
 * height + 14 px padding, with !important. That leaves no room for numbers in a 10-column
 * table, so the items table gets a compact variant (more specific selectors win).
 */
const ITEMS_TABLE_CSS = `
.premium-theme .scanbill-items thead th { padding: 8px 6px !important; font-size: 10px !important; position: static !important; }
.premium-theme .scanbill-items td { padding: 6px 4px !important; vertical-align: top; }
.premium-theme .scanbill-items input,
.premium-theme .scanbill-items select { height: 34px !important; padding: 4px 8px !important; border-radius: 8px !important; font-size: 13px !important; }
.premium-theme .scanbill-items input[type="number"] { padding: 4px 6px !important; }
`;

/** What a confirmed scan changed, with links to where it shows up. */
function SavedSummary({ scan }: { scan: ScannedDocument }) {
  const s = scan.sync || {};
  const lines: Array<JSX.Element | string> = [];
  if (s.stockMovements) lines.push(`Stock updated for ${s.stockMovements} item${s.stockMovements === 1 ? '' : 's'}`);
  if (s.createdProducts?.length) lines.push(`${s.createdProducts.length} new product${s.createdProducts.length === 1 ? '' : 's'} created`);
  if (s.purchaseEntryId)
    lines.push(
      <span key="pe">
        Purchase entry {s.purchaseEntryId} ·{' '}
        <Link to="/admin/purchase/report" className="font-semibold underline">
          Purchase Report
        </Link>
      </span>
    );
  if (s.supplierId)
    lines.push(
      <span key="sl">
        Supplier ledger {typeof s.ledgerAmount === 'number' ? `+${inr(s.ledgerAmount)} due` : 'updated'} ·{' '}
        <Link to={`/admin/pos/suppliers/${s.supplierId}`} className="font-semibold underline">
          Open supplier
        </Link>
      </span>
    );
  if (s.orderNumber)
    lines.push(
      <span key="or">
        POS order #{s.orderNumber} ·{' '}
        <Link to="/admin/pos/report" className="font-semibold underline">
          POS Report
        </Link>
      </span>
    );
  if (scan.docType === 'expense') lines.push('Expense stored with the scan');
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
      <div className="flex items-center gap-1.5 font-semibold">
        <CheckCircle2 size={16} /> Saved{s.at ? ` on ${new Date(s.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
      </div>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
