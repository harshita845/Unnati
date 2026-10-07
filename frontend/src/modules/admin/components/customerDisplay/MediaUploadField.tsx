import { useRef, useState } from 'react';
import { Film, ImageIcon, Loader2, Trash2, UploadCloud } from 'lucide-react';
import {
  DISPLAY_MEDIA_LIMITS,
  uploadDisplayMedia,
  validateDisplayMedia,
  type UploadedDisplayMedia,
} from '../../../../services/api/admin/customerDisplayService';

interface MediaUploadFieldProps {
  mediaType: 'image' | 'video';
  value: string;
  onUploaded: (media: UploadedDisplayMedia) => void;
  onClear?: () => void;
  hint?: string;
  compact?: boolean;
}

/** Drop/select a file → validate type & size → upload to Cloudinary with progress → preview. */
const MediaUploadField = ({ mediaType, value, onUploaded, onClear, hint, compact }: MediaUploadFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const rule = DISPLAY_MEDIA_LIMITS[mediaType];

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    const problem = validateDisplayMedia(file, mediaType);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setProgress(0);
    try {
      const media = await uploadDisplayMedia(file, mediaType, setProgress);
      onUploaded(media);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Upload failed');
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const uploading = progress !== null;

  return (
    <div>
      {value && !uploading ? (
        <div className={`relative overflow-hidden rounded-xl border bg-slate-900 ${compact ? 'aspect-video max-w-xs' : 'aspect-video'}`}>
          {mediaType === 'video' ? (
            <video src={value} muted controls playsInline className="h-full w-full object-contain" />
          ) : (
            <img src={value} alt="" className="h-full w-full object-contain" />
          )}
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-white/90 px-2.5 py-1 text-xs font-semibold text-gray-800 shadow hover:bg-white"
            >
              Replace
            </button>
            {onClear && (
              <button type="button" onClick={onClear} className="rounded-lg bg-white/90 p-1.5 text-red-600 shadow hover:bg-white" title="Remove">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition-colors ${
            compact ? 'py-5' : 'py-8'
          } ${dragging ? 'border-[var(--primary-color)] bg-emerald-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin text-[var(--primary-color)]" />
              <span className="text-sm font-semibold text-gray-700">Uploading… {progress}%</span>
              <div className="h-1.5 w-48 overflow-hidden rounded-full bg-gray-200">
                <div className="h-full bg-[var(--primary-color)] transition-all" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : (
            <>
              {mediaType === 'video' ? <Film className="h-7 w-7 text-gray-400" /> : <ImageIcon className="h-7 w-7 text-gray-400" />}
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <UploadCloud className="h-4 w-4" /> Click or drop a {mediaType} here
              </span>
              <span className="text-xs text-gray-500">{rule.label}</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={rule.types.join(',')}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
};

export default MediaUploadField;
