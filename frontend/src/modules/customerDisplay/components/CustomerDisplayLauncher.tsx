import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, ExternalLink, Loader2, MonitorSmartphone, X } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { ensureDisplayTerminal } from '../../../services/api/admin/customerDisplayService';
import type { CustomerDisplayPrefs } from '../hooks/useCustomerDisplayPublisher';

/**
 * POS Orders button: pick this counter's number, switch the customer display on, and open the
 * customer screen in its own window (drag it to the second monitor, then press F11).
 */

const TERMINAL_CODE = /^[A-Za-z0-9_-]{1,20}$/;

export const buildDisplayUrl = (terminal: string, key: string) =>
  `${window.location.origin}/customer-display?terminal=${encodeURIComponent(terminal)}&key=${encodeURIComponent(key)}`;

interface Props {
  prefs: CustomerDisplayPrefs;
  setPrefs: (update: Partial<CustomerDisplayPrefs>) => void;
}

const CustomerDisplayLauncher = ({ prefs, setPrefs }: Props) => {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'open' | 'copy' | null>(null);
  const [terminalDraft, setTerminalDraft] = useState(prefs.terminal);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  useEffect(() => setTerminalDraft(prefs.terminal), [prefs.terminal]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    setPosition({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const commitTerminal = () => {
    const code = terminalDraft.trim();
    if (!TERMINAL_CODE.test(code)) {
      showToast('Counter number can use letters, numbers, - and _', 'error');
      setTerminalDraft(prefs.terminal);
      return null;
    }
    if (code !== prefs.terminal) setPrefs({ terminal: code });
    return code;
  };

  const getLink = async (code: string) => {
    const res = await ensureDisplayTerminal(code);
    return buildDisplayUrl(res.data.code, res.data.displayKey);
  };

  const errorMessage = (err: any) => err?.response?.data?.message || 'Could not open the customer display';

  const openDisplay = async () => {
    const code = commitTerminal();
    if (!code) return;
    // Open synchronously (still inside the click) so popup blockers allow it, then point it at the screen
    const win = window.open('', `unnati-cfd-${code}`, 'popup=yes,width=1366,height=768');
    setBusy('open');
    try {
      const url = await getLink(code);
      setPrefs({ terminal: code, enabled: true });
      if (win) {
        win.location.href = url;
        win.focus();
      } else {
        window.open(url, `unnati-cfd-${code}`);
      }
      showToast(`Customer display for counter ${code} opened. Drag it to the customer monitor and press F11.`, 'success');
      setOpen(false);
    } catch (err) {
      win?.close();
      showToast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    const code = commitTerminal();
    if (!code) return;
    setBusy('copy');
    try {
      const url = await getLink(code);
      await navigator.clipboard.writeText(url);
      setPrefs({ terminal: code, enabled: true });
      showToast('Display link copied. Open it on the customer screen PC.', 'success');
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Customer Display"
        className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold transition-colors ${
          prefs.enabled ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
        }`}
      >
        <MonitorSmartphone className="h-4 w-4" />
        <span className="hidden sm:inline">Customer Display</span>
        {prefs.enabled && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[1000] w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-2xl"
            style={{ top: position.top, right: position.right }}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Customer Display</h3>
                <p className="text-xs text-gray-500">Shows this bill to the customer on a second screen.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mb-1 block text-xs font-semibold text-gray-700">This counter</label>
            <input
              value={terminalDraft}
              onChange={(e) => setTerminalDraft(e.target.value)}
              onBlur={commitTerminal}
              className="mb-3 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
              placeholder="1"
              maxLength={20}
            />

            <label className="mb-4 flex cursor-pointer items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <span className="text-sm font-medium text-gray-800">Show bill on customer screen</span>
              <input
                type="checkbox"
                checked={prefs.enabled}
                onChange={(e) => setPrefs({ enabled: e.target.checked })}
                className="h-4 w-4 accent-[var(--primary-color)]"
              />
            </label>

            <button
              type="button"
              onClick={openDisplay}
              disabled={!!busy}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary-color)] px-3 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy === 'open' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Open Customer Display
            </button>
            <button
              type="button"
              onClick={copyLink}
              disabled={!!busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {busy === 'copy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Copy link for another PC
            </button>
            <p className="mt-3 text-[11px] leading-snug text-gray-500">
              Drag the new window to the customer monitor and press <b>F11</b> (or use its Full screen button).
            </p>
          </div>,
          document.body
        )}
    </>
  );
};

export default CustomerDisplayLauncher;
