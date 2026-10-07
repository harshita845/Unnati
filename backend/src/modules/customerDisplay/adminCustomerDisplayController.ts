import { Request, Response } from "express";
import mongoose from "mongoose";
import cloudinary from "../../config/cloudinary";
import { asyncHandler } from "../../utils/asyncHandler";
import CustomerDisplayBanner from "../../models/CustomerDisplayBanner";
import CustomerDisplayCampaign from "../../models/CustomerDisplayCampaign";
import CustomerDisplayTerminal from "../../models/CustomerDisplayTerminal";
import { getWindowStatus, storeDayEnd, storeDayStart, toStoreDay, validateDayRange } from "./bannerSchedule";
import { sanitizeDisplayState } from "./displayState";
import {
  bumpContentVersion,
  CFD_ALL_ROOM,
  cfdRoom,
  ensureTerminal,
  generateDisplayKey,
  getDisplayBranding,
  getDisplaySettings,
  listLiveBanners,
  toPublicSettings,
  withBannerStatus,
} from "./customerDisplayService";

const CLOUDINARY_FOLDER = "Unnati Stores/customer-display";
const TERMINAL_CODE = /^[A-Za-z0-9_-]{1,20}$/;

const fail = (res: Response, status: number, message: string) => res.status(status).json({ success: false, message });
const io = (req: Request) => req.app.get("io") || null;
const isObjectId = (id: unknown) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

/** "YYYY-MM-DD" (or "" / null to clear) → Date at start/end of that store day. undefined = not sent. */
const parseDay = (value: unknown, edge: "start" | "end"): Date | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const day = typeof value === "string" ? value.slice(0, 10) : toStoreDay(value as Date);
  return edge === "start" ? storeDayStart(day) : storeDayEnd(day);
};

const dayOf = (d: Date | null | undefined) => (d ? toStoreDay(d) : null);

const cleanTerminals = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(new Set(value.map((v) => String(v).trim()).filter((v) => TERMINAL_CODE.test(v))))
    : [];

// ─── Banners ────────────────────────────────────────────────────────────────

/** Validates the banner form body. Returns the fields to save, or an error message. */
const readBannerBody = (body: any, isCreate: boolean): { data?: Record<string, any>; error?: string } => {
  const data: Record<string, any> = {};

  if (isCreate || body.title !== undefined) {
    const title = String(body.title ?? "").trim();
    if (!title) return { error: "Title is required" };
    data.title = title;
  }
  if (isCreate || body.mediaType !== undefined) {
    if (!["image", "video"].includes(body.mediaType)) return { error: "Media type must be image or video" };
    data.mediaType = body.mediaType;
  }
  if (isCreate || body.mediaUrl !== undefined) {
    const url = String(body.mediaUrl ?? "").trim();
    if (!/^https:\/\/\S+$/i.test(url)) return { error: "Upload a media file first" };
    data.mediaUrl = url;
  }
  for (const key of ["mediaPublicId", "posterUrl", "link", "notes"] as const) {
    if (body[key] !== undefined) data[key] = String(body[key] ?? "").trim();
  }
  if (body.durationSeconds !== undefined) {
    const d = Number(body.durationSeconds);
    if (!Number.isFinite(d) || d < 2 || d > 120) return { error: "Display duration must be 2–120 seconds" };
    data.durationSeconds = Math.round(d);
  }
  if (body.sortOrder !== undefined) {
    const s = Number(body.sortOrder);
    if (!Number.isFinite(s)) return { error: "Sort order must be a number" };
    data.sortOrder = Math.round(s);
  }
  if (body.isActive !== undefined) data.isActive = !!body.isActive;
  if (body.terminals !== undefined) data.terminals = cleanTerminals(body.terminals);
  if (body.campaign !== undefined) {
    if (body.campaign === null || body.campaign === "") data.campaign = null;
    else if (isObjectId(body.campaign)) data.campaign = body.campaign;
    else return { error: "Invalid campaign" };
  }

  const rangeError = validateDayRange(body.startDate || null, body.endDate || null);
  if (rangeError) return { error: rangeError };
  const start = parseDay(body.startDate, "start");
  const end = parseDay(body.endDate, "end");
  if (start !== undefined) data.startDate = start;
  if (end !== undefined) data.endDate = end;

  return { data };
};

