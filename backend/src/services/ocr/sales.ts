import mongoose, { ClientSession } from "mongoose";
import Order from "../../models/Order";
import OrderItem from "../../models/OrderItem";
import Customer from "../../models/Customer";
import Product from "../../models/Product";
import CreditTransaction from "../../models/CreditTransaction";
import type { IScannedDocument } from "../../models/ScannedDocument";
import { findVariantById, variantsFromProductDoc } from "../../modules/product/variantHelpers";
import { resolvePaid, ReviewBill, ReviewItem } from "./review";
import { ConfirmError } from "./errors";

/**
 * A scanned sales bill becomes a POS order (same shape POS Orders creates, so POS Report, bill
 * reprint and the customer's credit all see it). Separate from the POS Orders code on purpose:
 * this only runs from Scan Bill's confirm, inside its transaction.
 */

interface SaleLine {
  item: ReviewItem;
  productId: string;
  variantId: string;
  sku: string;
  qty: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0);

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank: "Bank Transfer",
  cheque: "Cheque",
  credit: "Credit",
  other: "Other",
};

async function resolveCustomer(bill: ReviewBill, session: ClientSession) {
  if (bill.party.customerId) {
    const c = await Customer.findById(bill.party.customerId).session(session);
    if (!c) throw new ConfirmError("The chosen customer no longer exists. Pick another.", 409);
    return { customer: c, walkIn: false };
  }
  const phone = (bill.party.phone || "").replace(/\D/g, "").slice(-10);
  if (phone.length === 10) {
    const byPhone = await Customer.findOne({ phone, email: { $ne: "walkin@pos.com" } }).session(session);
    if (byPhone) return { customer: byPhone, walkIn: false };
  }
  let walkIn = await Customer.findOne({ email: "walkin@pos.com" }).session(session);
  if (!walkIn) {
    [walkIn] = await Customer.create(
      [{ name: "Walk-in Customer", email: "walkin@pos.com", phone: "0000000000", status: "Active" }],
      { session }
    );
  }
  return { customer: walkIn, walkIn: true };
}

export async function createScannedSale(
  scan: IScannedDocument,
  bill: ReviewBill,
  lines: SaleLine[],
  ctx: { adminId: string; session: ClientSession }
) {
  const { session } = ctx;
  const { customer, walkIn } = await resolveCustomer(bill, session);
  const total = r2(num(bill.totals.grandTotal));
  const paid = r2(resolvePaid(bill));
  const unpaid = r2(total - paid);
  const isCredit = bill.paymentMode === "credit" || unpaid > 0.009;
  const paymentMethod = PAYMENT_LABEL[bill.paymentMode || ""] || (isCredit ? "Credit" : "Cash");
  if (walkIn && unpaid > 0.009) {
    throw new ConfirmError("This bill isn't fully paid. Pick a saved customer so the balance goes on their credit.", 400);
  }

  const [order] = await Order.create(
    [
      {
        customer: customer._id,
        customerName: (walkIn && bill.party.name) || customer.name,
        customerEmail: customer.email,
        customerPhone: (walkIn && bill.party.phone) || customer.phone,
        deliveryAddress: {
          address: bill.party.address || customer.address || "POS Order",
          city: customer.city || "POS",
          pincode: customer.pincode || "000000",
          state: bill.party.state || customer.state || "POS",
        },
        items: [],
        subtotal: 0,
        tax: 0,
        shipping: 0,
        discount: r2(num(bill.totals.discount)),
        total,
        paymentMethod,
        paymentStatus: isCredit ? "Pending" : "Paid",
        status: "Delivered",
        deliveryBoyStatus: "Delivered",
        deliveredAt: bill.invoiceDate ? new Date(`${bill.invoiceDate}T12:00:00Z`) : new Date(),
        adminNotes: `Created via POS System (Scan Bill${bill.invoiceNumber ? `, bill ${bill.invoiceNumber}` : ""})`,
      },
    ],
    { session }
  );

  const byItem = new Map(lines.map((l) => [l.item, l]));
  const itemIds: mongoose.Types.ObjectId[] = [];
  let subtotal = 0;
  let tax = 0;
  for (const item of bill.items) {
    if (item.action === "skip") continue;
    const line = byItem.get(item);
    const product: any = line ? await Product.findById(line.productId).session(session).lean() : null;
    const variant = product && line ? findVariantById(variantsFromProductDoc(product), line.variantId) : undefined;
    const qty = num(item.quantity);
    const lineTotal = r2(num(item.amount) || qty * num(item.rate) - num(item.discount));
    const gstRate = typeof item.taxRate === "number" ? item.taxRate : Number(product?.gst) || 0;
    // Retail bills print GST-inclusive amounts: back the tax out unless the bill shows it per line
    const gstAmount = num(item.taxAmount) || (gstRate > 0 ? r2((lineTotal * gstRate) / (100 + gstRate)) : 0);
    subtotal += lineTotal;
    tax += gstAmount;
    const [orderItem] = await OrderItem.create(
      [
        {
          order: order._id,
          ...(product ? { product: product._id, seller: product.seller } : {}),
          productName: item.name || product?.productName || "Item",
          productImage: variant?.mainImage || "",
          sku: variant?.sku || "",
          mrp: num(item.mrp),
          unitPrice: qty ? r2(lineTotal / qty) : num(item.rate),
          quantity: qty,
          total: lineTotal,
          hsnCode: item.hsn || product?.hsnCode || "",
          gst: gstRate,
          gstAmount,
          status: "Delivered",
          ...(variant ? { variantId: variant._id, variation: `${variant.name || variant.variationType || "Variant"}: ${variant.value}` } : {}),
        },
      ],
      { session }
    );
    itemIds.push(orderItem._id as mongoose.Types.ObjectId);
  }

  order.items = itemIds as any;
  order.subtotal = r2(subtotal);
  order.tax = r2(tax);
  await order.save({ session });

  if (isCredit && !walkIn && unpaid > 0) {
    customer.creditBalance = r2((customer.creditBalance || 0) + unpaid);
    await customer.save({ session });
    await CreditTransaction.create(
      [
        {
          customer: customer._id,
          type: "Order",
          amount: unpaid,
          balanceAfter: customer.creditBalance,
          description: `POS Order #${order.orderNumber} (scanned bill)`,
          referenceId: String(order._id),
          date: new Date(),
          createdBy: ctx.adminId,
        },
      ],
      { session }
    );
  }

  return { orderId: order._id as mongoose.Types.ObjectId, orderNumber: order.orderNumber, customerId: customer._id as mongoose.Types.ObjectId, scanId: scan._id };
}
