import api from "./config";

export type PlanDurationUnit = "day" | "month" | "year";

export interface PlanLimits {
  maxProducts?: number | null;
  commissionPercent?: number | null;
  featuredStore: boolean;
}

export interface SubscriptionPlan {
  _id: string;
  name: string;
  description?: string;
  price: number;
  durationValue: number;
  durationUnit: PlanDurationUnit;
  categories: Array<{ _id: string; name: string; subscriptionEnabled?: boolean; subscriptionGraceDays?: number | null; subscriptionBillType?: "gst" | "receipt" | null } | string>;
  features: string[];
  limits: PlanLimits;
  isActive: boolean;
  sortOrder: number;
  activeSubscribers?: number;
  // seller view only
  billType?: "gst" | "receipt";
  gstPercent?: number;
  totalPrice?: number;
}

export interface PlanInput {
  name: string;
  description?: string;
  price: number;
  durationValue: number;
  durationUnit: PlanDurationUnit;
  categories: string[];
  features: string[];
  limits: { maxProducts: number | null; commissionPercent: number | null; featuredStore: boolean };
  isActive: boolean;
  sortOrder?: number;
}

export interface SubscriptionSettings {
  graceDays: number;
  trialDays: number;
  reminderDays: number[];
  paymentMethods: { online: boolean; manual: boolean; wallet: boolean };
  gstPercent: number;
  invoiceEnabled: boolean;
  invoicePrefix: string;
}

export interface SellerSubscription {
  _id: string;
  seller: any;
  plan?: string | null;
  planSnapshot: {
    name: string;
    price: number;
    durationValue: number;
    durationUnit: PlanDurationUnit;
    features: string[];
    limits: PlanLimits;
  };
  categories: Array<{ _id: string; name: string }>;
  isTrial: boolean;
  status: "PendingPayment" | "Active" | "Expired" | "Cancelled";
  startDate?: string;
  endDate?: string;
  billType?: "gst" | "receipt";
  payment: {
    method?: "Online" | "Manual" | "Wallet" | "Trial";
    reference?: string;
    paymentId?: string;
    paidAt?: string;
    baseAmount: number;
    gstPercent: number;
    gstAmount: number;
    totalAmount: number;
  };
  invoiceNumber?: string;
  createdAt: string;
}

export interface SellerCategoryStatus {
  categoryId: string;
  name: string;
  sellsHere: boolean;
  /** false = this category doesn't need a plan; shown so sellers see all of their own categories */
  required: boolean;
  state: "Active" | "ExpiringSoon" | "Grace" | "Expired" | "NotSubscribed" | "Upcoming" | "NotRequired";
  daysLeft: number | null;
  graceDays: number;
  endDate: string | null;
  planName: string | null;
  isTrial: boolean;
  usage: { products: number; maxProducts: number | null } | null;
}

export interface SellerSubscriptionOverview {
  settings: { graceDays: number; paymentMethods: { online: boolean; manual: boolean; wallet: boolean }; gstPercent: number };
  categories: SellerCategoryStatus[];
  plans: SubscriptionPlan[];
  history: SellerSubscription[];
}

export const formatDuration = (value: number, unit: PlanDurationUnit) => `${value} ${unit}${value === 1 ? "" : "s"}`;

export const formatINR = (amount: number) => `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const formatDateIN = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";

/** yyyy-mm-dd for <input type="date"> (local date). */
export const toDateInput = (value?: string | Date | null) => {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Start of the chosen day (start date) / end of the chosen day (end date), in the user's time zone. */
export const dateInputToISO = (value: string, edge: "start" | "end") =>
  value ? new Date(`${value}T${edge === "start" ? "00:00:00" : "23:59:59"}`).toISOString() : undefined;

// ---------- Super Admin ----------
export const getSubscriptionSettings = async () => (await api.get("/admin/subscriptions/settings")).data;
export const updateSubscriptionSettings = async (data: Partial<SubscriptionSettings>) => (await api.put("/admin/subscriptions/settings", data)).data;
export const getPlans = async () => (await api.get("/admin/subscriptions/plans")).data;
export const createPlan = async (data: PlanInput) => (await api.post("/admin/subscriptions/plans", data)).data;
export const updatePlan = async (id: string, data: PlanInput) => (await api.put(`/admin/subscriptions/plans/${id}`, data)).data;
export const deletePlan = async (id: string) => (await api.delete(`/admin/subscriptions/plans/${id}`)).data;
export const getSellerSubscriptions = async (params?: Record<string, string | number | undefined>) =>
  (await api.get("/admin/subscriptions", { params })).data;
export const activatePlanForSeller = async (data: { sellerId: string; planId: string; reference?: string; startDate?: string; endDate?: string }) =>
  (await api.post("/admin/subscriptions/activate", data)).data;
export const grantSellerTrial = async (data: { sellerId: string; categories: string[]; startDate?: string; endDate?: string }) =>
  (await api.post("/admin/subscriptions/trial", data)).data;
export const updateSubscriptionDates = async (id: string, data: { startDate?: string; endDate?: string }) =>
  (await api.put(`/admin/subscriptions/${id}/dates`, data)).data;
export const extendSellerSubscription = async (id: string, days: number) => (await api.post(`/admin/subscriptions/${id}/extend`, { days })).data;
export const cancelSellerSubscription = async (id: string, reason?: string) => (await api.post(`/admin/subscriptions/${id}/cancel`, { reason })).data;

// ---------- Seller ----------
export const getMySubscriptions = async (): Promise<{ success: boolean; data: SellerSubscriptionOverview }> =>
  (await api.get("/seller/subscriptions")).data;
export const purchasePlan = async (planId: string, method: "Online" | "Wallet") =>
  (await api.post("/seller/subscriptions/purchase", { planId, method })).data;
export const verifyPlanPayment = async (id: string, data: { razorpayOrderId: string; paymentId: string; razorpaySignature: string }) =>
  (await api.post(`/seller/subscriptions/${id}/verify`, data)).data;
export const getSubscriptionInvoice = async (id: string) => (await api.get(`/seller/subscriptions/${id}/invoice`)).data;
