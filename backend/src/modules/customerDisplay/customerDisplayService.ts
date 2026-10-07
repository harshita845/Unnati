import crypto from "crypto";
import type { Server as SocketIOServer } from "socket.io";
import AppSettings from "../../models/AppSettings";
import CustomerDisplayBanner from "../../models/CustomerDisplayBanner";
import CustomerDisplaySettings, { ICustomerDisplaySettings } from "../../models/CustomerDisplaySettings";
import CustomerDisplayTerminal, { ICustomerDisplayTerminal } from "../../models/CustomerDisplayTerminal";
import { getBannerStatus, isBannerLive } from "./bannerSchedule";

/** Socket.IO room every customer screen joins; per-terminal rooms are `cfd-<code>`. */
export const CFD_ALL_ROOM = "cfd-all";
export const cfdRoom = (code: string) => `cfd-${code}`;

export const getDisplaySettings = async (): Promise<ICustomerDisplaySettings> => {
  const existing = await CustomerDisplaySettings.findOne();
  if (existing) return existing;
  try {
    return await CustomerDisplaySettings.create({});
  } catch {
    // Two first requests raced to create it
    return (await CustomerDisplaySettings.findOne()) as ICustomerDisplaySettings;
  }
};

/**
 * Call after any banner, campaign or settings change: open screens see the new version on
 * their next poll (or instantly over Socket.IO) and refetch.
 */
export const bumpContentVersion = async (io?: SocketIOServer | null): Promise<number> => {
  await getDisplaySettings();
  const updated = await CustomerDisplaySettings.findOneAndUpdate({}, { $inc: { contentVersion: 1 } }, { new: true });
  const version = updated?.contentVersion ?? 0;
  io?.to(CFD_ALL_ROOM).emit("cfd-content", { contentVersion: version });
  return version;
};

/** Store name, logo and UPI QR for the screen: display settings first, then POS Bill Settings. */
export const getDisplayBranding = async (settings: ICustomerDisplaySettings) => {
  const app: any = await AppSettings.findOne().select("appName appLogo billSettings").lean();
  const bill = app?.billSettings || {};
  const billLogo = bill.logo && bill.logo.enabled !== false ? bill.logo.url : "";
  const billQr = bill.qrSettings?.enabled === false ? "" : bill.qrSettings?.url || bill.qrCode || "";
  return {
    storeName: settings.storeName || bill.shopName || app?.appName || "",
    logoUrl: settings.logoUrl || billLogo || app?.appLogo || "",
    upiQrUrl: settings.showUpiQr ? billQr : "",
  };
};

/** Only what the customer screen needs; never admin-only fields. */
export const toPublicSettings = (s: ICustomerDisplaySettings) => ({
  showBanners: s.showBanners,
  billSide: s.billSide,
  billColumnWidth: s.billColumnWidth,
  fontScale: s.fontScale,
  theme: s.theme,
  welcomeText: s.welcomeText,
  thankYouText: s.thankYouText,
  paidScreenSeconds: s.paidScreenSeconds,
  showUpiQr: s.showUpiQr,
  defaultImageSeconds: s.defaultImageSeconds,
  defaultBanner: s.defaultBanner,
});

/** Banners that should be on `terminal`'s screen right now, in display order. */
export const listLiveBanners = async (terminal: string | null, now: Date = new Date()) => {
  const candidates: any[] = await CustomerDisplayBanner.find({
    isActive: true,
    $and: [
      { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
    ],
  })
    .populate("campaign", "isActive startDate endDate")
    .sort({ sortOrder: 1, createdAt: -1 })
    .lean();

  return candidates
    .filter((b) => isBannerLive(b, b.campaign || null, terminal, now))
    .map((b) => ({
      _id: String(b._id),
      title: b.title,
      mediaType: b.mediaType,
      mediaUrl: b.mediaUrl,
      posterUrl: b.posterUrl || "",
      durationSeconds: b.durationSeconds,
    }));
};

/** Admin list row: the banner plus its computed Active / Scheduled / Expired / Inactive status. */
export const withBannerStatus = (banner: any, now: Date = new Date()) => {
  const obj = typeof banner.toObject === "function" ? banner.toObject() : banner;
  const campaign = obj.campaign && typeof obj.campaign === "object" && "isActive" in obj.campaign ? obj.campaign : null;
  return { ...obj, status: getBannerStatus(obj, campaign, now) };
};

export const generateDisplayKey = () => crypto.randomBytes(18).toString("base64url");

/** Finds or creates a terminal (used when a cashier opens the display for a new counter). */
export const ensureTerminal = async (code: string, name?: string): Promise<ICustomerDisplayTerminal> => {
  const existing = await CustomerDisplayTerminal.findOne({ code });
  if (existing) return existing;
  try {
    return await CustomerDisplayTerminal.create({ code, name: name || `Counter ${code}`, displayKey: generateDisplayKey() });
  } catch {
    return (await CustomerDisplayTerminal.findOne({ code })) as ICustomerDisplayTerminal;
  }
};

const safeEqual = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

/** The terminal a customer screen belongs to, or null when the code/key pair is wrong. */
export const findTerminalByKey = async (code: unknown, key: unknown): Promise<ICustomerDisplayTerminal | null> => {
  if (typeof code !== "string" || typeof key !== "string" || !code || !key) return null;
  const terminal = await CustomerDisplayTerminal.findOne({ code: code.trim(), isActive: true });
  if (!terminal || !safeEqual(terminal.displayKey, key)) return null;
  return terminal;
};
