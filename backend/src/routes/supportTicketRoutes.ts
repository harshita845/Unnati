import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { authenticate, requireUserType } from "../middleware/auth";
import { uploadSingleImage, handleUploadError } from "../middleware/upload";
import { uploadImageFromBuffer } from "../services/cloudinaryService";
import { sendNotification, sendBroadcastNotification } from "../services/notificationService";
import { asyncHandler } from "../utils/asyncHandler";
import SupportTicket, {
  ISupportTicket,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TicketRaiserType,
} from "../models/SupportTicket";
import Customer from "../models/Customer";
import Seller from "../models/Seller";
import Delivery from "../models/Delivery";
import Admin from "../models/Admin";

/**
 * Support tickets: customers, sellers and delivery partners raise tickets and chat with the
 * Super Admin, who manages them all (status, replies).
 */
const router = Router();
router.use(authenticate);

const RAISERS = ["Customer", "Seller", "Delivery"];
const MAX_OPEN_TICKETS = 10;
const SUPPORT_FOLDER = "Unnati Stores/support";

const isAdmin = (req: Request) =>
  req.user?.userType === "Admin" ||
  String(req.user?.userType || "").toLowerCase() === "admin" ||
  (req.user as any)?.role === "Super Admin" ||
  (req.user as any)?.role === "Staff";
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const cleanAttachments = (v: unknown): string[] =>
  (Array.isArray(v) ? v : [])
    .map((u) => String(u || "").trim())
    .filter((u) => /^https:\/\/res\.cloudinary\.com\//.test(u))
    .slice(0, 5);
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function raiserProfile(userType: TicketRaiserType, userId: string) {
  if (userType === "Customer") {
    const c: any = await Customer.findById(userId).select("name phone email").lean();
    return c ? { name: c.name || "Customer", phone: c.phone, email: c.email } : null;
  }
  if (userType === "Seller") {
    const s: any = await Seller.findById(userId).select("sellerName storeName mobile email").lean();
    return s ? { name: s.storeName || s.sellerName || "Seller", phone: s.mobile, email: s.email } : null;
  }
  const d: any = await Delivery.findById(userId).select("name mobile email").lean();
  return d ? { name: d.name || "Delivery partner", phone: d.mobile, email: d.email } : null;
}

async function adminName(userId: string) {
  const a: any = await Admin.findById(userId).select("firstName lastName").lean();
  return a ? `${a.firstName || ""} ${a.lastName || ""}`.trim() || "Support team" : "Support team";
}

/** Load a ticket the caller may see (owner or admin) */
async function loadTicket(req: Request, res: Response): Promise<ISupportTicket | null> {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ success: false, message: "Ticket not found" });
    return null;
  }
  const ticket = await SupportTicket.findById(id);
  const owns =
    ticket &&
    ticket.raisedBy.userType === req.user!.userType &&
    String(ticket.raisedBy.userId) === String(req.user!.userId);
  if (!ticket || (!owns && !isAdmin(req))) {
    res.status(404).json({ success: false, message: "Ticket not found" });
    return null;
  }
  return ticket;
}

async function nextTicketNumber() {
  const last = await SupportTicket.findOne({ ticketNumber: /^TKT-\d+$/ }).sort({ createdAt: -1, _id: -1 }).select("ticketNumber").lean();
  const n = last ? parseInt(String(last.ticketNumber).slice(4), 10) || 0 : 0;
  return `TKT-${String(n + 1).padStart(5, "0")}`;
}

const notifyUser = (t: ISupportTicket, title: string, message: string) =>
  sendNotification(t.raisedBy.userType, String(t.raisedBy.userId), title, message, {
    type: "Info",
    link: t.raisedBy.userType === "Seller" ? `/seller/support?ticket=${t._id}` : t.raisedBy.userType === "Delivery" ? `/delivery/support?ticket=${t._id}` : `/support?ticket=${t._id}`,
  }).catch((e) => console.error("Support ticket notification failed:", e?.message));

const notifyAdmins = (t: ISupportTicket, title: string, message: string, priority: "Medium" | "High" = "Medium") =>
  sendBroadcastNotification("Admin", title, message, { type: "Info", priority, link: `/admin/support-tickets?ticket=${t._id}` }).catch((e) =>
    console.error("Support ticket notification failed:", e?.message)
  );

/** List view: no message bodies, just the latest one */
const summary = (t: any) => {
  const last = t.messages?.[t.messages.length - 1];
  return {
    _id: t._id,
    ticketNumber: t.ticketNumber,
    raisedBy: t.raisedBy,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status,
    orderRef: t.orderRef,
    lastMessageAt: t.lastMessageAt,
    lastMessage: last ? { senderType: last.senderType, message: String(last.message).slice(0, 160) } : null,
    messageCount: t.messages?.length || 0,
    unreadByAdmin: t.unreadByAdmin,
    unreadByUser: t.unreadByUser,
    createdAt: t.createdAt,
  };
};

