import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getTicket,
  listTickets,
  replyToTicket,
  setTicketPriority,
  setTicketStatus,
  supportErrorMessage,
  Ticket,
  TicketList,
  TicketPriority,
  TicketStatus,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "../../../services/api/supportService";
import TicketConversation, { PRIORITY_STYLES, STATUS_STYLES, StatusBadge } from "../../../components/support/TicketConversation";
import { useToast } from "../../../context/ToastContext";

const TABS = ["All", ...TICKET_STATUSES];
const WHO: Record<string, string> = { Customer: "Customer", Seller: "Seller", Delivery: "Delivery partner" };
const WHO_STYLES: Record<string, string> = {
  Customer: "bg-sky-50 text-sky-700",
  Seller: "bg-violet-50 text-violet-700",
  Delivery: "bg-orange-50 text-orange-700",
};
const REFRESH_MS = 20000;
const PAGE_SIZE = 20;

const when = (d: string) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * Super Admin → Support Tickets: every ticket raised by customers, sellers and delivery partners.
 * Filter, open a ticket, reply, and set its status / priority.
 */
export default function AdminSupportTickets() {
  const [params, setParams] = useSearchParams();
  const openId = params.get("ticket");
  const [tab, setTab] = useState("All");
  const [userType, setUserType] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [list, setList] = useState<TicketList | null>(null);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [ticketError, setTicketError] = useState("");

  const { showToast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const open = (id?: string) => {
    const p = new URLSearchParams(params);
    if (id) p.set("ticket", id);
    else p.delete("ticket");
    setParams(p);
  };

  const loadList = useCallback(async () => {
    try {
      setList(await listTickets({ status: tab === "All" ? undefined : tab, userType, search: query, unread: unreadOnly, page, limit: PAGE_SIZE }));
      setError("");
    } catch (e) {
      setError(supportErrorMessage(e, "Couldn't load tickets"));
    }
  }, [tab, userType, query, unreadOnly, page]);

  useEffect(() => {
    loadList();
    const t = setInterval(loadList, REFRESH_MS);
    return () => clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadTicket = useCallback(async (id: string) => {
    try {
      setTicket(await getTicket(id));
      setTicketError("");
    } catch (e) {
      setTicketError(supportErrorMessage(e, "Couldn't open this ticket"));
    }
  }, []);

  useEffect(() => {
    setTicket(null);
    setTicketError("");
    if (!openId) return;
    loadTicket(openId);
    const t = setInterval(() => loadTicket(openId), REFRESH_MS);
    return () => clearInterval(t);
  }, [openId, loadTicket]);

  const update = async (fn: () => Promise<Ticket>) => {
    try {
      setTicket(await fn());
      await loadList();
    } catch (e) {
      setTicketError(supportErrorMessage(e));
    }
  };

  const handleQuickStatus = async (ticketId: string, newStatus: TicketStatus, ticketNum?: string) => {
    setUpdatingId(ticketId);
    try {
      const updated = await setTicketStatus(ticketId, newStatus);
      if (ticket && ticket._id === ticketId) {
        setTicket(updated);
      }
      await loadList();
      if (tab !== "All" && tab !== newStatus) {
        showToast(`Ticket ${ticketNum || ""} marked as "${newStatus}" and moved to the "${newStatus}" tab.`, "success");
      } else {
        showToast(`Ticket ${ticketNum || ""} status updated to "${newStatus}".`, "success");
      }
    } catch (e) {
      showToast(supportErrorMessage(e, "Failed to update ticket status"), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const pages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Support Tickets</h1>
          <p className="text-sm text-gray-500">
            Tickets raised by customers, sellers and delivery partners
            {list?.unread ? ` · ${list.unread} with new messages` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket, name, phone, order…"
            className="w-64 max-w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
          />
          <select
            value={userType}
            onChange={(e) => {
              setUserType(e.target.value);
              setPage(1);
            }}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="">Everyone</option>
            <option value="Customer">Customers</option>
            <option value="Seller">Sellers</option>
            <option value="Delivery">Delivery partners</option>
          </select>
          <label className="flex items-center gap-1.5 rounded border px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => {
                setUnreadOnly(e.target.checked);
                setPage(1);
              }}
            />
            New messages
          </label>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${
              tab === t ? "border-transparent bg-[var(--primary-color)] text-white" : "border-gray-200 bg-white text-gray-600"
            }`}
          >
            {t} ({list?.counts?.[t] || 0})
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className={`grid gap-5 ${openId ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" : ""}`}>
        <div className={`overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm ${openId ? "hidden lg:block" : ""}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Raised by</th>
                  {!openId && <th className="px-4 py-3">Category</th>}
                  {!openId && <th className="px-4 py-3">Priority</th>}
                  <th className="px-4 py-3">Status</th>
                  {!openId && <th className="px-4 py-3">Last activity</th>}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!list && !error && (
                  <tr>
                    <td colSpan={openId ? 4 : 7} className="px-4 py-10 text-center text-gray-500">
                      Loading…
                    </td>
                  </tr>
                )}
                {list?.tickets.length === 0 && (
                  <tr>
                    <td colSpan={openId ? 4 : 7} className="px-4 py-10 text-center text-gray-500">
                      No tickets found
                    </td>
                  </tr>
                )}
                {list?.tickets.map((t) => (
                  <tr key={t._id} onClick={() => open(t._id)} className={`cursor-pointer hover:bg-gray-50/80 transition-colors ${openId === t._id ? "bg-emerald-50/30" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                        {t.unreadByAdmin && <span className="inline-block h-2 w-2 rounded-full bg-[var(--primary-color)]" title="New message" />}
                        {t.ticketNumber}
                      </div>
                      <div className={`max-w-[240px] truncate ${t.unreadByAdmin ? "font-bold text-gray-900" : "text-gray-800"}`}>{t.subject}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-800 font-medium">{t.raisedBy.name}</div>
                      <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${WHO_STYLES[t.raisedBy.userType]}`}>{WHO[t.raisedBy.userType]}</span>
                    </td>
                    {!openId && <td className="px-4 py-3 text-gray-600">{t.category}</td>}
                    {!openId && <td className={`px-4 py-3 ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</td>}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={t.status}
                        disabled={updatingId === t._id}
                        onChange={(e) => handleQuickStatus(t._id, e.target.value as TicketStatus, t.ticketNumber)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold cursor-pointer outline-none transition-all shadow-xs ${
                          STATUS_STYLES[t.status] || "bg-gray-100 text-gray-700 border-gray-200"
                        } ${updatingId === t._id ? "opacity-50 cursor-wait" : ""}`}
                        title="Click to change ticket status"
                      >
                        {TICKET_STATUSES.map((s) => (
                          <option key={s} value={s} className="bg-white text-gray-800 font-normal">
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    {!openId && <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{when(t.lastMessageAt)}</td>}
                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {t.status !== "Resolved" && t.status !== "Closed" && (
                          <button
                            type="button"
                            disabled={updatingId === t._id}
                            onClick={() => handleQuickStatus(t._id, "Resolved", t.ticketNumber)}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold border border-emerald-200 transition-all cursor-pointer flex items-center gap-1 shadow-xs disabled:opacity-50"
                            title="Mark as Resolved"
                          >
                            ✓ Resolve
                          </button>
                        )}
                        {t.status !== "Closed" && (
                          <button
                            type="button"
                            disabled={updatingId === t._id}
                            onClick={() => handleQuickStatus(t._id, "Closed", t.ticketNumber)}
                            className="px-2.5 py-1 bg-gray-50 text-gray-600 hover:bg-gray-700 hover:text-white rounded-lg text-xs font-semibold border border-gray-200 transition-all cursor-pointer flex items-center gap-1 shadow-xs disabled:opacity-50"
                            title="Close Ticket"
                          >
                            ✕ Close
                          </button>
                        )}
                        {(t.status === "Resolved" || t.status === "Closed") && (
                          <button
                            type="button"
                            disabled={updatingId === t._id}
                            onClick={() => handleQuickStatus(t._id, "Open", t.ticketNumber)}
                            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-semibold border border-blue-200 transition-all cursor-pointer flex items-center gap-1 shadow-xs disabled:opacity-50"
                            title="Reopen Ticket"
                          >
                            ↺ Reopen
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => open(t._id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            openId === t._id
                              ? "bg-[var(--primary-color)] text-white border-transparent"
                              : "bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green,#236B34)] hover:text-white border-[var(--brand-leaf,#5FA82E)]/30"
                          }`}
                        >
                          {openId === t._id ? "Viewing" : "View"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-xs text-gray-600">
              <span>
                Page {page} of {pages} · {list?.total} tickets
              </span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-2 py-1 disabled:opacity-40">
                  Previous
                </button>
                <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded border px-2 py-1 disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {openId && (
          <div className="space-y-4">
            <button type="button" onClick={() => open()} className="text-sm font-medium text-gray-600 hover:text-gray-900">
              ← Back to list
            </button>
            {ticketError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{ticketError}</p>}
            {!ticket && !ticketError && <p className="py-8 text-center text-sm text-gray-500">Loading…</p>}
            {ticket && (
              <>
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-500">
                        {ticket.ticketNumber} · {ticket.category}
                        {ticket.orderRef ? ` · Order no. ${ticket.orderRef}` : ""}
                      </p>
                      <h2 className="break-words text-lg font-semibold text-gray-900">{ticket.subject}</h2>
                    </div>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                    <div>
                      <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${WHO_STYLES[ticket.raisedBy.userType]}`}>{WHO[ticket.raisedBy.userType]}</span>
                      {ticket.raisedBy.name}
                    </div>
                    <div className="text-gray-500">
                      {ticket.raisedBy.phone && <a href={`tel:${ticket.raisedBy.phone}`} className="mr-3 hover:underline">{ticket.raisedBy.phone}</a>}
                      {ticket.raisedBy.email && <a href={`mailto:${ticket.raisedBy.email}`} className="hover:underline">{ticket.raisedBy.email}</a>}
                    </div>
                    <div className="text-xs text-gray-500">Raised {when(ticket.createdAt)}</div>
                  </div>
                  {/* Ticket Detail Actions Bar */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {ticket.status !== "Resolved" && ticket.status !== "Closed" && (
                        <button
                          type="button"
                          disabled={updatingId === ticket._id}
                          onClick={() => handleQuickStatus(ticket._id, "Resolved", ticket.ticketNumber)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          ✓ Mark as Resolved
                        </button>
                      )}
                      {ticket.status !== "Closed" && (
                        <button
                          type="button"
                          disabled={updatingId === ticket._id}
                          onClick={() => handleQuickStatus(ticket._id, "Closed", ticket.ticketNumber)}
                          className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold border border-gray-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          ✕ Close Ticket
                        </button>
                      )}
                      {(ticket.status === "Resolved" || ticket.status === "Closed") && (
                        <button
                          type="button"
                          disabled={updatingId === ticket._id}
                          onClick={() => handleQuickStatus(ticket._id, "Open", ticket.ticketNumber)}
                          className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-lg text-xs font-bold border border-blue-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          ↺ Reopen Ticket
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                        Status:
                        <select
                          value={ticket.status}
                          disabled={updatingId === ticket._id}
                          onChange={(e) => handleQuickStatus(ticket._id, e.target.value as TicketStatus, ticket.ticketNumber)}
                          className={`rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold cursor-pointer outline-none bg-white shadow-2xs ${
                            STATUS_STYLES[ticket.status] || "text-gray-700"
                          } ${updatingId === ticket._id ? "opacity-50" : ""}`}
                        >
                          {TICKET_STATUSES.map((s) => (
                            <option key={s} value={s} className="bg-white text-gray-800 font-normal">
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                        Priority:
                        <select
                          value={ticket.priority}
                          onChange={(e) => update(() => setTicketPriority(ticket._id, e.target.value as TicketPriority))}
                          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold bg-white cursor-pointer outline-none shadow-2xs"
                        >
                          {TICKET_PRIORITIES.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <TicketConversation
                    ticket={ticket}
                    viewer="Admin"
                    canReply
                    onReply={async (message, attachments) => {
                      setTicket(await replyToTicket(ticket._id, message, attachments));
                      loadList();
                    }}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
