import { Request, Response } from "express";
import mongoose from "mongoose";
import ScannedDocument, { IScannedDocument } from "../../models/ScannedDocument";
import { asyncHandler } from "../../utils/asyncHandler";
import { configuredProviderName, getOcrProvider, OcrFile, OcrProviderError } from "../../services/ocr/providers";
import { runExtraction, ocrTimeoutMs } from "../../services/ocr/extract";
import { DOC_TYPES, DocType, emptyExtraction, Extraction } from "../../services/ocr/schema";
import { duplicateFingerprint, formatDateIN, ScanWarning, validateExtraction } from "../../services/ocr/validate";
import { computeMatches } from "../../services/ocr/catalog";
import { confirmScan, syncScanToLedger } from "../../services/ocr/confirm";
import { ConfirmError } from "../../services/ocr/errors";
import { ReviewBillSchema } from "../../services/ocr/review";
import { amountToIndianWords } from "../../services/ocr/amountInWords";
import {
  ALLOWED_MIME,
  cloudinaryConfigured,
  deleteStored,
  fetchForOcr,
  isOurPublicId,
  MAX_FILES_PER_SCAN,
  maxFileBytes,
  OCR_DELIVERY_TYPE,
  signedFileUrl,
  StorageError,
  storeInline,
  uploadSignature,
} from "../../services/ocr/storage";
import { getSellerScanBillAccess, ownerFields, ownerFilter, ScanOwner, scanOwnerFrom } from "../../services/ocr/owner";

/**
 * Scan Bill: Admin POS (admin login) and, for sellers whose plan includes it, the seller panel
 * (see routes/ocrRoutes.ts). Every handler works only on the logged-in owner's scans and data.
 */