const serializeBanner = (banner: any) => {
  const row = withBannerStatus(banner);
  return { ...row, startDay: dayOf(row.startDate), endDay: dayOf(row.endDate) };
};

export const listBanners = asyncHandler(async (req: Request, res: Response) => {
  const { status, campaign, search } = req.query;
  const query: any = {};
  if (typeof campaign === "string" && isObjectId(campaign)) query.campaign = campaign;
  if (typeof search === "string" && search.trim()) {
    query.title = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  }

  const banners = await CustomerDisplayBanner.find(query)
    .populate("campaign", "name isActive startDate endDate")
    .sort({ sortOrder: 1, createdAt: -1 });

  let rows = banners.map(serializeBanner);
  if (typeof status === "string" && ["active", "scheduled", "expired", "inactive"].includes(status)) {
    rows = rows.filter((r) => r.status === status);
  }
  return res.json({ success: true, data: rows });
});

export const createBanner = asyncHandler(async (req: Request, res: Response) => {
  const { data, error } = readBannerBody(req.body, true);
  if (error) return fail(res, 400, error);
  if (data!.campaign && !(await CustomerDisplayCampaign.exists({ _id: data!.campaign }))) {
    return fail(res, 400, "Campaign not found");
  }
  if (data!.sortOrder === undefined) {
    const last: any = await CustomerDisplayBanner.findOne().sort({ sortOrder: -1 }).select("sortOrder").lean();
    data!.sortOrder = (last?.sortOrder ?? -1) + 1;
  }
  const banner = await CustomerDisplayBanner.create(data);
  await banner.populate("campaign", "name isActive startDate endDate");
  await bumpContentVersion(io(req));
  return res.status(201).json({ success: true, message: "Banner created", data: serializeBanner(banner) });
});

export const updateBanner = asyncHandler(async (req: Request, res: Response) => {
  if (!isObjectId(req.params.id)) return fail(res, 400, "Invalid banner id");
  const banner = await CustomerDisplayBanner.findById(req.params.id);
  if (!banner) return fail(res, 404, "Banner not found");

  // Validate the date range against the stored value when only one side is sent
  const body = { ...req.body };
  if (body.startDate === undefined && body.endDate !== undefined) body.startDate = dayOf(banner.startDate);
  if (body.endDate === undefined && body.startDate !== undefined) body.endDate = dayOf(banner.endDate);

  const { data, error } = readBannerBody(body, false);
  if (error) return fail(res, 400, error);
  if (data!.campaign && !(await CustomerDisplayCampaign.exists({ _id: data!.campaign }))) {
    return fail(res, 400, "Campaign not found");
  }
  banner.set(data!);
  await banner.save();
  await banner.populate("campaign", "name isActive startDate endDate");
  await bumpContentVersion(io(req));
  return res.json({ success: true, message: "Banner updated", data: serializeBanner(banner) });
});

export const duplicateBanner = asyncHandler(async (req: Request, res: Response) => {
  if (!isObjectId(req.params.id)) return fail(res, 400, "Invalid banner id");
  const source: any = await CustomerDisplayBanner.findById(req.params.id).lean();
  if (!source) return fail(res, 404, "Banner not found");
  const { _id, createdAt, updatedAt, __v, ...rest } = source;
  const copy = await CustomerDisplayBanner.create({
    ...rest,
    title: `${source.title} (copy)`.slice(0, 100),
    isActive: false, // copies start disabled so they don't go live by surprise
    sortOrder: (source.sortOrder ?? 0) + 1,
  });
  await copy.populate("campaign", "name isActive startDate endDate");
  await bumpContentVersion(io(req));
  return res.status(201).json({ success: true, message: "Banner duplicated (disabled)", data: serializeBanner(copy) });
});

