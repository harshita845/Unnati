import type { DisplayState } from './displayTypes';
import { buildDisplayState, isNewerState, nextSeq, stateFingerprint, type SnapshotInput } from './displaySnapshot';

/**
 * Cashier → customer screen sync, fastest path first:
 *  1. Same browser on the same PC (second monitor): BroadcastChannel, or localStorage events
 *     where BroadcastChannel isn't available. Instant, no network.
 *  2. Socket.IO room for the terminal, when the backend runs on an always-on server.
 *  3. HTTP polling of the terminal's last state, used only while 1 and 2 are silent
 *     (e.g. the screen is on another PC and the backend is serverless).
 * Every snapshot carries a seq; screens ignore anything older than what they show.
 */

type LocalMessage =
  | { type: 'state'; state: DisplayState }
  | { type: 'heartbeat'; seq: number }
  | { type: 'hello' };

interface LocalTransport {
  post: (msg: LocalMessage) => void;
  close: () => void;
}

const channelName = (terminal: string) => `unnati-cfd-${terminal}`;
const stateStorageKey = (terminal: string) => `unnati_cfd_state_${terminal}`;
const messageStorageKey = (terminal: string) => `unnati_cfd_msg_${terminal}`;

const storage = (): Storage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

export const readStoredState = (terminal: string): DisplayState | null => {
  try {
    const raw = storage()?.getItem(stateStorageKey(terminal));
    return raw ? (JSON.parse(raw) as DisplayState) : null;
  } catch {
    return null;
  }
};

const writeStoredState = (terminal: string, state: DisplayState) => {
  try {
    storage()?.setItem(stateStorageKey(terminal), JSON.stringify(state));
  } catch {
    /* storage full or blocked: the live channels still work */
  }
};

