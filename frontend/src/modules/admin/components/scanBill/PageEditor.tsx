import { useEffect, useRef, useState } from 'react';
import { Crop, RotateCcw, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { CropRect, PageEdits } from '../../scanBill/imagePrep';
import { btn } from './scanBillUi';

/**
 * Full-screen editor for one bill photo: zoom to inspect, rotate in 90° steps, drag a box to
 * crop. Edits are stored as fractions and applied when the photo is prepared for upload.
 */

interface Props {
  src: string;
  name: string;
  edits: PageEdits;
  onSave: (edits: PageEdits) => void;
  onClose: () => void;
}

const MAX_PREVIEW = 900;

export default function PageEditor({ src, name, edits, onSave, onClose }: Props) {
  const [rotation, setRotation] = useState<PageEdits['rotation']>(edits.rotation);
  const [crop, setCrop] = useState<CropRect | null>(edits.crop);
  const [zoom, setZoom] = useState(1);
  const [cropMode, setCropMode] = useState(false);
  const [drag, setDrag] = useState<{ x0: number; y0: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Draw the rotated photo; crop fractions are relative to this rotated picture
  useEffect(() => {
    let cancelled = false;
    const draw = (img: HTMLImageElement) => {
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const quarter = rotation === 90 || rotation === 270;
      const w = quarter ? img.naturalHeight : img.naturalWidth;
      const h = quarter ? img.naturalWidth : img.naturalHeight;
      const scale = Math.min(1, MAX_PREVIEW / Math.max(w, h));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, (-img.naturalWidth * scale) / 2, (-img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);
      ctx.restore();
    };
    if (imgRef.current?.src === src && imgRef.current.complete) draw(imgRef.current);
    else {
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        draw(img);
      };
      img.src = src;
    }
    return () => {
      cancelled = true;
    };
  }, [src, rotation]);

  const rotate = (dir: 1 | -1) => {
    setRotation((r) => (((r + dir * 90 + 360) % 360) as PageEdits['rotation']));
    setCrop(null); // a crop box drawn for the old orientation no longer fits
  };

  const pointer = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)) };
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-gray-900/95" role="dialog" aria-modal="true" aria-label={`Edit ${name}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2.5 text-white">
        <span className="mr-auto truncate text-sm font-semibold">{name}</span>
        <button type="button" className="rounded-md p-2 hover:bg-white/10" onClick={() => rotate(-1)} title="Rotate left" aria-label="Rotate left">
          <RotateCcw size={18} />
        </button>
        <button type="button" className="rounded-md p-2 hover:bg-white/10" onClick={() => rotate(1)} title="Rotate right" aria-label="Rotate right">
          <RotateCw size={18} />
        </button>
        <span className="mx-1 h-5 w-px bg-white/20" />
        <button type="button" className="rounded-md p-2 hover:bg-white/10 disabled:opacity-40" disabled={cropMode} onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label="Zoom out">
          <ZoomOut size={18} />
        </button>
        <span className="w-10 text-center text-xs">{Math.round(zoom * 100)}%</span>
        <button type="button" className="rounded-md p-2 hover:bg-white/10 disabled:opacity-40" disabled={cropMode} onClick={() => setZoom((z) => Math.min(4, z + 0.5))} aria-label="Zoom in">
          <ZoomIn size={18} />
        </button>
        <span className="mx-1 h-5 w-px bg-white/20" />
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ${cropMode ? 'bg-[#6DBB2D] text-white' : 'hover:bg-white/10'}`}
          onClick={() => {
            setZoom(1);
            setCropMode((m) => !m);
          }}
        >
          <Crop size={16} /> {cropMode ? 'Drag to crop' : 'Crop'}
        </button>
        {crop && (
          <button type="button" className="rounded-md px-2.5 py-1.5 text-sm hover:bg-white/10" onClick={() => setCrop(null)}>
            Clear crop
          </button>
        )}
        <button type="button" className="ml-2 rounded-md p-2 hover:bg-white/10" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto w-fit" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
          <div
            className={`relative touch-none select-none ${cropMode ? 'cursor-crosshair' : ''}`}
            onPointerDown={(e) => {
              if (!cropMode) return;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              const p = pointer(e);
              setDrag({ x0: p.x, y0: p.y });
              setCrop({ x: p.x, y: p.y, w: 0, h: 0 });
            }}
            onPointerMove={(e) => {
              if (!drag) return;
              const p = pointer(e);
              setCrop({ x: Math.min(drag.x0, p.x), y: Math.min(drag.y0, p.y), w: Math.abs(p.x - drag.x0), h: Math.abs(p.y - drag.y0) });
            }}
            onPointerUp={() => {
              setDrag(null);
              setCrop((c) => (c && c.w > 0.03 && c.h > 0.03 ? c : null)); // ignore accidental taps
            }}
          >
            <canvas ref={canvasRef} className="block max-h-[75vh] max-w-full rounded shadow-2xl" />
            {crop && (
              <div
                className="pointer-events-none absolute border-2 border-[#6DBB2D] shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
                style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">
        <button type="button" className={btn.secondary} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={btn.primary}
          onClick={() => {
            onSave({ rotation, crop });
            onClose();
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
