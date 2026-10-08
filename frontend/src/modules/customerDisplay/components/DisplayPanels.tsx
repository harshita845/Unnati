import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, QrCode, ShoppingBag, Wallet } from 'lucide-react';
import type { DisplayBranding, DisplayState, DisplayTheme } from '../sync/displayTypes';

/** The left-column panels of the Customer Display: bill, payment and payment-done. */

export const formatINR = (amount: number) =>
  `₹${(Number.isFinite(amount) ? amount : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatQty = (qty: number) => (Number.isInteger(qty) ? String(qty) : qty.toFixed(3).replace(/0+$/, ''));

const useClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);
  return now;
};

export const StoreMark = ({ branding, theme, size = 'md' }: { branding: DisplayBranding; theme: DisplayTheme; size?: 'md' | 'lg' }) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const box = size === 'lg' ? 'h-20 w-20 text-3xl' : 'h-12 w-12 text-xl';
  return (
    <div className="flex min-w-0 items-center gap-3">
      {branding.logoUrl && !logoFailed ? (
        <img src={branding.logoUrl} alt="" onError={() => setLogoFailed(true)} className={`${box} shrink-0 rounded-xl bg-white object-contain p-1`} />
      ) : (
        <div className={`${box} flex shrink-0 items-center justify-center rounded-xl font-black text-white`} style={{ background: theme.primary }}>
          {(branding.storeName || 'S').charAt(0).toUpperCase()}
        </div>
      )}
      {branding.storeName && (
        <span className={`truncate font-extrabold ${size === 'lg' ? 'text-4xl' : 'text-xl'}`} style={{ color: theme.text }}>
          {branding.storeName}
        </span>
      )}
    </div>
  );
};

const PanelHeader = ({
  branding,
  theme,
  billNo,
  customerName,
}: {
  branding: DisplayBranding;
  theme: DisplayTheme;
  billNo: string;
  customerName?: string;
}) => {
  const now = useClock();
  return (
    <div className="flex items-center justify-between gap-4 border-b px-6 py-4" style={{ borderColor: `${theme.text}14` }}>
      <StoreMark branding={branding} theme={theme} />
      <div className="shrink-0 text-right leading-tight" style={{ color: theme.text }}>
        {customerName && <div className="text-base font-extrabold" style={{ color: theme.primary }}>Welcome, {customerName}</div>}
        {billNo && <div className="text-sm font-bold opacity-80">{billNo}</div>}
        <div className="text-xs opacity-60">
          {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ·{' '}
          {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

const TotalRow = ({ label, value, theme, tone }: { label: string; value: string; theme: DisplayTheme; tone?: 'save' }) => (
  <div className="flex items-center justify-between text-base" style={{ color: tone === 'save' ? '#15803d' : theme.text }}>
    <span className="opacity-80">{label}</span>
    <span className="font-semibold tabular-nums">{value}</span>
  </div>
);

const Totals = ({ state, theme }: { state: DisplayState; theme: DisplayTheme }) => (
  <div className="space-y-1.5 border-t px-6 py-4" style={{ borderColor: `${theme.text}14` }}>
    <TotalRow label={`Items (${formatQty(state.totals.itemCount)})`} value={formatINR(state.totals.subtotal)} theme={theme} />
    {state.totals.discount > 0 && <TotalRow label="You save" value={`− ${formatINR(state.totals.discount)}`} theme={theme} tone="save" />}
    {state.totals.tax > 0 && <TotalRow label="GST (included)" value={formatINR(state.totals.tax)} theme={theme} />}
    <div className="mt-2 flex items-end justify-between rounded-2xl px-5 py-3 text-white" style={{ background: theme.primary }}>
      <span className="text-lg font-bold">Total</span>
      <span className="text-4xl font-black tabular-nums tracking-tight">{formatINR(state.totals.grandTotal)}</span>
    </div>
  </div>
);

/** Live bill: newest line scrolls into view and flashes when added or changed. */
export const BillPanel = ({
  state,
  branding,
  theme,
  flash,
}: {
  state: DisplayState;
  branding: DisplayBranding;
  theme: DisplayTheme;
  flash: { ids: string[]; nonce: number };
}) => {
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    const target = flash.ids[flash.ids.length - 1];
    const row = target ? rowRefs.current.get(target) : null;
    row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [flash.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: theme.panel }}>
      <PanelHeader branding={branding} theme={theme} billNo={state.billNo} customerName={state.customerName} />
      <div
        className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-6 pb-2 pt-3 text-xs font-bold uppercase tracking-wider opacity-60"
        style={{ color: theme.text }}
      >
        <span>Item</span>
        <span className="text-right">Qty</span>
        <span className="w-24 text-right">Price</span>
        <span className="w-28 text-right">Amount</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {state.items.map((item) => {
          const flashing = flash.ids.includes(item.id);
          return (
            <div
              key={flashing ? `${item.id}-${flash.nonce}` : item.id}
              ref={(el) => {
                if (el) rowRefs.current.set(item.id, el);
                else rowRefs.current.delete(item.id);
              }}
              className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 rounded-xl px-3 py-2.5 ${flashing ? 'cfd-flash' : ''}`}
              style={{ color: theme.text }}
            >
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold">{item.name}</div>
                {item.mrp > item.unitPrice && (
                  <div className="text-xs opacity-60">
                    MRP <span className="line-through">{formatINR(item.mrp)}</span>
                  </div>
                )}
              </div>
              <span className="text-right text-lg font-bold tabular-nums">{formatQty(item.qty)}</span>
              <span className="w-24 text-right tabular-nums opacity-80">{formatINR(item.unitPrice)}</span>
              <span className="w-28 text-right text-lg font-bold tabular-nums">{formatINR(item.lineTotal)}</span>
            </div>
          );
        })}
      </div>
      <Totals state={state} theme={theme} />
      <div className="flex items-center justify-center gap-2 px-6 pb-4 text-sm font-semibold" style={{ color: theme.primary }}>
        <ShoppingBag className="h-4 w-4" /> Billing in progress
      </div>
    </div>
  );
};

