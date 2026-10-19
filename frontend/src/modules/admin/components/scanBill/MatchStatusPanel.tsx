import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BarChart3, Check, CheckCircle2, ChevronLeft, ChevronRight, Pencil, ShieldCheck, TableProperties, X, XCircle } from 'lucide-react';
import type { BillItem, ReviewBill, ScanMatches, ScanWarning } from '../../../../services/api/admin/scanBillService';
import { confidenceTone, inToIso, isoToIN } from '../../scanBill/billMath';
import { optionKey } from './ProductPicker';
import { inputCls } from './scanBillUi';

/**
 * How well the AI read each field from the bill, like a reconciliation sheet:
 *   Fully matched     – read clearly from the bill
 *   Partially matched – the AI wasn't sure of the reading, or an error that blocks saving is on it
 *   Missing           – blank on the bill
 * Whether a value is already in your records (saved supplier, product in the catalogue) and any
 * check that flags it are shown alongside, not mixed into the status. Every row can be edited in
 * place and has an action (Allow, Link to…, Add as new, Exclude) that maps onto what saving does.
 */
type Status = 'full' | 'partial' | 'missing';

/** Field-mapping look: a coloured stripe on the row, and a soft pill with an icon */
const STATUS: Record<Status, { label: string; pill: string; stripe: string; dot: string; Icon: typeof CheckCircle2 }> = {
  full: { label: 'Fully Matched', pill: 'bg-emerald-50 text-emerald-700', stripe: 'border-l-emerald-500', dot: 'bg-emerald-500', Icon: CheckCircle2 },
  partial: { label: 'Partial Matched', pill: 'bg-amber-50 text-amber-700', stripe: 'border-l-amber-500', dot: 'bg-amber-500', Icon: AlertTriangle },
  missing: { label: 'Not Matched', pill: 'bg-red-50 text-red-600', stripe: 'border-l-red-500', dot: 'bg-red-500', Icon: XCircle },
};
const PAGE_SIZE = 10;
type Tab = 'mapping' | 'summary' | 'validation';

interface Row {
  key: string;
  label: string;
  /** Value as on the bill (what Edit changes) */
  value: string;
  /** What it matched in your records, or why it isn't fully matched */
  note: string;
  /** Kind of value read from the bill (shown under the source field) */
  sourceType: string;
  /** Where it is saved: a saved record, a new one, or nothing (excluded) */
  target: string;
  targetType: string;
  /** The row needs a decision (link / add / exclude) even if it was read clearly */
  needsMapping?: boolean;
  status: Status;
  field: string;
  edit?: { kind: 'text' | 'number' | 'date'; apply: (v: string) => void };
  actions: Array<{ value: string; label: string }>;
  action: string;
  onAction?: (value: string) => void;
}

interface Props {
  bill: ReviewBill;
  matches: ScanMatches | null;
  warnings: ScanWarning[];
  labels: Record<string, string>;
  locked: boolean;
  dateText: string;
  onUpdate: (patch: Partial<ReviewBill>) => void;
  onUpdateItem: (index: number, patch: Partial<BillItem>) => void;
  onDateText: (text: string) => void;
  focusField: (field?: string) => void;
}

