import { useMemo, useRef } from "react";
import { checkImageRefs } from "../utils/productImportImages";

/**
 * Bulk import: pick the product photos from this computer. The sheet's image cells can hold a
 * file name or laptop path ("rice.jpg", "D:\Images\rice.jpg") instead of a link; the photos are
 * matched by file name and uploaded during the import.
 */
export default function ImportImagesPanel({
  rows,
  files,
  onFilesChange,
  disabled,
}: {
  rows: Record<string, unknown>[];
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const report = useMemo(() => checkImageRefs(rows, files), [rows, files]);
  const needed = report.localRefs.size;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const images = Array.from(list).filter((f) => /^image\//i.test(f.type) || /\.(jpe?g|png|webp|gif|avif|bmp|jfif)$/i.test(f.name));
    const byName = new Map(files.map((f) => [f.name.toLowerCase(), f]));
    for (const f of images) byName.set(f.name.toLowerCase(), f);
    onFilesChange([...byName.values()]);
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-neutral-900 mr-auto">Product images from this computer</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => folderRef.current?.click()}
          className="rounded-lg bg-[var(--primary-color)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--primary-dark)] disabled:opacity-50"
        >
          Select images folder
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => filesRef.current?.click()}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          Select image files
        </button>
        {files.length > 0 && (
          <button type="button" disabled={disabled} onClick={() => onFilesChange([])} className="text-xs text-red-600 hover:underline disabled:opacity-50">
            Clear
          </button>
        )}
        <input
          ref={folderRef}
          type="file"
          multiple
          className="hidden"
          // Whole folder (Chrome, Edge, Safari, Firefox)
          {...({ webkitdirectory: "", directory: "" } as any)}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={filesRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <p className="mt-2 text-xs text-neutral-600">
        In the image columns (29–32) and <b>40. Variation Images</b> you can write a link, a file name (<code>rice.jpg</code>) or a path
        from your computer (<code>D:\Images\rice.jpg</code>). Select the photos here and they are uploaded during the import.
      </p>

      {needed > 0 ? (
        <div className="mt-3 space-y-1 text-xs">
          <p className={report.missing.length ? "text-amber-800" : "text-emerald-700"}>
            {report.matched.size} of {needed} image{needed === 1 ? "" : "s"} used in this sheet found
            {files.length ? ` among ${files.length} selected file${files.length === 1 ? "" : "s"}` : ""}.
          </p>
          {report.missing.length > 0 && (
            <p className="text-amber-800">
              Not found yet: {report.missing.slice(0, 6).join(", ")}
              {report.missing.length > 6 ? ` and ${report.missing.length - 6} more` : ""}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-neutral-500">
          {rows.length ? "This sheet only uses image links (or no images), nothing to select." : "Choose the Excel file first."}
        </p>
      )}
    </div>
  );
}
