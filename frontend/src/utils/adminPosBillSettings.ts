import {
  PosBillSettings,
  getThermalReceiptFontFamily,
  getThermalReceiptWidthMm,
  getReceiptPageCss,
  getThermalReceiptBaseFontSizePx,
  getThermalReceiptFontWeightValue,
  getThermalReceiptLineHeight,
  getThermalReceiptLetterSpacing,
  getDefaultPosBillSettings,
} from './sellerPosBillSettings';

export type { PosBillSettings };
export {
  getThermalReceiptFontFamily,
  getThermalReceiptWidthMm,
  getReceiptPageCss,
  getThermalReceiptBaseFontSizePx,
  getThermalReceiptFontWeightValue,
  getThermalReceiptLineHeight,
  getThermalReceiptLetterSpacing,
  getDefaultPosBillSettings,
};

/** Admin POS bill header/footer stored in localStorage (Bill Settings page). */
export const ADMIN_POS_BILL_SETTINGS_KEY = 'admin_pos_bill_settings';

/** Dispatched on same window when settings are saved (storage event only fires on other tabs). */
export const ADMIN_POS_BILL_SETTINGS_UPDATED_EVENT = 'admin_pos_bill_settings_updated';

export function readAdminPosBillSettings(): PosBillSettings | null {
  try {
    const raw = localStorage.getItem(ADMIN_POS_BILL_SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PosBillSettings;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
