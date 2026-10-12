import { useEffect, useRef, useState } from "react";
import { Ticket, uploadTicketImage, supportErrorMessage } from "../../services/api/supportService";
import { prepareImageForUpload } from "../../utils/productImportImages";

const fmt = (d: string) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const STATUS_STYLES: Record<string, string> = {
  Open: "bg-blue-50 text-blue-700 border-blue-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  Resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Closed: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

export const PRIORITY_STYLES: Record<string, string> = {
  Low: "text-neutral-500",
  Medium: "text-blue-600",
  High: "text-orange-600",
  Urgent: "text-red-600 font-semibold",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status] || ""}`}>{status}</span>;
}

/**
 * The messages of a ticket and the reply box. `viewer` decides which side is "me".
 */
export default function TicketConversation({
  ticket,
  viewer,
  accent = "var(--primary-color)",
  canReply,
  replyHint,
  onReply,
}: {
  ticket: Ticket;
  viewer: "Admin" | "User";
  accent?: string;
  canReply: boolean;
  replyHint?: string;
  onReply: (message: string, attachments: string[]) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [ticket.messages.length]);

  const addImage = async (file?: File) => {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const url = await uploadTicketImage(await prepareImageForUpload(file));
      setImages((prev) => [...prev, url].slice(0, 5));
    } catch (e) {
      setError(supportErrorMessage(e, "Couldn't upload the photo"));
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await onReply(text.trim(), images);
      setText("");
      setImages([]);
    } catch (e) {
      setError(supportErrorMessage(e, "Couldn't send the message"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        {ticket.messages.map((m) => {
          const mine = viewer === "Admin" ? m.senderType === "Admin" : m.senderType !== "Admin";
          return (
            <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${mine ? "text-white rounded-br-sm" : "bg-white border border-neutral-200 text-neutral-900 rounded-bl-sm"}`}
                style={mine ? { background: accent } : undefined}
              >
                <div className={`mb-0.5 text-[11px] font-semibold ${mine ? "text-white/85" : "text-neutral-500"}`}>
                  {m.senderType === "Admin" ? (viewer === "Admin" ? m.senderName || "Support team" : "Support team") : m.senderName}
                </div>
                <p className="whitespace-pre-wrap break-words">{m.message}</p>
                {m.attachments?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.attachments.map((a) => (
                      <a key={a} href={a} target="_blank" rel="noreferrer">
                        <img src={a} alt="Attachment" className="h-20 w-20 rounded-lg border border-white/40 object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                <div className={`mt-1 text-right text-[10px] ${mine ? "text-white/75" : "text-neutral-400"}`}>{fmt(m.createdAt)}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {canReply ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Type your message…"
            className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          />
          {images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {images.map((a) => (
                <div key={a} className="relative">
                  <img src={a} alt="Attachment" className="h-14 w-14 rounded-lg border border-neutral-200 object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((x) => x !== a))}
                    className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-neutral-800 text-[11px] text-white"
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={uploading || images.length >= 5}
              onClick={() => fileRef.current?.click()}
              className="text-xs font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
            >
              {uploading ? "Uploading photo…" : "📎 Add photo"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                addImage(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={send}
              disabled={!text.trim() || sending || uploading}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: accent }}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      ) : (
        replyHint && <p className="rounded-lg bg-neutral-100 px-3 py-2 text-center text-xs text-neutral-600">{replyHint}</p>
      )}
    </div>
  );
}
