import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, ExternalLink, Images, KeyRound, Loader2, Monitor, Plus, RefreshCw, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import {
  deleteDisplayTerminal,
  ensureDisplayTerminal,
  getCustomerDisplaySettings,
  getDisplayTerminals,
  regenerateDisplayTerminalKey,
  updateCustomerDisplaySettings,
  updateDisplayTerminal,
  type DisplaySettings,
  type DisplayTerminal,
} from '../../../services/api/admin/customerDisplayService';
import { DEFAULT_DISPLAY_SETTINGS, type DisplayTheme } from '../../customerDisplay/sync/displayTypes';
import { buildDisplayUrl } from '../../customerDisplay/components/CustomerDisplayLauncher';
import MediaUploadField from '../components/customerDisplay/MediaUploadField';
import { apiError, Field, inputClass, Toggle } from '../components/customerDisplay/customerDisplayUi';

const THEME_FIELDS: Array<{ key: keyof DisplayTheme; label: string }> = [
  { key: 'primary', label: 'Primary (totals, buttons)' },
  { key: 'background', label: 'Screen background' },
  { key: 'panel', label: 'Bill panel' },
  { key: 'text', label: 'Text' },
  { key: 'accent', label: 'Highlight' },
];

const Section = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <section className="rounded-xl border bg-white p-5 shadow-sm">
    <h2 className="text-base font-bold text-gray-900">{title}</h2>
    {description && <p className="mb-4 text-xs text-gray-500">{description}</p>}
    <div className={description ? '' : 'mt-4'}>{children}</div>
  </section>
);