const createLocalTransport = (terminal: string, onMessage: (msg: LocalMessage) => void): LocalTransport => {
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(channelName(terminal));
    channel.onmessage = (e) => onMessage(e.data as LocalMessage);
    return { post: (msg) => channel.postMessage(msg), close: () => channel.close() };
  }

  // Fallback: the storage event fires in the *other* windows of the same origin
  const key = messageStorageKey(terminal);
  const listener = (e: StorageEvent) => {
    if (e.key !== key || !e.newValue) return;
    try {
      onMessage(JSON.parse(e.newValue).msg as LocalMessage);
    } catch {
      /* ignore malformed */
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', listener);
  return {
    post: (msg) => {
      try {
        storage()?.setItem(key, JSON.stringify({ msg, nonce: Math.random() }));
      } catch {
        /* ignore */
      }
    },
    close: () => {
      if (typeof window !== 'undefined') window.removeEventListener('storage', listener);
    },
  };
};

// ─── Cashier side ───────────────────────────────────────────────────────────

export interface PublisherOptions {
  terminal: string;
  /** Sends the snapshot to the server (for screens on other PCs). Omit for same-PC only. */
  pushToServer?: (state: DisplayState) => Promise<unknown>;
  heartbeatMs?: number;
  serverDebounceMs?: number;
  serverRetryMs?: number;
}

export class DisplayPublisher {
  private readonly opts: Required<Omit<PublisherOptions, 'pushToServer'>> & Pick<PublisherOptions, 'pushToServer'>;
  private readonly local: LocalTransport;
  private current: DisplayState | null;
  private fingerprint = '';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pushing = false;
  private pushedSeq = 0;
  private disposed = false;

  constructor(options: PublisherOptions) {
    this.opts = { heartbeatMs: 3000, serverDebounceMs: 300, serverRetryMs: 3000, ...options };
    this.current = readStoredState(this.opts.terminal);
    this.local = createLocalTransport(this.opts.terminal, (msg) => {
      // A screen that just opened asks for the current bill
      if (msg.type === 'hello' && this.current) this.local.post({ type: 'state', state: this.current });
    });
    this.heartbeatTimer = setInterval(() => {
      this.local.post({ type: 'heartbeat', seq: this.current?.seq || 0 });
    }, this.opts.heartbeatMs);
  }

  get state() {
    return this.current;
  }

  /** Publishes the bill if anything visible changed. Returns the snapshot that is now live. */
  publish(input: SnapshotInput): DisplayState | null {
    if (this.disposed) return this.current;
    const draft = buildDisplayState(input, 0);
    const fp = stateFingerprint(draft);
    if (fp === this.fingerprint && this.current) return this.current;
    this.fingerprint = fp;

    const state: DisplayState = { ...draft, seq: nextSeq(this.current?.seq || 0) };
    this.current = state;
    writeStoredState(this.opts.terminal, state);
    this.local.post({ type: 'state', state });
    this.schedulePush(this.opts.serverDebounceMs);
    return state;
  }

  /**
   * Turns the last published bill into "paid" (e.g. after an online payment that left the
   * POS page and came back on a different route). Returns null if there was no bill.
   */
  markPaid(method: string): DisplayState | null {
    const last = this.current;
    if (this.disposed || !last || last.items.length === 0 || last.phase === 'paid') return null;
    const state: DisplayState = {
      ...last,
      phase: 'paid',
      payment: { method, amount: last.totals.grandTotal },
      seq: nextSeq(last.seq),
      at: Date.now(),
    };
    this.current = state;
    this.fingerprint = stateFingerprint(state);
    writeStoredState(this.opts.terminal, state);
    this.local.post({ type: 'state', state });
    return state;
  }

  /** Sends the newest snapshot to the server now (use before disposing a short-lived publisher). */
  async flushNow(): Promise<void> {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = null;
    await this.flush();
  }

  private schedulePush(delay: number) {
    if (!this.opts.pushToServer || this.disposed) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => void this.flush(), delay);
  }

  /** Sends only the newest snapshot; a failed send is retried with whatever is newest then. */
  private async flush() {
    this.pushTimer = null;
    const state = this.current;
    if (!state || !this.opts.pushToServer || this.pushing || state.seq <= this.pushedSeq) return;
    this.pushing = true;
    try {
      await this.opts.pushToServer(state);
      this.pushedSeq = Math.max(this.pushedSeq, state.seq);
    } catch {
      this.schedulePush(this.opts.serverRetryMs);
    } finally {
      this.pushing = false;
      if (this.current && this.current.seq > this.pushedSeq && !this.pushTimer) this.schedulePush(0);
    }
  }

  dispose() {
    this.disposed = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.local.close();
  }
}

// ─── Customer screen side ───────────────────────────────────────────────────

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting';

/** The subset of a socket.io-client Socket this module uses. */
export interface DisplaySocket {
  connected: boolean;
  on: (event: string, cb: (...args: any[]) => void) => unknown;
  emit: (event: string, ...args: any[]) => unknown;
  disconnect: () => unknown;
}

export interface ServerPoll {
  seq: number;
  contentVersion: number;
  state: DisplayState | null;
}

export class UnauthorizedDisplayError extends Error {}

export interface SubscriberOptions {
  terminal: string;
  key: string;
  /** GET the terminal's state from the server (polling fallback). Throw UnauthorizedDisplayError on 401. */
  fetchState: (since: number) => Promise<ServerPoll>;
  /** Returns a connected-or-connecting Socket.IO client, or null when realtime isn't available. */
  createSocket?: () => DisplaySocket | null;
  onState: (state: DisplayState) => void;
  onContentVersion?: (version: number) => void;
  onStatus?: (status: ConnectionStatus) => void;
  onUnauthorized?: () => void;
  initialState?: DisplayState | null;
  pollMs?: number;
  /** After this long without same-PC messages, fall back to the server. */
  localQuietMs?: number;
  /** How often to check for banner/settings changes while the fast paths are carrying the bill. */
  contentCheckMs?: number;
  maxBackoffMs?: number;
}

