import { useEffect, useRef, useState } from 'react';
import { Link2, Loader2, X } from 'lucide-react';
import { getAllSuppliers } from '../../../../services/api/admin/supplierService';
import { getAllCustomers } from '../../../../services/api/admin/adminCustomerService';
import type { ReviewBill, ScanMatches } from '../../../../services/api/admin/scanBillService';
import { ConfidenceDot, MatchBadge, inputCls } from './scanBillUi';

/**
 * Supplier (purchase) or customer (sales) name with autocomplete. Picking a saved party links
 * it (ledger/credit go to them) and fills in phone, GSTIN and address; typing a new name means
 * a new supplier is created on save.
 */

interface Option {
  id: string;
  name: string;
  phone?: string;
  gstin?: string;
  address?: string;
  balance?: number;
}

interface Props {
  kind: 'supplier' | 'customer';
  party: ReviewBill['party'];
  match?: ScanMatches['party'];
  confidence?: number | null;
  disabled?: boolean;
  onChange: (party: ReviewBill['party']) => void;
}

export default function PartyField({ kind, party, match, confidence, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const linkedId = kind === 'supplier' ? party.supplierId : party.customerId;
  const name = party.name || '';

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const fromScan: Option[] = (match?.candidates || []).map((c) => ({ id: c.id, name: c.name, phone: c.phone, gstin: c.gstin, address: c.address, balance: c.balance }));
    if (name.trim().length < 2) {
      setOptions(fromScan);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        let found: Option[] = [];
        if (kind === 'supplier') {
          const res: any = await getAllSuppliers(name.trim());
          found = (res?.data || []).slice(0, 8).map((s: any) => ({ id: s._id, name: s.name, phone: s.phone, gstin: s.gstNumber, address: s.address, balance: s.currentBalance }));
        } else {
          const res: any = await getAllCustomers({ search: name.trim(), limit: 8 });
          found = (res?.data || [])
            .filter((c: any) => c.email !== 'walkin@pos.com')
            .map((c: any) => ({ id: c._id, name: c.name, phone: c.phone, address: [c.address, c.city].filter(Boolean).join(', '), balance: c.creditBalance }));
        }
        const seen = new Set<string>();
        setOptions([...fromScan, ...found].filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true))));
      } catch {
        setOptions(fromScan);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [name, open, kind, match]);

  const pick = (o: Option) => {
    onChange({
      ...party,
      name: o.name,
      phone: o.phone || party.phone,
      gstin: o.gstin || party.gstin,
      address: o.address || party.address,
      ...(kind === 'supplier' ? { supplierId: o.id } : { customerId: o.id }),
    });
    setOpen(false);
  };

  const unlink = () => onChange({ ...party, ...(kind === 'supplier' ? { supplierId: null } : { customerId: null }) });

  return (
    <div className="relative" ref={ref}>
      <div className="mb-1 flex items-center gap-1.5">
        <label className="text-xs font-semibold text-gray-600">{kind === 'supplier' ? 'Supplier' : 'Customer'}</label>
        <ConfidenceDot value={confidence} />
        <span className="ml-auto">
          {linkedId ? (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
              <Link2 size={11} /> Saved {kind}
              {!disabled && (
                <button type="button" onClick={unlink} className="ml-0.5 rounded hover:bg-emerald-100" aria-label="Unlink">
                  <X size={11} />
                </button>
              )}
            </span>
          ) : name ? (
            match?.status === 'similar' ? <MatchBadge status="similar" /> : <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">{kind === 'supplier' ? 'New supplier' : 'Walk-in / new'}</span>
          ) : null}
        </span>
      </div>
      <div className="relative">
        <input
          className={inputCls}
          value={name}
          disabled={disabled}
          placeholder={kind === 'supplier' ? 'Supplier name' : 'Customer name (blank = walk-in)'}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            // Typing a different name breaks the link to the saved party
            onChange({ ...party, name: e.target.value, ...(kind === 'supplier' ? { supplierId: null } : { customerId: null }) });
            setOpen(true);
          }}
        />
        {loading && <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
      </div>
      {open && !disabled && options.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
          {options.map((o) => (
            <button key={o.id} type="button" onClick={() => pick(o)} className="block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-gray-50">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-gray-900">{o.name}</span>
                {typeof o.balance === 'number' && o.balance !== 0 && (
                  <span className={`shrink-0 text-[11px] font-semibold ${o.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {o.balance > 0 ? 'Due' : 'Advance'} ₹{Math.abs(o.balance).toLocaleString('en-IN')}
                  </span>
                )}
              </div>
              <div className="truncate text-[11px] text-gray-500">{[o.phone, o.gstin, o.address].filter(Boolean).join(' · ')}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