const SwitchRow = ({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3">
    <div>
      <div className="text-sm font-semibold text-gray-800">{label}</div>
      {hint && <div className="text-xs text-gray-500">{hint}</div>}
    </div>
    <Toggle checked={checked} onChange={onChange} label={label} />
  </div>
);

const timeAgo = (iso?: string | null) => {
  if (!iso) return 'Never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'Online now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h ago` : new Date(iso).toLocaleDateString('en-IN');
};

const TerminalsSection = () => {
  const { showToast } = useToast();
  const [terminals, setTerminals] = useState<DisplayTerminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await getDisplayTerminals();
      setTerminals(res.data || []);
    } catch (err) {
      showToast(apiError(err, 'Could not load terminals'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const code = newCode.trim();
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(code)) return showToast('Counter code can use letters, numbers, - and _', 'error');
    try {
      await ensureDisplayTerminal(code, newName.trim() || undefined);
      setNewCode('');
      setNewName('');
      load();
    } catch (err) {
      showToast(apiError(err, 'Could not add the terminal'), 'error');
    }
  };

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      if (success) showToast(success, 'success');
      load();
    } catch (err) {
      showToast(apiError(err, 'Something went wrong'), 'error');
    }
  };

  const copy = async (t: DisplayTerminal) => {
    try {
      await navigator.clipboard.writeText(buildDisplayUrl(t.code, t.displayKey));
      showToast('Display link copied', 'success');
    } catch {
      showToast('Could not copy. Select the link manually.', 'error');
    }
  };

  return (
    <Section
      title="Terminals (POS counters)"
      description="Each counter has its own customer screen and private display link. Terminals are also created automatically when a cashier opens the display from POS Orders."
    >
      {loading ? (
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
      ) : (
        <div className="space-y-2">
          {terminals.length === 0 && <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500">No terminals yet.</p>}
          {terminals.map((t) => (
            <div key={t.code} className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3">
              <Monitor className="h-5 w-5 text-gray-400" />
              <div className="min-w-[10rem] flex-1">
                <input
                  defaultValue={t.name}
                  onBlur={(e) => e.target.value.trim() !== t.name && run(() => updateDisplayTerminal(t.code, { name: e.target.value.trim() }))}
                  className="w-full rounded border-transparent bg-transparent px-1 text-sm font-semibold text-gray-900 hover:border-gray-200 focus:border-gray-300 focus:outline-none"
                />
                <div className="px-1 text-xs text-gray-500">
                  Code #{t.code} · Screen last seen: {timeAgo(t.lastSeenAt)}
                </div>
              </div>
              <Toggle checked={t.isActive} onChange={(v) => run(() => updateDisplayTerminal(t.code, { isActive: v }))} label="Enabled" />
              <button type="button" onClick={() => copy(t)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" title="Copy display link">
                <Copy className="h-4 w-4" />
              </button>
              <a
                href={buildDisplayUrl(t.code, t.displayKey)}
                target={`unnati-cfd-${t.code}`}
                rel="noreferrer"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                title="Open display"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() =>
                  window.confirm(`Create a new link for ${t.name || t.code}? Screens using the old link stop until reopened.`) &&
                  run(() => regenerateDisplayTerminalKey(t.code), 'New display link created')
                }
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                title="New display link (revokes the old one)"
              >
                <KeyRound className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => window.confirm(`Remove terminal ${t.name || t.code}?`) && run(() => deleteDisplayTerminal(t.code), 'Terminal removed')}
                className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2 pt-2">
            <Field label="Code">
              <input value={newCode} onChange={(e) => setNewCode(e.target.value)} maxLength={20} className={`${inputClass} w-28`} placeholder="2" />
            </Field>
            <Field label="Name">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} className={`${inputClass} w-48`} placeholder="Counter 2" />
            </Field>
            <button type="button" onClick={add} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <Plus className="h-4 w-4" /> Add terminal
            </button>
          </div>
        </div>
      )}
    </Section>
  );
};

/** Small schematic of the customer screen that follows the layout/theme settings. */
const LayoutSketch = ({ s }: { s: DisplaySettings }) => (
  <div className="aspect-video w-full overflow-hidden rounded-xl border shadow-inner" style={{ background: s.theme.background }}>
    <div className={`flex h-full ${s.billSide === 'right' ? 'flex-row-reverse' : ''}`}>
      <div className="flex flex-col gap-1.5 p-3" style={{ width: s.showBanners ? `${s.billColumnWidth}%` : '100%', background: s.theme.panel }}>
        <div className="h-2.5 w-1/2 rounded" style={{ background: s.theme.text, opacity: 0.8 }} />
        {[70, 55, 80, 60].map((w, i) => (
          <div key={i} className="h-1.5 rounded" style={{ width: `${w}%`, background: s.theme.text, opacity: i === 3 ? 0.35 : 0.15 }} />
        ))}
        <div className="h-1.5 w-2/3 rounded" style={{ background: s.theme.accent, opacity: 0.6 }} />
        <div className="mt-auto h-5 rounded" style={{ background: s.theme.primary }} />
      </div>
      {s.showBanners && (
        <div className="flex flex-1 items-center justify-center text-[10px] font-semibold uppercase tracking-wider text-white/80" style={{ background: '#334155' }}>
          Banners
        </div>
      )}
    </div>
  </div>
);

const AdminCustomerDisplaySettings = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [settings, setSettings] = useState<DisplaySettings | null>(null);
  const [saved, setSaved] = useState<string>('');
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await getCustomerDisplaySettings();
      setSettings(res.data);
      setSaved(JSON.stringify(res.data));
    } catch (err) {
      setLoadError(apiError(err, 'Could not load display settings'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 p-16 text-center">
        <p className="font-medium text-red-600">{loadError}</p>
        <button type="button" onClick={load} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }
  if (!settings) {
    return (
      <div className="flex justify-center p-16">
        <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
      </div>
    );
  }

  const set = <K extends keyof DisplaySettings>(key: K, value: DisplaySettings[K]) => setSettings((s) => (s ? { ...s, [key]: value } : s));
  const setTheme = (key: keyof DisplayTheme, value: string) => setSettings((s) => (s ? { ...s, theme: { ...s.theme, [key]: value } } : s));
  const dirty = JSON.stringify(settings) !== saved;
  const branding = settings.resolvedBranding;

  const save = async () => {
    setSaving(true);
    try {
      const { resolvedBranding, contentVersion, ...payload } = settings;
      const res = await updateCustomerDisplaySettings(payload);
      setSettings(res.data);
      setSaved(JSON.stringify(res.data));
      showToast('Display settings saved. Open screens update within seconds.', 'success');
    } catch (err) {
      showToast(apiError(err, 'Could not save settings'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 pb-24 sm:p-6 sm:pb-24">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Customer Display · Settings</h1>
          <p className="text-sm text-gray-500">How the customer-facing screen at each counter looks and behaves.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin/customer-display/banners')}
          className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <Images className="h-4 w-4" /> Manage banners
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Section title="Layout">
            <div className="space-y-3">
              <SwitchRow
                label="Show banner section"
                hint="Off = the bill fills the screen and the idle screen shows the logo and welcome text"
                checked={settings.showBanners}
                onChange={(v) => set('showBanners', v)}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Bill column side">
                  <div className="grid grid-cols-2 overflow-hidden rounded-lg border text-sm font-semibold">
                    {(['left', 'right'] as const).map((side) => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => set('billSide', side)}
                        className={`py-2 capitalize ${settings.billSide === side ? 'bg-[var(--primary-color)] text-white' : 'bg-white text-gray-700'}`}
                      >
                        {side}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={`Bill column width: ${settings.billColumnWidth}%`}>
                  <input
                    type="range"
                    min={30}
                    max={60}
                    step={1}
                    value={settings.billColumnWidth}
                    onChange={(e) => set('billColumnWidth', Number(e.target.value))}
                    className="w-full accent-[var(--primary-color)]"
                  />
                </Field>
                <Field label="Font size">
                  <select value={settings.fontScale} onChange={(e) => set('fontScale', e.target.value as DisplaySettings['fontScale'])} className={inputClass}>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Branding" description="Leave empty to use the shop name and logo from POS Bill Settings.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Store name" hint={!settings.storeName && branding.storeName ? `Using: ${branding.storeName}` : undefined}>
                <input value={settings.storeName} onChange={(e) => set('storeName', e.target.value)} maxLength={80} className={inputClass} placeholder={branding.storeName || 'Store name'} />
              </Field>
              <Field label="Logo" hint={!settings.logoUrl && branding.logoUrl ? 'Using the POS Bill Settings logo' : undefined}>
                <MediaUploadField
                  mediaType="image"
                  value={settings.logoUrl}
                  compact
                  onUploaded={(m) => set('logoUrl', m.url)}
                  onClear={() => set('logoUrl', '')}
                />
              </Field>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Theme colors</span>
                <button
                  type="button"
                  onClick={() => set('theme', { ...DEFAULT_DISPLAY_SETTINGS.theme })}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {THEME_FIELDS.map(({ key, label }) => (
                  <label key={key} className="flex flex-col gap-1.5 rounded-lg border p-2.5 text-xs text-gray-600">
                    <span className="font-medium">{label}</span>
                    <div className="flex items-center gap-2">
                      <input type="color" value={settings.theme[key]} onChange={(e) => setTheme(key, e.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
                      <span className="font-mono">{settings.theme[key]}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Messages & timing">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Welcome text (idle screen)">
                <input value={settings.welcomeText} onChange={(e) => set('welcomeText', e.target.value)} maxLength={120} className={inputClass} />
              </Field>
              <Field label="Thank-you text (after payment)">
                <input value={settings.thankYouText} onChange={(e) => set('thankYouText', e.target.value)} maxLength={120} className={inputClass} />
              </Field>
              <Field label="Return to idle after payment (seconds)" hint="3–60 seconds">
                <input
                  type="number"
                  min={3}
                  max={60}
                  value={settings.paidScreenSeconds}
                  onChange={(e) => set('paidScreenSeconds', Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
              <Field label="Default image duration (seconds)" hint="Used when a banner has no duration">
                <input
                  type="number"
                  min={2}
                  max={120}
                  value={settings.defaultImageSeconds}
                  onChange={(e) => set('defaultImageSeconds', Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>

          <Section title="Payment">
            <SwitchRow
              label="Show UPI QR code while paying"
              hint="Uses the QR code image from POS Bill Settings"
              checked={settings.showUpiQr}
              onChange={(v) => set('showUpiQr', v)}
            />
            {settings.showUpiQr && (
              <div className="mt-3 flex items-center gap-4 rounded-lg border px-4 py-3">
                {branding.upiQrUrl ? (
                  <>
                    <img src={branding.upiQrUrl} alt="UPI QR" className="h-20 w-20 rounded border object-contain" />
                    <p className="text-sm text-gray-600">This QR from POS Bill Settings is shown with the amount to pay.</p>
                  </>
                ) : (
                  <p className="text-sm text-amber-700">
                    No QR code found. Add one in{' '}
                    <button type="button" onClick={() => navigate('/admin/pos/bill-settings')} className="font-semibold underline">
                      POS Bill Settings
                    </button>
                    . Until then the screen just shows the amount to pay.
                  </p>
                )}
              </div>
            )}
          </Section>

          <Section title="Default banner" description="Shown when no banners are scheduled. If empty, the screen shows the logo and welcome text.">
            <div className="mb-3 flex gap-2">
              {(['image', 'video'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => type !== settings.defaultBanner.mediaType && set('defaultBanner', { mediaType: type, mediaUrl: '' })}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold capitalize ${
                    settings.defaultBanner.mediaType === type ? 'border-[var(--primary-color)] bg-emerald-50 text-[var(--primary-color)]' : 'text-gray-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <MediaUploadField
              mediaType={settings.defaultBanner.mediaType}
              value={settings.defaultBanner.mediaUrl}
              onUploaded={(m) => set('defaultBanner', { mediaType: settings.defaultBanner.mediaType, mediaUrl: m.url })}
              onClear={() => set('defaultBanner', { mediaType: settings.defaultBanner.mediaType, mediaUrl: '' })}
              hint="Recommended 1920×1080 (16:9)"
            />
          </Section>

          <TerminalsSection />
        </div>

        <div className="xl:col-span-1">
          <div className="sticky top-6 space-y-3">
            <Section title="Layout preview">
              <LayoutSketch s={settings} />
              <p className="mt-2 text-xs text-gray-500">While billing. When idle, banners fill the whole screen.</p>
            </Section>
            <Section title="Second monitor setup">
              <ol className="list-decimal space-y-1.5 pl-4 text-sm text-gray-600">
                <li>Connect the customer monitor and set Windows/macOS to <b>Extend</b> displays.</li>
                <li>
                  On POS Orders click <b>Customer Display → Open</b>.
                </li>
                <li>Drag the new window to the customer monitor.</li>
                <li>
                  Press <b>F11</b> (or the screen's Full screen button).
                </li>
              </ol>
            </Section>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 px-6 py-3 backdrop-blur lg:left-72">
        <div className="flex items-center justify-end gap-3">
          {dirty && <span className="text-sm text-amber-600">Unsaved changes</span>}
          <button
            type="button"
            onClick={() => setSettings(JSON.parse(saved))}
            disabled={!dirty || saving}
            className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary-color)] px-5 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminCustomerDisplaySettings;
