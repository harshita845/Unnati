import { useState } from "react";
import {
  IMAGE_SIZE_PRESETS,
  ImageSizeChoice,
  MAX_IMAGE_SIDE,
  MIN_IMAGE_SIDE,
} from "../../../../utils/imageResize";

interface Props {
  value: ImageSizeChoice;
  onChange: (value: ImageSizeChoice) => void;
  disabled?: boolean;
}

const fieldClass =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100";

/** Width × height the next uploaded images are resized to (or keep the original size). */
export default function ImageSizeSelector({ value, onChange, disabled }: Props) {
  const presetIndex = IMAGE_SIZE_PRESETS.findIndex((p) => p.width === value.width && p.height === value.height);
  const isOriginal = value.width === null && value.height === null;
  const [custom, setCustom] = useState(!isOriginal && presetIndex === -1);
  const selected = custom ? "custom" : isOriginal ? "original" : presetIndex === -1 ? "custom" : String(presetIndex);

  // While typing a box can be empty or too small: kept as 0 / the typed number, and uploads wait until it's valid
  const setSide = (side: "width" | "height", raw: string) => {
    const n = Math.round(Number(raw));
    onChange({ ...value, [side]: Number.isFinite(n) && n > 0 ? Math.min(MAX_IMAGE_SIDE, n) : 0 });
  };
  const tooSmall = selected === "custom" && ((value.width || 0) < MIN_IMAGE_SIDE || (value.height || 0) < MIN_IMAGE_SIDE);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-600">Image size</span>
      <select
        className={fieldClass}
        value={selected}
        disabled={disabled}
        aria-label="Image size"
        onChange={(e) => {
          const v = e.target.value;
          if (v === "original") {
            setCustom(false);
            onChange({ ...value, width: null, height: null });
          } else if (v === "custom") {
            setCustom(true);
            onChange({ ...value, width: value.width || 1080, height: value.height || 1080 });
          } else {
            setCustom(false);
            const p = IMAGE_SIZE_PRESETS[Number(v)];
            onChange({ ...value, width: p.width, height: p.height });
          }
        }}>
        <option value="original">Original size (no change)</option>
        {IMAGE_SIZE_PRESETS.map((p, i) => (
          <option key={p.label} value={String(i)}>{p.label}</option>
        ))}
        <option value="custom">Custom width × height…</option>
      </select>
      {selected === "custom" && (
        <span className="flex items-center gap-1">
          <input
            type="number"
            min={MIN_IMAGE_SIDE}
            max={MAX_IMAGE_SIDE}
            className={`${fieldClass} w-24`}
            value={value.width || ""}
            disabled={disabled}
            onChange={(e) => setSide("width", e.target.value)}
            aria-label="Width in pixels"
            placeholder="Width"
          />
          <span className="text-slate-400">×</span>
          <input
            type="number"
            min={MIN_IMAGE_SIDE}
            max={MAX_IMAGE_SIDE}
            className={`${fieldClass} w-24`}
            value={value.height || ""}
            disabled={disabled}
            onChange={(e) => setSide("height", e.target.value)}
            aria-label="Height in pixels"
            placeholder="Height"
          />
          <span className="text-xs text-slate-500">px</span>
        </span>
      )}
      {!isOriginal ? (
        <select
          className={fieldClass}
          value={value.fit}
          disabled={disabled}
          aria-label="How to fit the image"
          onChange={(e) => onChange({ ...value, fit: e.target.value as ImageSizeChoice["fit"] })}>
          <option value="contain">Fit whole image (white edges)</option>
          <option value="cover">Fill size (crop edges)</option>
        </select>
      ) : null}
      {tooSmall && <span className="text-xs text-rose-500">Use at least {MIN_IMAGE_SIDE} px on each side</span>}
    </div>
  );
}
