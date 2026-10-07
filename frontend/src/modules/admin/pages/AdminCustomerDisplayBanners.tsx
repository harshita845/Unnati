import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Eye, Film, GripVertical, ImageIcon, Loader2, Pencil, Plus, RefreshCw, Search, Settings2, Trash2 } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import {
  deleteDisplayBanner,
  duplicateDisplayBanner,
  getDisplayBanners,
  getDisplayCampaigns,
  getDisplayTerminals,
  reorderDisplayBanners,
  setDisplayBannerActive,
  type BannerStatus,
  type DisplayBanner,
  type DisplayCampaign,
  type DisplayTerminal,
} from '../../../services/api/admin/customerDisplayService';
import BannerFormModal from '../components/customerDisplay/BannerFormModal';
import CampaignsPanel from '../components/customerDisplay/CampaignsPanel';
import DisplayPreviewModal from '../components/customerDisplay/DisplayPreviewModal';
import { apiError, formatDayRange, StatusBadge, Toggle } from '../components/customerDisplay/customerDisplayUi';

const STATUS_FILTERS: Array<{ id: 'all' | BannerStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'expired', label: 'Expired' },
  { id: 'inactive', label: 'Disabled' },
];

const AdminCustomerDisplayBanners = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tab, setTab] = useState<'banners' | 'campaigns'>('banners');
  const [banners, setBanners] = useState<DisplayBanner[]>([]);
  const [campaigns, setCampaigns] = useState<DisplayCampaign[]>([]);
  const [terminals, setTerminals] = useState<DisplayTerminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BannerStatus>('all');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<DisplayBanner | null | 'new'>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [b, c, t] = await Promise.all([getDisplayBanners(), getDisplayCampaigns(), getDisplayTerminals()]);
      setBanners(b.data || []);
      setCampaigns(c.data || []);
      setTerminals(t.data || []);
    } catch (err) {
      setLoadError(apiError(err, 'Could not load banners'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: banners.length };
    banners.forEach((b) => (map[b.status] = (map[b.status] || 0) + 1));
    return map;
  }, [banners]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return banners.filter(
      (b) =>
        (statusFilter === 'all' || b.status === statusFilter) &&
        (!campaignFilter || b.campaign?._id === campaignFilter) &&
        (!q || b.title.toLowerCase().includes(q))
    );
  }, [banners, statusFilter, campaignFilter, search]);

  // Reordering a filtered subset would scramble the hidden rows, so only allow it on the full list
  const canReorder = statusFilter === 'all' && !campaignFilter && !search.trim() && banners.length > 1;

  const toggleActive = async (banner: DisplayBanner, isActive: boolean) => {
    setBusyId(banner._id);
    try {
      const res = await setDisplayBannerActive(banner._id, isActive);
      setBanners((list) => list.map((b) => (b._id === banner._id ? res.data : b)));
    } catch (err) {
      showToast(apiError(err, 'Could not update the banner'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = async (banner: DisplayBanner) => {
    setBusyId(banner._id);
    try {
      await duplicateDisplayBanner(banner._id);
      showToast('Banner duplicated. The copy starts disabled.', 'success');
      load();
    } catch (err) {
      showToast(apiError(err, 'Could not duplicate the banner'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (banner: DisplayBanner) => {
    if (!window.confirm(`Delete "${banner.title}"? This also deletes its uploaded file and can't be undone.`)) return;
    setBusyId(banner._id);
    try {
      await deleteDisplayBanner(banner._id);
      setBanners((list) => list.filter((b) => b._id !== banner._id));
      showToast('Banner deleted', 'success');
    } catch (err) {
      showToast(apiError(err, 'Could not delete the banner'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const drop = async (targetId: string) => {
    const sourceId = dragId.current;
    dragId.current = null;
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;
    const previous = banners;
    const list = [...banners];
    const from = list.findIndex((b) => b._id === sourceId);
    const to = list.findIndex((b) => b._id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setBanners(list.map((b, i) => ({ ...b, sortOrder: i })));
    try {
      await reorderDisplayBanners(list.map((b) => b._id));
    } catch (err) {
      setBanners(previous);
      showToast(apiError(err, 'Could not save the new order'), 'error');
    }
  };

  const terminalLabel = (codes: string[]) => {
    if (!codes.length) return 'All';
    return codes.map((c) => terminals.find((t) => t.code === c)?.name || `#${c}`).join(', ');
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Customer Display · Banners</h1>
          <p className="text-sm text-gray-500">Promotional slides shown on the customer-facing screen at each POS counter.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/admin/customer-display/settings')}
            className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Settings2 className="h-4 w-4" /> Display Settings
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Eye className="h-4 w-4" /> Live preview
          </button>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary-color)] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add banner
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b">
        {(['banners', 'campaigns'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold capitalize ${
              tab === t ? 'border-[var(--primary-color)] text-[var(--primary-color)]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'campaigns' ? (
        <CampaignsPanel campaigns={campaigns} loading={loading} onChanged={load} />
      ) : (
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    statusFilter === f.id ? 'bg-[var(--primary-color)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label} <span className="opacity-70">{counts[f.id] || 0}</span>
                </button>
              ))}
            </div>
            <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} className="rounded-lg border px-3 py-1.5 text-sm">
              <option value="">All campaigns</option>
              {campaigns.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="relative ml-auto">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title"
                className="rounded-lg border py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="font-medium text-red-600">{loadError}</p>
              <button type="button" onClick={load} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50">
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-gray-500">
              <ImageIcon className="h-10 w-10 text-gray-300" />
              <p className="font-medium">{banners.length ? 'No banners match these filters' : 'No banners yet'}</p>
              {!banners.length && (
                <button
                  type="button"
                  onClick={() => setEditing('new')}
                  className="mt-2 rounded-lg bg-[var(--primary-color)] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
                >
                  Add your first banner
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="w-8 px-3 py-3" title={canReorder ? 'Drag to reorder' : 'Clear filters to reorder'} />
                    <th className="px-3 py-3">Banner</th>
                    <th className="px-3 py-3">Schedule</th>
                    <th className="px-3 py-3">Campaign</th>
                    <th className="px-3 py-3">Terminals</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Enabled</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((b) => (
                    <tr
                      key={b._id}
                      draggable={canReorder}
                      onDragStart={() => (dragId.current = b._id)}
                      onDragOver={(e) => {
                        if (!canReorder) return;
                        e.preventDefault();
                        setDragOverId(b._id);
                      }}
                      onDragLeave={() => setDragOverId((id) => (id === b._id ? null : id))}
                      onDrop={() => drop(b._id)}
                      onDragEnd={() => setDragOverId(null)}
                      className={`hover:bg-gray-50 ${dragOverId === b._id ? 'bg-emerald-50 outline outline-2 outline-[var(--primary-color)]' : ''}`}
                    >
                      <td className="px-3 py-3 text-gray-400">
                        <GripVertical className={`h-4 w-4 ${canReorder ? 'cursor-grab' : 'opacity-30'}`} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-900">
                            {b.mediaType === 'video' ? (
                              b.posterUrl ? (
                                <img src={b.posterUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <Film className="m-auto mt-3 h-6 w-6 text-slate-400" />
                              )
                            ) : (
                              <img src={b.mediaUrl} alt="" className="h-full w-full object-cover" />
                            )}
                            {b.mediaType === 'video' && (
                              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[10px] font-bold text-white">VIDEO</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-gray-900">{b.title}</div>
                            <div className="text-xs text-gray-500">
                              {b.mediaType === 'image' ? `${b.durationSeconds}s` : 'Plays to end'} · #{b.sortOrder}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-gray-700">{formatDayRange(b.startDay, b.endDay)}</td>
                      <td className="px-3 py-3 text-gray-700">{b.campaign?.name || <span className="text-gray-400">None</span>}</td>
                      <td className="max-w-[10rem] truncate px-3 py-3 text-gray-700">{terminalLabel(b.terminals)}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-3 py-3">
                        <Toggle checked={b.isActive} disabled={busyId === b._id} onChange={(v) => toggleActive(b, v)} label="Enabled" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => setEditing(b)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicate(b)}
                            disabled={busyId === b._id}
                            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                            title="Duplicate"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(b)}
                            disabled={busyId === b._id}
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-40"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t px-4 py-2 text-xs text-gray-500">
                {canReorder ? 'Drag rows to change the slide order.' : 'Clear filters and search to drag rows into a new order.'} Open screens update
                within seconds of any change.
              </p>
            </div>
          )}
        </div>
      )}

      {editing && (
        <BannerFormModal
          banner={editing === 'new' ? null : editing}
          campaigns={campaigns}
          terminals={terminals}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {previewOpen && <DisplayPreviewModal terminals={terminals} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
};

export default AdminCustomerDisplayBanners;