export const subscribeToDisplay = (options: SubscriberOptions): (() => void) => {
  const opts = {
    pollMs: 2000,
    localQuietMs: 7000,
    contentCheckMs: 60000,
    maxBackoffMs: 15000,
    ...options,
  };
  let current: DisplayState | null = opts.initialState || null;
  let lastLocalAt = 0;
  let socketLive = false;
  let serverOk = false;
  let everConnected = false;
  let failures = 0;
  let lastServerCheck = 0;
  let stopped = false;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let lastStatus: ConnectionStatus | null = null;

  const apply = (state: DisplayState | null | undefined) => {
    if (stopped || !isNewerState(current, state)) return;
    current = state;
    opts.onState(state);
  };

  const updateStatus = () => {
    const localActive = Date.now() - lastLocalAt < opts.localQuietMs;
    const live = localActive || socketLive || serverOk;
    if (live) everConnected = true;
    const status: ConnectionStatus = live ? 'live' : everConnected ? 'reconnecting' : 'connecting';
    if (status !== lastStatus) {
      lastStatus = status;
      opts.onStatus?.(status);
    }
  };

  const unauthorized = () => {
    if (stopped) return;
    stop();
    opts.onUnauthorized?.();
  };

  // 1. Same-PC channel
  const local = createLocalTransport(opts.terminal, (msg) => {
    lastLocalAt = Date.now();
    if (msg.type === 'state') apply(msg.state);
    else if (msg.type === 'heartbeat' && current && msg.seq > current.seq) apply(readStoredState(opts.terminal));
    updateStatus();
  });
  apply(readStoredState(opts.terminal));
  local.post({ type: 'hello' });

  // 2. Socket.IO (only when the backend can host it)
  let socket: DisplaySocket | null = null;
  try {
    socket = opts.createSocket?.() || null;
  } catch {
    socket = null;
  }
  if (socket) {
    const join = () =>
      socket!.emit('cfd-join', { terminal: opts.terminal, key: opts.key }, (res: { ok: boolean }) => {
        if (res?.ok) {
          socketLive = true;
          updateStatus();
        } else {
          unauthorized();
        }
      });
    socket.on('connect', join);
    if (socket.connected) join();
    socket.on('disconnect', () => {
      socketLive = false;
      updateStatus();
    });
    socket.on('cfd-state', (state: DisplayState) => apply(state));
    socket.on('cfd-content', (payload: { contentVersion: number }) => opts.onContentVersion?.(payload?.contentVersion));
    socket.on('cfd-key-revoked', unauthorized);
  }

  // 3. Polling fallback + periodic content check
  const tick = async () => {
    if (stopped) return;
    const now = Date.now();
    const localActive = now - lastLocalAt < opts.localQuietMs;
    const needBill = !localActive && !socketLive;
    const needContentCheck = now - lastServerCheck >= opts.contentCheckMs;

    if (needBill || needContentCheck) {
      lastServerCheck = now;
      try {
        const res = await opts.fetchState(current?.seq || 0);
        if (stopped) return;
        failures = 0;
        serverOk = true;
        if (res.state) apply(res.state);
        if (typeof res.contentVersion === 'number') opts.onContentVersion?.(res.contentVersion);
      } catch (err) {
        if (err instanceof UnauthorizedDisplayError) return unauthorized();
        failures += 1;
        serverOk = false;
      }
    } else if (localActive || socketLive) {
      serverOk = false; // not relying on it; status comes from the fast paths
    }
    updateStatus();
    const delay = failures > 0 ? Math.min(opts.pollMs * 2 ** failures, opts.maxBackoffMs) : opts.pollMs;
    pollTimer = setTimeout(tick, delay);
  };
  pollTimer = setTimeout(tick, 0);
  updateStatus();

  function stop() {
    stopped = true;
    if (pollTimer) clearTimeout(pollTimer);
    local.close();
    socket?.disconnect();
  }
  return stop;
};
