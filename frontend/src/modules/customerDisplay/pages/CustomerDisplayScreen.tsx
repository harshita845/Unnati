import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Loader2, Maximize, Minimize, MonitorX } from 'lucide-react';
import { getSocketBaseURL, isRealtimeAvailable } from '../../../services/api/config';
import BannerSlider from '../components/BannerSlider';
import { BillPanel, PaidPanel, PaymentPanel, StoreMark } from '../components/DisplayPanels';
import { fetchDisplayBanners, fetchDisplayBootstrap, fetchDisplayState, type DisplayBootstrap } from '../services/customerDisplayPublicApi';
import { subscribeToDisplay, UnauthorizedDisplayError, type ConnectionStatus } from '../sync/displayChannel';
import { changedItemIds, resolveScreenView, shouldHoldPaid } from '../sync/displaySnapshot';
import { DEFAULT_DISPLAY_SETTINGS, type DisplayState } from '../sync/displayTypes';

/**
 * Customer-facing second screen for a POS counter: /customer-display?terminal=1&key=…
 * Opened from POS Orders → "Customer Display". Shows only the live bill and banners.
 */

const BANNER_REFRESH_MS = 5 * 60 * 1000;
const keyStorage = (terminal: string) => `unnati_cfd_key_${terminal}`;
const FONT_SCALE = { small: 0.9, medium: 1, large: 1.15 } as const;

/** Reads terminal + key from the URL, remembers the key and removes it from the address bar. */
const readCredentials = (): { terminal: string; key: string } => {
  const params = new URLSearchParams(window.location.search);
  const terminal = (params.get('terminal') || '').trim();
  const urlKey = params.get('key') || '';
  if (!terminal) return { terminal: '', key: '' };
  let key = urlKey;
  try {
    if (urlKey) localStorage.setItem(keyStorage(terminal), urlKey);
    else key = localStorage.getItem(keyStorage(terminal)) || '';
  } catch {
    /* storage blocked: key only lives in the URL */
  }
  if (urlKey) {
    params.delete('key');
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }
  return { terminal, key };
};

const Notice = ({ title, body }: { title: string; body: string }) => (
  <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-slate-900 px-8 text-center text-white">
    <MonitorX className="h-14 w-14 text-slate-400" />
    <h1 className="text-3xl font-bold">{title}</h1>
    <p className="max-w-xl text-lg text-slate-300">{body}</p>
  </div>
);

