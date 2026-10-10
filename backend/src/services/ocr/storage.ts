import cloudinary from "../../config/cloudinary";
import { OcrFile } from "./providers";

/**
 * Bill files live in Cloudinary as *authenticated* assets (not public URLs: bills carry GSTINs,
 * phone numbers and amounts). The browser uploads directly with a signature from us (Vercel caps
 * request bodies at 4.5 MB), then the server fetches the bytes over a signed URL for the AI.
 */

export const OCR_FOLDER = "Unnati Stores/scanned-bills";
export const OCR_DELIVERY_TYPE = "authenticated";

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const MAX_FILES_PER_SCAN = 10;
export const maxFileBytes = () => Math.max(1, Number(process.env.OCR_MAX_FILE_MB) || 10) * 1024 * 1024;

export const cloudinaryConfigured = () =>
  !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

export function uploadSignature() {
  const timestamp = Math.round(Date.now() / 1000);
  const params = { folder: OCR_FOLDER, timestamp, type: OCR_DELIVERY_TYPE };
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET as string);
  return {
    // "image" handles JPG/PNG/WEBP and PDF (page previews come for free)
    uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder: OCR_FOLDER,
    type: OCR_DELIVERY_TYPE,
    timestamp,
    signature,
    maxFileMb: maxFileBytes() / 1024 / 1024,
    allowed: ALLOWED_MIME,
  };
}

/** Only files we told the browser to upload (our folder) can be read back. */
export const isOurPublicId = (publicId: string) => typeof publicId === "string" && publicId.startsWith(`${OCR_FOLDER}/`) && !publicId.includes("..");

/**
 * Signed URL for the AI copy: auto-rotated (EXIF), capped at 2400px on the long edge, JPEG.
 * PDFs are sent as the original PDF (the providers read PDFs natively, text layer included).
 */
export function signedFileUrl(file: { publicId: string; format?: string; mimeType: string }, variant: "ai" | "preview" | "original" = "ai", page?: number) {
  const isPdf = file.mimeType === "application/pdf";
  const base = { resource_type: "image", type: OCR_DELIVERY_TYPE, sign_url: true, secure: true } as const;
  if (variant === "original" || (variant === "ai" && isPdf)) {
    // Through the Admin download API, not the delivery CDN: Cloudinary blocks delivering PDFs
    // unless the account allows it (401 "deny or ACL failure"); the API download always works.
    // Signed with the API secret and valid for an hour.
    return cloudinary.utils.private_download_url(file.publicId, file.format || (isPdf ? "pdf" : "jpg"), {
      resource_type: "image",
      type: OCR_DELIVERY_TYPE,
      expires_at: Math.round(Date.now() / 1000) + 3600,
    });
  }
  if (variant === "preview") {
    return cloudinary.url(file.publicId, {
      ...base,
      format: "jpg",
      transformation: [{ ...(isPdf && page ? { page } : {}), width: 1400, height: 1400, crop: "limit", quality: "auto" }],
    });
  }
  return cloudinary.url(file.publicId, {
    ...base,
    format: "jpg",
    transformation: [{ angle: "exif" }, { width: 2400, height: 2400, crop: "limit", quality: "auto:good" }],
  });
}

export type StorageStep = "upload" | "signing" | "fetch";