/** Screenshot for a ticket (any signed-in user) */
router.post(
  "/attachments",
  requireUserType("Admin", "Customer", "Seller", "Delivery"),
  uploadSingleImage.single("image"),
  handleUploadError,
  asyncHandler(async (req: Request, res: Response) => {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ success: false, message: "No image file provided" });
    const result = await uploadImageFromBuffer(file.buffer, { folder: SUPPORT_FOLDER, resourceType: "image" });
    return res.json({ success: true, data: { url: result.secureUrl || result.url } });
  })
);

/** Raise a ticket */
router.post(
  "/tickets",
  requireUserType("Customer", "Seller", "Delivery"),
  asyncHandler(async (req: Request, res: Response) => {
    const userType = req.user!.userType as TicketRaiserType;
    const userId = req.user!.userId;
    const subject = clean(req.body.subject, 200);
    const message = clean(req.body.message, 4000);
    if (!subject || !message) return res.status(400).json({ success: false, message: "Please enter a subject and describe the problem" });
    const category = TICKET_CATEGORIES.includes(req.body.category) ? req.body.category : "Other";
    const priority = TICKET_PRIORITIES.includes(req.body.priority) ? req.body.priority : "Medium";

    const mine = { "raisedBy.userType": userType, "raisedBy.userId": userId };
    const [openCount, lastHour] = await Promise.all([
      SupportTicket.countDocuments({ ...mine, status: { $in: ["Open", "In Progress"] } }),
      SupportTicket.countDocuments({ ...mine, createdAt: { $gte: new Date(Date.now() - 3600_000) } }),
    ]);
    if (openCount >= MAX_OPEN_TICKETS) {
      return res.status(429).json({ success: false, message: `You already have ${openCount} open tickets. Please reply on an existing ticket.` });
    }
    if (lastHour >= MAX_NEW_PER_HOUR) {
      return res.status(429).json({ success: false, message: "Too many tickets in the last hour. Please try again later." });
    }

    const profile = await raiserProfile(userType, userId);
    if (!profile) return res.status(404).json({ success: false, message: "Account not found" });

    let ticket: ISupportTicket | null = null;
    for (let attempt = 0; attempt < 5 && !ticket; attempt++) {
      try {
        ticket = await SupportTicket.create({
          ticketNumber: await nextTicketNumber(),
          raisedBy: { userType, userId, ...profile },
          subject,
          category,
          priority,
          orderRef: clean(req.body.orderRef, 60) || undefined,
          messages: [{ senderType: userType, senderId: userId, senderName: profile.name, message, attachments: cleanAttachments(req.body.attachments) }],
          lastMessageAt: new Date(),
          unreadByAdmin: true,
          unreadByUser: false,
        });
      } catch (e: any) {
        if (e?.code !== 11000) throw e; // two tickets got the same number at once: take the next one
      }
    }
    if (!ticket) return res.status(503).json({ success: false, message: "Couldn't create the ticket, please try again" });

    const who = userType === "Delivery" ? "Delivery partner" : userType;
    notifyAdmins(ticket, `New support ticket ${ticket.ticketNumber}`, `${who} ${profile.name}: ${subject}`, priority === "High" || priority === "Urgent" ? "High" : "Medium");
    return res.status(201).json({ success: true, data: ticket });
  })
);

/** My tickets, or (admin) all tickets with filters */
router.get(
  "/tickets",
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
    const filter: any = {};

    if (isAdmin(req)) {
      if (RAISERS.includes(String(req.query.userType))) filter["raisedBy.userType"] = req.query.userType;
      if (req.query.unread === "true") filter.unreadByAdmin = true;
      const q = clean(req.query.search, 80);
      if (q) {
        const rx = new RegExp(escapeRegex(q), "i");
        filter.$or = [{ ticketNumber: rx }, { subject: rx }, { "raisedBy.name": rx }, { "raisedBy.phone": rx }, { orderRef: rx }];
      }
    } else if (RAISERS.includes(String(req.user!.userType))) {
      filter["raisedBy.userType"] = req.user!.userType;
      filter["raisedBy.userId"] = new mongoose.Types.ObjectId(req.user!.userId);
    } else {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    const base = { ...filter };
    const counts: Record<string, number> = { All: 0 };
    const grouped = await SupportTicket.aggregate([{ $match: filter }, { $group: { _id: "$status", n: { $sum: 1 } } }]);
    for (const g of grouped) {
      counts[g._id] = g.n;
      counts.All += g.n;
    }
    if (TICKET_STATUSES.includes(req.query.status as any)) filter.status = req.query.status;

    const [items, total, unread] = await Promise.all([
      SupportTicket.find(filter).sort({ lastMessageAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      SupportTicket.countDocuments(filter),
      SupportTicket.countDocuments(isAdmin(req) ? { unreadByAdmin: true } : { ...base, unreadByUser: true }),
    ]);
    return res.json({ success: true, data: { tickets: items.map(summary), total, page, limit, counts, unread } });
  })
);

/** One ticket with its conversation; opening it marks it read for that side */
router.get(
  "/tickets/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const ticket = await loadTicket(req, res);
    if (!ticket) return;
    const field = isAdmin(req) ? "unreadByAdmin" : "unreadByUser";
    if (ticket[field]) {
      ticket[field] = false;
      await ticket.save();
    }
    return res.json({ success: true, data: ticket });
  })
);