export default function MatchStatusPanel({ bill, matches, warnings, labels, locked, dateText, onUpdate, onUpdateItem, onDateText, focusField }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState<Tab>('mapping');
  const [page, setPage] = useState(0);
  const [mapOpen, setMapOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the Map menu on a click elsewhere
  useEffect(() => {
    if (!mapOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMapOpen(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [mapOpen]);

  const conf = bill.confidence || {};
  const isSales = bill.docType === 'sales';
  const isSlip = bill.docType === 'stock_slip';
  const isExpense = bill.docType === 'expense';
  const flagged = (field: string) => warnings.filter((w) => w.severity !== 'info' && (w.field === field || w.field?.startsWith(`${field}.`)));
  const unsure = (v?: number | null) => {
    const tone = confidenceTone(v);
    return tone === 'medium' || tone === 'low';
  };
  const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === '';
  /** Blank = missing; unsure reading or a blocking error on the field = partial; otherwise fully matched */
  const readStatus = (value: unknown, confidence: number | null | undefined, field: string): Status =>
    blank(value) ? 'missing' : unsure(confidence) || flagged(field).some((w) => w.severity === 'error') ? 'partial' : 'full';
  /** What the "why" column says: a check that flags the field, else how it was read */
  const readNote = (status: Status, field: string, fallback: string) => {
    const issue = flagged(field).sort((a, b) => (a.severity === 'error' ? -1 : 0) - (b.severity === 'error' ? -1 : 0))[0];
    if (issue) return `${status === 'missing' ? 'Not found on the bill. ' : ''}${issue.message.trim().replace(/([^.!?])$/, '$1.')}`;
    if (status === 'missing') return 'Not found on the bill.';
    if (status === 'partial') return 'AI was not fully sure. Check it against the bill.';
    return fallback;
  };

  const rows: Row[] = [];

  // Supplier / customer
  if (!isSlip) {
    const kind = isSales ? 'customer' : 'supplier';
    const linkedId = isSales ? bill.party.customerId : bill.party.supplierId;
    const best = matches?.party?.best;
    const name = bill.party.name || '';
    const status: Status = blank(name) && !linkedId ? 'missing' : readStatus(name || 'linked', conf.party, 'party.name');
    const records = linkedId
      ? best && best.id === linkedId
        ? `Linked to your saved ${kind} "${best.name}"`
        : `Linked to a saved ${kind}`
      : best && matches?.party?.status !== 'new'
        ? `Looks like your saved ${kind} "${best.name}". Choose "Link to" to use it`
        : `Not in your ${kind}s yet. "Add as new" saves it as a new ${kind}`;
    const idKey = isSales ? 'customerId' : 'supplierId';
    rows.push({
      key: 'party',
      label: isSales ? 'Customer' : 'Supplier',
      value: name,
      note: status === 'full' ? records : `${readNote(status, 'party.name', '')} ${records}`.trim(),
      sourceType: 'Name',
      target: linkedId ? (best && best.id === linkedId ? best.name : `Saved ${kind}`) : name ? `New ${kind}: ${name}` : '-',
      targetType: linkedId ? `Saved ${kind}` : `New ${kind}`,
      needsMapping: !linkedId && !!best && matches?.party?.status !== 'new',
      status,
      field: 'party.name',
      edit: { kind: 'text', apply: (v) => onUpdate({ party: { ...bill.party, name: v, [idKey]: null } }) },
      actions: [
        ...(best ? [{ value: 'link', label: `Link to "${best.name}"` }] : []),
        { value: 'new', label: `Add as new ${kind}` },
      ],
      action: linkedId ? 'link' : 'new',
      onAction: (a) => {
        if (a === 'link' && best) onUpdate({ party: { ...bill.party, [idKey]: best.id, name: bill.party.name || best.name } });
        if (a === 'new') onUpdate({ party: { ...bill.party, [idKey]: null } });
      },
    });
  }

  /** A plain field: Allow keeps the reading, Exclude clears it */
  const simple = (
    key: string,
    label: string,
    field: string,
    value: string,
    confidence: number | null | undefined,
    edit: Row['edit'],
    clear: () => void,
    sourceType: string,
    target: string
  ) => {
    const status = readStatus(value, confidence, field);
    rows.push({
      key,
      label,
      value,
      note: readNote(status, field, 'Read clearly from the bill'),
      sourceType,
      target: value ? target : '-',
      targetType: sourceType,
      status,
      field,
      edit,
      actions: [
        { value: 'keep', label: 'Allow' },
        { value: 'exclude', label: 'Exclude (clear it)' },
      ],
      action: 'keep',
      onAction: (a) => a === 'exclude' && clear(),
    });
  };

  simple('invoiceNumber', 'Bill no.', 'invoiceNumber', bill.invoiceNumber || '', conf.invoiceNumber,
    { kind: 'text', apply: (v) => onUpdate({ invoiceNumber: v }) }, () => onUpdate({ invoiceNumber: '' }), 'Text', 'Bill no.');
  simple('invoiceDate', 'Bill date', 'invoiceDate', bill.invoiceDate ? isoToIN(bill.invoiceDate) : dateText, conf.invoiceDate,
    { kind: 'date', apply: (v) => { onDateText(v); onUpdate({ invoiceDate: inToIso(v) }); } }, () => { onDateText(''); onUpdate({ invoiceDate: null }); }, 'Date', 'Bill date');
  if (!isSlip) {
    simple('gstin', 'GSTIN', 'party.gstin', bill.party.gstin || '', conf.party,
      { kind: 'text', apply: (v) => onUpdate({ party: { ...bill.party, gstin: v.toUpperCase() } }) }, () => onUpdate({ party: { ...bill.party, gstin: '' } }), 'GSTIN', `${isSales ? 'Customer' : 'Supplier'} GSTIN`);
    const total = bill.totals.grandTotal;
    simple('grandTotal', 'Grand total', 'totals.grandTotal', typeof total === 'number' ? String(total) : '', conf.totals,
      { kind: 'number', apply: (v) => onUpdate({ totals: { ...bill.totals, grandTotal: v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v) } }) },
      () => onUpdate({ totals: { ...bill.totals, grandTotal: null } }), 'Amount', 'Bill total');
  }

  // Item lines: the status is the reading; the action decides what happens to stock
  if (!isExpense) {
    bill.items.forEach((it, i) => {
      const m = matches?.items?.[i];
      const best = m?.best;
      const bestLabel = best ? (best.variant ? `${best.name} · ${best.variant}` : best.name) : '';
      const name = it.name || '';
      const status = readStatus(name, it.confidence ?? conf.items, `items.${i}`);
      const linked = it.action === 'link' && !!it.productId;
      const linkedToBest = linked && !!best && best.productId === it.productId && (best.variationId || null) === (it.variationId || null);
      const linkedLabel = linked ? labels[optionKey(it.productId, it.variationId)] : '';
      const records = linked
        ? `Linked to ${linkedLabel ? `"${linkedLabel}"` : 'a product in your catalogue'}`
        : it.action === 'create'
          ? 'Not in your catalogue. Added as a new product when you save'
          : best && m?.status !== 'new'
            ? `Looks like "${bestLabel}" in your catalogue. Choose "Link to" to use it`
            : 'Not in your catalogue. Choose "Add as new" to add it, or it is excluded';
      rows.push({
        key: `item-${i}`,
        label: `Item ${i + 1}`,
        value: name,
        note: status === 'full' ? records : `${readNote(status, `items.${i}`, '')} ${records}`.trim(),
        sourceType: `Item · qty ${it.quantity ?? '-'}`,
        target: linked ? linkedLabel || 'Product in catalogue' : it.action === 'create' ? `New product: ${name}` : '-',
        targetType: linked ? 'Product' : it.action === 'create' ? 'New product' : 'Excluded',
        needsMapping: !linked && it.action !== 'create',
        status,
        field: `items.${i}`,
        edit: { kind: 'text', apply: (v) => onUpdateItem(i, { name: v }) },
        actions: [
          ...(best ? [{ value: 'link', label: `Link to "${bestLabel}"` }] : []),
          ...(linked && !linkedToBest ? [{ value: 'linked', label: `Allow (keep link${linkedLabel ? ` to "${linkedLabel}"` : ''})` }] : []),
          { value: 'create', label: 'Add as new product' },
          { value: 'skip', label: 'Exclude (no stock change)' },
        ],
        action: linked ? (linkedToBest ? 'link' : 'linked') : it.action === 'create' ? 'create' : 'skip',
        onAction: (a) => {
          if (a === 'link' && best) onUpdateItem(i, { action: 'link', productId: best.productId, variationId: best.variationId ?? null });
          if (a === 'create') onUpdateItem(i, { action: 'create', productId: null, variationId: null });
          if (a === 'skip') onUpdateItem(i, { action: 'skip', productId: null, variationId: null });
        },
      });
    });
  }

  const counts = rows.reduce<Record<Status, number>>((acc, r) => ({ ...acc, [r.status]: acc[r.status] + 1 }), { full: 0, partial: 0, missing: 0 });

  const startEdit = (row: Row) => {
    setMapOpen(null);
    setEditing(row.key);
    setDraft(row.value);
  };
  const commitEdit = (row: Row) => {
    row.edit?.apply(draft);
    setEditing(null);
  };

  if (!rows.length) return null;

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  // Summary figures
  const itemRows = bill.items.length;
  const linkedItems = bill.items.filter((it) => it.action === 'link' && it.productId).length;
  const newItems = bill.items.filter((it) => it.action === 'create').length;
  const excludedItems = itemRows - linkedItems - newItems;
  const amountLinked = bill.items.reduce((sum, it) => sum + (it.action === 'link' && it.productId ? Number(it.amount) || 0 : 0), 0);
  const money = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const blocking = warnings.filter((w) => w.severity === 'error');

  const tabs: Array<{ id: Tab; label: string; Icon: typeof CheckCircle2; badge?: number }> = [
    { id: 'mapping', label: 'Field Mapping', Icon: TableProperties },
    { id: 'summary', label: 'Summary', Icon: BarChart3 },
    { id: 'validation', label: 'Validation', Icon: ShieldCheck, badge: warnings.length || undefined },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 px-3" role="tablist">
        {tabs.map(({ id, label, Icon, badge }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${
              tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon size={16} />
            {label}
            {badge ? <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800">{badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'mapping' && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
                <tr>
                  <th className="w-12 px-3 py-2.5 text-center">#</th>
                  <th className="px-3 py-2.5">Source Field</th>
                  <th className="px-3 py-2.5">Target Field</th>
                  <th className="px-3 py-2.5">Match Status</th>
                  <th className="w-28 px-3 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((row, idx) => {
                  const st = STATUS[row.status];
                  const needsMap = row.status !== 'full' || !!row.needsMapping;
                  return (
                    <tr key={row.key} className="align-middle">
                      <td className={`border-l-4 ${st.stripe} px-3 py-2.5 text-center text-gray-500`}>{current * PAGE_SIZE + idx + 1}</td>
                      <td className="px-3 py-2.5">
                        {editing === row.key ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              className={`${inputCls} min-w-[160px]`}
                              value={draft}
                              inputMode={row.edit?.kind === 'number' ? 'decimal' : undefined}
                              placeholder={row.edit?.kind === 'date' ? 'DD/MM/YYYY' : undefined}
                              onChange={(e) => setDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit(row);
                                if (e.key === 'Escape') setEditing(null);
                              }}
                              aria-label={`Edit ${row.label}`}
                            />
                            <button type="button" className="rounded p-1 text-emerald-600 hover:bg-emerald-50" onClick={() => commitEdit(row)} aria-label="Save edit">
                              <Check size={14} />
                            </button>
                            <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100" onClick={() => setEditing(null)} aria-label="Cancel edit">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-1.5">
                            <div className="min-w-0">
                              <button type="button" className="text-left text-[13px] font-semibold uppercase tracking-wide text-gray-800 hover:underline" onClick={() => focusField(row.field)} title="Show this field in the form">
                                {row.label}
                              </button>
                              <div className={`break-words text-xs ${row.value ? 'text-gray-700' : 'italic text-gray-400'}`}>{row.value || 'blank'}</div>
                              <div className="text-[10px] uppercase tracking-wide text-gray-400">({row.sourceType})</div>
                            </div>
                            {!locked && row.edit && (
                              <button type="button" className="mt-0.5 shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" onClick={() => startEdit(row)} aria-label={`Edit ${row.label}`} title="Edit">
                                <Pencil size={13} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className={`break-words text-[13px] font-semibold ${row.target === '-' ? 'text-gray-400' : 'text-gray-800'}`}>{row.target}</div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-400">({row.targetType})</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${st.pill}`}>
                          <st.Icon size={14} />
                          {st.label}
                        </span>
                        <div className="mt-1 max-w-[280px] text-[11px] leading-snug text-gray-500">{row.note}</div>
                      </td>
                      <td className="relative px-3 py-2.5 text-center">
                        {needsMap && !locked ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setMapOpen((k) => (k === row.key ? null : row.key))}
                              className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                              aria-haspopup="menu"
                              aria-expanded={mapOpen === row.key}
                            >
                              Map
                            </button>
                            {mapOpen === row.key && (
                              <div ref={menuRef} role="menu" className="absolute right-3 top-full z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-1 text-left shadow-lg">
                                {row.edit && (
                                  <button type="button" role="menuitem" onClick={() => startEdit(row)} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                                    <Pencil size={13} /> Edit the value
                                  </button>
                                )}
                                {row.actions.map((a) => (
                                  <button
                                    key={a.value}
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={row.action === a.value}
                                    onClick={() => {
                                      row.onAction?.(a.value);
                                      setMapOpen(null);
                                    }}
                                    className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs hover:bg-gray-50 ${row.action === a.value ? 'font-semibold text-blue-700' : 'text-gray-700'}`}
                                  >
                                    <span className="w-3.5">{row.action === a.value ? <Check size={13} /> : null}</span>
                                    {a.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <button type="button" className="rounded border border-gray-200 p-1 disabled:opacity-40" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: pages }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`min-w-[28px] rounded px-2 py-1 font-semibold ${n === current ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {n + 1}
                </button>
              ))}
              <button type="button" className="rounded border border-gray-200 p-1 disabled:opacity-40" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page">
                <ChevronRight size={14} />
              </button>
            </div>
            <span>
              Showing {current * PAGE_SIZE + 1} - {Math.min(rows.length, (current + 1) * PAGE_SIZE)} of {rows.length} fields
            </span>
          </div>
        </>
      )}

      {tab === 'summary' && (
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(STATUS) as Status[]).map((st) => {
            const S = STATUS[st];
            return (
              <div key={st} className={`rounded-lg border border-gray-200 border-l-4 ${S.stripe} p-3`}>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                  <S.Icon size={14} /> {S.label}
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{counts[st]}</div>
                <div className="text-[11px] text-gray-400">of {rows.length} fields</div>
              </div>
            );
          })}
          <div className="rounded-lg border border-gray-200 border-l-4 border-l-blue-500 p-3">
            <div className="text-xs font-semibold text-gray-500">Bill total</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-gray-900">₹{money(Number(bill.totals.grandTotal) || 0)}</div>
            <div className="text-[11px] text-gray-400">₹{money(amountLinked)} on items linked to products</div>
          </div>
          {!isExpense && (
            <div className="rounded-lg border border-gray-200 p-3 sm:col-span-2 lg:col-span-3">
              <div className="text-xs font-semibold text-gray-500">Items ({itemRows})</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">{linkedItems} linked to products</span>
                <span className="rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-violet-700">{newItems} added as new products</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-600">{excludedItems} excluded (no stock change)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'validation' && (
        <div className="p-4">
          {warnings.length === 0 ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 size={16} /> All checks passed
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs text-gray-500">
                {blocking.length ? `${blocking.length} must be fixed before saving` : 'Nothing blocks saving'} · {warnings.length - blocking.length} to review
              </p>
              <ul className="space-y-1.5">
                {warnings.map((w, i) => (
                  <li key={`${w.code}-${i}`}>
                    <button
                      type="button"
                      onClick={() => focusField(w.field)}
                      className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs ${
                        w.severity === 'error' ? 'bg-red-50 text-red-800' : w.severity === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-gray-50 text-gray-600'
                      }`}
                    >
                      {w.severity === 'error' ? <XCircle size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
                      <span>{w.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
