import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
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

/** cell: the whole status cell is filled with the colour (like a reconciliation sheet); dot: the summary counters */
const STATUS: Record<Status, { label: string; cell: string; dot: string }> = {
  full: { label: 'Fully matched', cell: 'bg-[#2fbf4a]', dot: 'bg-[#2fbf4a]' },
  partial: { label: 'Partially matched', cell: 'bg-[#f59e0b]', dot: 'bg-[#f59e0b]' },
  missing: { label: 'Missing', cell: 'bg-[#d81b3f]', dot: 'bg-[#d81b3f]' },
};

interface Row {
  key: string;
  label: string;
  /** Value as on the bill (what Edit changes) */
  value: string;
  /** What it matched in your records, or why it isn't fully matched */
  note: string;
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
  const simple = (key: string, label: string, field: string, value: string, confidence: number | null | undefined, edit: Row['edit'], clear: () => void) => {
    const status = readStatus(value, confidence, field);
    rows.push({
      key,
      label,
      value,
      note: readNote(status, field, 'Read clearly from the bill'),
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
    { kind: 'text', apply: (v) => onUpdate({ invoiceNumber: v }) }, () => onUpdate({ invoiceNumber: '' }));
  simple('invoiceDate', 'Bill date', 'invoiceDate', bill.invoiceDate ? isoToIN(bill.invoiceDate) : dateText, conf.invoiceDate,
    { kind: 'date', apply: (v) => { onDateText(v); onUpdate({ invoiceDate: inToIso(v) }); } }, () => { onDateText(''); onUpdate({ invoiceDate: null }); });
  if (!isSlip) {
    simple('gstin', 'GSTIN', 'party.gstin', bill.party.gstin || '', conf.party,
      { kind: 'text', apply: (v) => onUpdate({ party: { ...bill.party, gstin: v.toUpperCase() } }) }, () => onUpdate({ party: { ...bill.party, gstin: '' } }));
    const total = bill.totals.grandTotal;
    simple('grandTotal', 'Grand total', 'totals.grandTotal', typeof total === 'number' ? String(total) : '', conf.totals,
      { kind: 'number', apply: (v) => onUpdate({ totals: { ...bill.totals, grandTotal: v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v) } }) },
      () => onUpdate({ totals: { ...bill.totals, grandTotal: null } }));
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
    setEditing(row.key);
    setDraft(row.value);
  };
  const commitEdit = (row: Row) => {
    row.edit?.apply(draft);
    setEditing(null);
  };

  if (!rows.length) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-bold text-gray-900">Match status</h3>
        <div className="flex flex-wrap gap-2 text-xs">
          {(Object.keys(STATUS) as Status[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-gray-700">
              <span className={`h-2.5 w-2.5 rounded-sm ${STATUS[s].dot}`} />
              {STATUS[s].label}: <b className="tabular-nums">{counts[s]}</b>
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">On the bill</th>
              <th className="px-3 py-2 text-center">Match status</th>
              <th className="px-3 py-2">In your records / why</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.key} className="align-top">
                <td className="px-3 py-2 font-medium text-gray-700">
                  <button type="button" className="text-left hover:underline" onClick={() => focusField(row.field)} title="Show this field in the form">
                    {row.label}
                  </button>
                </td>
                <td className="px-3 py-2">
                  {editing === row.key ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        className={`${inputCls} min-w-[140px]`}
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
                      <span className={`break-words ${row.value ? 'text-gray-900' : 'italic text-gray-400'}`}>{row.value || 'blank'}</span>
                      {!locked && row.edit && (
                        <button type="button" className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" onClick={() => startEdit(row)} aria-label={`Edit ${row.label}`} title="Edit">
                          <Pencil size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className={`px-3 py-2 text-center align-middle ${STATUS[row.status].cell}`}>
                  <span className="inline-flex whitespace-nowrap rounded-full border border-white/80 bg-white/10 px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
                    {STATUS[row.status].label}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">{row.note}</td>
                <td className="px-3 py-2">
                  <select
                    className={`${inputCls} min-w-[170px] text-xs`}
                    value={row.action}
                    disabled={locked || row.actions.length < 2}
                    onChange={(e) => row.onAction?.(e.target.value)}
                    aria-label={`Action for ${row.label}`}
                  >
                    {row.actions.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