/** Reply on a ticket */
router.post(
  "/tickets/:id/messages",
  asyncHandler(async (req: Request, res: Response) => {
    const ticket = await loadTicket(req, res);
    if (!ticket) return;
    const message = clean(req.body.message, 4000);
    if (!message) return res.status(400).json({ success: false, message: "Please type a message" });
    const admin = isAdmin(req);
    if (ticket.status === "Closed" && !admin) {
      return res.status(400).json({ success: false, message: "This ticket is closed. Please raise a new ticket." });
    }

    const senderName = admin ? await adminName(req.user!.userId) : ticket.raisedBy.name;
    ticket.messages.push({
      senderType: admin ? "Admin" : ticket.raisedBy.userType,
      senderId: new mongoose.Types.ObjectId(req.user!.userId),
      senderName,
      message,
      attachments: cleanAttachments(req.body.attachments),
      createdAt: new Date(),
    } as any);
    ticket.lastMessageAt = new Date();
    if (admin) {
      ticket.unreadByUser = true;
      if (ticket.status === "Open") ticket.status = "In Progress";
    } else {
      ticket.unreadByAdmin = true;
      // A reply on a resolved ticket means the problem isn't solved yet
      if (ticket.status === "Resolved") {
        ticket.status = "Open";
        ticket.resolvedAt = undefined;
      }
    }
    await ticket.save();

    if (admin) notifyUser(ticket, `Reply on ticket ${ticket.ticketNumber}`, message.slice(0, 200));
    else {
      const who = ticket.raisedBy.userType === "Delivery" ? "Delivery partner" : ticket.raisedBy.userType;
      notifyAdmins(ticket, `New reply on ${ticket.ticketNumber}`, `${who} ${ticket.raisedBy.name}: ${message.slice(0, 160)}`);
    }
    return res.json({ success: true, data: ticket });
  })
);

/** Change status: admin any; the person who raised it can close it */
router.patch(
  "/tickets/:id/status",
  asyncHandler(async (req: Request, res: Response) => {
    const ticket = await loadTicket(req, res);
    if (!ticket) return;
    const status = String(req.body.status || "");
    if (!TICKET_STATUSES.includes(status as any)) return res.status(400).json({ success: false, message: "Invalid status" });
    const admin = isAdmin(req);
    if (!admin && status !== "Closed") return res.status(403).json({ success: false, message: "You can only close your ticket" });
    if (ticket.status === status) return res.json({ success: true, data: ticket });

    ticket.status = status as any;
    if (status === "Resolved") ticket.resolvedAt = new Date();
    if (status === "Closed") ticket.closedAt = new Date();
    if (status === "Open" || status === "In Progress") {
      ticket.resolvedAt = undefined;
      ticket.closedAt = undefined;
    }
    if (admin) ticket.unreadByUser = true;
    await ticket.save();

    if (admin) {
      const text: Record<string, string> = {
        "In Progress": "Our team is working on your ticket.",
        Resolved: "Your ticket is marked resolved. Reply on it if you still need help.",
        Closed: "Your ticket has been closed.",
        Open: "Your ticket has been reopened.",
      };
      notifyUser(ticket, `Ticket ${ticket.ticketNumber}: ${status}`, text[status]);
    } else {
      const who = ticket.raisedBy.userType === "Delivery" ? "Delivery partner" : ticket.raisedBy.userType;
      notifyAdmins(ticket, `Ticket ${ticket.ticketNumber} closed`, `${who} ${ticket.raisedBy.name} closed the ticket.`);
    }
    return res.json({ success: true, data: ticket });
  })
);

/** Admin: change priority */
router.patch(
  "/tickets/:id/priority",
  requireUserType("Admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const ticket = await loadTicket(req, res);
    if (!ticket) return;
    if (!TICKET_PRIORITIES.includes(req.body.priority)) return res.status(400).json({ success: false, message: "Invalid priority" });
    ticket.priority = req.body.priority;
    await ticket.save();
    return res.json({ success: true, data: ticket });
  })
);

export default router;