export const setBannerStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!isObjectId(req.params.id)) return fail(res, 400, "Invalid banner id");
  const banner = await CustomerDisplayBanner.findByIdAndUpdate(
    req.params.id,
    { isActive: !!req.body.isActive },
    { new: true }
  ).populate("campaign", "name isActive startDate endDate");
  if (!banner) return fail(res, 404, "Banner not found");
  await bumpContentVersion(io(req));
  return res.json({ success: true, message: banner.isActive ? "Banner enabled" : "Banner disabled", data: serializeBanner(banner) });
});

export const deleteBanner = asyncHandler(async (req: Request, res: Response) => {
  if (!isObjectId(req.params.id)) return fail(res, 400, "Invalid banner id");
  const banner = await CustomerDisplayBanner.findByIdAndDelete(req.params.id);
  if (!banner) return fail(res, 404, "Banner not found");
  if (banner.mediaPublicId) {
    cloudinary.uploader
      .destroy(banner.mediaPublicId, { resource_type: banner.mediaType === "video" ? "video" : "image" })
      .catch((err: any) => console.warn("Customer display: could not delete media", err?.message));
  }
  await bumpContentVersion(io(req));
  return res.json({ success: true, message: "Banner deleted" });
});

/** Body: { ids: string[] } in the new display order. */
export const reorderBanners = asyncHandler(async (req: Request, res: Response) => {
  const ids: unknown = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(isObjectId)) return fail(res, 400, "Send the banner ids in order");
  await CustomerDisplayBanner.bulkWrite(
    (ids as string[]).map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { sortOrder: index } } } }))
  );
  await bumpContentVersion(io(req));
  return res.json({ success: true, message: "Order saved" });
});

// ─── Campaigns ──────────────────────────────────────────────────────────────

const serializeCampaign = (c: any, bannerCount = 0) => {
  const obj = typeof c.toObject === "function" ? c.toObject() : c;
  return { ...obj, status: getWindowStatus(obj), startDay: dayOf(obj.startDate), endDay: dayOf(obj.endDate), bannerCount };
};

const readCampaignBody = (body: any, isCreate: boolean): { data?: Record<string, any>; error?: string } => {
  const data: Record<string, any> = {};
  if (isCreate || body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (!name) return { error: "Campaign name is required" };
    data.name = name;
  }
  if (body.description !== undefined) data.description = String(body.description ?? "").trim();
  if (body.isActive !== undefined) data.isActive = !!body.isActive;
  const rangeError = validateDayRange(body.startDate || null, body.endDate || null);
  if (rangeError) return { error: rangeError };
  const start = parseDay(body.startDate, "start");
  const end = parseDay(body.endDate, "end");
  if (start !== undefined) data.startDate = start;
  if (end !== undefined) data.endDate = end;
  return { data };
};

