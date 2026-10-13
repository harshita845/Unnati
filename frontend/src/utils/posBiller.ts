import { getModuleUserData } from "./moduleAuth";
import { getStaffSession } from "./staffSession";
import type { PosBillSettings } from "./sellerPosBillSettings";

/**
 * "Seller Name" on POS bills: whoever is billing right now — the staff member if a staff
 * login is active, otherwise the signed-in admin / seller. Never typed by hand.
 */
export function currentBillerName(module: "admin" | "seller"): string {
  const staff = getStaffSession(module);
  if (staff?.name) return staff.name.trim();
  const user = getModuleUserData(module) || {};
  if (module === "admin") {
    return `${user.firstName || ""} ${user.lastName || ""}`.trim() || String(user.name || "").trim();
  }
  return String(user.sellerName || user.name || user.storeName || "").trim();
}

/** Bill Settings toggle "Show Seller Name on bill" (on unless switched off) */
export const showsSellerName = (settings?: PosBillSettings | null) => settings?.showSellerName !== false;
