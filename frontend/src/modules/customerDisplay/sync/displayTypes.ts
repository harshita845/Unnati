/** Shapes shared by the POS (publisher), the customer screen and the API. Mirrors the backend. */

export type DisplayPhase = 'idle' | 'billing' | 'payment' | 'paid';

export interface DisplayItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  mrp: number;
  lineTotal: number;
}

export interface DisplayTotals {
  itemCount: number;
  /** Total at MRP */
  subtotal: number;
  /** Savings vs MRP */
  discount: number;
  /** GST included in the total */
  tax: number;
  grandTotal: number;
}

export interface DisplayState {
  phase: DisplayPhase;
  billNo: string;
  items: DisplayItem[];
  totals: DisplayTotals;
  payment: { method: string; amount: number } | null;
  /** Monotonic per terminal; older snapshots are ignored. */
  seq: number;
  /** Epoch ms when the cashier produced the snapshot. */
  at: number;
}

export interface DisplayTheme {
  primary: string;
  background: string;
  panel: string;
  text: string;
  accent: string;
}

export interface DisplaySettingsPublic {
  showBanners: boolean;
  billSide: 'left' | 'right';
  billColumnWidth: number;
  fontScale: 'small' | 'medium' | 'large';
  theme: DisplayTheme;
  welcomeText: string;
  thankYouText: string;
  paidScreenSeconds: number;
  showUpiQr: boolean;
  defaultImageSeconds: number;
  defaultBanner: { mediaType: 'image' | 'video'; mediaUrl: string };
}

export interface DisplayBranding {
  storeName: string;
  logoUrl: string;
  upiQrUrl: string;
}

export interface LiveBanner {
  _id: string;
  title: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  posterUrl?: string;
  durationSeconds: number;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettingsPublic = {
  showBanners: true,
  billSide: 'left',
  billColumnWidth: 40,
  fontScale: 'medium',
  theme: { primary: '#0f766e', background: '#f1f5f9', panel: '#ffffff', text: '#0f172a', accent: '#f59e0b' },
  welcomeText: 'Welcome! Happy shopping',
  thankYouText: 'Thank you, visit again!',
  paidScreenSeconds: 8,
  showUpiQr: true,
  defaultImageSeconds: 5,
  defaultBanner: { mediaType: 'image', mediaUrl: '' },
};
