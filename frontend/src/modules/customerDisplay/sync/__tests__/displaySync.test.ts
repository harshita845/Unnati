import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDisplayState, changedItemIds, isNewerState, nextSeq, resolveScreenView, shouldHoldPaid } from '../displaySnapshot';
import { DisplayPublisher, subscribeToDisplay, UnauthorizedDisplayError, type ConnectionStatus } from '../displayChannel';
import type { DisplayState } from '../displayTypes';

// Browser-like localStorage (the POS page and the success page share it in the real app)
const memoryStore = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => (memoryStore.has(k) ? memoryStore.get(k)! : null),
    setItem: (k: string, v: string) => void memoryStore.set(k, String(v)),
    removeItem: (k: string) => void memoryStore.delete(k),
    clear: () => memoryStore.clear(),
    key: (i: number) => [...memoryStore.keys()][i] ?? null,
    get length() {
      return memoryStore.size;
    },
  },
});

const last = <T,>(list: T[]): T | undefined => list[list.length - 1];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (check: () => boolean, timeoutMs = 2000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition');
    await wait(5);
  }
};

const milk = { id: 'milk', name: 'Milk 1L', qty: 2, unitPrice: 30, mrp: 32, gstPercent: 5 };
const bread = { id: 'bread', name: 'Bread', qty: 1, unitPrice: 45, mrp: 45, gstPercent: 0 };

test('snapshot totals follow the POS (GST-inclusive prices)', () => {
  // POS keeps the newest line first
  const s = buildDisplayState({ phase: 'billing', billNo: 'Bill 1', lines: [bread, milk] }, 1);
  assert.deepEqual(s.items.map((i) => i.id), ['milk', 'bread'], 'listed oldest first');
  assert.equal(s.totals.grandTotal, 105);
  assert.equal(s.totals.subtotal, 109);
  assert.equal(s.totals.discount, 4);
  assert.equal(s.totals.itemCount, 3);
  assert.equal(s.totals.tax, 2.86); // 60 × 5/105
  assert.equal(s.payment, null);
});

test('empty cart is idle; payment carries the amount', () => {
  assert.equal(buildDisplayState({ phase: 'billing', lines: [] }, 1).phase, 'idle');
  const pay = buildDisplayState({ phase: 'payment', lines: [milk], paymentMethod: 'UPI' }, 2);
  assert.deepEqual(pay.payment, { method: 'UPI', amount: 60 });
});

test('ordering: only newer snapshots apply, seq never goes backwards', () => {
  const a = buildDisplayState({ phase: 'billing', lines: [milk] }, 10);
  const b = buildDisplayState({ phase: 'billing', lines: [milk, bread] }, 11);
  assert.equal(isNewerState(null, a), true);
  assert.equal(isNewerState(a, b), true);
  assert.equal(isNewerState(b, a), false, 'late duplicate is ignored');
  assert.equal(isNewerState(b, b), false);
  assert.equal(nextSeq(500, 100), 501, 'clock behind → still increases');
  assert.equal(nextSeq(5, 1000), 1000);
});

test('changed items drive the highlight', () => {
  const a = buildDisplayState({ phase: 'billing', lines: [milk] }, 1);
  const b = buildDisplayState({ phase: 'billing', lines: [bread, { ...milk, qty: 3 }] }, 2);
  assert.deepEqual(changedItemIds(a, b).sort(), ['bread', 'milk']);
  assert.deepEqual(changedItemIds(b, b), []);
});

test('same-PC sync: cashier changes reach the screen instantly, in order', async () => {
  const terminal = `t-local-${Date.now()}`;
  const received: DisplayState[] = [];
  let polls = 0;
  const publisher = new DisplayPublisher({ terminal, heartbeatMs: 20 });
  const stop = subscribeToDisplay({
    terminal,
    key: 'k',
    fetchState: async () => {
      polls += 1;
      return { seq: 0, contentVersion: 1, state: null };
    },
    onState: (s) => received.push(s),
    pollMs: 10,
    localQuietMs: 200,
    contentCheckMs: 60000,
  });

  publisher.publish({ phase: 'billing', billNo: 'Bill 1', lines: [milk] });
  publisher.publish({ phase: 'billing', billNo: 'Bill 1', lines: [bread, milk] });
  publisher.publish({ phase: 'billing', billNo: 'Bill 1', lines: [bread, milk] }); // no visible change → not sent
  publisher.publish({ phase: 'payment', billNo: 'Bill 1', lines: [bread, milk], paymentMethod: 'UPI' });

  await waitFor(() => last(received)?.phase === 'payment');
  assert.deepEqual(received.map((s) => s.phase), ['billing', 'billing', 'payment']);
  assert.ok(received.every((s, i) => i === 0 || s.seq > received[i - 1].seq));
  assert.equal(last(received)!.totals.grandTotal, 105);

  const pollsBefore = polls;
  await wait(100);
  assert.ok(polls - pollsBefore <= 1, 'no bill polling while the same-PC channel is live');

  stop();
  publisher.dispose();
});

