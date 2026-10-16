import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import {
  applyPostStartCameraEnhancements,
  getScannerProfile,
  isAppleMobile,
} from "../utils/scannerPlatform";
import {
  applyIosStreamEnhancements,
  isIosTorchSupported,
  readIosZoomRange,
  requestIosCameraStream,
  setIosTorch,
  setIosZoom,
  startIosVideoPreview,
  stopMediaStream,
  takePrimedIosCameraStream,
} from "../utils/iosLiveCameraScanner";
import {
  decodeBarcodeFromFileWithWasm,
  ensureIosVideoPlayback,
  prepareIosBarcodeWasm,
  startIosWasmVideoScan,
} from "../utils/iosWasmBarcodeScanner";

interface QRScannerModalProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: unknown) => void;
  onClose: () => void;
  /** Title and manual-entry placeholder; defaults keep the existing billing scanner text. */
  title?: string;
  manualPlaceholder?: string;
}

const BILLING_BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.RSS_14,
  Html5QrcodeSupportedFormats.RSS_EXPANDED,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.PDF_417,
];

function createReaderElementId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `qr-scanner-${crypto.randomUUID()}`;
  }
  return `qr-scanner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function QRScannerModal({
  onScanSuccess,
  onScanFailure,
  onClose,
  title,
  manualPlaceholder,
}: QRScannerModalProps) {
  const scannerProfile = useMemo(() => getScannerProfile(), []);
  const isIosProfile = scannerProfile.id === "ios";

  const readerIdRef = useRef<string | null>(null);
  if (!readerIdRef.current) {
    readerIdRef.current = createReaderElementId();
  }
  const readerId = readerIdRef.current;

  // Android: html5-qrcode
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const beginLiveScanRef = useRef<(() => Promise<void>) | null>(null);

  // iOS: native camera + WASM
  const iosVideoRef = useRef<HTMLVideoElement | null>(null);
  const iosStreamRef = useRef<MediaStream | null>(null);
  const stopWasmScanRef = useRef<(() => void) | null>(null);

  const handledRef = useRef(false);
  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanFailureRef = useRef(onScanFailure);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [iosStarting, setIosStarting] = useState(false);
  const [iosPreviewStalled, setIosPreviewStalled] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: 0.1 });
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const stopIosCamera = useCallback(() => {
    stopWasmScanRef.current?.();
    stopWasmScanRef.current = null;
    stopMediaStream(iosStreamRef.current);
    iosStreamRef.current = null;
    const video = iosVideoRef.current;
    if (video) {
      video.srcObject = null;
    }
  }, []);

  const playBeep = useCallback(() => {
    const ctx = audioContextRef.current;
    const buffer = audioBufferRef.current;
    if (!ctx || !buffer) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      /* ignore */
    }
  }, []);

  const finishScan = useCallback(
    (decodedText: string) => {
      if (handledRef.current) return;
      handledRef.current = true;

      if (navigator.vibrate) navigator.vibrate(60);
      playBeep();

      if (isIosProfile) {
        stopIosCamera();
      } else {
        stopWasmScanRef.current = null;
        const s = scannerRef.current;
        scannerRef.current = null;
        if (s) {
          s.stop()
            .then(() => s.clear())
            .catch(() => {
              try {
                s.clear();
              } catch {
                /* ignore */
              }
            });
        }
      }

      onScanSuccessRef.current(decodedText);
    },
    [isIosProfile, stopIosCamera, playBeep]
  );

  const unlockAudio = useCallback(() => {
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const loadSound = async () => {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;
        const response = await fetch("/assets/sound/beep.mp3");
        const arrayBuffer = await response.arrayBuffer();
        audioBufferRef.current = await ctx.decodeAudioData(arrayBuffer);
      } catch (err) {
        console.warn("Failed to load beep sound:", err);
      }
    };
    void loadSound();
    return () => {
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
    onScanFailureRef.current = onScanFailure;
  });

  // ─── iOS: WASM preload + auto-start from Scan-button gesture ───
  const attachIosStream = useCallback(
    async (streamPromise: Promise<MediaStream>) => {
      const video = iosVideoRef.current;
      if (!video) return;

      setIosStarting(true);
      setIosPreviewStalled(false);

      try {
        const stream = await streamPromise;
        iosStreamRef.current = stream;
        await startIosVideoPreview(video, stream);

        setTorchSupported(isIosTorchSupported(stream));
        const zr = readIosZoomRange(stream);
        if (zr && zr.max > zr.min) {
          setZoomRange(zr);
          setZoom(zr.min);
        }

        void applyIosStreamEnhancements(stream);
        stopWasmScanRef.current = startIosWasmVideoScan(video, (text) => finishScan(text));
        setCameraReady(true);
        setIosPreviewStalled(false);
      } catch (err: unknown) {
        console.error("QRScannerModal: iOS camera failed", err);
        stopIosCamera();
        setCameraReady(false);
        setIosPreviewStalled(true);
        setCameraError("Camera permission denied or camera not available. Please enable camera access in browser settings or click 'Upload Image'.");
        onScanFailureRef.current?.(err);
      } finally {
        setIosStarting(false);
      }
    },
    [finishScan, stopIosCamera]
  );

  useEffect(() => {
    if (!isIosProfile) return;

    handledRef.current = false;
    setCameraReady(false);
    setIosStarting(false);
    setIosPreviewStalled(false);
    setTorchOn(false);
    setTorchSupported(false);
    setZoom(1);

    void prepareIosBarcodeWasm().catch((err) => {
      console.warn("QRScannerModal: WASM preload failed", err);
    });

    return () => {
      stopIosCamera();
      setCameraReady(false);
    };
  }, [isIosProfile, stopIosCamera]);

  useLayoutEffect(() => {
    if (!isIosProfile) return;

    const primed = takePrimedIosCameraStream();
    if (primed) {
      void attachIosStream(primed);
      return;
    }

    // Scan opened without priming — request on mount (may fail on some iOS versions).
    void attachIosStream(requestIosCameraStream());
  }, [isIosProfile, attachIosStream]);

  // ─── Android: unchanged html5-qrcode path ───
  useEffect(() => {
    if (isIosProfile) return;

    handledRef.current = false;
    setCameraReady(false);
    setTorchOn(false);
    setTorchSupported(false);
    setZoom(1);

    const scanner = new Html5Qrcode(readerId, {
      verbose: false,
      useBarCodeDetectorIfSupported: true,
      formatsToSupport: BILLING_BARCODE_FORMATS,
    });
    scannerRef.current = scanner;

    const onDecoded = (decodedText: string) => finishScan(decodedText);

    const beginLiveScan = () =>
      scanner
        .start(
          { facingMode: "environment" },
          scannerProfile.scanConfig,
          onDecoded,
          (errorMessage: string, error: unknown) => {
            if (onScanFailureRef.current && !errorMessage?.includes("No barcode detected")) {
              onScanFailureRef.current(errorMessage ?? error);
            }
          }
        )
        .then(async () => {
          setCameraReady(true);
          try {
            const caps = scanner.getRunningTrackCameraCapabilities();
            if (caps.torchFeature()?.isSupported()) setTorchSupported(true);
            const zoomFeature = caps.zoomFeature();
            if (zoomFeature?.isSupported()) {
              setZoomRange({
                min: zoomFeature.min(),
                max: zoomFeature.max(),
                step: zoomFeature.step(),
              });
              setZoom(zoomFeature.min());
            }
          } catch {
            setTorchSupported(false);
          }
          await applyPostStartCameraEnhancements(scanner, false);
        });

    beginLiveScanRef.current = beginLiveScan;

    beginLiveScan().catch((err: any) => {
      console.warn("QRScannerModal: camera start deferred (permission or device unavailable)", err?.message || err);
      setCameraReady(false);
      setCameraError("Camera permission denied or camera not available. Please allow camera access in your browser settings, enter Order ID below, or click 'Upload Image'.");
    });

    return () => {
      setCameraReady(false);
      const s = scannerRef.current;
      scannerRef.current = null;
      beginLiveScanRef.current = null;
      if (!s) return;
      if (s.isScanning) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {
            try {
              s.clear();
            } catch {
              /* ignore */
            }
          });
      } else {
        try {
          s.clear();
        } catch {
          /* ignore */
        }
      }
    };
  }, [readerId, isIosProfile, finishScan, scannerProfile]);

  const resumeIosPreview = useCallback(async () => {
    const video = iosVideoRef.current;
    if (!video?.srcObject) {
      void attachIosStream(requestIosCameraStream());
      return;
    }
    const playing = await ensureIosVideoPlayback(video);
    setIosPreviewStalled(!playing);
  }, [attachIosStream]);

  const handlePreviewTap = () => {
    unlockAudio();
    if (isIosProfile && (iosPreviewStalled || !cameraReady)) {
      void resumeIosPreview();
    }
  };

  const handleZoomChange = async (newZoom: number) => {
    if (isIosProfile) {
      try {
        await setIosZoom(iosStreamRef.current, newZoom);
        setZoom(newZoom);
      } catch (err) {
        console.error("Failed to apply iOS zoom", err);
      }
      return;
    }

    const scanner = scannerRef.current;
    if (!scanner?.isScanning) return;
    try {
      await scanner.applyVideoConstraints({
        advanced: [{ zoom: newZoom } as MediaTrackConstraintSet],
      } as MediaTrackConstraints);
      setZoom(newZoom);
    } catch (err) {
      console.error("Failed to apply zoom", err);
    }
  };

  const handleGalleryPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsProcessingImage(true);
    setCameraError(null);

    try {
      if (isIosProfile) {
        stopIosCamera();
        setCameraReady(false);
      } else {
        const scanner = scannerRef.current;
        if (scanner?.isScanning) {
          try {
            await scanner.stop();
          } catch {
            /* ignore stop error */
          }
        }
      }

      let text: string | null = null;

      // 1. Try high-performance zxing-wasm first (works everywhere, decodes 1D barcodes and QR codes from image file)
      try {
        text = await decodeBarcodeFromFileWithWasm(file);
      } catch (wasmErr) {
        console.warn("zxing-wasm scan attempt:", wasmErr);
      }

      // 2. Fallback to native browser BarcodeDetector API (Chromium / Android Chrome)
      if (!text && typeof window !== "undefined" && "BarcodeDetector" in window) {
        try {
          const detector = new (window as any).BarcodeDetector();
          const bitmap = await createImageBitmap(file);
          const detected = await detector.detect(bitmap);
          if (detected && detected.length > 0 && detected[0]?.rawValue) {
            text = String(detected[0].rawValue).trim();
          }
        } catch (detectorErr) {
          console.warn("BarcodeDetector fallback:", detectorErr);
        }
      }

      // 3. Fallback to html5-qrcode scanFile
      if (!text) {
        try {
          let scanner = scannerRef.current;
          if (!scanner) {
            scanner = new Html5Qrcode(`temp-file-scan-${Date.now()}`, {
              verbose: false,
              useBarCodeDetectorIfSupported: true,
              formatsToSupport: BILLING_BARCODE_FORMATS,
            });
          }
          text = await scanner.scanFile(file, false);
        } catch (html5Err) {
          console.warn("html5-qrcode scanFile fallback:", html5Err);
        }
      }

      if (!text) {
        throw new Error("No barcode found in image. Please try a clearer photo or enter the barcode number below.");
      }

      if (handledRef.current) return;
      handledRef.current = true;
      playBeep();
      onScanSuccessRef.current(text);
      onClose();
    } catch (err: any) {
      handledRef.current = false;
      const errorMsg = err?.message || "No barcode found in image";
      setCameraError(errorMsg);
      onScanFailureRef.current?.(err);
    } finally {
      setIsProcessingImage(false);
    }
  };

  const toggleTorch = async () => {
    const next = !torchOn;
    if (isIosProfile) {
      try {
        await setIosTorch(iosStreamRef.current, next);
        setTorchOn(next);
      } catch {
        /* not supported */
      }
      return;
    }

    const scanner = scannerRef.current;
    if (!scanner?.isScanning || !torchSupported) return;
    try {
      await scanner.applyVideoConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      } as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      try {
        await scanner.applyVideoConstraints({ torch: next } as MediaTrackConstraints);
        setTorchOn(next);
      } catch {
        /* ignore */
      }
    }
  };

  const showIosLoading = isIosProfile && iosStarting;
  const showViewfinder = cameraReady && !showIosLoading;

  return createPortal(
    <div
      className={`fixed inset-0 z-[1050] flex flex-col justify-end sm:justify-center items-center bg-black/80 p-0 sm:p-4 overflow-hidden ${
        isIosProfile ? "" : "backdrop-blur-sm"
      }`}
      onClick={onClose}
      onTouchStart={unlockAudio}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden relative shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] border border-neutral-100"
        onClick={(e) => {
          e.stopPropagation();
          unlockAudio();
        }}
      >
        {!isIosProfile && (
          <style>{`
            #${readerId} video {
              width: 100% !important;
              height: 100% !important;
              min-height: 220px !important;
              max-height: 260px !important;
              object-fit: cover !important;
            }
          `}</style>
        )}

        {/* Sticky Header */}
        <div className="flex justify-between items-center py-3.5 px-4 sm:px-5 border-b border-gray-100 bg-white shrink-0 z-30">
          <div>
            <h3 className="text-base font-bold text-gray-800 leading-tight">
              {title || "Scan Barcode / QR"}
            </h3>
            <p className="text-[10px] text-[var(--brand-green,#236B34)] font-semibold mt-0.5">
              Align barcode in view or upload an image
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-neutral-900 rounded-full transition-colors cursor-pointer"
            aria-label="Close scanner"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3">
          {isIosProfile && iosPreviewStalled && !iosStarting && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 leading-relaxed">
              Camera paused — tap the preview to resume.
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-[11px] font-medium text-gray-500">
              {cameraReady ? "Camera active" : cameraError ? "Camera offline" : "Starting camera..."}
            </span>
            <button
              type="button"
              onClick={() => setIsHighContrast(!isHighContrast)}
              className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isHighContrast
                  ? "bg-neutral-800 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {isHighContrast ? "🌓 High Contrast" : "🌓 Contrast"}
            </button>
          </div>

          {zoomRange.max > zoomRange.min && (
            <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-sm space-y-1">
              <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase">
                <span>Zoom</span>
                <span className="text-[var(--brand-green,#236B34)] bg-emerald-50 px-1.5 py-0.5 rounded-full font-bold">
                  {zoom.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min={zoomRange.min}
                max={zoomRange.max}
                step={zoomRange.step}
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[var(--brand-green,#236B34)]"
              />
            </div>
          )}

          {/* Camera Preview Area */}
          <div className="relative rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-900 shadow-inner">
            {isIosProfile ? (
              <video
                ref={iosVideoRef}
                playsInline
                muted
                autoPlay
                onClick={handlePreviewTap}
                className={`w-full h-[220px] sm:h-[260px] overflow-hidden bg-black object-cover ${
                  isHighContrast ? "contrast-150 brightness-110 saturate-0" : ""
                }`}
              />
            ) : (
              <div
                id={readerId}
                className={`w-full h-[220px] sm:h-[260px] overflow-hidden bg-black ${
                  isHighContrast ? "contrast-150 brightness-110 saturate-0" : ""
                }`}
              />
            )}

            {showIosLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}

            {/* Camera Permission / Error Fallback inside preview */}
            {cameraError && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-neutral-900/95 text-white p-4 text-center">
                <div className="w-11 h-11 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-2">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                    <line x1="2" y1="2" x2="22" y2="22"/>
                  </svg>
                </div>
                <p className="font-bold text-sm text-neutral-100">
                  {cameraError?.toLowerCase().includes("barcode") ? "Barcode Not Found" : "Camera Access Blocked"}
                </p>
                <p className="text-[11px] text-neutral-300 mt-1 max-w-[260px] leading-relaxed">
                  {cameraError?.toLowerCase().includes("barcode")
                    ? "Could not detect a barcode in that photo. Please try a clearer, closer photo or enter the barcode below."
                    : "Camera permission was not granted. You can upload an image from your gallery or type the barcode below."}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    disabled={isProcessingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] text-white text-xs font-semibold rounded-lg shadow transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isProcessingImage ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        <span>Upload Photo</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingImage}
                    onClick={() => {
                      setCameraError(null);
                      if (beginLiveScanRef.current) {
                        beginLiveScanRef.current().catch(() => {
                          setCameraError("Camera permission denied. Please allow access in browser settings.");
                        });
                      }
                    }}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg border border-neutral-700 transition-all cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Viewfinder Frame (Brand Green) */}
            {showViewfinder && !cameraError && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[85%] h-[72%] border-2 border-[var(--brand-green,#236B34)] rounded-lg relative shadow-[0_0_15px_rgba(35,107,52,0.3)]">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-white rounded-tl" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-white rounded-tr" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-white rounded-bl" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-white rounded-br" />
                  <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-[var(--brand-leaf,#5FA82E)]/70 animate-pulse" />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons: Upload image & Flashlight */}
          <div className="flex flex-wrap gap-2 justify-center shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleGalleryPick}
            />
            <button
              type="button"
              disabled={isProcessingImage}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-4 py-2.5 text-xs font-bold rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
            >
              {isProcessingImage ? (
                <>
                  <div className="w-4 h-4 border-2 border-[var(--brand-green,#236B34)] border-t-transparent rounded-full animate-spin" />
                  <span>Scanning image...</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span>Upload Barcode Image</span>
                </>
              )}
            </button>
            {torchSupported && (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                className={`px-4 py-2.5 text-xs font-bold rounded-xl border shadow-sm transition-colors cursor-pointer ${
                  torchOn
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {torchOn ? "🔦 Flash ON" : "🔦 Flash"}
              </button>
            )}
          </div>

          {/* Manual Barcode / Code Entry */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const el = document.getElementById("manual-qr-input") as HTMLInputElement;
              if (el?.value.trim()) {
                onScanSuccessRef.current(el.value.trim());
              }
            }}
            className="pt-2 border-t border-gray-200 flex gap-2"
          >
            <input
              type="text"
              placeholder={manualPlaceholder || "Enter barcode or product number..."}
              className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand-green,#236B34)] text-gray-800 font-sans"
              id="manual-qr-input"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer active:scale-95 shadow-sm"
            >
              {manualPlaceholder?.toLowerCase().includes("order") ? "Verify" : "Search"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="py-2.5 px-4 border-t border-gray-100 bg-white shrink-0">
          <p className="text-center text-[10.5px] text-gray-400">
            Center barcode in the green frame or upload an image from gallery
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

export { isAppleMobile };
