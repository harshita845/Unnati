import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

interface VoiceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchResult: (query: string) => void;
}

export default function VoiceSearchModal({ isOpen, onClose, onSearchResult }: VoiceSearchModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      setTranscript("");
      setErrorMsg("");
      return;
    }

    // Check browser support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg("Voice search is not supported in this browser. Please try Chrome, Edge, or Safari.");
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-IN"; // English (India) with Hindi / Indian English recognition

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMsg("");
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);

        if (event.results[0] && event.results[0].isFinal) {
          const finalText = currentTranscript.trim();
          if (finalText) {
            setTimeout(() => {
              onSearchResult(finalText);
              onClose();
            }, 600);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setErrorMsg("Microphone permission was denied. Please allow microphone access in your browser settings.");
        } else if (event.error === "no-speech") {
          setErrorMsg("Didn't catch that. Please tap the mic to try again.");
        } else {
          setErrorMsg("Could not detect speech. Please tap the mic and try speaking again.");
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error("Failed to start speech recognition:", err);
      setErrorMsg("Microphone error. Please check permissions and try again.");
      setIsListening(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [isOpen]);

  const restartListening = () => {
    setErrorMsg("");
    setTranscript("");
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      try {
        recognitionRef.current.start();
      } catch {
        // ignore
      }
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[1002] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
        {/* Backdrop click to dismiss */}
        <div className="fixed inset-0" onClick={onClose} />

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl text-center z-10 border border-[var(--brand-border,#E9E2D3)] overflow-hidden"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-800 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close voice search"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Title */}
          <h3 className="text-xl font-bold font-sans text-[var(--brand-ink,#1C2B20)] mb-1">
            Voice Search
          </h3>
          <p className="text-xs text-[var(--brand-ink-muted,#5B6B60)] mb-6">
            {isListening ? "Listening for products..." : "Tap the microphone to speak"}
          </p>

          {/* Animated Mic Button */}
          <div className="relative my-6 flex items-center justify-center">
            {isListening && (
              <>
                <motion.div
                  className="absolute w-28 h-28 rounded-full bg-[var(--brand-leaf-tint,#EAF5E0)] pointer-events-none"
                  animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0.15, 0.6] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                />
                <motion.div
                  className="absolute w-24 h-24 rounded-full bg-[var(--brand-leaf,#5FA82E)]/20 pointer-events-none"
                  animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0.3, 0.7] }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut", delay: 0.2 }}
                />
              </>
            )}

            <button
              type="button"
              onClick={restartListening}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer ${
                isListening
                  ? "bg-[var(--brand-green,#236B34)] text-white ring-4 ring-[var(--brand-leaf-light,#8CC63F)]/40 scale-105"
                  : "bg-neutral-100 hover:bg-neutral-200 text-neutral-600"
              }`}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          </div>

          {/* Live Transcript / Prompts */}
          <div className="min-h-[50px] flex items-center justify-center px-2">
            {transcript ? (
              <p className="text-base font-semibold text-[var(--brand-green-deep,#14401F)] animate-fadeIn">
                &ldquo;{transcript}&rdquo;
              </p>
            ) : errorMsg ? (
              <p className="text-xs font-medium text-red-600 bg-red-50 py-2 px-3 rounded-xl border border-red-100">
                {errorMsg}
              </p>
            ) : isListening ? (
              <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--brand-leaf,#5FA82E)]">
                <span className="w-2 h-2 rounded-full bg-[var(--brand-green,#236B34)] animate-ping" />
                <span>Try saying &quot;Basmati Rice&quot; or &quot;Amul Milk&quot;</span>
              </div>
            ) : (
              <p className="text-xs text-neutral-400">Tap the mic to try speaking again</p>
            )}
          </div>

          {/* Footer note */}
          <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
            <span>English &amp; Hindi supported</span>
            <button
              type="button"
              onClick={onClose}
              className="font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
