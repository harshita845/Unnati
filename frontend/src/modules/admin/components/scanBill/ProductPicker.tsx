import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, Plus, Search, SkipForward } from 'lucide-react';
import { getPOSProducts } from '../../../../services/api/admin/adminProductService';
import type { BillItem, ItemMatch, MatchCandidate } from '../../../../services/api/admin/scanBillService';
import { MatchBadge, inputCls } from './scanBillUi';

/**
 * Per line: which catalogue product the scanned item is. Shows the badge
 * (Matched / Similar / New / Create / Skip) and a menu to pick a suggestion, search the
 * catalogue, quick-create a product or skip the line.
 */

export interface ProductOption {
  productId: string;
  variationId?: string;
  label: string;
  stock?: number;
}

export const optionKey = (productId?: string | null, variationId?: string | null) => `${productId || ''}:${variationId || ''}`;

const candidateOption = (c: MatchCandidate): ProductOption => ({
  productId: c.productId,
  variationId: c.variationId,
  label: c.variant ? `${c.name} · ${c.variant}` : c.name,
  stock: c.stock,
});

interface Props {
  item: BillItem;
  match?: ItemMatch;
  labels: Record<string, string>;
  categories: Array<{ _id: string; name: string }>;
  disabled?: boolean;
  onChange: (patch: Partial<BillItem>, label?: { key: string; label: string }) => void;
}

export function badgeFor(item: BillItem, match?: ItemMatch): 'matched' | 'similar' | 'new' | 'create' | 'skip' {
  if (item.action === 'link') return 'matched';
  if (item.action === 'create') return 'create';
  if (match?.status === 'similar') return 'similar';
  if (match?.status === 'new' || !match) return 'new';
  return 'skip';
}

export default function ProductPicker({ item, match, labels, categories, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductOption[]>([]);
  const [searching, setSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const badge = badgeFor(item, match);
  const linkedLabel = item.action === 'link' ? labels[optionKey(item.productId, item.variationId)] || 'Linked product' : null;
  const suggestion = match?.best && item.action === 'skip' && match.status === 'similar' ? candidateOption(match.best) : null;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // Catalogue search (debounced), one option per variant
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await getPOSProducts({ search: query.trim() } as any);
        const rows: ProductOption[] = [];
        for (const p of (res.data || []).slice(0, 15) as any[]) {
          const variants: any[] = Array.isArray(p.variations) && p.variations.length ? p.variations : [{}];
          for (const v of variants) {
            rows.push({
              productId: p._id,
              variationId: v._id,
              label: variants.length > 1 ? `${p.productName} · ${v.value || v.name || ''}` : p.productName,
              stock: v.stock,
            });
          }
        }
        setResults(rows.slice(0, 25));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, open]);

  const pick = (o: ProductOption) => {
    onChange({ action: 'link', productId: o.productId, variationId: o.variationId ?? null }, { key: optionKey(o.productId, o.variationId), label: o.label });
    setOpen(false);
  };

  const candidates = (match?.candidates || []).map(candidateOption);

  return (
    <div className="relative min-w-0" ref={ref}>
      <div className="flex items-center gap-1.5">
        <MatchBadge status={badge} />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center justify-between gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-left text-xs text-gray-700 hover:border-gray-300 disabled:bg-gray-50"
        >
          <span className="truncate">
            {linkedLabel || (item.action === 'create' ? 'New product on save' : suggestion ? `Use “${suggestion.label}”?` : item.action === 'skip' ? 'Not linked (no stock change)' : '')}
          </span>
          <ChevronDown size={14} className="shrink-0 text-gray-400" />
        </button>
      </div>
      {suggestion && !disabled && (
        <button type="button" onClick={() => pick(suggestion)} className="mt-1 text-[11px] font-semibold text-[#4f8f1c] hover:underline">
          Yes, use it
        </button>
      )}
      {item.action === 'create' && (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <select
            className={`${inputCls} py-1 text-xs`}
            value={item.categoryId || ''}
            disabled={disabled}
            onChange={(e) => onChange({ categoryId: e.target.value || null })}
            aria-label="Category for the new product"
          >
            <option value="">Category…</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            className={`${inputCls} py-1 text-xs`}
            type="number"
            min={0}
            step="0.01"
            placeholder="Selling ₹"
            value={item.sellingPrice ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ sellingPrice: e.target.value === '' ? null : Number(e.target.value) })}
            aria-label="Selling price for the new product"
          />
        </div>
      )}

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-80 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
          {candidates.length > 0 && (
            <>
              <div className="px-1.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Suggestions</div>
              {candidates.map((o, i) => (
                <button
                  key={optionKey(o.productId, o.variationId)}
                  type="button"
                  onClick={() => pick(o)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-gray-50"
                >
                  <span className="truncate">{o.label}</span>
                  <span className="shrink-0 text-[10px] text-gray-400">
                    {Math.round((match!.candidates[i].score || 0) * 100)}% · stock {o.stock ?? 0}
                  </span>
                </button>
              ))}
              <div className="my-1.5 h-px bg-gray-100" />
            </>
          )}
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus className={`${inputCls} pl-7 text-xs`} placeholder="Search products, SKU or barcode" value={query} onChange={(e) => setQuery(e.target.value)} />
            {searching && <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {results.map((o) => (
              <button key={optionKey(o.productId, o.variationId)} type="button" onClick={() => pick(o)} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-gray-50">
                <span className="truncate">{o.label}</span>
                <span className="shrink-0 text-[10px] text-gray-400">stock {o.stock ?? 0}</span>
              </button>
            ))}
            {query.trim().length >= 2 && !searching && !results.length && <div className="px-2 py-2 text-xs text-gray-400">No products found.</div>}
          </div>
          <div className="mt-1.5 flex gap-1.5 border-t border-gray-100 pt-1.5">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-violet-50 px-2 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
              onClick={() => {
                onChange({ action: 'create', productId: null, variationId: null, sellingPrice: item.sellingPrice ?? item.mrp ?? null });
                setOpen(false);
              }}
            >
              <Plus size={13} /> Create new product
            </button>
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-gray-50 px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              onClick={() => {
                onChange({ action: 'skip', productId: null, variationId: null });
                setOpen(false);
              }}
            >
              <SkipForward size={13} /> Skip line
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