export const listCampaigns = asyncHandler(async (_req: Request, res: Response) => {
  const [campaigns, counts] = await Promise.all([
    CustomerDisplayCampaign.find().sort({ createdAt: -1 }),
    CustomerDisplayBanner.aggregate([{ $match: { campaign: { $ne: null } } }, { $group: { _id: "$campaign", n: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map((c: any) => [String(c._id), c.n]));
  return res.json({ success: true, data: campaigns.map((c) => serializeCampaign(c, countMap.get(String(c._id)) || 0)) });
});

export const createCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { data, error } = readCampaignBody(req.body, true);
  if (error) return fail(res, 400, error);
  const campaign = await CustomerDisplayCampaign.create(data);
  await bumpContentVersion(io(req));
  return res.status(201).json({ success: true, message: "Campaign created", data: serializeCampaign(campaign) });
});

export const updateCampaign = asyncHandler(async (req: Request, res: Response) => {
  if (!isObjectId(req.params.id)) return fail(res, 400, "Invalid campaign id");
  const campaign = await CustomerDisplayCampaign.findById(req.params.id);
  if (!campaign) return fail(res, 404, "Campaign not found");
  const body = { ...req.body };
  if (body.startDate === undefined && body.endDate !== undefined) body.startDate = dayOf(campaign.startDate);
  if (body.endDate === undefined && body.startDate !== undefined) body.endDate = dayOf(campaign.endDate);
  const { data, error } = readCampaignBody(body, false);
  if (error) return fail(res, 400, error);
  campaign.set(data!);
  await campaign.save();
  await bumpContentVersion(io(req));
  const bannerCount = await CustomerDisplayBanner.countDocuments({ campaign: campaign._id });
  return res.json({ success: true, message: "Campaign updated", data: serializeCampaign(campaign, bannerCount) });
});

/** Deleting a campaign keeps its banners; they just stop belonging to it. */
export const deleteCampaign = asyncHandler(async (req: Request, res: Response) => {
  if (!isObjectId(req.params.id)) return fail(res, 400, "Invalid campaign id");
  const campaign = await CustomerDisplayCampaign.findByIdAndDelete(req.params.id);
  if (!campaign) return fail(res, 404, "Campaign not found");
  await CustomerDisplayBanner.updateMany({ campaign: campaign._id }, { $set: { campaign: null } });
  await bumpContentVersion(io(req));
  return res.json({ success: true, message: "Campaign deleted; its banners were kept" });
});

// ─── Settings ───────────────────────────────────────────────────────────────

const SETTINGS_FIELDS = [
  "showBanners",
  "billSide",
  "billColumnWidth",
  "fontScale",
  "storeName",
  "logoUrl",
  "welcomeText",
  "thankYouText",
  "paidScreenSeconds",
  "showUpiQr",
  "defaultImageSeconds",
] as const;

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await getDisplaySettings();
  const branding = await getDisplayBranding(settings);
  return res.json({ success: true, data: { ...settings.toObject(), resolvedBranding: branding } });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await getDisplaySettings();
  const body = req.body || {};
  for (const key of SETTINGS_FIELDS) {
    if (body[key] !== undefined) (settings as any)[key] = body[key];
  }
  if (body.theme && typeof body.theme === "object") {
    for (const key of ["primary", "background", "panel", "text", "accent"] as const) {
      if (typeof body.theme[key] === "string") settings.theme[key] = body.theme[key];
    }
  }
  if (body.defaultBanner && typeof body.defaultBanner === "object") {
    const url = String(body.defaultBanner.mediaUrl ?? "").trim();
    if (url && !/^https:\/\/\S+$/i.test(url)) return fail(res, 400, "Default banner must be an uploaded file");
    settings.defaultBanner = {
      mediaType: body.defaultBanner.mediaType === "video" ? "video" : "image",
      mediaUrl: url,
    };
  }
  if (req.user?.userId && isObjectId(req.user.userId)) settings.updatedBy = req.user.userId as any;
  settings.contentVersion = (settings.contentVersion || 0) + 1;
  await settings.save(); // runs schema validation (ranges, enums, hex colors)

  io(req)?.to(CFD_ALL_ROOM).emit("cfd-content", { contentVersion: settings.contentVersion });
  const branding = await getDisplayBranding(settings);
  return res.json({ success: true, message: "Display settings saved", data: { ...settings.toObject(), resolvedBranding: branding } });
});

// ─── Terminals ──────────────────────────────────────────────────────────────

const serializeTerminal = (t: any) => ({
  _id: String(t._id),
  code: t.code,
  name: t.name,
  displayKey: t.displayKey,
  isActive: t.isActive,
  lastSeenAt: t.lastSeenAt,
  stateUpdatedAt: t.stateUpdatedAt,
});

export const listTerminals = asyncHandler(async (_req: Request, res: Response) => {
  const terminals = await CustomerDisplayTerminal.find().select("-state").sort({ code: 1 });
  return res.json({ success: true, data: terminals.map(serializeTerminal) });
});

/** Creates the terminal on first use (POS "Open Customer Display") and returns its display key. */
export const ensureTerminalHandler = asyncHandler(async (req: Request, res: Response) => {
  const code = String(req.params.code || "").trim();
  if (!TERMINAL_CODE.test(code)) return fail(res, 400, "Terminal code can use letters, numbers, - and _ (max 20)");
  const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 60) : undefined;
  const terminal = await ensureTerminal(code, name);
  if (!terminal.isActive) return fail(res, 403, "This terminal is disabled in Display Settings");
  return res.json({ success: true, data: serializeTerminal(terminal) });
});

