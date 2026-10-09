/** Seller Bill Settings page — same key as `SellerBillSettings.tsx` localStorage cache. */
export const SELLER_BILL_SETTINGS_KEY = 'seller_bill_settings';

/** Fires on the same window when seller saves bill settings (`storage` only fires in other tabs). */
export const SELLER_BILL_SETTINGS_UPDATED_EVENT = 'seller_bill_settings_updated';

export interface PosBillSettings {
  shopName?: string;
  sellerName?: string;
  address?: string;
  phone?: string;
  email?: string;

  // Basic Details Toggles
  notes?: {
    text: string;
    enabled: boolean;
    alignment?: 'left' | 'center' | 'right';
  };
  terms?: {
    text: string;
    enabled: boolean;
    fontSize?: 'small' | 'normal' | 'large';
    alignment?: 'left' | 'center' | 'right';
  };
  gst?: {
    text: string;
    enabled: boolean;
  };
  fssai?: {
    text: string;
    enabled: boolean;
  };

  // Branding & Logo
  logo?: {
    enabled: boolean;
    url: string;
    size: 'small' | 'medium' | 'large';
    alignment: 'left' | 'center' | 'right';
  };

  // QR Code
  qrCode?: string; // Image URL string for backward compatibility
  qrSettings?: {
    enabled: boolean;
    url?: string;
    size: 'small' | 'medium' | 'large';
    alignment: 'left' | 'center' | 'right';
  };

  // Typography
  fontFamily?: 'sans' | 'inter' | 'roboto' | 'arial' | 'helvetica' | 'opensans' | 'mono' | 'serif' | 'georgia';
  fontSize?: 'xsmall' | 'small' | 'compact' | 'normal' | 'medium' | 'large' | 'xlarge';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';

  // Spacing & Layout
  lineSpacing?: 'compact' | 'normal' | 'comfortable';
  letterSpacing?: 'tight' | 'normal' | 'wide';
  paperWidth?: '80mm' | '58mm';
  margins?: {
    top: number; // in mm
    right: number;
    bottom: number;
    left: number;
  };

  // Alignments
  headerAlignment?: 'left' | 'center' | 'right';

  // Footer Tagline
  footerSlogan?: {
    text: string;
    enabled: boolean;
    alignment?: 'left' | 'center' | 'right';
    fontSize?: 'small' | 'normal' | 'large';
    bold?: boolean;
  };

  // Table Columns
  tableColumns?: {
    showIndex: boolean;
    showQty: boolean;
    showMrp: boolean;
    showSp: boolean;
    showDiscount: boolean;
    showTotal: boolean;
    showWarranty: boolean;
  };

  // Divider / Borders
  dividerStyle?: 'single' | 'double' | 'dashed' | 'dotted' | 'none';
  dividerSpacing?: 'compact' | 'normal';

  // Section Styling
  grandTotalSize?: 'normal' | 'medium' | 'large';
  showEstimatedBillHeader?: boolean;
}

export function getDefaultPosBillSettings(): PosBillSettings {
  return {
    shopName: '',
    sellerName: '',
    address: '',
    phone: '',
    email: '',
    notes: {
      text: 'Thank you for your business',
      enabled: true,
      alignment: 'center',
    },
    terms: {
      text: 'Goods once sold will not be taken back.',
      enabled: true,
      fontSize: 'normal',
      alignment: 'center',
    },
    gst: {
      text: '',
      enabled: false,
    },
    fssai: {
      text: '',
      enabled: false,
    },
    logo: {
      enabled: false,
      url: '',
      size: 'medium',
      alignment: 'center',
    },
    qrCode: '',
    qrSettings: {
      enabled: true,
      url: '',
      size: 'medium',
      alignment: 'center',
    },
    fontFamily: 'sans',
    fontSize: 'normal',
    fontWeight: 'normal',
    lineSpacing: 'normal',
    letterSpacing: 'normal',
    paperWidth: '80mm',
    margins: {
      top: 2,
      right: 3,
      bottom: 4,
      left: 2,
    },
    headerAlignment: 'left',
    footerSlogan: {
      text: '',
      enabled: false,
      alignment: 'center',
      fontSize: 'normal',
      bold: true,
    },
    tableColumns: {
      showIndex: true,
      showQty: true,
      showMrp: true,
      showSp: true,
      showDiscount: true,
      showTotal: true,
      showWarranty: true,
    },
    dividerStyle: 'single',
    dividerSpacing: 'normal',
    grandTotalSize: 'normal',
    showEstimatedBillHeader: true,
  };
}

export function getThermalReceiptFontFamily(family?: string): string {
  switch (family) {
    case 'inter':
      return "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    case 'roboto':
      return "'Roboto', -apple-system, BlinkMacSystemFont, Arial, sans-serif";
    case 'arial':
      return "Arial, Helvetica, sans-serif";
    case 'helvetica':
      return "'Helvetica Neue', Helvetica, Arial, sans-serif";
    case 'opensans':
      return "'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif";
    case 'mono':
      return "'Courier New', Courier, monospace";
    case 'serif':
      return "'Times New Roman', Times, serif";
    case 'georgia':
      return "Georgia, serif";
    case 'sans':
    default:
      return "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  }
}

export function getThermalReceiptWidthMm(width?: string): string {
  return width === '58mm' ? '48mm' : '72mm';
}

export function getThermalReceiptBaseFontSizePx(size?: string): number {
  switch (size) {
    case 'xsmall':
      return 10;
    case 'small':
    case 'compact':
      return 11;
    case 'medium':
      return 14;
    case 'large':
      return 15.5;
    case 'xlarge':
      return 17;
    case 'normal':
    default:
      return 12.5;
  }
}

export function getThermalReceiptFontWeightValue(weight?: string): number {
  switch (weight) {
    case 'medium':
      return 500;
    case 'semibold':
      return 600;
    case 'bold':
      return 700;
    case 'normal':
    default:
      return 400;
  }
}

export function getThermalReceiptLineHeight(spacing?: string): number {
  switch (spacing) {
    case 'compact':
      return 1.15;
    case 'comfortable':
      return 1.55;
    case 'normal':
    default:
      return 1.35;
  }
}

export function getThermalReceiptLetterSpacing(spacing?: string): string {
  switch (spacing) {
    case 'tight':
      return '-0.3px';
    case 'wide':
      return '0.5px';
    case 'normal':
    default:
      return '0px';
  }
}

/** Read cached seller bill settings from localStorage (used by Seller POS print/PDF). */
export function readSellerPosBillSettings(): PosBillSettings | null {
  try {
    const raw = localStorage.getItem(SELLER_BILL_SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PosBillSettings;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
