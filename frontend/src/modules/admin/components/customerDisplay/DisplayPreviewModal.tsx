import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getDisplayPreview, type DisplayTerminal } from '../../../../services/api/admin/customerDisplayService';
import BannerSlider from '../../../customerDisplay/components/BannerSlider';
import type { DisplayBranding, DisplaySettingsPublic, LiveBanner } from '../../../customerDisplay/sync/displayTypes';
import { Modal } from './customerDisplayUi';

/** Live preview: the real slider with what a terminal's screen shows right now. */
const DisplayPreviewModal = ({ terminals, onClose }: { terminals: DisplayTerminal[]; onClose: () => void }) => {
  const [terminal, setTerminal] = useState(terminals[0]?.code || '');
  const [view, setView] = useState<'idle' | 'billing'>('idle');
  const [data, setData] = useState<{ settings: DisplaySettingsPublic; branding: DisplayBranding; banners: LiveBanner[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    getDisplayPreview(terminal || undefined)
      .then((res) => !cancelled && setData(res.data))
      .catch(() => !cancelled && setError('Could not load the preview'));
    return () => {
      cancelled = true;
    };
  }, [terminal]);

  const s = data?.settings;
  return (
    <Modal title="Live preview" onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={terminal} onChange={(e) => setTerminal(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">Any terminal (banners for all)</option>
          {terminals.map((t) => (
            <option key={t.code} value={t.code}>
              {t.name || `Counter ${t.code}`} (#{t.code})
            </option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-lg border text-sm font-semibold">
          {(['idle', 'billing'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-2 ${view === v ? 'bg-[var(--primary-color)] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              {v === 'idle' ? 'Idle (full width)' : 'While billing'}
            </button>
          ))}
        </div>
        {data && <span className="text-sm text-gray-500">{data.banners.length} banner(s) live now</span>}
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-slate-900">
        {/* Same slider as the customer screen: slides fill the area and move right-to-left */}
        {error ? (
          <div className="flex h-full items-center justify-center text-sm text-red-300">{error}</div>
        ) : !data || !s ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className={`flex h-full w-full ${s.billSide === 'right' ? 'flex-row-reverse' : 'flex-row'}`} style={{ background: s.theme.background }}>
            {view === 'billing' && (
              <div className="flex h-full flex-col gap-2 p-4" style={{ width: s.showBanners ? `${s.billColumnWidth}%` : '100%', background: s.theme.panel }}>
                <div className="text-sm font-bold" style={{ color: s.theme.text }}>
                  {data.branding.storeName || 'Your store'}
                </div>
                {[60, 45, 70, 50].map((w, i) => (
                  <div key={i} className="h-3 rounded" style={{ width: `${w}%`, background: `${s.theme.text}18` }} />
                ))}
                <div className="mt-auto rounded-lg px-3 py-2 text-right text-sm font-black text-white" style={{ background: s.theme.primary }}>
                  ₹ 1,234.00
                </div>
              </div>
            )}
            {(view === 'idle' || s.showBanners) && (
              <div className="h-full min-w-0 flex-1">
                <BannerSlider
                  banners={data.banners}
                  fallback={s.defaultBanner}
                  defaultImageSeconds={s.defaultImageSeconds}
                  background={s.theme.background}
                  emptyContent={
                    <div className="flex h-full items-center justify-center p-6 text-center text-lg font-semibold" style={{ color: s.theme.text }}>
                      {s.welcomeText}
                      <br />
                      <span className="text-xs font-normal opacity-60">(no live banners and no default banner)</span>
                    </div>
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default DisplayPreviewModal;
