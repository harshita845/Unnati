/**
 * Get a bill photo ready in the browser before upload: apply the person's rotate/crop, cap the
 * long edge and re-encode as JPEG. Phone photos (5–12 MB) become ~0.5–1.5 MB, which uploads fast
 * and is still sharp enough to read small print. PDFs are uploaded unchanged.
 */

export interface CropRect {
  /** Fractions of the image (0–1), so they survive rotation previews and resizes */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PageEdits {
  rotation: 0 | 90 | 180 | 270;
  crop: CropRect | null;
}

export const MAX_EDGE = 2400;
export const JPEG_QUALITY = 0.85;

/** Output size for a source image after rotation, crop and the long-edge cap. */
export function outputSize(srcW: number, srcH: number, edits: PageEdits, maxEdge = MAX_EDGE) {
  const crop = edits.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const quarter = edits.rotation === 90 || edits.rotation === 270;
  const rotW = quarter ? srcH : srcW;
  const rotH = quarter ? srcW : srcH;
  const cw = Math.max(1, Math.round(rotW * crop.w));
  const ch = Math.max(1, Math.round(rotH * crop.h));
  const scale = Math.min(1, maxEdge / Math.max(cw, ch));
  return { width: Math.max(1, Math.round(cw * scale)), height: Math.max(1, Math.round(ch * scale)), scale, rotW, rotH };
}

const loadImage = (file: Blob) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image couldn't be opened. Try a JPG or PNG."));
    };
    img.src = url;
  });

/** Rotate + crop + resize + JPEG. Browsers apply EXIF orientation when drawing, so photos come out upright. */
export async function prepareImage(file: File, edits: PageEdits): Promise<Blob> {
  const img = await loadImage(file);
  const { width, height, scale, rotW, rotH } = outputSize(img.naturalWidth, img.naturalHeight, edits);
  const crop = edits.crop ?? { x: 0, y: 0, w: 1, h: 1 };

  // 1. rotated full image
  const rotated = document.createElement('canvas');
  rotated.width = Math.round(rotW * scale);
  rotated.height = Math.round(rotH * scale);
  const rctx = rotated.getContext('2d')!;
  rctx.fillStyle = '#fff';
  rctx.fillRect(0, 0, rotated.width, rotated.height);
  rctx.translate(rotated.width / 2, rotated.height / 2);
  rctx.rotate((edits.rotation * Math.PI) / 180);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  rctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);

  // 2. crop
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  out.getContext('2d')!.drawImage(rotated, crop.x * rotated.width, crop.y * rotated.height, crop.w * rotated.width, crop.h * rotated.height, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not prepare the image.'))), 'image/jpeg', JPEG_QUALITY)
  );
}

export const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
export const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
