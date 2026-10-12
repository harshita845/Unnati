import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  createTicket,
  getTicket,
  listTickets,
  replyToTicket,
  setTicketStatus,
  supportErrorMessage,
  Ticket,
  TicketList,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TicketPriority,
  uploadTicketImage,
} from "../../services/api/supportService";
import { prepareImageForUpload } from "../../utils/productImportImages";
import TicketConversation, { PRIORITY_STYLES, StatusBadge } from "./TicketConversation";

const TABS = ["All", "Open", "In Progress", "Resolved", "Closed"];
const REFRESH_MS = 20000;

const ago = (d: string) => {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

/**
 * Help & Support for customers, sellers and delivery partners: raise a ticket, see your tickets
 * and chat with the support team. `?ticket=<id>` opens one (links from notifications).
 */
export default function SupportCenter({
  accent = "var(--primary-color)",
  intro,
  showPriority = false,
}: {
  accent?: string;
  intro?: string;
  /** Sellers can mark a ticket urgent; for others the team sets the priority */
  showPriority?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const openId = params.get("ticket");
  const creating = params.get("new") === "1";

  const [tab, setTab] = useState("All");
  const [list, setList] = useState<TicketList | null>(null);
  const [listError, setListError] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [ticketError, setTicketError] = useState("");

  const go = (next: { ticket?: string; new?: boolean }) => {
    const p = new URLSearchParams(params);
    p.delete("ticket");
    p.delete("new");
    if (next.ticket) p.set("ticket", next.ticket);
    if (next.new) p.set("new", "1");
    setParams(p);
  };

  const loadList = useCallback(async () => {
    try {
      setList(await listTickets({ status: tab === "All" ? undefined : tab, limit: 50 }));
      setListError("");
    } catch (e) {
      setListError(supportErrorMessage(e, "Couldn't load your tickets"));
    }
  }, [tab]);

  const loadTicket = useCallback(async (id: string) => {
    try {
      setTicket(await getTicket(id));
      setTicketError("");
    } catch (e) {
      setTicketError(supportErrorMessage(e, "Couldn't open this ticket"));
    }
  }, []);

  useEffect(() => {
    if (openId || creating) return;
    loadList();
    const t = setInterval(loadList, REFRESH_MS);
    return () => clearInterval(t);
  }, [loadList, openId, creating]);

  useEffect(() => {
    if (!openId) {
      setTicket(null);
      return;
    }
    setTicket(null);
    loadTicket(openId);
    const t = setInterval(() => loadTicket(openId), REFRESH_MS);
    return () => clearInterval(t);
  }, [openId, loadTicket]);

  if (creating) {
    return <NewTicketForm accent={accent} showPriority={showPriority} onCancel={() => go({})} onCreated={(t) => go({ ticket: t._id })} />;
  }

  if (openId) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => go({})} className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
          ← All tickets
        </button>
        {ticketError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{ticketError}</p>}
        {!ticket && !ticketError && <p className="py-8 text-center text-sm text-neutral-500">Loading…</p>}
        {ticket && (
          <>
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-neutral-500">{ticket.ticketNumber}</p>
                  <h2 className="break-words text-base font-semibold text-neutral-900">{ticket.subject}</h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    {ticket.category}
                    {ticket.orderRef ? ` · Order no. ${ticket.orderRef}` : ""} · Raised {ago(ticket.createdAt)}
                  </p>
                </div>
                <StatusBadge status={ticket.status} />
              </div>
              {ticket.status !== "Closed" && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm("Close this ticket? You can raise a new one any time.")) return;
                    try {
                      setTicket(await setTicketStatus(ticket._id, "Closed"));
                    } catch (e) {
                      setTicketError(supportErrorMessage(e));
                    }
                  }}
                  className="mt-3 text-xs font-medium text-neutral-500 underline hover:text-neutral-800"
                >
                  {ticket.status === "Resolved" ? "My problem is solved, close ticket" : "Close ticket"}
                </button>
              )}
            </div>
            {ticket.status === "Resolved" && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                The team marked this resolved. Still need help? Just reply below and it will be reopened.
              </p>
            )}
            <TicketConversation
              ticket={ticket}
              viewer="User"
              accent={accent}
              canReply={ticket.status !== "Closed"}
              replyHint="This ticket is closed. Raise a new ticket if you need more help."
              onReply={async (message, attachments) => setTicket(await replyToTicket(ticket._id, message, attachments))}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-neutral-900">Need help?</h2>
          <p className="text-sm text-neutral-500">{intro || "Raise a ticket and our support team will reply here."}</p>
        </div>
        <button type="button" onClick={() => go({ new: true })} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: accent }}>
          + Raise a ticket
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${tab === t ? "text-white border-transparent" : "bg-white text-neutral-600 border-neutral-200"}`}
            style={tab === t ? { background: accent } : undefined}
          >
            {t}
            {list?.counts?.[t] ? ` (${list.counts[t]})` : ""}
          </button>
        ))}
      </div>

      {listError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{listError}</p>}
      {!list && !listError && <p className="py-8 text-center text-sm text-neutral-500">Loading…</p>}
      {list && list.tickets.length === 0 && (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-10 text-center text-sm text-neutral-500">
          {tab === "All" ? "You haven't raised any tickets yet." : `No ${tab.toLowerCase()} tickets.`}
        </p>
      )}
      <div className="space-y-2">
        {list?.tickets.map((t) => (
          <button
            key={t._id}
            type="button"
            onClick={() => go({ ticket: t._id })}
            className="block w-full rounded-xl border border-neutral-200 bg-white p-3.5 text-left hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-neutral-500">
                  {t.ticketNumber} · {t.category}
                </p>
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {t.unreadByUser && <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: accent }} title="New reply" />}
                  {t.subject}
                </p>
                {t.lastMessage && (
                  <p className="mt-0.5 truncate text-xs text-neutral-500">
                    {t.lastMessage.senderType === "Admin" ? "Support: " : "You: "}
                    {t.lastMessage.message}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <StatusBadge status={t.status} />
                <p className="mt-1 text-[10px] text-neutral-400">{ago(t.lastMessageAt)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function NewTicketForm({
  accent,
  showPriority,
  onCancel,
  onCreated,
}: {
  accent: string;
  showPriority: boolean;
  onCancel: () => void;
  onCreated: (t: Ticket) => void;
}) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<string>("Order");
  const [priority, setPriority] = useState<TicketPriority>("Medium");
  const [orderRef, setOrderRef] = useState("");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError("Please enter a subject and describe the problem");
      return;
    }
    setSaving(true);
    setError("");
    try {
      onCreated(await createTicket({ subject: subject.trim(), category, priority: showPriority ? priority : undefined, orderRef: orderRef.trim() || undefined, message: message.trim(), attachments: images }));
    } catch (err) {
      setError(supportErrorMessage(err, "Couldn't raise the ticket"));
      setSaving(false);
    }
  };

  const field = "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400";
  return (
    <form onSubmit={submit} className="space-y-4">
      <button type="button" onClick={onCancel} className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
        ← Back
      </button>
      <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-base font-semibold text-neutral-900">Raise a ticket</h2>
        <label className="block text-xs font-semibold text-neutral-700">
          What is it about?
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${field} mt-1`}>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-neutral-700">
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="e.g. Wrong item delivered" className={`${field} mt-1`} />
        </label>
        <label className="block text-xs font-semibold text-neutral-700">
          Order number <span className="font-normal text-neutral-400">(if it's about an order)</span>
          <input value={orderRef} onChange={(e) => setOrderRef(e.target.value)} maxLength={60} placeholder="e.g. ORD-1024" className={`${field} mt-1`} />
        </label>
        {showPriority && (
          <label className="block text-xs font-semibold text-neutral-700">
            How urgent?
            <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} className={`${field} mt-1`}>
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} className={PRIORITY_STYLES[p]}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-xs font-semibold text-neutral-700">
          Describe the problem
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={4000} placeholder="Tell us what happened…" className={`${field} mt-1 resize-none`} />
        </label>
        <div>
          <div className="flex flex-wrap gap-2">
            {images.map((a) => (
              <div key={a} className="relative">
                <img src={a} alt="Attachment" className="h-16 w-16 rounded-lg border border-neutral-200 object-cover" />
                <button type="button" onClick={() => setImages((p) => p.filter((x) => x !== a))} className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-neutral-800 text-[11px] text-white" aria-label="Remove photo">
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" disabled={uploading || images.length >= 5} onClick={() => fileRef.current?.click()} className="mt-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-50">
            {uploading ? "Uploading photo…" : "📎 Add a photo or screenshot (optional)"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setUploading(true);
              setError("");
              try {
                const url = await uploadTicketImage(await prepareImageForUpload(f));
                setImages((p) => [...p, url].slice(0, 5));
              } catch (err) {
                setError(supportErrorMessage(err, "Couldn't upload the photo"));
              } finally {
                setUploading(false);
              }
            }}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700">
            Cancel
          </button>
          <button type="submit" disabled={saving || uploading} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: accent }}>
            {saving ? "Submitting…" : "Submit ticket"}
          </button>
        </div>
      </div>
    </form>
  );
}
