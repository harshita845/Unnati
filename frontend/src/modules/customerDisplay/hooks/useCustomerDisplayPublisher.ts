import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pushDisplayState } from '../../../services/api/admin/customerDisplayService';
import { DisplayPublisher } from '../sync/displayChannel';
import type { SnapshotInput } from '../sync/displaySnapshot';

/** Per-PC choice of counter number and whether this POS feeds a customer display. */
export interface CustomerDisplayPrefs {
  terminal: string;
  enabled: boolean;
}

const PREFS_KEY = 'admin_pos_customer_display';
const DEFAULT_PREFS: CustomerDisplayPrefs = { terminal: '1', enabled: false };

const readPrefs = (): CustomerDisplayPrefs => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed.terminal === 'string') return { terminal: parsed.terminal || '1', enabled: !!parsed.enabled };
  } catch {
    /* defaults */
  }
  return DEFAULT_PREFS;
};

export const useCustomerDisplayPrefs = () => {
  const [prefs, setPrefsState] = useState<CustomerDisplayPrefs>(readPrefs);
  const setPrefs = useCallback((update: Partial<CustomerDisplayPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...update };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return { prefs, setPrefs };
};

/** After an online payment that returned on another page: show "Payment Successful" for the last bill. */
export const announceCustomerDisplayPaid = async (method: string) => {
  const prefs = readPrefs();
  if (!prefs.enabled || !prefs.terminal) return;
  const terminal = prefs.terminal;
  const publisher = new DisplayPublisher({ terminal, pushToServer: (state) => pushDisplayState(terminal, state) });
  try {
    if (publisher.markPaid(method)) await publisher.flushNow();
  } catch {
    /* the same-PC screen already got it; the server copy is best effort */
  } finally {
    publisher.dispose();
  }
};

/**
 * Mirrors the cashier's current bill to the customer display of `prefs.terminal`.
 * Same-PC screens get it instantly; screens on other PCs get it via the server.
 * Does nothing while the display is switched off for this POS.
 */
export const useCustomerDisplayPublisher = (prefs: CustomerDisplayPrefs, input: SnapshotInput) => {
  const publisherRef = useRef<DisplayPublisher | null>(null);
  const inputKey = useMemo(() => JSON.stringify(input), [input]);
  const latestInput = useRef(input);
  latestInput.current = input;

  useEffect(() => {
    if (!prefs.enabled || !prefs.terminal) return;
    const terminal = prefs.terminal;
    const publisher = new DisplayPublisher({
      terminal,
      pushToServer: (state) => pushDisplayState(terminal, state),
    });
    publisherRef.current = publisher;
    publisher.publish(latestInput.current);
    return () => {
      publisher.dispose();
      publisherRef.current = null;
    };
  }, [prefs.enabled, prefs.terminal]);

  useEffect(() => {
    publisherRef.current?.publish(latestInput.current);
  }, [inputKey]);

  /**
   * Call right after a checkout succeeds (before the cart is cleared): the customer screen shows
   * the confirmation for the bill they just saw, whatever happens to the cashier's screen next.
   */
  const markPaid = useCallback((method: string) => {
    const publisher = publisherRef.current;
    if (!publisher) return;
    if (publisher.markPaid(method)) void publisher.flushNow().catch(() => undefined);
  }, []);

  return { markPaid };
};