const fail = (res: Response, status: number, message: string, extra: Record<string, unknown> = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const monthlyLimit = () => Math.max(0, Number(process.env.OCR_MONTHLY_LIMIT) || 500);
const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

/** AI calls this month: everyone's (the server-wide cap), or one seller's (their plan allowance). */
async function aiCallsThisMonth(match: Record<string, unknown> = {}): Promise<number> {
  const [row] = await ScannedDocument.aggregate([
    { $match: { createdAt: { $gte: monthStart() }, ...match } },
    { $group: { _id: null, calls: { $sum: "$aiCalls" } } },
  ]);
  return row?.calls || 0;
}

/** The owner from the login, or a 401 already sent. */
function requireOwner(req: Request, res: Response): ScanOwner | null {
  const owner = scanOwnerFrom(req);
  if (!owner) fail(res, 401, "Login required");
  return owner;
}

/** This owner's limit for the month: the server-wide cap, and for a seller their plan's allowance. */
async function scanLimitFor(owner: ScanOwner): Promise<{ used: number; limit: number; message: string } | null> {
  const used = await aiCallsThisMonth();
  if (used >= monthlyLimit()) {
    return { used, limit: monthlyLimit(), message: `Monthly scan limit reached (${monthlyLimit()}). Enter bills manually until next month, or raise OCR_MONTHLY_LIMIT.` };
  }
  if (owner.kind === "seller") {
    const access = await getSellerScanBillAccess(owner.sellerId);
    const mine = await aiCallsThisMonth({ seller: new mongoose.Types.ObjectId(owner.sellerId) });
    if (mine >= access.monthlyLimit) {
      return { used: mine, limit: access.monthlyLimit, message: `You've used all ${access.monthlyLimit} scans in your plan this month. Enter bills manually until next month.` };
    }
  }
  return null;
}

const isDocType = (v: unknown): v is DocType => typeof v === "string" && (DOC_TYPES as readonly string[]).includes(v);

/** A signed link, or null when one can't be made (e.g. storage not configured): previews are optional. */
function safeLink(make: () => string): string | null {
  try {
    return make();
  } catch {
    return null;
  }
}

/** Scan for the browser: the stored data plus short-lived signed preview links (never the raw bytes). */
function present(scan: IScannedDocument) {
  const json: any = scan.toObject({ versionKey: false });
  json.files = (json.files || []).map((f: any) => {
    const pages = f.mimeType === "application/pdf" ? Math.max(1, Number(f.pages) || 1) : 1;
    return {
      ...f,
      previewUrls: f.publicId
        ? Array.from({ length: Math.min(pages, 20) }, (_, i) => safeLink(() => signedFileUrl(f, "preview", f.mimeType === "application/pdf" ? i + 1 : undefined))).filter(Boolean)
        : [],
      originalUrl: f.publicId ? safeLink(() => signedFileUrl(f, "original")) : null,
    };
  });
  return json;
}

/** Billing summary for the list/history table */
function summaryFields(e: Pick<Extraction, "party" | "invoiceNumber" | "invoiceDate" | "totals">) {
  return {
    partyName: e.party?.name || undefined,
    invoiceNumber: e.invoiceNumber || undefined,
    invoiceDate: e.invoiceDate || undefined,
    grandTotal: typeof e.totals?.grandTotal === "number" ? e.totals.grandTotal : undefined,
  };
}

/** Flag a probable re-scan of a bill already in the system. */
async function duplicateCheck(scanId: mongoose.Types.ObjectId, e: Extraction, owner: ScanOwner): Promise<{ fingerprint?: string; duplicateOf?: any; warning?: ScanWarning }> {
  const fingerprint = duplicateFingerprint(e) || undefined;
  if (!fingerprint) return {};
  const other: any = await ScannedDocument.findOne({ fingerprint, _id: { $ne: scanId }, status: { $in: ["draft", "confirmed", "syncing"] }, ...ownerFilter(owner) })
    .sort({ createdAt: -1 })
    .select("_id status createdAt invoiceNumber")
    .lean();
  if (!other) return { fingerprint };
  const when = formatDateIN(new Date(other.createdAt).toISOString().slice(0, 10));
  return {
    fingerprint,
    duplicateOf: other._id,
    warning: {
      code: "DUPLICATE",
      severity: "error",
      message: `This bill looks like one already scanned on ${when}${other.status === "confirmed" ? " and saved" : ""}. Check before saving it again.`,
      field: "invoiceNumber",
    },
  };
}

/** Re-attach link/create choices the person made, by line position (used after edits). */
function withDefaultActions(e: Extraction, matches: Awaited<ReturnType<typeof computeMatches>> | null) {
  return {
    ...e,
    party: {
      ...e.party,
      supplierId: e.docType !== "sales" && matches?.party.status === "matched" ? matches.party.best?.id ?? null : null,
      customerId: e.docType === "sales" && matches?.party.status === "matched" ? matches.party.best?.id ?? null : null,
    },
    items: e.items.map((it, i) => {
      const m = matches?.items[i];
      const best = m?.status === "matched" ? m.best : undefined;
      return {
        ...it,
        action: best ? "link" : "skip",
        productId: best?.productId ?? null,
        variationId: best?.variationId ?? null,
      };
    }),
  };
}

async function fillFromExtraction(scan: IScannedDocument, outcome: Awaited<ReturnType<typeof runExtraction>>, owner: ScanOwner) {
  const e = outcome.extraction;
  const matches = await computeMatches(e, owner).catch(() => null);
  const dup = await duplicateCheck(scan._id as mongoose.Types.ObjectId, e, owner);
  scan.set({
    status: "draft",
    docType: e.docType,
    provider: outcome.provider,
    aiModel: outcome.model,
    extracted: e,
    data: withDefaultActions(e, matches),
    matches,
    warnings: dup.warning ? [dup.warning, ...outcome.warnings] : outcome.warnings,
    confidence: e.confidence.overall ?? undefined,
    fingerprint: dup.fingerprint,
    duplicateOf: dup.duplicateOf,
    error: undefined,
    aiCalls: (scan.aiCalls || 0) + outcome.aiCalls,
    repaired: outcome.repaired,
    usage: outcome.usage,
    ...summaryFields(e),
  });
}

function markFailed(scan: IScannedDocument, error: unknown, docType: DocType) {
  const message = error instanceof OcrProviderError || error instanceof Error ? error.message : "Couldn't read the bill.";
  const empty = emptyExtraction(docType === "unknown" ? "purchase" : docType);
  scan.set({
    status: "failed",
    error: message,
    // Manual entry starts from an empty bill of the chosen type
    data: scan.data || { ...empty, items: [] },
    warnings: [],
  });
  return message;
}

async function filesForAi(scan: IScannedDocument): Promise<OcrFile[]> {
  const perFile = await Promise.all(
    scan.files.filter((f) => f.publicId).map((f) => fetchForOcr({ publicId: f.publicId!, format: f.format, mimeType: f.mimeType, pages: f.pages }))
  );
  return perFile.flat();
}

/**
 * AI requests that count towards the monthly limit: every request sent, except one the provider
 * refused before doing any work (bad key / not configured, or rate limited).
 */
function billableCalls(sent: number, error?: unknown): number {
  if (error instanceof OcrProviderError && (error.kind === "config" || error.kind === "rate_limit")) return Math.max(0, sent - 1);
  return sent;
}

/** Log a failed scan step (status and reason only: no URLs, keys or file contents). */
function logScanFailure(scanId: unknown, error: unknown) {
  if (error instanceof StorageError) console.warn(`[ocr] scan ${scanId}: storage ${error.step} failed`, error.status ?? "", error.reason ?? "");
  else if (!(error instanceof OcrProviderError)) console.error(`[ocr] scan ${scanId} failed:`, (error as Error)?.message);
}

// ---------------------------------------------------------------------------------------------

export const getConfig = asyncHandler(async (req: Request, res: Response) => {
  let model: string | null = null;
  let configError: string | null = null;
  try {
    model = getOcrProvider().model;
  } catch (e: any) {
    configError = e?.message || "Not configured";
  }
  return res.json({
    success: true,
    data: {
      aiEnabled: !configError,
      provider: configuredProviderName(),
      model,
      configError,
      storageEnabled: cloudinaryConfigured(),
      maxFiles: MAX_FILES_PER_SCAN,
      maxFileMb: maxFileBytes() / 1024 / 1024,
      allowedTypes: ALLOWED_MIME,
      timeoutMs: ocrTimeoutMs(),
      // Sales bills become POS orders against shared customer accounts: admin only for now
      salesEnabled: req.user?.userType !== "Seller",
    },
  });
});

export const getUploadSignature = asyncHandler(async (_req: Request, res: Response) => {
  if (!cloudinaryConfigured()) return fail(res, 503, "File storage (Cloudinary) is not configured on the server.");
  return res.json({ success: true, data: uploadSignature() });
});

export const getUsage = asyncHandler(async (req: Request, res: Response) => {
  const owner = requireOwner(req, res);
  if (!owner) return;
  // A seller sees their own plan allowance; the admin sees the server-wide total
  const mine = owner.kind === "seller" ? { seller: new mongoose.Types.ObjectId(owner.sellerId) } : {};
  const used = await aiCallsThisMonth(mine);
  const limit = owner.kind === "seller" ? (await getSellerScanBillAccess(owner.sellerId)).monthlyLimit : monthlyLimit();
  const next = monthStart();
  next.setUTCMonth(next.getUTCMonth() + 1);
  const [counts] = await ScannedDocument.aggregate([
    { $match: { createdAt: { $gte: monthStart() }, ...mine } },
    {
      $group: {
        _id: null,
        scans: { $sum: 1 },
        confirmed: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        inputTokens: { $sum: { $ifNull: ["$usage.inputTokens", 0] } },
        outputTokens: { $sum: { $ifNull: ["$usage.outputTokens", 0] } },
      },
    },
  ]);
  return res.json({
    success: true,
    data: {
      month: monthStart().toISOString().slice(0, 7),
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetsAt: next.toISOString(),
      scans: counts?.scans || 0,
      confirmed: counts?.confirmed || 0,
      failed: counts?.failed || 0,
      inputTokens: counts?.inputTokens || 0,
      outputTokens: counts?.outputTokens || 0,
    },
  });
});

/**
 * POST /scan — read one bill (1–10 images/PDF pages of the same bill).
 * body: { files: [{ publicId, format, mimeType, bytes, pages, originalName } | { dataBase64, mimeType, originalName }],
 *         docType?: purchase|sales|stock_slip|expense, manual?: true }
 * AI failures still return the scan (status "failed") so the person can type it in instead.
 */
export const scanBill = asyncHandler(async (req: Request, res: Response) => {
  const owner = requireOwner(req, res);
  if (!owner) return;
  const rawFiles: any[] = Array.isArray(req.body?.files) ? req.body.files : [];
  const docTypeHint: DocType | null = isDocType(req.body?.docType) ? req.body.docType : null;
  const manual = req.body?.manual === true;

  if (!manual && !rawFiles.length) return fail(res, 400, "Add at least one photo or PDF of the bill.");
  if (rawFiles.length > MAX_FILES_PER_SCAN) return fail(res, 400, `Up to ${MAX_FILES_PER_SCAN} pages per bill.`);

  // Validate and gather files (Cloudinary references or small inline uploads)
  const inline: Array<OcrFile & { originalName?: string }> = [];
  const stored: any[] = [];
  for (const [i, f] of rawFiles.entries()) {
    const mimeType = String(f?.mimeType || "").toLowerCase();
    if (!(ALLOWED_MIME as readonly string[]).includes(mimeType)) return fail(res, 400, `File ${i + 1}: only JPG, PNG, WEBP or PDF.`);
    if (typeof f.dataBase64 === "string" && f.dataBase64) {
      const data = Buffer.from(f.dataBase64.replace(/^data:[^,]+,/, ""), "base64");
      if (!data.length) return fail(res, 400, `File ${i + 1} is empty.`);
      if (data.length > maxFileBytes()) return fail(res, 413, `File ${i + 1} is larger than ${maxFileBytes() / 1024 / 1024} MB.`);
      inline.push({ mimeType, data, originalName: typeof f.originalName === "string" ? f.originalName.slice(0, 200) : undefined });
    } else if (typeof f.publicId === "string" && isOurPublicId(f.publicId)) {
      if (Number(f.bytes) > maxFileBytes()) return fail(res, 413, `File ${i + 1} is larger than ${maxFileBytes() / 1024 / 1024} MB.`);
      stored.push({
        publicId: f.publicId,
        resourceType: "image",
        deliveryType: OCR_DELIVERY_TYPE,
        format: typeof f.format === "string" ? f.format.slice(0, 10) : undefined,
        mimeType,
        bytes: Number(f.bytes) || undefined,
        pages: Number(f.pages) || undefined,
        originalName: typeof f.originalName === "string" ? f.originalName.slice(0, 200) : undefined,
      });
    } else {
      return fail(res, 400, `File ${i + 1}: upload it first (missing file reference).`);
    }
  }
  if (inline.length && stored.length) return fail(res, 400, "Send either uploaded file references or inline files, not both.");

  if (!manual) {
    const over = await scanLimitFor(owner);
    if (over) return fail(res, 429, over.message, { code: "MONTHLY_LIMIT" });
  }

  // Keep inline uploads too (for the preview and audit), if storage is configured
  for (const f of inline) {
    const saved = await storeInline(f.data, f.mimeType, f.originalName).catch(() => null);
    stored.push(saved || { mimeType: f.mimeType, bytes: f.data.length, originalName: f.originalName });
  }

  const scan = await ScannedDocument.create({
    ...ownerFields(owner),
    status: manual ? "draft" : "processing",
    docType: docTypeHint || "unknown",
    files: stored,
    ...(manual ? { data: emptyExtraction(docTypeHint || "purchase"), provider: "manual" } : {}),
  });
  if (manual) return res.status(201).json({ success: true, data: present(scan) });

  let aiError: string | null = null;
  let sent = 0;
  try {
    const files = inline.length ? inline.map(({ mimeType, data }) => ({ mimeType, data })) : await filesForAi(scan);
    const outcome = await runExtraction(files, { docTypeHint, onAiCall: () => sent++ });
    await fillFromExtraction(scan, outcome, owner);
  } catch (error) {
    aiError = markFailed(scan, error, docTypeHint || "purchase");
    logScanFailure(scan._id, error);
    // Only AI requests actually made count (a storage failure never reached the AI)
    scan.aiCalls = (scan.aiCalls || 0) + billableCalls(sent, error);
  }
  await scan.save();
  return res.status(201).json({ success: true, data: present(scan), ...(aiError ? { aiError } : {}) });
});

/** POST /:id/rescan — read the stored files again (e.g. after a bad first read). */
export const rescanBill = asyncHandler(async (req: Request, res: Response) => {
  const owner = requireOwner(req, res);
  if (!owner) return;
  const scan = await findScan(req, res);
  if (!scan) return;
  if (!["draft", "failed"].includes(scan.status)) return fail(res, 409, "Only unsaved scans can be re-scanned.");
  if (!scan.files.some((f) => f.publicId)) return fail(res, 400, "No stored files to re-scan. Upload the bill again.");
  const over = await scanLimitFor(owner);
  if (over) return fail(res, 429, over.message, { code: "MONTHLY_LIMIT" });
  const hint: DocType | null = isDocType(req.body?.docType) ? req.body.docType : scan.docType !== "unknown" ? scan.docType : null;
  let aiError: string | null = null;
  let sent = 0;
  try {
    const outcome = await runExtraction(await filesForAi(scan), { docTypeHint: hint, onAiCall: () => sent++ });
    await fillFromExtraction(scan, outcome, owner);
  } catch (error) {
    aiError = markFailed(scan, error, hint || "purchase");
    logScanFailure(scan._id, error);
    scan.aiCalls = (scan.aiCalls || 0) + billableCalls(sent, error);
  }
  await scan.save();
  return res.json({ success: true, data: present(scan), ...(aiError ? { aiError } : {}) });
});

/** The scan, only if it belongs to the logged-in owner (anything else is "not found"). */
async function findScan(req: Request, res: Response): Promise<IScannedDocument | null> {
  const { id } = req.params;
  const owner = scanOwnerFrom(req);
  if (!owner || !mongoose.Types.ObjectId.isValid(id)) {
    fail(res, 404, "Scan not found");
    return null;
  }
  const scan = await ScannedDocument.findOne({ _id: id, ...ownerFilter(owner) });
  if (!scan) {
    fail(res, 404, "Scan not found");
    return null;
  }
  return scan;
}

/**
 * A manual entry nobody filled in: no party, bill no., total or items. The page discards these
 * when the person leaves; this catches the rest (closed tab, lost connection).
 */
const EMPTY_MANUAL_DRAFT = {
  provider: "manual",
  status: "draft",
  partyName: { $in: [null, ""] },
  invoiceNumber: { $in: [null, ""] },
  grandTotal: null,
  $or: [{ "data.items": { $size: 0 } }, { "data.items": { $exists: false } }],
};
const EMPTY_DRAFT_TTL_MS = 30 * 60 * 1000;

/** Delete empty manual drafts older than 30 minutes, with their files (best effort, never blocks). */
async function purgeEmptyDrafts() {
  const stale = await ScannedDocument.find({ ...EMPTY_MANUAL_DRAFT, createdAt: { $lt: new Date(Date.now() - EMPTY_DRAFT_TTL_MS) } })
    .select("_id files.publicId")
    .limit(200)
    .lean();
  if (!stale.length) return;
  await deleteStored(stale.flatMap((d: any) => (d.files || []).map((f: any) => f.publicId).filter(Boolean)));
  await ScannedDocument.deleteMany({ _id: { $in: stale.map((d: any) => d._id) }, ...EMPTY_MANUAL_DRAFT });
}

/** GET / — scan history. ?status=&docType=&q=&from=YYYY-MM-DD&to=&page=&limit= */
export const listScans = asyncHandler(async (req: Request, res: Response) => {
  const owner = requireOwner(req, res);
  if (!owner) return;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter: any = { ...ownerFilter(owner) };
  const status = String(req.query.status || "");
  if (status && status !== "all") filter.status = { $in: status.split(",") };
  else filter.status = { $ne: "discarded" };
  // Empty manual entries are clutter, not history
  filter.$nor = [EMPTY_MANUAL_DRAFT];
  purgeEmptyDrafts().catch(() => undefined);
  if (isDocType(req.query.docType)) filter.docType = req.query.docType;
  const q = String(req.query.q || "").trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ partyName: rx }, { invoiceNumber: rx }];
  }
  const from = String(req.query.from || "");
  const to = String(req.query.to || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(from) || /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    filter.createdAt = {};
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) filter.createdAt.$gte = new Date(`${from}T00:00:00+05:30`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) filter.createdAt.$lte = new Date(`${to}T23:59:59.999+05:30`);
  }
  const [rows, total] = await Promise.all([
    ScannedDocument.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("status docType partyName invoiceNumber invoiceDate grandTotal confidence warnings files provider aiModel error duplicateOf sync createdAt updatedAt")
      .lean(),
    ScannedDocument.countDocuments(filter),
  ]);
  const data = rows.map((r: any) => ({
    ...r,
    warningCount: (r.warnings || []).filter((w: any) => w.severity !== "info").length,
    warnings: undefined,
    pages: (r.files || []).reduce((s: number, f: any) => s + (Number(f.pages) || 1), 0),
    thumbnailUrl: r.files?.[0]?.publicId ? safeLink(() => signedFileUrl(r.files[0], "preview", r.files[0].mimeType === "application/pdf" ? 1 : undefined)) : null,
    files: undefined,
  }));
  return res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const getScan = asyncHandler(async (req: Request, res: Response) => {
  const scan = await findScan(req, res);
  if (!scan) return;
  return res.json({ success: true, data: present(scan) });
});

