import crypto from "crypto";
import axios from "axios";

const cashfreeBaseUrl = () =>
  process.env.CASHFREE_MODE === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";

const cashfreeHeaders = () => ({
  "x-client-id": process.env.CASHFREE_APP_ID as string,
  "x-client-secret": process.env.CASHFREE_SECRET_KEY as string,
  "x-api-version": "2023-08-01",
});

export const createRazorpayOrder = async (amount: number, receipt: string, orderId: string) => {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await axios.post(
    "https://api.razorpay.com/v1/orders",
    { amount: Math.round(amount * 100), currency: "INR", receipt, notes: { order_id: orderId } },
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return response.data as { id: string };
};

export const createCashfreeOrder = async (params: {
  amount: number;
  orderId: string;
  customerId: string;
  email?: string;
  phone?: string;
}) => {
  const cfOrderId = `cust_${params.orderId}_${Date.now()}`;
  const response = await axios.post(
    `${cashfreeBaseUrl()}/orders`,
    {
      order_id: cfOrderId,
      order_amount: params.amount,
      order_currency: "INR",
      customer_details: {
        customer_id: params.customerId,
        customer_email: params.email || "customer@example.com",
        customer_phone: params.phone || "9999999999",
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/order/success?order_id=${params.orderId}`,
      },
    },
    { headers: cashfreeHeaders() }
  );
  return { cfOrderId, paymentSessionId: response.data.payment_session_id as string };
};

/** Razorpay checkout signature: HMAC-SHA256(order_id|payment_id, key_secret). */
export const isValidRazorpaySignature = (razorpayOrderId: string, paymentId: string, signature: string) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !razorpayOrderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${razorpayOrderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/** Ask Cashfree whether the order is paid; returns the Cashfree payment reference when it is. */
export const getCashfreePaidReference = async (cfOrderId: string, expectedAmount: number): Promise<string | null> => {
  const response = await axios.get(`${cashfreeBaseUrl()}/orders/${encodeURIComponent(cfOrderId)}`, {
    headers: cashfreeHeaders(),
  });
  const data = response.data || {};
  if (data.order_status !== "PAID") return null;
  if (Math.abs(Number(data.order_amount) - expectedAmount) > 0.01) return null;
  return String(data.cf_order_id || cfOrderId);
};