/** A storage problem, saying which step failed and Cloudinary's reason (never a URL, key or file bytes). */
export class StorageError extends Error {
  constructor(readonly step: StorageStep, message: string, readonly status?: number, readonly reason?: string) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * Cloudinary's own reason (x-cld-error header, or the JSON error body), trimmed of the
 * "String to sign" echo and anything signature-like so it is safe to show and log.
 */
async function cloudinaryReason(res: Response): Promise<string> {
  let reason = res.headers.get("x-cld-error") || "";
  if (!reason) {
    try {
      reason = ((await res.clone().json()) as any)?.error?.message || "";
    } catch {
      /* body isn't JSON */
    }
  }
  return reason
    .replace(/\.?\s*String to sign.*$/is, "")
    .replace(/\b[0-9a-f]{32,}\b/gi, "…")
    .trim()
    .slice(0, 160);
}

const STEP_LABEL: Record<StorageStep, string> = {
  upload: "Upload to storage failed",
  signing: "Couldn't sign the storage link",
  fetch: "Couldn't download the bill from storage",
};

const storageMessage = (step: StorageStep, status?: number, reason?: string) =>
  `${STEP_LABEL[step]}${status || reason ? ` (${[status, reason].filter(Boolean).join(": ")})` : ""}.`;

async function download(url: string, timeoutMs: number): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const reason = await cloudinaryReason(res);
      throw new StorageError("fetch", storageMessage("fetch", res.status, reason), res.status, reason);
    }
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length > maxFileBytes() * 2) throw new StorageError("fetch", "The stored file is too large to read.");
    return data;
  } catch (error: any) {
    if (error instanceof StorageError) throw error;
    if (error?.name === "AbortError") throw new StorageError("fetch", storageMessage("fetch", undefined, "timed out"), undefined, "timed out");
    throw new StorageError("fetch", storageMessage("fetch", undefined, "network error"), undefined, "network error");
  } finally {
    clearTimeout(timer);
  }
}

function sign(file: { publicId: string; format?: string; mimeType: string }, variant: "ai" | "preview", page?: number): string {
  if (!cloudinaryConfigured()) {
    throw new StorageError("signing", storageMessage("signing", undefined, "Cloudinary keys are not set on the server"), undefined, "not configured");
  }
  try {
    return signedFileUrl(file, variant, page);
  } catch (error: any) {
    throw new StorageError("signing", storageMessage("signing", undefined, String(error?.message || "unknown error").slice(0, 120)));
  }
}

/**
 * Download a stored bill for the AI: images as a resized JPEG (signed delivery URL), PDFs as the
 * original through the Admin download API. If a PDF can't be downloaded that way, its pages are
 * sent as JPEG renders instead (the same signed delivery the preview uses).
 */
export async function fetchForOcr(file: { publicId: string; format?: string; mimeType: string; pages?: number }, timeoutMs = 15000): Promise<OcrFile[]> {
  const isPdf = file.mimeType === "application/pdf";
  if (!isPdf) return [{ mimeType: "image/jpeg", data: await download(sign(file, "ai"), timeoutMs) }];
  try {
    return [{ mimeType: "application/pdf", data: await download(sign(file, "ai"), timeoutMs) }];
  } catch (error) {
    if (!(error instanceof StorageError) || error.step !== "fetch") throw error;
    const pages = Math.min(10, Math.max(1, Number(file.pages) || 1));
    try {
      const renders = await Promise.all(Array.from({ length: pages }, (_, i) => download(sign(file, "preview", i + 1), timeoutMs)));
      return renders.map((data) => ({ mimeType: "image/jpeg", data }));
    } catch {
      throw error; // report the original (PDF download) failure
    }
  }
}

/** Small inline uploads (curl tests, or when the browser can't reach Cloudinary): store them too. */
export async function storeInline(data: Buffer, mimeType: string, originalName?: string) {
  if (!cloudinaryConfigured()) return null;
  const isPdf = mimeType === "application/pdf";
  const result: any = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: OCR_FOLDER, type: OCR_DELIVERY_TYPE, resource_type: "image", ...(isPdf ? { format: "pdf" } : {}) },
      (err: unknown, res: unknown) => (err ? reject(err) : resolve(res))
    );
    stream.end(data);
  });
  return {
    publicId: result.public_id as string,
    resourceType: "image",
    deliveryType: OCR_DELIVERY_TYPE,
    format: result.format as string,
    mimeType,
    bytes: result.bytes as number,
    pages: result.pages as number | undefined,
    originalName,
  };
}

export async function deleteStored(publicIds: string[]) {
  if (!cloudinaryConfigured() || !publicIds.length) return;
  await cloudinary.api
    .delete_resources(publicIds, { type: OCR_DELIVERY_TYPE, resource_type: "image" })
    .catch(() => undefined); // best effort: a leftover file is harmless, a failed delete shouldn't block
}
