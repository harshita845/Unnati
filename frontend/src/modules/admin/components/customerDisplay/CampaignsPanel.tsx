import { useState } from 'react';
import { Layers, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import {
  createDisplayCampaign,
  deleteDisplayCampaign,
  updateDisplayCampaign,
  type CampaignInput,
  type DisplayCampaign,
} from '../../../../services/api/admin/customerDisplayService';
import { apiError, Field, formatDayRange, inputClass, Modal, StatusBadge, Toggle } from './customerDisplayUi';

/** Campaigns: schedule a whole set of banners at once (the campaign dates limit its banners). */

const CampaignForm = ({ campaign, onClose, onSaved }: { campaign: DisplayCampaign | null; onClose: () => void; onSaved: () => void }) => {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CampaignInput>({
    name: campaign?.name || '',
    description: campaign?.description || '',
    isActive: campaign?.isActive ?? true,
    startDate: campaign?.startDay || '',
    endDate: campaign?.endDay || '',
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return showToast('Campaign name is required', 'error');
    if (form.startDate && form.endDate && form.endDate < form.startDate) return showToast('End date must be on or after the start date', 'error');
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), startDate: form.startDate || null, endDate: form.endDate || null };
      if (campaign) await updateDisplayCampaign(campaign._id, payload);
      else await createDisplayCampaign(payload);
      showToast(campaign ? 'Campaign updated' : 'Campaign created', 'success');
      onSaved();
    } catch (err) {
      showToast(apiError(err, 'Could not save the campaign'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={campaign ? 'Edit campaign' : 'New campaign'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white">
            Cancel
          </button>
          <button
            type="submit"
            form="cfd-campaign-form"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary-color)] px-5 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </>
      }
    >
      <form id="cfd-campaign-form" onSubmit={submit} className="space-y-4">
        <Field label="Name" required>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} className={inputClass} placeholder="e.g. Diwali week" />
        </Field>
        <Field label="Description">
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={300} className={inputClass} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Start date">
            <input type="date" value={form.startDate || ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputClass} />
          </Field>
          <Field label="End date" hint="Inclusive">
            <input type="date" value={form.endDate || ''} min={form.startDate || undefined} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inputClass} />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
          <span className="text-sm font-semibold text-gray-800">Enabled</span>
          <Toggle checked={!!form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Enabled" />
        </div>
        <p className="text-xs text-gray-500">Assign banners to this campaign from the banner form. A banner shows only while both it and its campaign are live.</p>
      </form>
    </Modal>
  );
};

const CampaignsPanel = ({ campaigns, loading, onChanged }: { campaigns: DisplayCampaign[]; loading: boolean; onChanged: () => void }) => {
  const { showToast } = useToast();
  const [editing, setEditing] = useState<DisplayCampaign | null | 'new'>(null);

  const toggle = async (c: DisplayCampaign, isActive: boolean) => {
    try {
      await updateDisplayCampaign(c._id, { isActive });
      onChanged();
    } catch (err) {
      showToast(apiError(err, 'Could not update the campaign'), 'error');
    }
  };

  const remove = async (c: DisplayCampaign) => {
    if (!window.confirm(`Delete campaign "${c.name}"? Its ${c.bannerCount} banner(s) are kept and just leave the campaign.`)) return;
    try {
      await deleteDisplayCampaign(c._id);
      showToast('Campaign deleted', 'success');
      onChanged();
    } catch (err) {
      showToast(apiError(err, 'Could not delete the campaign'), 'error');
    }
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="font-bold text-gray-900">Campaigns</h2>
          <p className="text-xs text-gray-500">Group banners and schedule them together, e.g. banners A/B/C for one week, D/E the next.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--primary-color)] px-3 py-2 text-sm font-bold text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New campaign
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-gray-500">
          <Layers className="h-8 w-8 text-gray-300" />
          <p className="font-medium">No campaigns yet</p>
          <p className="text-xs">Campaigns are optional. Banners can have their own dates.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3">Campaign</th>
                <th className="px-5 py-3">Schedule</th>
                <th className="px-5 py-3">Banners</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Enabled</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.map((c) => (
                <tr key={c._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-semibold text-gray-900">{c.name}</div>
                    {c.description && <div className="text-xs text-gray-500">{c.description}</div>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-gray-700">{formatDayRange(c.startDay, c.endDay)}</td>
                  <td className="px-5 py-3 text-gray-700">{c.bannerCount}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-5 py-3">
                    <Toggle checked={c.isActive} onChange={(v) => toggle(c, v)} label="Enabled" />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setEditing(c)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => remove(c)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <CampaignForm
          campaign={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
};

export default CampaignsPanel;
