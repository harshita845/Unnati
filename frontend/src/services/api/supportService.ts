import api from "./config";

/** Support tickets: customers, sellers and delivery partners raise them; Super Admin manages. */

export type TicketStatus = "Open" | "In Progress" | "Resolved" | "Closed";
export type TicketPriority = "Low" | "Medium" | "High" | "Urgent";
export type TicketRaiser = "Customer" | "Seller" | "Delivery";

export const TICKET_STATUSES: TicketStatus[] = ["Open", "In Progress", "Resolved", "Closed"];
export const TICKET_PRIORITIES: TicketPriority[] = ["Low", "Medium", "High", "Urgent"];
export const TICKET_CATEGORIES = ["Order", "Payment", "Delivery", "Product", "Account", "Technical", "Other"] as const;

export interface TicketMessage {
  _id: string;
  senderType: "Admin" | TicketRaiser;
  senderName: string;
  message: string;
  attachments: string[];
  createdAt: string;
}

export interface TicketSummary {
  _id: string;
  ticketNumber: string;
  raisedBy: { userType: TicketRaiser; userId: string; name: string; phone?: string; email?: string };
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  orderRef?: string;
  lastMessageAt: string;
  lastMessage: { senderType: string; message: string } | null;
  messageCount: number;
  unreadByAdmin: boolean;
  unreadByUser: boolean;
  createdAt: string;
}

export interface Ticket extends Omit<TicketSummary, "lastMessage" | "messageCount"> {
  messages: TicketMessage[];
  resolvedAt?: string;
  closedAt?: string;
}

export interface TicketList {
  tickets: TicketSummary[];
  total: number;
  page: number;
  limit: number;
  counts: Record<string, number>;
  unread: number;
}

export interface NewTicket {
  subject: string;
  category: string;
  priority?: TicketPriority;
  orderRef?: string;
  message: string;
  attachments?: string[];
}

export const listTickets = async (params: {
  status?: string;
  userType?: string;
  search?: string;
  unread?: boolean;
  page?: number;
  limit?: number;
} = {}): Promise<TicketList> => {
  const res = await api.get("/support/tickets", {
    params: { ...params, unread: params.unread ? "true" : undefined, status: params.status || undefined, userType: params.userType || undefined, search: params.search || undefined },
  });
  return res.data.data;
};

export const getTicket = async (id: string): Promise<Ticket> => (await api.get(`/support/tickets/${id}`)).data.data;

export const createTicket = async (data: NewTicket): Promise<Ticket> => (await api.post("/support/tickets", data)).data.data;

export const replyToTicket = async (id: string, message: string, attachments: string[] = []): Promise<Ticket> =>
  (await api.post(`/support/tickets/${id}/messages`, { message, attachments })).data.data;

export const setTicketStatus = async (id: string, status: TicketStatus): Promise<Ticket> =>
  (await api.patch(`/support/tickets/${id}/status`, { status })).data.data;

export const setTicketPriority = async (id: string, priority: TicketPriority): Promise<Ticket> =>
  (await api.patch(`/support/tickets/${id}/priority`, { priority })).data.data;

/** Screenshot for a ticket; returns its link */
export const uploadTicketImage = async (file: File): Promise<string> => {
  const form = new FormData();
  form.append("image", file);
  const res = await api.post("/support/attachments", form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 });
  return res.data.data.url;
};

export const supportErrorMessage = (e: any, fallback = "Something went wrong, please try again") =>
  e?.response?.data?.message || e?.message || fallback;
