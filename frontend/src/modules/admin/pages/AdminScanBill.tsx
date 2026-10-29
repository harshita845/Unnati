import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Crop,
  FileText,
  History,
  ImagePlus,
  Keyboard,
  Layers,
  Loader2,
  RotateCw,
  ScanLine,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { adminScanScope, ScanScope, scanScope, setScanScope } from '../scanBill/scanScope';
import {
  blobToBase64,
  DOC_TYPE_LABEL,
  getScan,
  getScanConfig,
  getScanUsage,
  ScanConfig,
  ScanDocType,
  ScanFileInput,
  ScannedDocument,
  scanBill,
  ScanUsage,
  startManualEntry,
  discardScan,
  ReviewBill,
  uploadScanFile,
} from '../../../services/api/admin/scanBillService';
import { ACCEPTED, isPdf, PageEdits, prepareImage } from '../scanBill/imagePrep';
import PageEditor from '../components/scanBill/PageEditor';
import ReviewForm from '../components/scanBill/ReviewForm';
import ScanHistory from '../components/scanBill/ScanHistory';
import { isBillEmpty } from '../scanBill/confirmChecks';
import { apiMessage, btn, EmptyState, ScanningImage, StatusPill, Stepper, StepState } from '../components/scanBill/scanBillUi';

/**
 * Admin POS → Scan Bill.
 *   Before: add photos/PDFs, rotate/crop/zoom them, pick the bill type
 *   OCR:    upload → AI reads → checks & matching, one bill at a time (batch queue)
 *   After:  review and fix the bill, then Confirm & Save / Sync to Ledger
 * History tab lists every scan.
 */

interface Page {
  id: string;
  file: File;
  url: string;
  pdf: boolean;
  edits: PageEdits;
}

type QueueState = 'pending' | 'uploading' | 'reading' | 'ready' | 'failed' | 'error';

interface QueueBill {
  key: string;
  pages: Page[];
  docType: ScanDocType;
  state: QueueState;
  progress: number;
  startedAt?: number;
  error?: string;
  scan?: ScannedDocument;
}

const DOC_TYPES: ScanDocType[] = ['purchase', 'sales', 'stock_slip', 'expense'];
/** Without file storage on the server, pages go inline in the request (Vercel caps bodies at 4.5 MB) */
const INLINE_LIMIT_BYTES = 3 * 1024 * 1024;
const uid = () => Math.random().toString(36).slice(2, 10);

