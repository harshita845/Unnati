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
    return cloudinary.url(file.publicId, { ...base, format: file.format || (isPdf ? "pdf" : undefined) });
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

/** Download a stored bill for the AI (image transformed per signedFileUrl, PDF as-is). */
export async function fetchForOcr(file: { publicId: string; format?: string; mimeType: string }, timeoutMs = 15000): Promise<OcrFile> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(signedFileUrl(file, "ai"), { signal: controller.signal });
    if (!res.ok) throw new Error(`Couldn't read the uploaded file back from storage (${res.status}).`);
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length > maxFileBytes() * 2) throw new Error("Uploaded file is too large.");
    return { mimeType: file.mimeType === "application/pdf" ? "application/pdf" : "image/jpeg", data };
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("Timed out reading the uploaded file from storage.");
    throw error;
  } finally {
    clearTimeout(timer);
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