test('a screen opened mid-bill catches up from the cashier', async () => {
  const terminal = `t-hello-${Date.now()}`;
  const publisher = new DisplayPublisher({ terminal, heartbeatMs: 1000 });
  publisher.publish({ phase: 'billing', lines: [milk, bread] });

  let got: DisplayState | null = null;
  const stop = subscribeToDisplay({
    terminal,
    key: 'k',
    fetchState: async () => ({ seq: 0, contentVersion: 1, state: null }),
    onState: (s) => (got = s),
    pollMs: 1000,
  });
  await waitFor(() => got !== null);
  assert.equal(got!.items.length, 2);
  stop();
  publisher.dispose();
});

test('server fallback: screen on another PC polls and reconnects after errors', async () => {
  const terminal = `t-remote-${Date.now()}`;
  const remote = buildDisplayState({ phase: 'billing', lines: [milk] }, 100);
  const newer = buildDisplayState({ phase: 'paid', lines: [milk], paymentMethod: 'UPI' }, 101);
  let call = 0;
  const statuses: ConnectionStatus[] = [];
  const received: DisplayState[] = [];
  const versions: number[] = [];

  const stop = subscribeToDisplay({
    terminal,
    key: 'k',
    fetchState: async (since) => {
      call += 1;
      if (call === 1) return { seq: 100, contentVersion: 7, state: since < 100 ? remote : null };
      if (call === 2 || call === 3) throw new Error('network down');
      return { seq: 101, contentVersion: 8, state: since < 101 ? newer : null };
    },
    onState: (s) => received.push(s),
    onStatus: (s) => statuses.push(s),
    onContentVersion: (v) => versions.push(v),
    pollMs: 5,
    localQuietMs: 1,
    maxBackoffMs: 30,
  });

  await waitFor(() => last(received)?.phase === 'paid');
  assert.deepEqual(received.map((s) => s.seq), [100, 101]);
  assert.ok(statuses.includes('reconnecting'), 'shows the reconnecting dot while the server is unreachable');
  assert.equal(last(statuses), 'live');
  assert.deepEqual([...new Set(versions)], [7, 8], 'content version changes are reported (banner refetch)');
  stop();
});

test('revoked display key stops the screen', async () => {
  let unauthorized = false;
  const stop = subscribeToDisplay({
    terminal: `t-revoked-${Date.now()}`,
    key: 'old',
    fetchState: async () => {
      throw new UnauthorizedDisplayError('revoked');
    },
    onState: () => undefined,
    onUnauthorized: () => (unauthorized = true),
    pollMs: 5,
    localQuietMs: 1,
  });
  await waitFor(() => unauthorized);
  stop();
});

test('paid screen is held while the cashier clears the cart, until the next customer starts', () => {
  const paid = buildDisplayState({ phase: 'paid', lines: [milk], paymentMethod: 'Cash' }, 10);
  const cleared = buildDisplayState({ phase: 'billing', lines: [] }, 11); // cart emptied → idle
  const nextCustomer = buildDisplayState({ phase: 'billing', lines: [bread] }, 12);

  assert.equal(resolveScreenView(paid, paid).phase, 'paid');
  const held = resolveScreenView(cleared, paid);
  assert.equal(held.phase, 'paid', 'emptied cart does not cut the thank-you screen short');
  assert.equal(held.phase === 'paid' && held.state.seq, 10);
  assert.equal(resolveScreenView(nextCustomer, paid).phase, 'billing', 'a new bill replaces it immediately');
  assert.equal(resolveScreenView(cleared, null).phase, 'idle', 'after the timer: back to idle');
  assert.equal(resolveScreenView(paid, null).phase, 'idle', 'an old paid state alone does not reopen the thank-you screen');

  assert.equal(shouldHoldPaid(paid, 8, paid.at + 3000), true);
  assert.equal(shouldHoldPaid(paid, 8, paid.at + 60 * 60 * 1000), false, 'reopening the screen later shows idle, not an old receipt');
});

test('online payment returning on another page marks the last bill paid', async () => {
  const terminal = `t-paid-${Date.now()}`;
  const pushed: DisplayState[] = [];
  const cashier = new DisplayPublisher({ terminal, heartbeatMs: 1000 });
  cashier.publish({ phase: 'payment', billNo: 'Bill 1', lines: [milk, bread], paymentMethod: 'PhonePe' });
  cashier.dispose(); // POS page navigates away to the payment gateway

  const received: DisplayState[] = [];
  const stop = subscribeToDisplay({
    terminal,
    key: 'k',
    fetchState: async () => ({ seq: 0, contentVersion: 1, state: null }),
    onState: (s) => received.push(s),
    pollMs: 1000,
  });
  await waitFor(() => last(received)?.phase === 'payment');

  const successPage = new DisplayPublisher({ terminal, heartbeatMs: 1000, pushToServer: async (s) => void pushed.push(s) });
  const paid = successPage.markPaid('PhonePe');
  await successPage.flushNow();
  successPage.dispose();

  assert.equal(paid?.phase, 'paid');
  assert.deepEqual(paid?.payment, { method: 'PhonePe', amount: 105 });
  await waitFor(() => last(received)?.phase === 'paid');
  assert.equal(pushed.length, 1, 'also sent to the server for screens on other PCs');
  const again = new DisplayPublisher({ terminal });
  assert.equal(again.markPaid('x'), null, 'no double "paid"');
  again.dispose();
  stop();
});
