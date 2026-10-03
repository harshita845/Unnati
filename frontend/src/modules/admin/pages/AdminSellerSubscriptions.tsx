import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../../context/ToastContext";
import { getCategories, type Category } from "../../../services/api/admin/adminProductService";
import { getSellers } from "../../../services/api/admin/adminSellerService";
import {
  PlanInput,
  SellerSubscription,
  SubscriptionPlan,
  SubscriptionSettings,
  activatePlanForSeller,
  cancelSellerSubscription,
  createPlan,
  dateInputToISO,
  deletePlan,
  extendSellerSubscription,
  formatDateIN,
  formatDuration,
  formatINR,
  getPlans,
  getSellerSubscriptions,
  getSubscriptionSettings,
  grantSellerTrial,
  toDateInput,
  updatePlan,
  updateSubscriptionDates,
  updateSubscriptionSettings,
} from "../../../services/api/subscriptionService";

type Tab = "plans" | "subscriptions" | "settings";

const emptyPlan: PlanInput = {
  name: "",
  description: "",
  price: 0,
  durationValue: 1,
  durationUnit: "month",
  categories: [],
  features: [""],
  limits: { maxProducts: null, commissionPercent: null, featuredStore: false },
  isActive: true,
  sortOrder: 0,
};

const inputClass =
  "w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]";
const labelClass = "block text-sm font-medium text-neutral-700 mb-1";
const DAY = 24 * 60 * 60 * 1000;