export const updateTerminal = asyncHandler(async (req: Request, res: Response) => {
  const update: Record<string, any> = {};
  if (typeof req.body?.name === "string") update.name = req.body.name.trim().slice(0, 60);
  if (req.body?.isActive !== undefined) update.isActive = !!req.body.isActive;
  const terminal = await CustomerDisplayTerminal.findOneAndUpdate({ code: req.params.code }, update, { new: true });
  if (!terminal) return fail(res, 404, "Terminal not found");
  return res.json({ success: true, message: "Terminal updated", data: serializeTerminal(terminal) });
});

/** New key: screens using the old link stop working until reopened from the POS. */
export const regenerateTerminalKey = asyncHandler(async (req: Request, res: Response) => {
  const terminal = await CustomerDisplayTerminal.findOneAndUpdate(
    { code: req.params.code },
    { displayKey: generateDisplayKey() },
    { new: true }
  );
  if (!terminal) return fail(res, 404, "Terminal not found");
  io(req)?.to(cfdRoom(terminal.code)).emit("cfd-key-revoked");
  return res.json({ success: true, message: "New display link created", data: serializeTerminal(terminal) });
});

export const deleteTerminal = asyncHandler(async (req: Request, res: Response) => {
  const terminal = await CustomerDisplayTerminal.findOneAndDelete({ code: req.params.code });
  if (!terminal) return fail(res, 404, "Terminal not found");
  io(req)?.to(cfdRoom(terminal.code)).emit("cfd-key-revoked");
  return res.json({ success: true, message: "Terminal removed" });
});

/**
 * Cashier → server: the latest bill snapshot for a terminal. Stale snapshots (lower seq than
 * stored) are ignored, so out-of-order requests can't roll the screen back.
 */
export const pushTerminalState = asyncHandler(async (req: Request, res: Response) => {
  const code = String(req.params.code || "").trim();
  if (!TERMINAL_CODE.test(code)) return fail(res, 400, "Invalid terminal code");
  const state = sanitizeDisplayState(req.body);
  if (!state) return fail(res, 400, "Invalid display state");

  await ensureTerminal(code);
  const updated = await CustomerDisplayTerminal.findOneAndUpdate(
    { code, stateSeq: { $lt: state.seq } },
    { $set: { state, stateSeq: state.seq, stateUpdatedAt: new Date() } },
    { new: true, projection: { stateSeq: 1 } }
  );
  if (updated) io(req)?.to(cfdRoom(code)).emit("cfd-state", state);
  return res.json({ success: true, data: { accepted: !!updated, seq: state.seq } });
});

// ─── Media upload & preview ─────────────────────────────────────────────────

/**
 * Signs a direct browser → Cloudinary upload. Large videos never pass through the API
 * (serverless hosts cap request bodies at a few MB).
 */
export const getUploadSignature = asyncHandler(async (req: Request, res: Response) => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return fail(res, 503, "Media storage (Cloudinary) is not configured on the server");
  }
  const resourceType = req.body?.resourceType === "video" ? "video" : "image";
  const timestamp = Math.round(Date.now() / 1000);
  const params = { folder: CLOUDINARY_FOLDER, timestamp };
  const signature = cloudinary.utils.api_sign_request(params, CLOUDINARY_API_SECRET);
  return res.json({
    success: true,
    data: {
      uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
      apiKey: CLOUDINARY_API_KEY,
      folder: CLOUDINARY_FOLDER,
      timestamp,
      signature,
    },
  });
});

/** What a terminal's screen would show right now: for the admin live preview. */
export const previewDisplay = asyncHandler(async (req: Request, res: Response) => {
  const terminal = typeof req.query.terminal === "string" && req.query.terminal ? req.query.terminal : null;
  const settings = await getDisplaySettings();
  const [banners, branding] = await Promise.all([listLiveBanners(terminal), getDisplayBranding(settings)]);
  return res.json({ success: true, data: { settings: toPublicSettings(settings), branding, banners } });
});
