import OrderItem from "../models/OrderItem";
import Refund from "../models/Refund";
import Customer from "../models/Customer";
import { restoreOrderItemStock, takeOrderItemStock } from "./orderStockService";
import { sendNotification } from "./notificationService";

/**
 * Finishing a return is the step that actually moves money and stock, and it used to live only in
 * the delivery app's handler. A seller or admin marking the same request "Completed" from their own
 * screen just flipped a status: the customer was never refunded and the item never came back into
 * stock. So completion lives here, and all three callers go through it.
 *
 * A Return gives the money back. A Replacement sends another unit instead — and when there is none
 * left to send, it becomes a refund rather than leaving the customer with neither.
 */

export interface ReturnCompletionResult {
  /** false when the request was already Completed, so nothing was moved twice */
  applied: boolean;
  refundIssued: number | null;
  replacementSent: boolean;
  /** set when a replacement could not be fulfilled and was refunded instead */
  replacementUnavailable: boolean;
}

const UNCHANGED: ReturnCompletionResult = {
  applied: false,
  refundIssued: null,
  replacementSent: false,
  replacementUnavailable: false,
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const creditCustomer = async (
  returnRequest: any,
  orderItem: any,
  reason: string,
  title: string,
  message: (amount: number) => string
) => {
  // The amount agreed at approval, or the line's own price when nobody set one
  const amount = roundMoney(
    Number(returnRequest.refundAmount) || Number(orderItem?.unitPrice || 0) * Number(returnRequest.quantity || 0)
  );
  if (!(amount > 0)) return null;

  const refund = await Refund.create({
    order: returnRequest.order,
    customer: returnRequest.customer,
    amount,
    reason,
    status: "Completed",
    processedAt: new Date(),
  });

  // walletAmount is a read-only virtual alias for creditBalance — update the real field
  await Customer.updateOne({ _id: returnRequest.customer }, { $inc: { creditBalance: amount } });

  returnRequest.refundAmount = amount;
  returnRequest.refundId = refund._id;

  sendNotification("Customer", String(returnRequest.customer), title, message(amount), {
    type: "Payment",
    priority: "High",
  }).catch((err) => console.error("Return refund notification failed:", err));

  return amount;
};

/**
 * Restores stock, settles the money, and marks the request Completed.
 * Safe to call twice: a request that is already Completed is left alone.
 */
export const completeReturnRequest = async (returnRequest: any): Promise<ReturnCompletionResult> => {
  // Keyed on settledAt, not on status: the seller and admin screens write "Completed" before
  // calling this, so a status check here would skip the refund for exactly those two paths.
  if (!returnRequest || returnRequest.settledAt) return UNCHANGED;

  const orderItem: any = await OrderItem.findById(returnRequest.orderItem);
  if (!orderItem) {
    returnRequest.status = "Completed";
    returnRequest.settledAt = new Date();
    await returnRequest.save();
    return { ...UNCHANGED, applied: true };
  }

  const quantity = Number(returnRequest.quantity) || orderItem.quantity;

  const result: ReturnCompletionResult = {
    applied: true,
    refundIssued: null,
    replacementSent: false,
    replacementUnavailable: false,
  };

  const restoreReturnedUnit = () =>
    restoreOrderItemStock({
      product: orderItem.product,
      variantId: orderItem.variantId,
      variation: orderItem.variation,
      quantity,
    });

  if (returnRequest.requestType === "Replacement") {
    // Claim a replacement from existing stock BEFORE putting the returned one back, otherwise the
    // item coming back would count as its own replacement and the customer would be sent the very
    // unit they rejected. Only then does the returned unit go back on the shelf.
    const sent = await takeOrderItemStock(orderItem, quantity);
    await restoreReturnedUnit();
    if (sent) {
      orderItem.status = "Replaced";
      await orderItem.save();
      result.replacementSent = true;
      sendNotification(
        "Customer",
        String(returnRequest.customer),
        "Replacement on its way",
        `Your replacement for ${orderItem.productName || "your item"} has been handed over.`,
        { type: "Order", priority: "High" }
      ).catch((err) => console.error("Replacement notification failed:", err));
    } else {
      // Nothing left to send: refund rather than leave the customer with neither item nor money
      orderItem.status = "Returned";
      await orderItem.save();
      result.replacementUnavailable = true;
      result.refundIssued = await creditCustomer(
        returnRequest,
        orderItem,
        `Replacement unavailable: ${returnRequest.reason || "Item returned"}`,
        "Refund credited",
        (amount) =>
          `${orderItem.productName || "Your item"} is out of stock, so ₹${amount} has been credited to your Unnati wallet instead of a replacement.`
      );
    }
  } else {
    // A plain return: the unit comes back and the money goes out
    await restoreReturnedUnit();
    orderItem.status = "Returned";
    await orderItem.save();
    result.refundIssued = await creditCustomer(
      returnRequest,
      orderItem,
      `Return: ${returnRequest.reason || "Item returned"}`,
      "Refund credited",
      (amount) => `₹${amount} for your return has been credited to your Unnati wallet.`
    );
  }

  returnRequest.status = "Completed";
  returnRequest.settledAt = new Date();
  await returnRequest.save();
  return result;
};
