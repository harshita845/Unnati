import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, History, Loader2, RefreshCw, Search } from 'lucide-react';
import { DOC_TYPE_LABEL, listScans, ScanDocType, ScanHistoryRow } from '../../../../services/api/admin/scanBillService';
import { inr, isoToIN } from '../../scanBill/billMath';
import { apiMessage, btn, EmptyState, inputCls, StatusPill } from './scanBillUi';

/** Every scanned bill, newest first, with filters. Clicking a row opens it for review. */

const STATUS_FILTERS: Array<[string, string]> = [
  ['', 'All'],
  ['draft,failed', 'To review'],
  ['confirmed', 'Saved'],
  ['discarded', 'Discarded'],
];
const PAGE_SIZE = 15;

export default function ScanHistory({ onOpen, refreshKey }: { onOpen: (id: string) => void; refreshKey: number }) {
  const [rows, setRows] = useState<ScanHistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [docType, setDocType] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [status, docType, query, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listScans({ status: status || undefined, docType: docType || undefined, q: query || undefined, from: from || undefined, to: to || undefined, page, limit: PAGE_SIZE });
      setRows(res.rows);
      setTotal(res.pagination?.total || 0);
    } catch (e) {
      setError(apiMessage(e, "Couldn't load the scan history"));
    } finally {
      setLoading(false);
    }
  }, [status, docType, query, from, to, page]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = !!(status || docType || query || from || to);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-[14rem] flex-1">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={`${inputCls} pl-8`} placeholder="Search supplier, customer or bill no." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex rounded-lg border border-gray-200 p-0.5">
          {STATUS_FILTERS.map(([v, l]) => (
            <button key={l} type="button" onClick={() => setStatus(v)} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${status === v ? 'bg-[#6DBB2D] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {l}
            </button>
          ))}
        </div>
        <select className={`${inputCls} w-auto`} value={docType} onChange={(e) => setDocType(e.target.value)} aria-label="Bill type">
          <option value="">All types</option>
          {(['purchase', 'sales', 'stock_slip', 'expense'] as ScanDocType[]).map((t) => (
            <option key={t} value={t}>
              {DOC_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <label className="text-[11px] text-gray-500">
          From
          <input type="date" className={`${inputCls} mt-0.5 w-auto`} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-[11px] text-gray-500">
          To
          <input type="date" className={`${inputCls} mt-0.5 w-auto`} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" className={btn.secondary} onClick={load} aria-label="Refresh">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle size={16} /> {error}
          <button type="button" className="ml-auto text-xs font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      ) : loading && !rows.length ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-16 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Loading scans…
        </div>
      ) : !rows.length ? (
        <EmptyState
          icon={<History size={22} />}
          title={filtered ? 'No scans match these filters' : 'No bills scanned yet'}
          text={filtered ? 'Try clearing the search or picking a wider date range.' : 'Scanned bills appear here, with their status, so you can come back and finish reviewing them.'}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Bill</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Party</th>
                  <th className="px-3 py-2 text-left">Bill no. / date</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Scanned</th>
                </tr>
              </thead>
              <tbody className={loading ? 'opacity-60' : ''}>
                {rows.map((r) => (
                  <tr key={r._id} onClick={() => onOpen(r._id)} className="cursor-pointer border-t border-gray-100 hover:bg-[#6DBB2D]/5">
                    <td className="px-3 py-2">
                      <div className="h-12 w-10 overflow-hidden rounded border border-gray-200 bg-gray-100">
                        {r.thumbnailUrl ? <img src={r.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[9px] text-gray-400">{r.provider === 'manual' ? 'Manual' : '—'}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">{DOC_TYPE_LABEL[r.docType]}</td>
                    <td className="max-w-[14rem] truncate px-3 py-2 font-medium text-gray-900">{r.partyName || <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      <div>{r.invoiceNumber || '—'}</div>
                      <div className="text-gray-400">{isoToIN(r.invoiceDate) || ''}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{inr(r.grandTotal)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <StatusPill status={r.status} />
                        {r.warningCount > 0 && r.status !== 'confirmed' && (
                          <span title={`${r.warningCount} thing(s) to check`} className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-700">
                            <AlertTriangle size={12} /> {r.warningCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{new Date(r.createdAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-xs text-gray-600">
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" className={btn.ghost} disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                <ChevronLeft size={15} />
              </button>
              <span>
                Page {page} of {pages}
              </span>
              <button type="button" className={btn.ghost} disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
