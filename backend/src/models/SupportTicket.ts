import mongoose, { Document, Schema } from "mongoose";

export const TICKET_RAISER_TYPES = ["Customer", "Seller", "Delivery"] as const;
export const TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed"] as const;
export const TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
export const TICKET_CATEGORIES = ["Order", "Payment", "Delivery", "Product", "Account", "Technical", "Other"] as const;

export type TicketRaiserType = (typeof TICKET_RAISER_TYPES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export interface ITicketMessage {
  _id?: mongoose.Types.ObjectId;
  senderType: "Admin" | TicketRaiserType;
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  message: string;
  attachments: string[];
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  ticketNumber: string;
  raisedBy: {
    userType: TicketRaiserType;
    userId: mongoose.Types.ObjectId;
    name: string;
    phone?: string;
    email?: string;
  };
  subject: string;
  category: (typeof TICKET_CATEGORIES)[number];
  priority: (typeof TICKET_PRIORITIES)[number];
  status: TicketStatus;
  /** Order number or id the ticket is about (optional) */
  orderRef?: string;
  messages: ITicketMessage[];
  lastMessageAt: Date;
  /** New message the other side hasn't opened yet */
  unreadByAdmin: boolean;
  unreadByUser: boolean;
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TicketMessageSchema = new Schema<ITicketMessage>(
  {
    senderType: { type: String, enum: ["Admin", ...TICKET_RAISER_TYPES], required: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    senderName: { type: String, trim: true, default: "" },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    attachments: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketNumber: { type: String, required: true, unique: true },
    raisedBy: {
      userType: { type: String, enum: TICKET_RAISER_TYPES, required: true },
      userId: { type: Schema.Types.ObjectId, required: true },
      name: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
    },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, enum: TICKET_CATEGORIES, default: "Other" },
    priority: { type: String, enum: TICKET_PRIORITIES, default: "Medium" },
    status: { type: String, enum: TICKET_STATUSES, default: "Open" },
    orderRef: { type: String, trim: true, maxlength: 60 },
    messages: { type: [TicketMessageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now },
    unreadByAdmin: { type: Boolean, default: true },
    unreadByUser: { type: Boolean, default: false },
    resolvedAt: Date,
    closedAt: Date,
  },
  { timestamps: true }
);

SupportTicketSchema.index({ "raisedBy.userType": 1, "raisedBy.userId": 1, lastMessageAt: -1 });
SupportTicketSchema.index({ status: 1, lastMessageAt: -1 });

const SupportTicket = mongoose.model<ISupportTicket>("SupportTicket", SupportTicketSchema);
export default SupportTicket;