/** Amount to pay plus the store's UPI QR (from POS Bill Settings). */
export const PaymentPanel = ({
  state,
  branding,
  theme,
  showQr,
}: {
  state: DisplayState;
  branding: DisplayBranding;
  theme: DisplayTheme;
  showQr: boolean;
}) => {
  const [qrFailed, setQrFailed] = useState(false);
  const amount = state.payment?.amount ?? state.totals.grandTotal;
  const method = (state.payment?.method || '').toLowerCase();
  const isCash = method === 'cash';
  const qrVisible = showQr && !isCash && !!branding.upiQrUrl && !qrFailed;

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: theme.panel, color: theme.text }}>
      <PanelHeader branding={branding} theme={theme} billNo={state.billNo} customerName={state.customerName} />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="text-lg font-semibold uppercase tracking-widest opacity-70">Amount to pay</div>
        <div className="text-6xl font-black tabular-nums tracking-tight" style={{ color: theme.primary }}>
          {formatINR(amount)}
        </div>
        {qrVisible ? (
          <>
            <div className="rounded-3xl bg-white p-4 shadow-xl ring-4" style={{ ['--tw-ring-color' as any]: `${theme.primary}33` }}>
              <img src={branding.upiQrUrl} alt="UPI QR code" onError={() => setQrFailed(true)} className="h-64 w-64 object-contain" />
            </div>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <QrCode className="h-5 w-5" style={{ color: theme.primary }} /> Scan with any UPI app to pay
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl px-6 py-4 text-xl font-semibold" style={{ background: `${theme.primary}14` }}>
            <Wallet className="h-6 w-6" style={{ color: theme.primary }} />
            {isCash ? 'Please pay at the counter' : 'Please complete the payment with the cashier'}
          </div>
        )}
        <div className="flex items-center gap-2 text-sm opacity-70">
          <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: theme.accent }} /> Waiting for payment…
        </div>
      </div>
    </div>
  );
};

/** "Payment Successful" summary with a countdown back to the welcome screen. */
export const PaidPanel = ({
  state,
  branding,
  theme,
  thankYouText,
  seconds,
}: {
  state: DisplayState;
  branding: DisplayBranding;
  theme: DisplayTheme;
  thankYouText: string;
  seconds: number;
}) => {
  // Udhaar bills aren't paid now: they're added to the customer's credit account
  const isCredit = /credit|udhaar/i.test(state.payment?.method || '');
  return (
  <div className="flex h-full min-h-0 flex-col" style={{ background: theme.panel, color: theme.text }}>
    <PanelHeader branding={branding} theme={theme} billNo={state.billNo} customerName={state.customerName} />
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <CheckCircle2 className={`cfd-pop h-28 w-28 ${isCredit ? 'text-amber-500' : 'text-green-600'}`} strokeWidth={1.75} />
      <div className={`text-4xl font-black ${isCredit ? 'text-amber-600' : 'text-green-700'}`}>
        {isCredit ? 'Added to your credit account' : 'Payment Successful'}
      </div>
      <div className="text-5xl font-black tabular-nums">{formatINR(state.payment?.amount ?? state.totals.grandTotal)}</div>
      <div className="w-full max-w-md space-y-1.5 rounded-2xl px-5 py-4 text-left" style={{ background: `${theme.text}08` }}>
        <TotalRow label="Items" value={formatQty(state.totals.itemCount)} theme={theme} />
        {state.payment?.method && (
          <TotalRow label={isCredit ? 'Bill type' : 'Paid by'} value={isCredit ? 'Credit (Udhaar)' : state.payment.method} theme={theme} />
        )}
        {state.totals.discount > 0 && <TotalRow label="You saved" value={formatINR(state.totals.discount)} theme={theme} tone="save" />}
      </div>
      <div className="text-2xl font-bold" style={{ color: theme.primary }}>
        {thankYouText}
      </div>
    </div>
    <div className="h-1.5 w-full" style={{ background: `${theme.text}10` }}>
      <div className="cfd-countdown h-full" style={{ background: theme.primary, animationDuration: `${seconds}s` }} />
    </div>
  </div>
  );
};
