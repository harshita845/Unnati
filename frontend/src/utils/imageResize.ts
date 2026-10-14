/**
 * Resize an image in the browser to an exact width × height before uploading, so the stored
 * image (and every app that shows it) has the size chosen on the product form.
 */

export type ImageFit = "contain" | "cover";

export interface ImageSizeChoice {
  /** null = keep the original size */
  width: number | null;
  height: number | null;
  /** contain: whole image visible, empty space filled white. cover: fills the size, edges cropped. */
  fit: ImageFit;
}

export const ORIGINAL_SIZE: ImageSizeChoice = { width: null, height: null, fit: "contain" };

export const IMAGE_SIZE_PRESETS: { label: string; width: number; height: number }[] = [
  { label: "Square 1080 × 1080 (recommended)", width: 1080, height: 1080 },
  { label: "Square 720 × 720", width: 720, height: 720 },
  { label: "Square 500 × 500", width: 500, height: 500 },
  { label: "Portrait 3:4 · 720 × 960", width: 720, height: 960 },
  { label: "Portrait 4:5 · 1080 × 1350", width: 1080, height: 1350 },
  { label: "Landscape 4:3 · 960 × 720", width: 960, height: 720 },
  { label: "Wide 16:9 · 1280 × 720", width: 1280, height: 720 },
];

export const MIN_IMAGE_SIDE = 100;
export const MAX_IMAGE_SIDE = 4000;

/** Original size, or both sides between the min and max. */
export const isImageSizeValid = (choice: ImageSizeChoice) =>
  (choice.width === null && choice.height === null) ||
  [choice.width, choice.height].every((n) => typeof n === "number" && n >= MIN_IMAGE_SIDE && n <= MAX_IMAGE_SIDE);

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name}`));
    };
    img.src = url;
  });

/** Resize to the chosen size. Returns the original file when no size is chosen. */
export async function resizeImageFile(
  file: File,
  choice: ImageSizeChoice
): Promise<{ file: File; upscaled: boolean }> {
  if (choice.width === null && choice.height === null) return { file, upscaled: false };
  if (!isImageSizeValid(choice)) throw new Error(`Choose an image size of at least ${MIN_IMAGE_SIDE} × ${MIN_IMAGE_SIDE} px`);
  const img = await loadImage(file);
  const W = choice.width as number;
  const H = choice.height as number;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { file, upscaled: false };

  const keepTransparency = file.type === "image/png" || file.type === "image/webp";
  if (!keepTransparency || choice.fit === "contain") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
  }
  const scale = choice.fit === "cover"
    ? Math.max(W / img.naturalWidth, H / img.naturalHeight)
    : Math.min(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);

  const type = keepTransparency ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  if (!blob) return { file, upscaled: false };
  const base = file.name.replace(/\.[^.]+$/, "");
  return {
    file: new File([blob], `${base}-${W}x${H}.${type === "image/png" ? "png" : "jpg"}`, { type }),
    upscaled: scale > 1.05,
  };
}

export const describeImageSize = (choice: ImageSizeChoice) =>
  choice.width === null && choice.height === null ? "original size" : `${choice.width || "?"} × ${choice.height || "?"} px`;