/** PUT /:id — save the person's edits (draft). Re-runs the checks and returns fresh warnings. */
export const updateScan = asyncHandler(async (req: Request, res: Response) => {
  const owner = requireOwner(req, res);
  if (!owner) return;
  const scan = await findScan(req, res);
  if (!scan) return;
  if (!["draft", "failed"].includes(scan.status)) return fail(res, 409, "This scan is already saved and can't be edited.");
  const parsed = ReviewBillSchema.safeParse(req.body?.data ?? req.body);
  if (!parsed.success) {
    return fail(res, 400, "Some fields are invalid.", { details: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`) });
  }
  const bill = parsed.data;
  const asExtraction = bill as unknown as Extraction;
  const warnings = validateExtraction({
    ...asExtraction,
    confidence: { overall: null, invoiceNumber: null, invoiceDate: null, party: null, items: null, totals: null },
  });
  const dup = await duplicateCheck(scan._id as mongoose.Types.ObjectId, asExtraction, owner);
  scan.set({
    data: bill,
    docType: bill.docType,
    status: "draft",
    warnings: dup.warning ? [dup.warning, ...warnings] : warnings,
    fingerprint: dup.fingerprint,
    duplicateOf: dup.duplicateOf,
    ...summaryFields(asExtraction),
  });
  await scan.save();
  return res.json({ success: true, data: present(scan) });
});

/** POST /:id/rematch — fuzzy-match the (edited) items and party again. */
export const rematchScan = asyncHandler(async (req: Request, res: Response) => {
  const owner = requireOwner(req, res);
  if (!owner) return;
  const scan = await findScan(req, res);
  if (!scan) return;
  const bill = ReviewBillSchema.safeParse(req.body?.data ?? scan.data);
  if (!bill.success) return fail(res, 400, "Some fields are invalid.");
  const matches = await computeMatches(bill.data as unknown as Extraction, owner);
  if (["draft", "failed"].includes(scan.status)) {
    scan.matches = matches;
    await scan.save();
  }
  return res.json({ success: true, data: matches });
});

/** POST /:id/confirm — { data?, syncLedger? }. Idempotent: confirming twice returns the first result. */
export const confirmScanHandler = asyncHandler(async (req: Request, res: Response) => {
  const owner = requireOwner(req, res);
  if (!owner) return;
  try {
    const result = await confirmScan(req.params.id, owner, { data: req.body?.data, syncLedger: req.body?.syncLedger });
    return res.status(result.alreadyConfirmed ? 200 : 201).json({
      success: true,
      message: result.alreadyConfirmed ? "Already saved earlier. Nothing was added again." : "Bill saved.",
      alreadyConfirmed: result.alreadyConfirmed,
      data: present(result.scan),
    });
  } catch (error) {
    if (error instanceof ConfirmError) return fail(res, error.status, error.message, error.details ? { details: error.details } : {});
    console.error("[ocr] confirm failed:", (error as Error)?.message);
    return fail(res, 500, "Couldn't save the bill. Nothing was changed. Try again.");
  }
});

/** POST /:id/sync-ledger — { supplierId? } post a confirmed purchase to the supplier ledger. */
export const syncLedgerHandler = asyncHandler(async (req: Request, res: Response) => {
  const owner = requireOwner(req, res);
  if (!owner) return;
  try {
    const supplierId = typeof req.body?.supplierId === "string" && mongoose.Types.ObjectId.isValid(req.body.supplierId) ? req.body.supplierId : undefined;
    const result = await syncScanToLedger(req.params.id, owner, supplierId);
    return res.json({
      success: true,
      message: result.alreadyConfirmed ? "Already in the supplier ledger." : "Added to the supplier ledger.",
      alreadyConfirmed: result.alreadyConfirmed,
      data: present(result.scan),
    });
  } catch (error) {
    if (error instanceof ConfirmError) return fail(res, error.status, error.message);
    console.error("[ocr] ledger sync failed:", (error as Error)?.message);
    return fail(res, 500, "Couldn't update the supplier ledger. Nothing was changed.");
  }
});

/** DELETE /:id — discard an unsaved scan (and its stored files). Saved bills can't be deleted here. */
export const discardScan = asyncHandler(async (req: Request, res: Response) => {
  const scan = await findScan(req, res);
  if (!scan) return;
  if (scan.status === "confirmed" || scan.status === "syncing") return fail(res, 409, "This bill is saved. Reverse it from Purchase/POS instead.");
  if (scan.status === "discarded") return res.json({ success: true, message: "Already discarded" });
  await deleteStored(scan.files.map((f) => f.publicId).filter(Boolean) as string[]);
  // An untouched manual entry has nothing worth keeping: remove it outright
  if (await ScannedDocument.exists({ _id: scan._id, ...EMPTY_MANUAL_DRAFT })) {
    await ScannedDocument.deleteOne({ _id: scan._id });
    return res.json({ success: true, message: "Empty entry removed" });
  }
  scan.set({ status: "discarded", files: scan.files.map((f) => ({ ...((f as any).toObject?.() ?? f), publicId: undefined })) });
  await scan.save();
  return res.json({ success: true, message: "Scan discarded" });
});

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote, and neutralise spreadsheet formulas (=, +, -, @ at the start)
  const safe = /^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) || safe !== s ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** GET /:id/export?format=csv|json — PDF is generated in the browser from the same data. */
export const exportScan = asyncHandler(async (req: Request, res: Response) => {
  const scan = await findScan(req, res);
  if (!scan) return;
  const bill: any = scan.data || scan.extracted || {};
  const format = String(req.query.format || "csv").toLowerCase();
  const base = `scan-${(bill.invoiceNumber || String(scan._id)).toString().replace(/[^A-Za-z0-9_-]+/g, "_")}`;
  if (format === "json") {
    res.setHeader("Content-Disposition", `attachment; filename="${base}.json"`);
    return res.json({ id: scan._id, status: scan.status, docType: scan.docType, bill, warnings: scan.warnings, sync: scan.sync });
  }
  if (format !== "csv") return fail(res, 400, "Use format=csv or format=json (PDF is made in the browser).");

  const t = bill.totals || {};
  const lines: string[][] = [
    ["Bill type", bill.docType],
    ["Bill no.", bill.invoiceNumber],
    ["Date", formatDateIN(bill.invoiceDate)],
    ["Party", bill.party?.name],
    ["GSTIN", bill.party?.gstin],
    ["Phone", bill.party?.phone],
    ["Payment mode", bill.paymentMode],
    ["Payment status", bill.paymentStatus],
    [],
    ["#", "Item", "HSN", "Qty", "Unit", "Rate", "MRP", "Discount", "GST %", "Tax", "Amount", "Batch", "Expiry"],
    ...((bill.items || []) as any[]).map((it, i) => [
      String(i + 1), it.name, it.hsn, it.quantity, it.unit, it.rate, it.mrp, it.discount, it.taxRate, it.taxAmount, it.amount, it.batch, it.expiry,
    ]),
    [],
    ["Subtotal", t.subtotal],
    ["Discount", t.discount],
    ["CGST", t.cgst],
    ["SGST", t.sgst],
    ["IGST", t.igst],
    ["Cess", t.cess],
    ["Other charges", t.otherCharges],
    ["Round off", t.roundOff],
    ["Grand total", t.grandTotal],
    ["Amount in words", typeof t.grandTotal === "number" ? amountToIndianWords(t.grandTotal) : bill.amountInWords],
  ].map((row) => row.map(csvCell));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${base}.csv"`);
  return res.send("﻿" + lines.map((r) => r.join(",")).join("\r\n"));
});