export default function AdminScanBill({ scope = adminScanScope }: { scope?: ScanScope } = {}) {
  // Before any part renders or loads: they read the scope for their API and links
  setScanScope(scope);
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'scan' | 'history'>(params.get('tab') === 'history' ? 'history' : 'scan');
  const [config, setConfig] = useState<ScanConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [usage, setUsage] = useState<ScanUsage | null>(null);
  const [categories, setCategories] = useState<Array<{ _id: string; name: string }>>([]);

  const [pages, setPages] = useState<Page[]>([]);
  const [docType, setDocType] = useState<ScanDocType>('purchase');
  const [oneBill, setOneBill] = useState(true);
  const [editing, setEditing] = useState<Page | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const [queue, setQueue] = useState<QueueBill[]>([]);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState<{ scan: ScannedDocument; previews: string[]; key?: string } | null>(null);
  const [opening, setOpening] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const processingRef = useRef(false);
  // What's in the open review form right now (for leaving: discard empty manual drafts, warn on unsaved edits)
  const formRef = useRef<{ bill: ReviewBill | null; dirty: boolean }>({ bill: null, dirty: false });
  const openRef = useRef<ScannedDocument | null>(null);

  // ------------------------------------------------------------------ setup
  const refreshUsage = useCallback(() => {
    getScanUsage().then(setUsage).catch(() => undefined);
  }, []);

  useEffect(() => {
    getScanConfig()
      .then(setConfig)
      .catch((e) => setConfigError(apiMessage(e, "Couldn't reach the server")));
    refreshUsage();
    scanScope()
      .loadCategories()
      .then((rows) => setCategories(rows.filter((c: any) => !c.parentId).map((c: any) => ({ _id: c._id, name: c.name }))))
      .catch(() => undefined);
  }, [refreshUsage]);

  // Free the local preview URLs when leaving the page
  const urlsRef = useRef<string[]>([]);
  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const onFormChange = useCallback((bill: ReviewBill, dirty: boolean) => {
    formRef.current = { bill, dirty };
  }, []);

  /**
   * Leaving the open scan. An untouched manual entry is deleted (no empty drafts in History);
   * unsaved edits ask first. Returns false when the person chose to stay.
   */
  const leaveOpenScan = useCallback((): boolean => {
    const scan = openRef.current;
    if (!scan) return true;
    const { bill, dirty } = formRef.current;
    const editable = scan.status === 'draft' || scan.status === 'failed';
    const emptyManual = scan.provider === 'manual' && scan.status === 'draft' && isBillEmpty(bill ?? scan.data);
    if (emptyManual) {
      discardScan(scan._id).catch(() => undefined);
    } else if (editable && dirty && !window.confirm('You have unsaved changes on this bill. Leave without saving?')) {
      return false;
    }
    openRef.current = null;
    formRef.current = { bill: null, dirty: false };
    return true;
  }, []);

  useEffect(() => {
    openRef.current = open?.scan ?? null;
  }, [open]);

  // Leaving the page (route change) also tidies up an untouched manual entry
  useEffect(() => () => {
    const scan = openRef.current;
    if (scan?.provider === 'manual' && scan.status === 'draft' && isBillEmpty(formRef.current.bill ?? scan.data)) {
      discardScan(scan._id).catch(() => undefined);
    }
  }, []);

  // Deep link: ?id=<scan> opens it for review
  const openScanById = useCallback(
    async (id: string) => {
      if (openRef.current?._id === id) return;
      if (!leaveOpenScan()) return;
      setOpening(true);
      try {
        const scan = await getScan(id);
        setOpen({ scan, previews: [] });
        setTab('scan');
        setParams((p) => {
          const next = new URLSearchParams(p);
          next.set('id', id);
          next.delete('tab');
          return next;
        }, { replace: true });
      } catch (e) {
        showToast(apiMessage(e, "Couldn't open that scan"), 'error');
      } finally {
        setOpening(false);
      }
    },
    [setParams, showToast, leaveOpenScan]
  );

  useEffect(() => {
    const id = params.get('id');
    if (id && open?.scan._id !== id) openScanById(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeReview = () => {
    if (!leaveOpenScan()) return;
    setOpen(null);
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.delete('id');
      return next;
    }, { replace: true });
  };

  // ------------------------------------------------------------------ before: pages
  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const maxMb = config?.maxFileMb ?? 10;
    const accepted: Page[] = [];
    for (const file of Array.from(list)) {
      if (!ACCEPTED.includes(file.type) && !isPdf(file)) {
        showToast(`${file.name}: only JPG, PNG, WEBP or PDF`, 'error');
        continue;
      }
      if (file.size > maxMb * 1024 * 1024 && (isPdf(file) || file.size > 40 * 1024 * 1024)) {
        // Photos get shrunk before upload; PDFs go as they are
        showToast(`${file.name} is larger than ${maxMb} MB`, 'error');
        continue;
      }
      const url = URL.createObjectURL(file);
      urlsRef.current.push(url);
      accepted.push({ id: uid(), file, url, pdf: isPdf(file), edits: { rotation: 0, crop: null } });
    }
    setPages((p) => [...p, ...accepted].slice(0, 30));
  };

  const movePage = (i: number, dir: -1 | 1) =>
    setPages((p) => {
      const j = i + dir;
      if (j < 0 || j >= p.length) return p;
      const next = p.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const removePage = (id: string) => setPages((p) => p.filter((x) => x.id !== id));

  const startScan = () => {
    if (!pages.length) return;
    const max = config?.maxFiles ?? 10;
    const groups = oneBill ? [pages] : pages.map((p) => [p]);
    if (groups.some((g) => g.length > max)) {
      showToast(`Up to ${max} pages per bill. Split them into separate bills.`, 'error');
      return;
    }
    setQueue((q) => [...q, ...groups.map((g) => ({ key: uid(), pages: g, docType, state: 'pending' as QueueState, progress: 0 }))]);
    setPages([]);
  };

  /** Rotate/crop/compress each page and upload it (or inline it when the server has no file storage). */
  const uploadPages = useCallback(
    async (list: Page[], onProgress?: (pct: number) => void): Promise<ScanFileInput[]> => {
      const files: ScanFileInput[] = [];
      let inlineBytes = 0;
      for (const [i, page] of list.entries()) {
        const blob = page.pdf ? page.file : await prepareImage(page.file, page.edits);
        const name = page.pdf ? page.file.name : page.file.name.replace(/\.[^.]+$/, '') + '.jpg';
        if (config?.storageEnabled) {
          files.push(await uploadScanFile(blob, name, (pct) => onProgress?.(Math.round(((i + pct / 100) / list.length) * 100))));
        } else {
          inlineBytes += blob.size;
          if (inlineBytes > INLINE_LIMIT_BYTES) throw new Error('These pages are too large to send without file storage. Scan fewer pages at once.');
          files.push({ mimeType: page.pdf ? 'application/pdf' : 'image/jpeg', dataBase64: await blobToBase64(blob), originalName: name });
          onProgress?.(Math.round(((i + 1) / list.length) * 100));
        }
      }
      return files;
    },
    [config?.storageEnabled]
  );

  const manualEntry = async () => {
    setManualBusy(true);
    try {
      // Pages already added come along, so the bill photo shows beside the form while typing
      const attached = pages.slice(0, config?.maxFiles ?? 10);
      const files = attached.length ? await uploadPages(attached) : [];
      const scan = await startManualEntry(docType, files);
      setOpen({ scan, previews: attached.filter((p) => !p.pdf).map((p) => p.url) });
      if (attached.length) setPages([]);
      setParams((p) => {
        const next = new URLSearchParams(p);
        next.set('id', scan._id);
        return next;
      }, { replace: true });
    } catch (e) {
      showToast(apiMessage(e, "Couldn't start a manual entry"), 'error');
    } finally {
      setManualBusy(false);
    }
  };

  // ------------------------------------------------------------------ OCR: the queue
  const patchBill = (key: string, patch: Partial<QueueBill>) => setQueue((q) => q.map((b) => (b.key === key ? { ...b, ...patch } : b)));

  const processBill = useCallback(
    async (bill: QueueBill) => {
      patchBill(bill.key, { state: 'uploading', progress: 0, error: undefined });
      try {
        // Prepare (rotate/crop/compress) and upload every page
        const files = await uploadPages(bill.pages, (pct) => patchBill(bill.key, { progress: pct }));
        patchBill(bill.key, { state: 'reading', progress: 100, startedAt: Date.now() });
        const res = await scanBill(files, bill.docType);
        const scan = res.data;
        patchBill(bill.key, { state: scan.status === 'failed' ? 'failed' : 'ready', scan, error: res.aiError });
        if (res.aiError) showToast(`AI couldn't read the bill: ${res.aiError}`, 'error');
        return scan;
      } catch (e: any) {
        const status = e?.response?.status;
        const msg =
          status === 429
            ? apiMessage(e, 'Too many scans. Wait a minute and retry.')
            : apiMessage(e, 'Scan failed');
        patchBill(bill.key, { state: 'error', error: msg });
        return null;
      } finally {
        refreshUsage();
        setHistoryKey((k) => k + 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uploadPages, refreshUsage]
  );

  // One bill at a time: keeps within the per-minute limit and the server's time budget
  useEffect(() => {
    if (processingRef.current) return;
    const next = queue.find((b) => b.state === 'pending');
    if (!next || !config) return;
    processingRef.current = true;
    const onlyOne = queue.filter((b) => b.state !== 'pending').length === 0 && queue.length === 1;
    processBill(next).then((scan) => {
      processingRef.current = false;
      // A single bill opens for review as soon as it's read
      if (scan && onlyOne) setOpen((o) => o ?? { scan, previews: next.pages.filter((p) => !p.pdf).map((p) => p.url), key: next.key });
      setQueue((q) => [...q]); // re-run this effect for the next pending bill
    });
  }, [queue, config, processBill]);

  const anyReading = queue.some((b) => b.state === 'reading' || b.state === 'uploading');
  useEffect(() => {
    if (!anyReading) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [anyReading]);

  const current = queue.find((b) => b.state === 'uploading' || b.state === 'reading');

  const stepsFor = (b: QueueBill): Array<{ label: string; state: StepState; hint?: string }> => {
    const secs = b.startedAt ? Math.max(0, Math.round((now - b.startedAt) / 1000)) : 0;
    const order: QueueState[] = ['uploading', 'reading', 'ready'];
    const at = b.state === 'failed' ? 2 : b.state === 'error' ? -1 : order.indexOf(b.state);
    return [
      { label: 'Upload', state: b.state === 'pending' ? 'todo' : b.state === 'uploading' ? 'active' : b.state === 'error' && !b.startedAt ? 'error' : 'done', hint: b.state === 'uploading' ? `${b.progress}%` : undefined },
      { label: 'AI reads', state: at < 1 ? (b.state === 'error' && b.startedAt ? 'error' : 'todo') : at === 1 ? 'active' : b.state === 'failed' ? 'error' : 'done', hint: b.state === 'reading' ? `${secs}s` : undefined },
      { label: 'Check & match', state: b.state === 'ready' ? 'done' : 'todo' },
      { label: 'Review', state: b.state === 'ready' || b.state === 'failed' ? 'active' : 'todo' },
    ];
  };

  const openQueueBill = (b: QueueBill) => {
    if (!b.scan) return;
    if (openRef.current && openRef.current._id !== b.scan._id && !leaveOpenScan()) return;
    setOpen({ scan: b.scan, previews: b.pages.filter((p) => !p.pdf).map((p) => p.url), key: b.key });
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.set('id', b.scan!._id);
      return next;
    }, { replace: true });
  };

  const onScanUpdated = (scan: ScannedDocument) => {
    setOpen((o) => (o ? { ...o, scan } : o));
    setQueue((q) => q.map((b) => (b.scan?._id === scan._id ? { ...b, scan, state: scan.status === 'failed' ? 'failed' : 'ready' } : b)));
    setHistoryKey((k) => k + 1);
    refreshUsage();
  };

  const onDiscarded = (id: string) => {
    openRef.current = null;
    setQueue((q) => q.filter((b) => b.scan?._id !== id));
    closeReview();
    setHistoryKey((k) => k + 1);
  };

  const nextToReview = useMemo(
    () => queue.find((b) => (b.state === 'ready' || b.state === 'failed') && b.scan && b.scan.status !== 'confirmed' && b.scan._id !== open?.scan._id),
    [queue, open]
  );

  const aiOff = config && !config.aiEnabled;
  const limitReached = usage ? usage.remaining <= 0 : false;

  // ------------------------------------------------------------------ render
  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-3 sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6DBB2D]/15 text-[#4f8f1c]">
          <ScanLine size={22} />
        </div>
        <div className="mr-auto">
          <h1 className="text-lg font-bold text-gray-900">Scan Bill</h1>
          <p className="text-xs text-gray-500">Photograph a bill, let AI fill it in, check it, save it to stock and ledgers.</p>
        </div>
        {usage && (
          <span
            title={`Resets ${new Date(usage.resetsAt).toLocaleDateString('en-IN')}`}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${limitReached ? 'bg-red-100 text-red-700' : usage.remaining < usage.limit * 0.1 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}
          >
            {usage.used} / {usage.limit} AI scans this month
          </span>
        )}
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
          <button type="button" onClick={() => setTab('scan')} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ${tab === 'scan' ? 'bg-[#6DBB2D] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            <ScanLine size={15} /> Scan
          </button>
          <button type="button" onClick={() => { if (open && !leaveOpenScan()) return; if (open) setOpen(null); setTab('history'); setHistoryKey((k) => k + 1); }} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ${tab === 'history' ? 'bg-[#6DBB2D] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            <History size={15} /> History
          </button>
        </div>
      </div>

      {configError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle size={16} /> {configError}
        </div>
      )}
      {aiOff && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">AI reading is off</div>
            <div className="text-xs">
              {config?.configError?.replace(/\s*Enter the bill manually\.?$/, '') || 'AI scanning is not set up on the server.'} Use <b>Enter manually</b> to type the bill in;
              any photos you add stay attached so you can read from them.
            </div>
          </div>
        </div>
      )}

      {tab === 'history' ? (
        <ScanHistory onOpen={openScanById} refreshKey={historyKey} />
      ) : opening ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-20 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Opening scan…
        </div>
      ) : open ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btn.secondary} onClick={closeReview}>
              <ArrowLeft size={15} /> Back to scanning
            </button>
            {nextToReview && (
              <button type="button" className={`${btn.secondary} ml-auto`} onClick={() => openQueueBill(nextToReview)}>
                Next bill to review <ChevronRight size={15} />
              </button>
            )}
          </div>
          <ReviewForm
            key={open.scan._id}
            scan={open.scan}
            localPreviews={open.previews}
            categories={categories}
            onUpdated={onScanUpdated}
            onDiscarded={onDiscarded}
            onOpenScan={openScanById}
            onFormChange={onFormChange}
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {/* Before */}
          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-auto text-sm font-bold text-gray-900">1. Add the bill</h2>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Bill type">
                {DOC_TYPES.filter((t) => t !== 'sales' || scanScope().kind === 'admin').map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={docType === t}
                    onClick={() => setDocType(t)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${docType === t ? 'border-[#6DBB2D] bg-[#6DBB2D]/10 text-[#3f7a12]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {DOC_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${dragOver ? 'border-[#6DBB2D] bg-[#6DBB2D]/5' : 'border-gray-300 bg-gray-50'}`}
            >
              <Upload size={26} className="mb-2 text-gray-400" />
              <p className="text-sm font-semibold text-gray-800">Drop bill photos or PDFs here</p>
              <p className="mt-0.5 text-xs text-gray-500">
                JPG, PNG, WEBP or PDF · up to {config?.maxFileMb ?? 10} MB · up to {config?.maxFiles ?? 10} pages per bill
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button type="button" className={btn.primary} onClick={() => fileInput.current?.click()}>
                  <ImagePlus size={15} /> Choose files
                </button>
                <button type="button" className={`${btn.secondary} sm:hidden`} onClick={() => cameraInput.current?.click()}>
                  Take photo
                </button>
              </div>
              <input ref={fileInput} type="file" multiple accept={ACCEPTED.join(',')} className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            </div>

            {pages.length > 0 && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">
                    {pages.length} file{pages.length === 1 ? '' : 's'}
                  </span>
                  {pages.length > 1 && (
                    <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs">
                      <button type="button" onClick={() => setOneBill(true)} className={`rounded-md px-2 py-1 font-semibold ${oneBill ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>
                        Pages of one bill
                      </button>
                      <button type="button" onClick={() => setOneBill(false)} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold ${!oneBill ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>
                        <Layers size={12} /> Each is a separate bill
                      </button>
                    </div>
                  )}
                  <button type="button" className={`${btn.ghost} ml-auto`} onClick={() => setPages([])}>
                    Clear all
                  </button>
                </div>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {pages.map((p, i) => (
                    <li key={p.id} className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                      <button type="button" disabled={p.pdf} onClick={() => setEditing(p)} className="relative block aspect-[3/4] w-full overflow-hidden bg-gray-100" aria-label={`Edit ${p.file.name}`}>
                        {p.pdf ? (
                          <span className="flex h-full flex-col items-center justify-center gap-1 text-gray-500">
                            <FileText size={30} />
                            <span className="text-[11px] font-semibold">PDF</span>
                          </span>
                        ) : (
                          <img src={p.url} alt={p.file.name} className="h-full w-full object-contain transition" style={{ transform: `rotate(${p.edits.rotation}deg)` }} />
                        )}
                        <span className="absolute left-1.5 top-1.5 rounded bg-gray-900/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{oneBill ? `Page ${i + 1}` : `Bill ${i + 1}`}</span>
                        {(p.edits.crop || p.edits.rotation !== 0) && (
                          <span className="absolute right-1.5 top-1.5 flex gap-0.5 rounded bg-[#6DBB2D] px-1 py-0.5 text-white">
                            {p.edits.rotation !== 0 && <RotateCw size={11} />}
                            {p.edits.crop && <Crop size={11} />}
                          </span>
                        )}
                      </button>
                      <div className="flex items-center gap-0.5 border-t border-gray-100 px-1.5 py-1">
                        <span className="mr-auto truncate text-[11px] text-gray-500" title={p.file.name}>
                          {p.file.name}
                        </span>
                        <button type="button" className={btn.ghost} disabled={i === 0} onClick={() => movePage(i, -1)} aria-label="Move earlier">
                          <ChevronLeft size={13} />
                        </button>
                        <button type="button" className={btn.ghost} disabled={i === pages.length - 1} onClick={() => movePage(i, 1)} aria-label="Move later">
                          <ChevronRight size={13} />
                        </button>
                        {!p.pdf && (
                          <button
                            type="button"
                            className={btn.ghost}
                            onClick={() => setPages((ps) => ps.map((x) => (x.id === p.id ? { ...x, edits: { rotation: (((x.edits.rotation + 90) % 360) as PageEdits['rotation']), crop: null } } : x)))}
                            aria-label="Rotate"
                          >
                            <RotateCw size={13} />
                          </button>
                        )}
                        <button type="button" className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => removePage(p.id)} aria-label="Remove">
                          <X size={13} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-gray-500">Tap a photo to zoom, rotate or crop it. Cropping to just the bill helps the AI read it.</p>
              </>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              <button type="button" className={btn.primary} disabled={!pages.length || !!aiOff || limitReached || !config} onClick={startScan}>
                <Sparkles size={15} />
                {oneBill || pages.length <= 1 ? 'Scan bill' : `Scan ${pages.length} bills`}
              </button>
              <button type="button" className={btn.secondary} onClick={manualEntry} disabled={manualBusy}>
                {manualBusy ? <Loader2 size={15} className="animate-spin" /> : <Keyboard size={15} />} Enter manually
              </button>
              {limitReached && <span className="text-xs text-red-600">Monthly AI limit reached. Enter bills manually.</span>}
              {aiOff && !limitReached && (
                <span className="text-xs text-amber-700">
                  Scan is off until AI is set up on the server.{pages.length > 0 ? ' Enter manually keeps the file you added.' : ''}
                </span>
              )}
            </div>
          </section>

          {/* OCR + queue */}
          <section className="space-y-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-gray-900">2. AI reads it</h2>
              {current ? (
                <div className="space-y-4">
                  <ScanningImage src={current.pages.find((p) => !p.pdf)?.url} active={current.state === 'reading' || current.state === 'uploading'} />
                  <Stepper steps={stepsFor(current)} />
                  <p className="text-center text-xs text-gray-500">
                    {current.state === 'uploading' ? 'Uploading securely…' : 'Reading items, totals and GST. This usually takes 10–30 seconds.'}
                  </p>
                </div>
              ) : queue.length ? (
                <p className="text-xs text-gray-500">All bills in the queue have been read. Open one below to review it.</p>
              ) : (
                <EmptyState icon={<ScanLine size={22} />} title="Nothing scanning yet" text="Add a bill on the left and press Scan. You can queue several bills; they're read one after another." />
              )}
            </div>

            {queue.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                  <h3 className="text-sm font-bold text-gray-900">Queue ({queue.length})</h3>
                  <button
                    type="button"
                    className={btn.ghost}
                    onClick={() => setQueue((q) => q.filter((b) => !(b.scan && b.scan.status === 'confirmed')))}
                    disabled={!queue.some((b) => b.scan?.status === 'confirmed')}
                  >
                    Clear saved
                  </button>
                </div>
                <ul className="divide-y divide-gray-100">
                  {queue.map((b, i) => {
                    const thumb = b.pages.find((p) => !p.pdf)?.url;
                    return (
                      <li key={b.key} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="h-12 w-10 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-100">
                          {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <FileText size={18} className="m-auto mt-3 text-gray-400" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-gray-900">
                            {b.scan?.partyName || `Bill ${i + 1}`} <span className="font-normal text-gray-400">· {DOC_TYPE_LABEL[b.scan?.docType ?? b.docType]}</span>
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {b.state === 'pending' && 'Waiting…'}
                            {b.state === 'uploading' && `Uploading ${b.progress}%`}
                            {b.state === 'reading' && `AI reading… ${b.startedAt ? Math.round((now - b.startedAt) / 1000) : 0}s`}
                            {(b.state === 'ready' || b.state === 'failed') && b.scan && (
                              <span className="inline-flex items-center gap-1.5">
                                <StatusPill status={b.scan.status} />
                                {b.scan.status !== 'confirmed' && b.scan.warnings.filter((w) => w.severity !== 'info').length > 0 && (
                                  <span className="text-amber-700">{b.scan.warnings.filter((w) => w.severity !== 'info').length} to check</span>
                                )}
                              </span>
                            )}
                            {b.state === 'error' && <span className="text-red-600">{b.error}</span>}
                          </div>
                        </div>
                        {(b.state === 'uploading' || b.state === 'reading') && <Loader2 size={16} className="animate-spin text-[#6DBB2D]" />}
                        {(b.state === 'ready' || b.state === 'failed') && (
                          <button type="button" className={btn.secondary} onClick={() => openQueueBill(b)}>
                            {b.scan?.status === 'confirmed' ? 'View' : 'Review'}
                          </button>
                        )}
                        {b.state === 'error' && (
                          <button type="button" className={btn.secondary} onClick={() => patchBill(b.key, { state: 'pending', error: undefined, startedAt: undefined })}>
                            Retry
                          </button>
                        )}
                        {(b.state === 'pending' || b.state === 'error') && (
                          <button type="button" className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => setQueue((q) => q.filter((x) => x.key !== b.key))} aria-label="Remove from queue">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}

      {editing && (
        <PageEditor
          src={editing.url}
          name={editing.file.name}
          edits={editing.edits}
          onClose={() => setEditing(null)}
          onSave={(edits) => setPages((ps) => ps.map((x) => (x.id === editing.id ? { ...x, edits } : x)))}
        />
      )}
    </div>
  );
}
