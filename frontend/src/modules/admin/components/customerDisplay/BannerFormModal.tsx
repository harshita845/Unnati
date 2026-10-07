import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '../../../../context/ToastContext';
import {
  createDisplayBanner,
  updateDisplayBanner,
  type BannerInput,
  type DisplayBanner,
  type DisplayCampaign,
  type DisplayTerminal,
} from '../../../../services/api/admin/customerDisplayService';
import MediaUploadField from './MediaUploadField';
import { apiError, Field, inputClass, Modal, Toggle } from './customerDisplayUi';

interface Props {
  banner: DisplayBanner | null;
  campaigns: DisplayCampaign[];
  terminals: DisplayTerminal[];
  onClose: () => void;
  onSaved: () => void;
}

const SIZE_HINT =
  'Recommended 1920×1080 (16:9). Slides fill the banner area on any screen size: the full screen when idle, the banner column while billing. Edges may be trimmed to fit, so keep text and key products near the center.';

const BannerFormModal = ({ banner, campaigns, terminals, onClose, onSaved }: Props) => {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BannerInput & { allTerminals: boolean }>(() => ({
    title: banner?.title || '',
    mediaType: banner?.mediaType || 'image',
    mediaUrl: banner?.mediaUrl || '',
    mediaPublicId: banner?.mediaPublicId || '',
    posterUrl: banner?.posterUrl || '',
    durationSeconds: banner?.durationSeconds ?? 5,
    sortOrder: banner?.sortOrder,
    isActive: banner?.isActive ?? true,
    startDate: banner?.startDay || '',
    endDate: banner?.endDay || '',
    terminals: banner?.terminals || [],
    allTerminals: !banner?.terminals?.length,
    campaign: banner?.campaign?._id || '',
    link: banner?.link || '',
    notes: banner?.notes || '',
  }));
  const [extraTerminal, setExtraTerminal] = useState('');

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const terminalCodes = Array.from(new Set([...terminals.map((t) => t.code), ...(form.terminals || [])]));
  const toggleTerminal = (code: string) =>
    set('terminals', form.terminals?.includes(code) ? form.terminals.filter((c) => c !== code) : [...(form.terminals || []), code]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return showToast('Title is required', 'error');
    if (!form.mediaUrl) return showToast(`Upload the ${form.mediaType} first`, 'error');
    if (form.startDate && form.endDate && form.endDate < form.startDate) return showToast('End date must be on or after the start date', 'error');
    if (!form.allTerminals && !form.terminals?.length) return showToast('Pick at least one terminal, or choose All terminals', 'error');

    const { allTerminals, ...rest } = form;
    const payload: BannerInput = {
      ...rest,
      title: form.title.trim(),
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      campaign: form.campaign || null,
      terminals: allTerminals ? [] : form.terminals,
      durationSeconds: Number(form.durationSeconds) || 5,
    };
    if (payload.sortOrder === undefined || Number.isNaN(Number(payload.sortOrder))) delete payload.sortOrder;

    setSaving(true);
    try {
      if (banner) await updateDisplayBanner(banner._id, payload);
      else await createDisplayBanner(payload);
      showToast(banner ? 'Banner updated' : 'Banner created', 'success');
      onSaved();
    } catch (err) {
      showToast(apiError(err, 'Could not save the banner'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={banner ? 'Edit banner' : 'Add banner'}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white">
            Cancel
          </button>
          <button
            type="submit"
            form="cfd-banner-form"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary-color)] px-5 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} {banner ? 'Save changes' : 'Create banner'}
          </button>
        </>
      }
    >
      <form id="cfd-banner-form" onSubmit={submit} className="space-y-5">
        <Field label="Title" required>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={100} className={inputClass} placeholder="e.g. Diwali offers – 20% off sweets" />
        </Field>

        <Field label="Media type" required>
          <div className="grid grid-cols-2 gap-2">
            {(['image', 'video'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => type !== form.mediaType && setForm((f) => ({ ...f, mediaType: type, mediaUrl: '', mediaPublicId: '', posterUrl: '' }))}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize ${
                  form.mediaType === type ? 'border-[var(--primary-color)] bg-emerald-50 text-[var(--primary-color)]' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </Field>

        <Field label={form.mediaType === 'video' ? 'Video file' : 'Image file'} required>
          <MediaUploadField
            mediaType={form.mediaType}
            value={form.mediaUrl}
            hint={SIZE_HINT}
            onUploaded={(m) => setForm((f) => ({ ...f, mediaUrl: m.url, mediaPublicId: m.publicId, posterUrl: m.posterUrl || '' }))}
            onClear={() => setForm((f) => ({ ...f, mediaUrl: '', mediaPublicId: '', posterUrl: '' }))}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {form.mediaType === 'image' ? (
            <Field label="Show for (seconds)" hint="2–120 seconds">
              <input type="number" min={2} max={120} value={form.durationSeconds} onChange={(e) => set('durationSeconds', Number(e.target.value))} className={inputClass} />
            </Field>
          ) : (
            <Field label="Duration">
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">Videos play muted to the end</p>
            </Field>
          )}
          <Field label="Sort order" hint="Lower shows first. You can also drag rows in the list.">
            <input
              type="number"
              value={form.sortOrder ?? ''}
              onChange={(e) => set('sortOrder', e.target.value === '' ? undefined : Number(e.target.value))}
              className={inputClass}
              placeholder="Auto (last)"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Start date" hint="Leave empty to start right away">
            <input type="date" value={form.startDate || ''} onChange={(e) => set('startDate', e.target.value)} className={inputClass} />
          </Field>
          <Field label="End date" hint="Shows through the end of this day. Empty = no end.">
            <input type="date" value={form.endDate || ''} min={form.startDate || undefined} onChange={(e) => set('endDate', e.target.value)} className={inputClass} />
          </Field>
        </div>

        <Field label="Campaign" hint="Optional. The banner shows only while its campaign is active and within the campaign's dates too.">
          <select value={form.campaign || ''} onChange={(e) => set('campaign', e.target.value)} className={inputClass}>
            <option value="">No campaign</option>
            {campaigns.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
                {!c.isActive ? ' (disabled)' : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Terminals">
          <div className="space-y-2">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={form.allTerminals} onChange={() => set('allTerminals', true)} className="accent-[var(--primary-color)]" /> All terminals
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={!form.allTerminals} onChange={() => set('allTerminals', false)} className="accent-[var(--primary-color)]" /> Specific terminals
              </label>
            </div>
            {!form.allTerminals && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3">
                {terminalCodes.map((code) => {
                  const t = terminals.find((x) => x.code === code);
                  const on = form.terminals?.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleTerminal(code)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        on ? 'border-[var(--primary-color)] bg-[var(--primary-color)] text-white' : 'border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      {t?.name || `Counter ${code}`} <span className="opacity-70">#{code}</span>
                    </button>
                  );
                })}
                <input
                  value={extraTerminal}
                  onChange={(e) => setExtraTerminal(e.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && extraTerminal) {
                      e.preventDefault();
                      if (!form.terminals?.includes(extraTerminal)) set('terminals', [...(form.terminals || []), extraTerminal]);
                      setExtraTerminal('');
                    }
                  }}
                  placeholder="Add code + Enter"
                  className="w-36 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                />
              </div>
            )}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Link (optional)">
            <input value={form.link || ''} onChange={(e) => set('link', e.target.value)} className={inputClass} placeholder="Offer page or reference" />
          </Field>
          <Field label="Notes (optional)">
            <input value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} className={inputClass} placeholder="Internal note" />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-gray-800">Enabled</div>
            <div className="text-xs text-gray-500">Disabled banners never show, whatever their dates</div>
          </div>
          <Toggle checked={!!form.isActive} onChange={(v) => set('isActive', v)} label="Enabled" />
        </div>
      </form>
    </Modal>
  );
};

export default BannerFormModal;
