/**
 * Customer Display banner scheduling. Pure functions (no DB) so they can be unit tested.
 *
 * Dates are whole days in the store's timezone (India, UTC+05:30): a banner scheduled
 * 2026-10-01 → 2026-10-07 shows from 00:00 on the 1st until 23:59:59 on the 7th.
 */

export type BannerStatus = "active" | "scheduled" | "expired" | "inactive";

export interface ScheduleWindow {
  isActive: boolean;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

export interface SchedulableBanner extends ScheduleWindow {
  terminals?: string[];
}

/** Offset of the store timezone from UTC, in minutes (India Standard Time). */
export const STORE_TZ_OFFSET_MINUTES = 330;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-07" → the instant that day starts in store time. Returns null for bad input. */
export const storeDayStart = (day: string): Date | null => {
  const m = DATE_ONLY.exec(day);
  if (!m) return null;
  const utcMidnight = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const date = new Date(utcMidnight - STORE_TZ_OFFSET_MINUTES * 60 * 1000);
  // Reject impossible dates such as 2026-02-31 (Date.UTC silently rolls them over)
  return toStoreDay(date) === day ? date : null;
};

/** "2026-10-07" → the last millisecond of that day in store time. */
export const storeDayEnd = (day: string): Date | null => {
  const start = storeDayStart(day);
  return start ? new Date(start.getTime() + DAY_MS - 1) : null;
};

/** An instant → its "YYYY-MM-DD" day in store time. */
export const toStoreDay = (value: Date | string): string => {
  const shifted = new Date(new Date(value).getTime() + STORE_TZ_OFFSET_MINUTES * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
};

const toTime = (value: Date | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * Where a window sits relative to `now`. A missing start means "already started",
 * a missing end means "never ends".
 */
export const getWindowStatus = (window: ScheduleWindow, now: Date = new Date()): BannerStatus => {
  if (!window.isActive) return "inactive";
  const t = now.getTime();
  const start = toTime(window.startDate);
  const end = toTime(window.endDate);
  if (end !== null && t > end) return "expired";
  if (start !== null && t < start) return "scheduled";
  return "active";
};

/**
 * A banner's status, taking its campaign into account. The banner shows only while both
 * the banner and its campaign (if any) are active and inside their date windows.
 */
export const getBannerStatus = (
  banner: ScheduleWindow,
  campaign: ScheduleWindow | null | undefined,
  now: Date = new Date()
): BannerStatus => {
  const own = getWindowStatus(banner, now);
  if (!campaign) return own;
  const parent = getWindowStatus(campaign, now);
  if (own === "inactive" || parent === "inactive") return "inactive";
  if (own === "expired" || parent === "expired") return "expired";
  if (own === "scheduled" || parent === "scheduled") return "scheduled";
  return "active";
};

/** Empty/missing terminal list means "all terminals". */
export const bannerTargetsTerminal = (banner: SchedulableBanner, terminal: string | null | undefined): boolean => {
  const list = (banner.terminals || []).map((t) => String(t).trim()).filter(Boolean);
  if (list.length === 0) return true;
  return !!terminal && list.includes(String(terminal).trim());
};

/** True when the banner should be on the customer screen of `terminal` right now. */
export const isBannerLive = (
  banner: SchedulableBanner,
  campaign: ScheduleWindow | null | undefined,
  terminal: string | null | undefined,
  now: Date = new Date()
): boolean => getBannerStatus(banner, campaign, now) === "active" && bannerTargetsTerminal(banner, terminal);

/** Checks a start/end day pair from the admin form. Returns an error message or null. */
export const validateDayRange = (startDay?: string | null, endDay?: string | null): string | null => {
  const start = startDay ? storeDayStart(startDay) : null;
  const end = endDay ? storeDayEnd(endDay) : null;
  if (startDay && !start) return "Start date is not a valid date";
  if (endDay && !end) return "End date is not a valid date";
  if (start && end && end.getTime() < start.getTime()) return "End date must be on or after the start date";
  return null;
};