const statusBadge = (sub: SellerSubscription) => {
  const map: Record<string, string> = {
    Active: "bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]",
    Expired: "bg-amber-100 text-amber-800",
    Cancelled: "bg-red-100 text-red-800",
    PendingPayment: "bg-neutral-100 text-neutral-700",
  };
  const upcoming = sub.status === "Active" && sub.startDate && new Date(sub.startDate) > new Date();
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[sub.status] || map.PendingPayment}`}>
      {upcoming ? "Starts later" : sub.isTrial && sub.status === "Active" ? "Trial" : sub.status}
    </span>
  );
};

const errorMessage = (err: any, fallback: string) => err?.response?.data?.message || err?.message || fallback;

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
    <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </div>
  </div>
);

export default function AdminSellerSubscriptions() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("plans");

  // shared data
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);

  // plans
  const [editing, setEditing] = useState<{ id?: string; data: PlanInput } | null>(null);
  const [saving, setSaving] = useState(false);

  // subscriptions
  const [subs, setSubs] = useState<SellerSubscription[]>([]);
  const [stats, setStats] = useState<{ active: number; expired: number; trials: number; revenue: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [activateForm, setActivateForm] = useState<{ sellerId: string; planId: string; reference: string; customDates: boolean; startDate: string; endDate: string } | null>(null);
  const [trialForm, setTrialForm] = useState<{ sellerId: string; categories: string[]; startDate: string; endDate: string } | null>(null);
  const [datesFor, setDatesFor] = useState<{ id: string; label: string; startDate: string; endDate: string } | null>(null);
  const [extendFor, setExtendFor] = useState<{ id: string; days: number } | null>(null);

  // settings
  const [settings, setSettings] = useState<SubscriptionSettings | null>(null);
  const [reminderText, setReminderText] = useState("");

  const rootCategories = useMemo(() => categories.filter((c: any) => !c.parentId), [categories]);
  const requiredCategories = useMemo(() => rootCategories.filter((c: any) => c.subscriptionEnabled), [rootCategories]);

  const loadPlans = async () => {
    try {
      const res = await getPlans();
      setPlans(res.data || []);
    } catch (err) {
      showToast(errorMessage(err, "Failed to load plans"), "error");
    }
  };

  const loadSubscriptions = async () => {
    try {
      const res = await getSellerSubscriptions({
        status: expiringOnly ? undefined : statusFilter,
        expiringInDays: expiringOnly ? 7 : undefined,
        limit: 100,
      });
      setSubs(res.data || []);
      setStats(res.stats || null);
    } catch (err) {
      showToast(errorMessage(err, "Failed to load subscriptions"), "error");
    }
  };

  const loadSettings = async () => {
    try {
      const res = await getSubscriptionSettings();
      setSettings(res.data);
      setReminderText((res.data?.reminderDays || []).join(", "));
    } catch (err) {
      showToast(errorMessage(err, "Failed to load settings"), "error");
    }
  };

  useEffect(() => {
    loadPlans();
    loadSettings();
    getCategories().then((res) => setCategories(res.data || [])).catch(() => undefined);
    getSellers().then((res: any) => setSellers(res.data || [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (tab === "subscriptions") loadSubscriptions();
  }, [tab, statusFilter, expiringOnly]);

  // ---------------- Plans ----------------
  const planToInput = (plan: SubscriptionPlan, overrides: Partial<PlanInput> = {}): PlanInput => ({
    name: plan.name,
    description: plan.description || "",
    price: plan.price,
    durationValue: plan.durationValue,
    durationUnit: plan.durationUnit,
    categories: plan.categories.map((c: any) => String(c._id || c)),
    features: plan.features,
    limits: {
      maxProducts: plan.limits?.maxProducts ?? null,
      commissionPercent: plan.limits?.commissionPercent ?? null,
      featuredStore: !!plan.limits?.featuredStore,
    },
    isActive: plan.isActive,
    sortOrder: plan.sortOrder || 0,
    ...overrides,
  });

  const openNewPlan = () => setEditing({ data: { ...emptyPlan, features: [""] } });
  const openEditPlan = (plan: SubscriptionPlan) =>
    setEditing({ id: plan._id, data: planToInput(plan, { features: plan.features.length ? plan.features : [""] }) });

  const setPlanField = (patch: Partial<PlanInput>) =>
    setEditing((prev) => (prev ? { ...prev, data: { ...prev.data, ...patch } } : prev));

  const savePlan = async () => {
    if (!editing) return;
    const data = { ...editing.data, features: editing.data.features.map((f) => f.trim()).filter(Boolean) };
    if (!data.name.trim()) return showToast("Plan name is required", "error");
    if (!data.categories.length) return showToast("Select at least one category", "error");
    setSaving(true);
    try {
      if (editing.id) await updatePlan(editing.id, data);
      else await createPlan(data);
      showToast(editing.id ? "Plan updated" : "Plan created", "success");
      setEditing(null);
      loadPlans();
    } catch (err) {
      showToast(errorMessage(err, "Failed to save plan"), "error");
    } finally {
      setSaving(false);
    }
  };

  const removePlan = async (plan: SubscriptionPlan) => {
    if (!window.confirm(`Delete plan "${plan.name}"? Plans that sellers have bought are deactivated instead.`)) return;
    try {
      const res = await deletePlan(plan._id);
      showToast(res.message || "Done", "success");
      loadPlans();
    } catch (err) {
      showToast(errorMessage(err, "Failed to delete plan"), "error");
    }
  };

  const togglePlanActive = async (plan: SubscriptionPlan) => {
    try {
      await updatePlan(plan._id, planToInput(plan, { isActive: !plan.isActive }));
      loadPlans();
    } catch (err) {
      showToast(errorMessage(err, "Failed to update plan"), "error");
    }
  };

  // ---------------- Subscriptions ----------------
  const openActivate = () =>
    setActivateForm({ sellerId: "", planId: "", reference: "", customDates: false, startDate: toDateInput(new Date()), endDate: toDateInput(new Date(Date.now() + 30 * DAY)) });

  const submitActivate = async () => {
    if (!activateForm?.sellerId || !activateForm.planId) return showToast("Choose a seller and a plan", "error");
    try {
      await activatePlanForSeller({
        sellerId: activateForm.sellerId,
        planId: activateForm.planId,
        reference: activateForm.reference,
        ...(activateForm.customDates
          ? { startDate: dateInputToISO(activateForm.startDate, "start"), endDate: dateInputToISO(activateForm.endDate, "end") }
          : {}),
      });
      showToast("Plan activated for seller", "success");
      setActivateForm(null);
      loadSubscriptions();
    } catch (err) {
      showToast(errorMessage(err, "Failed to activate plan"), "error");
    }
  };

  const openTrial = () =>
    setTrialForm({ sellerId: "", categories: [], startDate: toDateInput(new Date()), endDate: toDateInput(new Date(Date.now() + (settings?.trialDays || 30) * DAY)) });

  const submitTrial = async () => {
    if (!trialForm?.sellerId || !trialForm.categories.length) return showToast("Choose a seller and at least one category", "error");
    try {
      await grantSellerTrial({
        sellerId: trialForm.sellerId,
        categories: trialForm.categories,
        startDate: dateInputToISO(trialForm.startDate, "start"),
        endDate: dateInputToISO(trialForm.endDate, "end"),
      });
      showToast("Free trial granted", "success");
      setTrialForm(null);
      loadSubscriptions();
    } catch (err) {
      showToast(errorMessage(err, "Failed to grant trial"), "error");
    }
  };

  const submitDates = async () => {
    if (!datesFor) return;
    try {
      await updateSubscriptionDates(datesFor.id, {
        startDate: dateInputToISO(datesFor.startDate, "start"),
        endDate: dateInputToISO(datesFor.endDate, "end"),
      });
      showToast("Dates updated", "success");
      setDatesFor(null);
      loadSubscriptions();
    } catch (err) {
      showToast(errorMessage(err, "Failed to update dates"), "error");
    }
  };

  const submitExtend = async () => {
    if (!extendFor) return;
    try {
      await extendSellerSubscription(extendFor.id, Number(extendFor.days));
      showToast("Subscription extended", "success");
      setExtendFor(null);
      loadSubscriptions();
    } catch (err) {
      showToast(errorMessage(err, "Failed to extend"), "error");
    }
  };

  const cancelSub = async (sub: SellerSubscription) => {
    const reason = window.prompt(`Cancel "${sub.planSnapshot.name}" for ${sub.seller?.storeName || "this seller"}? Enter a reason (optional):`);
    if (reason === null) return;
    try {
      await cancelSellerSubscription(sub._id, reason || undefined);
      showToast("Subscription cancelled", "success");
      loadSubscriptions();
    } catch (err) {
      showToast(errorMessage(err, "Failed to cancel"), "error");
    }
  };

  // ---------------- Settings ----------------
  const saveSettings = async () => {
    if (!settings) return;
    const reminderDays = reminderText
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0);
    try {
      const res = await updateSubscriptionSettings({ ...settings, reminderDays });
      setSettings(res.data);
      setReminderText((res.data?.reminderDays || []).join(", "));
      showToast("Settings saved", "success");
    } catch (err) {
      showToast(errorMessage(err, "Failed to save settings"), "error");
    }
  };

  const tabButton = (id: Tab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        tab === id ? "bg-[var(--primary-dark)] text-white" : "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50"
      }`}>
      {label}
    </button>
  );

  const categoryRuleText = (c: any) => {
    const grace = typeof c.subscriptionGraceDays === "number" ? c.subscriptionGraceDays : settings?.graceDays;
    const bill = c.subscriptionBillType || (settings?.invoiceEnabled === false ? "receipt" : "gst");
    return `${bill === "gst" ? "GST invoice" : "Receipt"} · ${grace === 0 ? "hide at expiry" : `${grace}d grace`}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-5">
        <h1 className="text-2xl font-bold text-neutral-900">Seller Subscriptions</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Create plans sellers buy to sell in subscription categories. Turn on "Subscription required", the grace period and the bill type
          for each category in Category settings.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {tabButton("plans", "Plans")}
          {tabButton("subscriptions", "Seller Subscriptions")}
          {tabButton("settings", "Settings")}
        </div>
      </div>

      {/* ===================== PLANS ===================== */}
      {tab === "plans" && (
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-[var(--primary-dark)] text-white px-5 py-3 flex items-center justify-between">
            <h2 className="font-semibold">Plans</h2>
            <button onClick={openNewPlan} className="px-3 py-1.5 bg-white text-[var(--primary-dark)] rounded-lg text-sm font-semibold">
              + Create Plan
            </button>
          </div>
          {plans.length === 0 ? (
            <p className="p-6 text-sm text-neutral-500">No plans yet. Create your first plan (e.g. Grocery Monthly, Grocery Yearly).</p>
          ) : (
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((plan) => (
                <div key={plan._id} className={`border rounded-xl p-4 ${plan.isActive ? "border-neutral-200" : "border-dashed border-neutral-300 opacity-70"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-neutral-900">{plan.name}</h3>
                      <p className="text-xl font-bold text-[var(--primary-dark)] mt-1">
                        {formatINR(plan.price)}
                        <span className="text-sm font-medium text-neutral-500"> / {formatDuration(plan.durationValue, plan.durationUnit)}</span>
                      </p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${plan.isActive ? "bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]" : "bg-neutral-100 text-neutral-600"}`}>
                      {plan.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {plan.description && <p className="text-sm text-neutral-600 mt-2">{plan.description}</p>}
                  <p className="text-xs text-neutral-500 mt-3">Categories</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {plan.categories.map((c: any) => (
                      <span key={String(c._id || c)} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800" title={c.subscriptionEnabled ? categoryRuleText(c) : "Subscription not required"}>
                        {c.name || "Category"}
                        {c.subscriptionEnabled === false ? " (not required)" : c.subscriptionEnabled ? ` · ${categoryRuleText(c)}` : ""}
                      </span>
                    ))}
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-neutral-700">
                    {plan.limits?.maxProducts ? <li>• Up to {plan.limits.maxProducts} products</li> : <li>• Unlimited products</li>}
                    {plan.limits?.commissionPercent != null && <li>• {plan.limits.commissionPercent}% commission</li>}
                    {plan.limits?.featuredStore && <li>• Featured store</li>}
                    {plan.features.map((f, i) => <li key={i}>• {f}</li>)}
                  </ul>
                  <p className="text-xs text-neutral-500 mt-3">Active subscribers: {plan.activeSubscribers || 0}</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => openEditPlan(plan)} className="px-3 py-1.5 text-sm rounded-lg border border-neutral-300 hover:bg-neutral-50">Edit</button>
                    <button onClick={() => togglePlanActive(plan)} className="px-3 py-1.5 text-sm rounded-lg border border-neutral-300 hover:bg-neutral-50">
                      {plan.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => removePlan(plan)} className="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== SUBSCRIPTIONS ===================== */}
      {tab === "subscriptions" && (
        <div className="space-y-4">
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Active", value: stats.active },
                { label: "On free trial", value: stats.trials },
                { label: "Expired", value: stats.expired },
                { label: "Revenue", value: formatINR(stats.revenue) },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-lg border border-neutral-200 p-4">
                  <p className="text-xs text-neutral-500">{s.label}</p>
                  <p className="text-xl font-bold text-neutral-900 mt-1">{s.value}</p>
                </div>
              ))}
            </div>
          )}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-neutral-200 flex flex-wrap items-center gap-3">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} disabled={expiringOnly} className="px-3 py-2 border border-neutral-300 rounded-lg text-sm">
                {["All", "Active", "Expired", "Cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={expiringOnly} onChange={(e) => setExpiringOnly(e.target.checked)} />
                Expiring in 7 days
              </label>
              <div className="ml-auto flex flex-wrap gap-2">
                <button onClick={openTrial} className="px-3 py-2 border border-[var(--primary-dark)] text-[var(--primary-dark)] rounded-lg text-sm font-semibold">
                  Grant free trial
                </button>
                <button onClick={openActivate} className="px-3 py-2 bg-[var(--primary-dark)] text-white rounded-lg text-sm font-semibold">
                  Activate plan for seller
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                  <tr>
                    {["Seller", "Plan", "Categories", "Period", "Status", "Payment", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {subs.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-500">No subscriptions found</td></tr>
                  )}
                  {subs.map((sub) => (
                    <tr key={sub._id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-900">{sub.seller?.storeName || "—"}</p>
                        <p className="text-xs text-neutral-500">{sub.seller?.city}</p>
                      </td>
                      <td className="px-4 py-3">{sub.planSnapshot.name}</td>
                      <td className="px-4 py-3 text-xs">{sub.categories.map((c) => c.name).join(", ")}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">{formatDateIN(sub.startDate)} – {formatDateIN(sub.endDate)}</td>
                      <td className="px-4 py-3">{statusBadge(sub)}</td>
                      <td className="px-4 py-3 text-xs">
                        <p>{sub.payment.method || "—"} {sub.payment.totalAmount ? `· ${formatINR(sub.payment.totalAmount)}` : ""}</p>
                        {sub.invoiceNumber && <p className="text-neutral-500">{sub.billType === "receipt" ? "Receipt" : "Invoice"} {sub.invoiceNumber}</p>}
                        {sub.payment.reference && <p className="text-neutral-500">Ref: {sub.payment.reference}</p>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {["Active", "Expired"].includes(sub.status) && (
                          <>
                            <button
                              onClick={() => setDatesFor({ id: sub._id, label: `${sub.seller?.storeName || ""} · ${sub.planSnapshot.name}`, startDate: toDateInput(sub.startDate), endDate: toDateInput(sub.endDate) })}
                              className="text-[var(--primary-color)] hover:underline mr-3">Edit dates</button>
                            <button onClick={() => setExtendFor({ id: sub._id, days: 30 })} className="text-[var(--primary-color)] hover:underline mr-3">Extend</button>
                            <button onClick={() => cancelSub(sub)} className="text-red-600 hover:underline">Cancel</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SETTINGS ===================== */}
      {tab === "settings" && settings && (
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-5 space-y-5 max-w-3xl">
          <p className="text-sm text-neutral-500">
            Grace period and bill type below are defaults. Each category can have its own in Category settings.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Default grace period after expiry (days)</label>
              <input type="number" min={0} className={inputClass} value={settings.graceDays}
                onChange={(e) => setSettings({ ...settings, graceDays: Number(e.target.value) })} />
              <p className="text-xs text-neutral-500 mt-1">Products stay visible this many days after a plan ends. 0 = hide immediately.</p>
            </div>
            <div>
              <label className={labelClass}>Default free-trial length (days)</label>
              <input type="number" min={0} className={inputClass} value={settings.trialDays}
                onChange={(e) => setSettings({ ...settings, trialDays: Number(e.target.value) })} />
              <p className="text-xs text-neutral-500 mt-1">Pre-fills the trial end date. You can pick exact start and end dates each time.</p>
            </div>
            <div>
              <label className={labelClass}>Reminder days before expiry</label>
              <input className={inputClass} value={reminderText} onChange={(e) => setReminderText(e.target.value)} placeholder="7, 3, 1" />
            </div>
            <div>
              <label className={labelClass}>GST on subscription (%)</label>
              <input type="number" min={0} max={100} className={inputClass} value={settings.gstPercent}
                onChange={(e) => setSettings({ ...settings, gstPercent: Number(e.target.value) })} />
              <p className="text-xs text-neutral-500 mt-1">Charged only for categories that bill with a GST invoice.</p>
            </div>
          </div>
          <div>
            <p className={labelClass}>Payment methods</p>
            <div className="flex flex-wrap gap-5 text-sm">
              {([
                ["online", "Online (UPI / Card)"],
                ["manual", "Manual activation by admin (cash / bank)"],
                ["wallet", "Seller wallet balance"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input type="checkbox" checked={settings.paymentMethods[key]}
                    onChange={(e) => setSettings({ ...settings, paymentMethods: { ...settings.paymentMethods, [key]: e.target.checked } })} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className={labelClass}>Default bill type</p>
              <div className="flex gap-5 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={settings.invoiceEnabled} onChange={() => setSettings({ ...settings, invoiceEnabled: true })} />
                  GST invoice
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={!settings.invoiceEnabled} onChange={() => setSettings({ ...settings, invoiceEnabled: false })} />
                  Payment receipt
                </label>
              </div>
            </div>
            <div>
              <label className={labelClass}>Invoice / receipt number prefix</label>
              <input className={inputClass} value={settings.invoicePrefix} onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })} />
            </div>
          </div>
          <button onClick={saveSettings} className="px-4 py-2 bg-[var(--primary-dark)] text-white rounded-lg text-sm font-semibold">Save settings</button>
        </div>
      )}

      {/* ===================== PLAN MODAL ===================== */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => !saving && setEditing(null)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">{editing.id ? "Edit Plan" : "Create Plan"}</h2>
              <button onClick={() => setEditing(null)} className="text-neutral-400 hover:text-neutral-600" disabled={saving}>✕</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className={labelClass}>Plan name *</label>
                <input className={inputClass} value={editing.data.name} onChange={(e) => setPlanField({ name: e.target.value })} placeholder="e.g. Grocery Monthly" />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <input className={inputClass} value={editing.data.description} onChange={(e) => setPlanField({ description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Price (₹, before GST) *</label>
                  <input type="number" min={0} className={inputClass} value={editing.data.price} onChange={(e) => setPlanField({ price: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={labelClass}>Duration *</label>
                  <input type="number" min={1} className={inputClass} value={editing.data.durationValue} onChange={(e) => setPlanField({ durationValue: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={labelClass}>Unit</label>
                  <select className={inputClass} value={editing.data.durationUnit} onChange={(e) => setPlanField({ durationUnit: e.target.value as any })}>
                    <option value="day">Days</option>
                    <option value="month">Months</option>
                    <option value="year">Years</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Categories this plan covers *</label>
                <div className="max-h-44 overflow-y-auto border border-neutral-200 rounded-lg p-2 grid sm:grid-cols-2 gap-1">
                  {rootCategories.map((c: any) => (
                    <label key={c._id} className="flex items-center gap-2 text-sm px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={editing.data.categories.includes(c._id)}
                        onChange={(e) =>
                          setPlanField({
                            categories: e.target.checked ? [...editing.data.categories, c._id] : editing.data.categories.filter((id) => id !== c._id),
                          })
                        }
                      />
                      <span>{c.name}</span>
                      {c.subscriptionEnabled && <span className="text-[10px] px-1.5 rounded bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]">required</span>}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  Sellers only need a plan for categories marked "Subscription required". GST is added only for categories that bill with a GST invoice.
                </p>
              </div>
              <div className="border border-neutral-200 rounded-lg p-3 space-y-3">
                <p className="text-sm font-medium text-neutral-700">Limits (enforced by the app)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Max products</label>
                    <input type="number" min={1} className={inputClass} placeholder="Unlimited"
                      value={editing.data.limits.maxProducts ?? ""}
                      onChange={(e) => setPlanField({ limits: { ...editing.data.limits, maxProducts: e.target.value === "" ? null : Number(e.target.value) } })} />
                  </div>
                  <div>
                    <label className={labelClass}>Commission %</label>
                    <input type="number" min={0} max={100} className={inputClass} placeholder="Seller's normal rate"
                      value={editing.data.limits.commissionPercent ?? ""}
                      onChange={(e) => setPlanField({ limits: { ...editing.data.limits, commissionPercent: e.target.value === "" ? null : Number(e.target.value) } })} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.data.limits.featuredStore}
                    onChange={(e) => setPlanField({ limits: { ...editing.data.limits, featuredStore: e.target.checked } })} />
                  Featured store (shown first in Shop by Store)
                </label>
              </div>
              <div>
                <label className={labelClass}>Features shown to sellers</label>
                {editing.data.features.map((feature, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input className={inputClass} value={feature} placeholder="e.g. Priority support"
                      onChange={(e) => setPlanField({ features: editing.data.features.map((f, j) => (j === i ? e.target.value : f)) })} />
                    <button type="button" className="px-3 border border-neutral-300 rounded-lg text-neutral-500"
                      onClick={() => setPlanField({ features: editing.data.features.filter((_, j) => j !== i) })}>✕</button>
                  </div>
                ))}
                <button type="button" onClick={() => setPlanField({ features: [...editing.data.features, ""] })} className="text-sm text-[var(--primary-color)] font-medium">
                  + Add feature
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.data.isActive} onChange={(e) => setPlanField({ isActive: e.target.checked })} />
                Active (sellers can buy this plan)
              </label>
            </div>
            <div className="px-6 py-4 border-t border-neutral-200 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} disabled={saving} className="px-4 py-2 text-sm border border-neutral-300 rounded-lg">Cancel</button>
              <button onClick={savePlan} disabled={saving} className="px-4 py-2 text-sm bg-[var(--primary-dark)] text-white rounded-lg font-semibold">
                {saving ? "Saving..." : editing.id ? "Update Plan" : "Create Plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== ACTIVATE MODAL ===================== */}
      {activateForm && (
        <Modal title="Activate plan for seller" onClose={() => setActivateForm(null)}>
          <p className="text-sm text-neutral-500">For sellers who paid by cash or bank transfer.</p>
          <div>
            <label className={labelClass}>Seller</label>
            <select className={inputClass} value={activateForm.sellerId} onChange={(e) => setActivateForm({ ...activateForm, sellerId: e.target.value })}>
              <option value="">Select seller</option>
              {sellers.map((s: any) => <option key={s._id} value={s._id}>{s.storeName} {s.city ? `(${s.city})` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Plan</label>
            <select className={inputClass} value={activateForm.planId} onChange={(e) => setActivateForm({ ...activateForm, planId: e.target.value })}>
              <option value="">Select plan</option>
              {plans.filter((p) => p.isActive).map((p) => (
                <option key={p._id} value={p._id}>{p.name} · {formatINR(p.price)} / {formatDuration(p.durationValue, p.durationUnit)}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={activateForm.customDates} onChange={(e) => setActivateForm({ ...activateForm, customDates: e.target.checked })} />
            Choose custom start and end dates (otherwise the plan's duration from today)
          </label>
          {activateForm.customDates && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Start date</label>
                <input type="date" className={inputClass} value={activateForm.startDate} onChange={(e) => setActivateForm({ ...activateForm, startDate: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>End date</label>
                <input type="date" className={inputClass} value={activateForm.endDate} onChange={(e) => setActivateForm({ ...activateForm, endDate: e.target.value })} />
              </div>
            </div>
          )}
          <div>
            <label className={labelClass}>Payment reference</label>
            <input className={inputClass} value={activateForm.reference} placeholder="Receipt / UTR number"
              onChange={(e) => setActivateForm({ ...activateForm, reference: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setActivateForm(null)} className="px-4 py-2 text-sm border border-neutral-300 rounded-lg">Cancel</button>
            <button onClick={submitActivate} className="px-4 py-2 text-sm bg-[var(--primary-dark)] text-white rounded-lg font-semibold">Activate</button>
          </div>
        </Modal>
      )}

      {/* ===================== TRIAL MODAL ===================== */}
      {trialForm && (
        <Modal title="Grant free trial" onClose={() => setTrialForm(null)}>
          <div>
            <label className={labelClass}>Seller</label>
            <select className={inputClass} value={trialForm.sellerId} onChange={(e) => setTrialForm({ ...trialForm, sellerId: e.target.value })}>
              <option value="">Select seller</option>
              {sellers.map((s: any) => <option key={s._id} value={s._id}>{s.storeName} {s.city ? `(${s.city})` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Categories</label>
            {requiredCategories.length === 0 ? (
              <p className="text-xs text-neutral-500">No category requires a subscription yet.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto border border-neutral-200 rounded-lg p-2 space-y-1">
                {requiredCategories.map((c: any) => (
                  <label key={c._id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={trialForm.categories.includes(c._id)}
                      onChange={(e) => setTrialForm({ ...trialForm, categories: e.target.checked ? [...trialForm.categories, c._id] : trialForm.categories.filter((id) => id !== c._id) })} />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Start date</label>
              <input type="date" className={inputClass} value={trialForm.startDate} onChange={(e) => setTrialForm({ ...trialForm, startDate: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>End date</label>
              <input type="date" className={inputClass} value={trialForm.endDate} onChange={(e) => setTrialForm({ ...trialForm, endDate: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setTrialForm(null)} className="px-4 py-2 text-sm border border-neutral-300 rounded-lg">Cancel</button>
            <button onClick={submitTrial} className="px-4 py-2 text-sm bg-[var(--primary-dark)] text-white rounded-lg font-semibold">Grant trial</button>
          </div>
        </Modal>
      )}

      {/* ===================== EDIT DATES MODAL ===================== */}
      {datesFor && (
        <Modal title="Edit subscription dates" onClose={() => setDatesFor(null)}>
          <p className="text-sm text-neutral-500">{datesFor.label}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Start date</label>
              <input type="date" className={inputClass} value={datesFor.startDate} onChange={(e) => setDatesFor({ ...datesFor, startDate: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>End date</label>
              <input type="date" className={inputClass} value={datesFor.endDate} onChange={(e) => setDatesFor({ ...datesFor, endDate: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDatesFor(null)} className="px-4 py-2 text-sm border border-neutral-300 rounded-lg">Cancel</button>
            <button onClick={submitDates} className="px-4 py-2 text-sm bg-[var(--primary-dark)] text-white rounded-lg font-semibold">Save dates</button>
          </div>
        </Modal>
      )}

      {/* ===================== EXTEND MODAL ===================== */}
      {extendFor && (
        <Modal title="Extend subscription" onClose={() => setExtendFor(null)}>
          <div>
            <label className={labelClass}>Extra days</label>
            <input type="number" min={1} className={inputClass} value={extendFor.days} onChange={(e) => setExtendFor({ ...extendFor, days: Number(e.target.value) })} />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setExtendFor(null)} className="px-4 py-2 text-sm border border-neutral-300 rounded-lg">Cancel</button>
            <button onClick={submitExtend} className="px-4 py-2 text-sm bg-[var(--primary-dark)] text-white rounded-lg font-semibold">Extend</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