const CustomerDisplayScreen = () => {
  const [{ terminal, key }] = useState(readCredentials);
  const [boot, setBoot] = useState<DisplayBootstrap | null>(null);
  const [loadError, setLoadError] = useState<'unauthorized' | 'network' | null>(null);
  const [state, setState] = useState<DisplayState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [flash, setFlash] = useState<{ ids: string[]; nonce: number }>({ ids: [], nonce: 0 });
  const [paidHold, setPaidHold] = useState<DisplayState | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const stateRef = useRef<DisplayState | null>(null);
  const contentVersionRef = useRef<number>(0);
  const paidSecondsRef = useRef(DEFAULT_DISPLAY_SETTINGS.paidScreenSeconds);

  // ── Load settings, branding, banners (retries until the server answers) ──
  const loadBootstrap = useCallback(async () => {
    const data = await fetchDisplayBootstrap(terminal, key);
    contentVersionRef.current = data.contentVersion;
    setBoot(data);
    return data;
  }, [terminal, key]);

  useEffect(() => {
    if (!terminal || !key) return;
    let cancelled = false;
    let attempt = 0;
    let timer: number;
    const run = async () => {
      try {
        const data = await loadBootstrap();
        if (cancelled) return;
        setLoadError(null);
        if (!stateRef.current || data.state.seq > stateRef.current.seq) applyState(data.state);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof UnauthorizedDisplayError) return setLoadError('unauthorized');
        setLoadError('network');
        attempt += 1;
        timer = window.setTimeout(run, Math.min(2000 * 2 ** attempt, 30000));
      }
    };
    run();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [terminal, key, loadBootstrap]); // eslint-disable-line react-hooks/exhaustive-deps -- applyState is stable

  // ── Live bill sync ──
  const applyState = useCallback((next: DisplayState) => {
    const ids = changedItemIds(stateRef.current, next);
    stateRef.current = next;
    setState(next);
    if (shouldHoldPaid(next, paidSecondsRef.current)) setPaidHold(next);
    else if (next.items.length > 0 && next.phase !== 'paid') setPaidHold(null); // next customer started
    if (ids.length) setFlash((f) => ({ ids, nonce: f.nonce + 1 }));
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const refreshContent = useCallback(
    async (version?: number) => {
      if (version !== undefined && version === contentVersionRef.current) return;
      try {
        await loadBootstrap();
      } catch (err) {
        if (err instanceof UnauthorizedDisplayError) setLoadError('unauthorized');
      }
    },
    [loadBootstrap]
  );

  const booted = !!boot;
  useEffect(() => {
    if (!booted) return;
    return subscribeToDisplay({
      terminal,
      key,
      initialState: stateRef.current,
      fetchState: (since) => fetchDisplayState(terminal, key, since),
      createSocket: () =>
        isRealtimeAvailable()
          ? io(getSocketBaseURL(), { transports: ['websocket', 'polling'], reconnectionDelayMax: 10000 })
          : null,
      onState: applyState,
      onStatus: setStatus,
      onContentVersion: (v) => void refreshContent(v),
      onUnauthorized: () => setLoadError('unauthorized'),
    });
  }, [booted, terminal, key, applyState, refreshContent]);

  // Banner schedules change at midnight etc.: refetch every few minutes too
  useEffect(() => {
    if (!booted) return;
    const t = window.setInterval(async () => {
      try {
        const res = await fetchDisplayBanners(terminal, key);
        setBoot((b) => (b ? { ...b, banners: res.banners } : b));
      } catch {
        /* next tick */
      }
    }, BANNER_REFRESH_MS);
    return () => window.clearInterval(t);
  }, [booted, terminal, key]);

  // ── Paid screen → back to welcome after N seconds ──
  const settings = boot?.settings || DEFAULT_DISPLAY_SETTINGS;
  paidSecondsRef.current = settings.paidScreenSeconds;
  useEffect(() => {
    if (!paidHold) return;
    const t = window.setTimeout(() => setPaidHold(null), Math.max(3, settings.paidScreenSeconds) * 1000);
    return () => window.clearTimeout(t);
  }, [paidHold, settings.paidScreenSeconds]);

  // ── Kiosk niceties: fullscreen toggle, hidden cursor, keep the screen awake ──
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    let hideTimer = window.setTimeout(() => setControlsVisible(false), 3000);
    const onMove = () => {
      setControlsVisible(true);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setControlsVisible(false), 3000);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchstart', onMove);

    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        wakeLock = await (navigator as any).wakeLock?.request('screen');
      } catch {
        /* not supported / denied */
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && requestWakeLock();
    requestWakeLock();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchstart', onMove);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearTimeout(hideTimer);
      wakeLock?.release?.().catch(() => undefined);
    };
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else document.documentElement.requestFullscreen().catch(() => undefined);
  };

  // Scale all text with the screen size (1366×768 → 1920×1080) and the font-size setting
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.fontSize;
    const scale = FONT_SCALE[settings.fontScale] || 1;
    html.style.fontSize = `calc(clamp(13px, 0.9vw + 2px, 22px) * ${scale})`;
    return () => {
      html.style.fontSize = previous;
    };
  }, [settings.fontScale]);

  useEffect(() => {
    if (boot?.branding.storeName) document.title = `${boot.branding.storeName} · Customer Display`;
  }, [boot?.branding.storeName]);

  const theme = settings.theme;
  const view = useMemo(() => resolveScreenView(state, paidHold), [state, paidHold]);
  const phase = view.phase;

  // ── Error / loading states ──
  if (!terminal || !key) {
    return (
      <Notice
        title="Customer display not set up"
        body="Open this screen from the POS: POS Orders → Customer Display → Open. Then drag the window to the customer monitor and press F11."
      />
    );
  }
  if (loadError === 'unauthorized') {
    return (
      <Notice
        title="This display link has expired"
        body="The link for this counter was reset or the counter was disabled. Reopen the customer display from the POS screen."
      />
    );
  }
  if (!boot) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-slate-900 text-white">
        <Loader2 className="h-10 w-10 animate-spin text-slate-300" />
        <p className="text-lg text-slate-300">{loadError === 'network' ? 'Waiting for connection…' : 'Starting customer display…'}</p>
      </div>
    );
  }

  const branding = boot.branding;
  const slider = (
    <BannerSlider
      banners={boot.banners}
      fallback={settings.defaultBanner}
      defaultImageSeconds={settings.defaultImageSeconds}
      background={theme.background}
      emptyContent={
        <div className="flex h-full flex-col items-center justify-center gap-6 p-10 text-center" style={{ color: theme.text }}>
          <StoreMark branding={branding} theme={theme} size="lg" />
          <p className="text-3xl font-semibold opacity-80">{settings.welcomeText}</p>
        </div>
      }
    />
  );

  const leftPanel =
    view.phase === 'payment' ? (
      <PaymentPanel state={view.state} branding={branding} theme={theme} showQr={settings.showUpiQr} />
    ) : view.phase === 'paid' ? (
      <PaidPanel
        key={view.state.seq}
        state={view.state}
        branding={branding}
        theme={theme}
        thankYouText={settings.thankYouText}
        seconds={settings.paidScreenSeconds}
      />
    ) : view.phase === 'billing' ? (
      <BillPanel state={view.state} branding={branding} theme={theme} flash={flash} />
    ) : null;

  return (
    <div
      className="relative h-screen w-screen select-none overflow-hidden"
      style={{ background: theme.background, cursor: controlsVisible ? 'default' : 'none' }}
    >
      <style>{`
        @keyframes cfdFlash { 0% { background: ${theme.accent}55; } 100% { background: transparent; } }
        .cfd-flash { animation: cfdFlash 1.4s ease-out; }
        @keyframes cfdPop { 0% { transform: scale(.4); opacity: 0; } 70% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
        .cfd-pop { animation: cfdPop .5s ease-out; }
        @keyframes cfdCountdown { from { width: 100%; } to { width: 0%; } }
        .cfd-countdown { animation-name: cfdCountdown; animation-timing-function: linear; animation-fill-mode: forwards; }
      `}</style>

      {phase === 'idle' ? (
        settings.showBanners ? (
          <div className="relative h-full w-full">
            {slider}
            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-6 bg-gradient-to-b from-black/60 to-transparent px-8 pb-12 pt-5">
              <div className="rounded-2xl bg-white/90 px-4 py-2 shadow">
                <StoreMark branding={branding} theme={theme} />
              </div>
              <div className="text-right text-2xl font-bold text-white drop-shadow">{settings.welcomeText}</div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center" style={{ color: theme.text }}>
            <StoreMark branding={branding} theme={theme} size="lg" />
            <p className="text-3xl font-semibold opacity-80">{settings.welcomeText}</p>
          </div>
        )
      ) : (
        <div className={`flex h-full w-full ${settings.billSide === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>
          <div
            className="h-full min-w-0 shadow-2xl"
            style={{ width: settings.showBanners ? `${settings.billColumnWidth}%` : '100%', maxWidth: settings.showBanners ? undefined : 960, margin: settings.showBanners ? undefined : '0 auto' }}
          >
            {leftPanel}
          </div>
          {settings.showBanners && <div className="h-full min-w-0 flex-1">{slider}</div>}
        </div>
      )}

      {/* Connection dot: never a broken screen, just a small hint while reconnecting */}
      <div className="pointer-events-none absolute bottom-3 right-3 z-20 flex items-center gap-2">
        {status !== 'live' && (
          <span className="rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white">
            {status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
          </span>
        )}
        <span
          className={`h-2.5 w-2.5 rounded-full ${status === 'live' ? 'bg-green-500 opacity-40' : 'animate-pulse bg-amber-400'}`}
        />
      </div>

      <button
        type="button"
        onClick={toggleFullscreen}
        className={`absolute right-3 top-3 z-30 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white transition-opacity ${
          controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        {isFullscreen ? 'Exit full screen' : 'Full screen'}
      </button>
    </div>
  );
};

export default CustomerDisplayScreen;
