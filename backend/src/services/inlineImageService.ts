import { uploadImage } from "./cloudinaryService";
import { CLOUDINARY_FOLDERS } from "../config/cloudinary";

/**
 * A picture sent as text (data:image/...) must not be stored in the database. Kept inside a seller
 * record, a 210 KB banner was read on every store listing and sent to every customer twice (as
 * `storeBanner` and again as `image`), turning the home page into a 600 KB download. These helpers
 * move such pictures to Cloudinary so only a short link is saved.
 */

export const SELLER_IMAGE_FIELDS = ["logo", "storeBanner", "profile"] as const;

export class InlineImageUploadError extends Error {
  constructor(public readonly field: string, cause?: unknown) {
    super(`Could not upload the ${field} image. Please try again.`);
    this.name = "InlineImageUploadError";
    if (cause) console.error(`Inline image upload failed for "${field}":`, (cause as Error).message);
  }
}

export const isInlineImage = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("data:image/");

/**
 * Replaces any data-URL in the listed fields with an uploaded link, in place.
 * The same picture in two fields (logo and profile are often identical) is uploaded once.
 */
export const offloadInlineImages = async <T extends Record<string, any>>(
  data: T,
  fields: readonly string[] = SELLER_IMAGE_FIELDS,
  folder: string = CLOUDINARY_FOLDERS.SELLER_PROFILE
): Promise<T> => {
  const uploaded = new Map<string, string>();
  for (const field of fields) {
    const value = data[field];
    if (!isInlineImage(value)) continue;
    let url = uploaded.get(value);
    if (!url) {
      try {
        url = (await uploadImage(value, { folder })).secureUrl;
      } catch (error) {
        throw new InlineImageUploadError(field, error);
      }
      uploaded.set(value, url);
    }
    (data as Record<string, any>)[field] = url;
  }
  return data;
};
