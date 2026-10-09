import { useEffect, useRef, useState } from "react";
import { ALL_SELLER_MODULES, SELLER_PLAN_CHANGED_EVENT } from "../../../constants/sellerModules";
import jsPDF from "jspdf";
import { useToast } from "../../../context/ToastContext";
import {
  SellerCategoryStatus,
  SellerSubscription,
  SellerSubscriptionOverview,
  SubscriptionPlan,
  formatDateIN,
  formatDuration,
  formatINR,
  getMySubscriptions,
  getSubscriptionInvoice,
  purchasePlan,
  verifyPlanPayment,
} from "../../../services/api/subscriptionService";

const loadScript = (src: string) =>
  new Promise<boolean>((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const stateStyle: Record<SellerCategoryStatus["state"], { label: string; cls: string }> = {
  Active: { label: "Active", cls: "bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]" },
  ExpiringSoon: { label: "Expiring soon", cls: "bg-amber-100 text-amber-800" },
  Grace: { label: "Expired · grace period", cls: "bg-orange-100 text-orange-800" },
  Expired: { label: "Expired", cls: "bg-red-100 text-red-800" },
  NotSubscribed: { label: "Not subscribed", cls: "bg-neutral-100 text-neutral-700" },
  Upcoming: { label: "Starts soon", cls: "bg-blue-100 text-blue-800" },
  NotRequired: { label: "No subscription needed", cls: "bg-neutral-100 text-neutral-500" },
};

const errorMessage = (err: any, fallback: string) => err?.response?.data?.message || err?.message || fallback;
const plural = (n: number | null, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function SellerSubscriptions() {
  const { showToast } = useToast();
  const [data, setData] = useState<SellerSubscriptionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<SubscriptionPlan | null>(null);
  const [processing, setProcessing] = useState(false);

  // Plan chosen at signup (?plan=<id> or saved on the account) opens ready to pay, once
  const autoOpened = useRef(false);
  const planChanged = () => window.dispatchEvent(new CustomEvent(SELLER_PLAN_CHANGED_EVENT));

  const load = async () => {
    try {
      const res = await getMySubscriptions();
      setData(res.data);
      if (!autoOpened.current) {
        autoOpened.current = true;
        const wanted = new URLSearchParams(window.location.search).get("plan") || res.data?.selectedPlanId;
        const alreadyHasPlan = res.data?.planAccess?.hasPlan;
        const plan = wanted && !alreadyHasPlan ? res.data?.plans?.find((p) => p._id === wanted) : null;
        if (plan) setBuying(plan);
      }
    } catch (err) {
      showToast(errorMessage(err, "Failed to load subscriptions"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (window.location.hash === "#plans") {
      setTimeout(() => {
        document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" });
      }, 400);
    }
  }, []);

  const pay = async (plan: SubscriptionPlan, method: "Online" | "Wallet") => {
    setProcessing(true);
    try {
      const res = await purchasePlan(plan._id, method);
      const { subscription, razorpay } = res.data || {};
      if (!razorpay) {
        showToast(`"${plan.name}" is active`, "success");
        setBuying(null);
        setProcessing(false);
        await load();
        planChanged();
        return;
      }
      const ok = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      if (!ok) throw new Error("Payment page failed to load");
      const rzp = new (window as any).Razorpay({
        key: razorpay.key,
        amount: Math.round(razorpay.amount * 100),
        currency: "INR",
        name: "Unnati",
        description: `Subscription: ${plan.name}`,
        order_id: razorpay.orderId,
        handler: async (response: any) => {
          try {
            await verifyPlanPayment(subscription._id, {
              razorpayOrderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            showToast(`Payment successful. "${plan.name}" is active.`, "success");
            setBuying(null);
            await load();
            planChanged();
          } catch (err) {
            showToast(errorMessage(err, "Payment could not be verified"), "error");
          } finally {
            setProcessing(false);
          }
        },
        modal: { ondismiss: () => setProcessing(false) },
        theme: { color: "#0B5D3B" },
      });
      rzp.on("payment.failed", (r: any) => showToast(r?.error?.description || "Payment failed. Please try again.", "error"));
      rzp.open();
      return;
    } catch (err) {
      showToast(errorMessage(err, "Could not start the payment"), "error");
    }
    setProcessing(false);
  };

  const downloadInvoice = async (sub: SellerSubscription) => {
    try {
      const res = await getSubscriptionInvoice(sub._id);
      const { subscription: s, seller, invoiceEnabled } = res.data;
      const doc = new jsPDF();
      const left = 20;
      let y = 22;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(invoiceEnabled ? "Tax Invoice" : "Payment Receipt", left, y);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      y += 8;
      doc.text("Unnati - Seller Subscription", left, y);
      y += 10;
      doc.text(`${invoiceEnabled ? "Invoice" : "Receipt"} No: ${s.invoiceNumber || s._id}`, left, y);
      doc.text(`Date: ${formatDateIN(s.payment?.paidAt)}`, 140, y);
      y += 10;
      doc.setFont("helvetica", "bold");
      doc.text("Billed to", left, y);
      doc.setFont("helvetica", "normal");
      y += 6;
      [seller?.storeName, seller?.sellerName, seller?.address, seller?.city, seller?.email, seller?.mobile, seller?.gstNumber || seller?.gstin ? `GSTIN: ${seller.gstNumber || seller.gstin}` : ""]
        .filter(Boolean)
        .forEach((line: string) => {
          doc.text(String(line), left, y);
          y += 5;
        });
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.text("Description", left, y);
      doc.text("Amount", 170, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 7;
      doc.text(`${s.planSnapshot.name} (${formatDuration(s.planSnapshot.durationValue, s.planSnapshot.durationUnit)})`, left, y);
      doc.text(`Rs. ${s.payment.baseAmount.toFixed(2)}`, 170, y, { align: "right" });
      y += 6;
      doc.setFontSize(9);
      doc.text(`Period: ${formatDateIN(s.startDate)} to ${formatDateIN(s.endDate)}`, left, y);
      y += 5;
      doc.text(`Categories: ${(s.categories || []).map((c: any) => c.name).join(", ")}`, left, y);
      doc.setFontSize(10);
      y += 8;
      if (invoiceEnabled && s.payment.gstAmount > 0) {
        doc.text(`GST @ ${s.payment.gstPercent}%`, left, y);
        doc.text(`Rs. ${s.payment.gstAmount.toFixed(2)}`, 170, y, { align: "right" });
        y += 7;
      }
      doc.setFont("helvetica", "bold");
      doc.text("Total paid", left, y);
      doc.text(`Rs. ${s.payment.totalAmount.toFixed(2)}`, 170, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 8;
      doc.setFontSize(9);
      doc.text(`Payment: ${s.payment.method}${s.payment.paymentId ? ` (${s.payment.paymentId})` : ""}${s.payment.reference ? ` Ref: ${s.payment.reference}` : ""}`, left, y);
      doc.save(`${s.invoiceNumber || "subscription"}.pdf`);
    } catch (err) {
      showToast(errorMessage(err, "Could not download the bill"), "error");
    }
  };

  if (loading) return <p className="text-sm text-neutral-500 p-6">Loading subscriptions…</p>;
  if (!data) return null;

  const methods = data.settings.paymentMethods;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-5">
        <h1 className="text-2xl font-bold text-neutral-900">Subscriptions</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {data.planAccess?.required
            ? "Every store needs an active plan to sell. Your plan decides which parts of this panel you can use. If it expires, your store is hidden from customers until you renew (after the grace period). Your products are never deleted."
            : "Some categories need an active plan to sell. If a plan expires, your products in that category are hidden from customers until you renew (some categories give a few days of grace first). Your products are never deleted."}
        </p>
      </div>

      {data.planAccess?.locked && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4">
          <p className="font-semibold text-red-800">Your store isn't live yet</p>
          <p className="text-sm text-red-700 mt-1">
            You don't have an active subscription plan, so customers can't see your store and only Dashboard and Subscriptions are open.
            Choose a plan below and pay to unlock your panel{data.selectedPlanId ? " (the plan you picked at signup is highlighted)" : ""}.
          </p>
        </div>
      )}
      {data.planAccess?.required && data.planAccess.inGrace && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-5 py-4 text-sm text-orange-800">
          Your plan has ended and you're in the grace period. Renew now or your store will be hidden.
        </div>
      )}

      {/* Category status */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-[var(--primary-dark)] text-white px-5 py-3"><h2 className="font-semibold">My categories</h2></div>
        {data.categories.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">You don't have products in any category yet.</p>
        ) : (
          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {data.categories.map((c) => {
              const style = stateStyle[c.state];
              return (
                <div key={c.categoryId} className="border border-neutral-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-neutral-900">{c.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${style.cls}`}>
                      {c.isTrial && (c.state === "Active" || c.state === "ExpiringSoon") ? "Free trial" : style.label}
                    </span>
                  </div>
                  {c.planName && <p className="text-sm text-neutral-600 mt-1">{c.planName}</p>}
                  {c.state === "Grace" && c.daysLeft !== null && (
                    <p className="text-sm text-orange-700 mt-1">Products will be hidden in {plural(c.daysLeft, "day")}. Renew now.</p>
                  )}
                  {(c.state === "Active" || c.state === "ExpiringSoon") && (
                    <p className="text-sm text-neutral-600 mt-1">Valid until {formatDateIN(c.endDate)} ({plural(c.daysLeft, "day")} left)</p>
                  )}
                  {c.state === "Upcoming" && <p className="text-sm text-blue-700 mt-1">Starts in {plural(c.daysLeft, "day")}.</p>}
                  {(c.state === "Expired" || c.state === "NotSubscribed") && c.sellsHere && (
                    <p className="text-sm text-red-700 mt-1">Your products here are hidden from customers.</p>
                  )}
                  {c.state === "NotRequired" ? (
                    <p className="text-xs text-neutral-500 mt-2">This category doesn't need a subscription right now.</p>
                  ) : (
                    <p className="text-xs text-neutral-500 mt-2">
                      {c.graceDays === 0 ? "Products are hidden as soon as the plan ends." : `Grace after expiry: ${plural(c.graceDays, "day")}.`}
                    </p>
                  )}
                  {c.usage && (
                    <p className="text-xs text-neutral-500 mt-1">
                      Products: {c.usage.products}
                      {c.usage.maxProducts ? ` / ${c.usage.maxProducts}` : " (unlimited)"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Plans */}
      <div id="plans" className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-[var(--primary-dark)] text-white px-5 py-3"><h2 className="font-semibold">Plans</h2></div>
        {data.plans.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">No plans available right now.</p>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {data.plans.map((plan) => {
              // Whole groups read better than a long list ("All of Beauty" instead of 30 category names)
              const groups = (plan.headerCategories || []).map((h: any) => `All of ${h.name}`);
              const groupIds = new Set((plan.headerCategories || []).map((h: any) => String(h._id)));
              const singles = plan.categories
                .filter((c: any) => !groupIds.has(String(c.headerCategoryId?._id || c.headerCategoryId || "")))
                .map((c: any) => c.name)
                .filter(Boolean);
              const covered = groups.length ? [...groups, ...singles] : plan.categories.map((c: any) => c.name).filter(Boolean);
              const current = data.categories.find(
                (c) => plan.categories.some((pc: any) => String(pc._id || pc) === c.categoryId) && c.planName === plan.name && c.state !== "Expired"
              );
              return (
                <div
                  key={plan._id}
                  className={`border rounded-xl p-4 flex flex-col ${data.selectedPlanId === plan._id ? "border-[var(--primary-color)] ring-2 ring-[var(--primary-alpha-30)]" : "border-neutral-200"}`}>
                  {data.selectedPlanId === plan._id && (
                    <span className="self-start text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--primary-alpha-20)] text-[var(--primary-darker)] mb-2">
                      Chosen at signup
                    </span>
                  )}
                  <h3 className="font-semibold text-neutral-900">{plan.name}</h3>
                  <p className="text-xl font-bold text-[var(--primary-dark)] mt-1">
                    {formatINR(plan.price)}
                    <span className="text-sm font-medium text-neutral-500"> / {formatDuration(plan.durationValue, plan.durationUnit)}</span>
                  </p>
                  {plan.gstPercent ? (
                    <p className="text-xs text-neutral-500">{formatINR(plan.totalPrice || plan.price)} incl. {plan.gstPercent}% GST · GST invoice</p>
                  ) : (
                    <p className="text-xs text-neutral-500">No GST · payment receipt</p>
                  )}
                  {plan.description && <p className="text-sm text-neutral-600 mt-2">{plan.description}</p>}
                  <p className="text-xs text-neutral-500 mt-3">For: {covered.join(", ")}</p>
                  <ul className="mt-2 space-y-1 text-sm text-neutral-700 flex-1">
                    <li>✓ {plan.limits?.maxProducts ? `Up to ${plan.limits.maxProducts} products` : "Unlimited products"}</li>
                    {plan.limits?.commissionPercent != null && <li>✓ {plan.limits.commissionPercent}% commission</li>}
                    {plan.limits?.featuredStore && <li>✓ Featured store in Shop by Store</li>}
                    {plan.features.map((f, i) => <li key={i}>✓ {f}</li>)}
                  </ul>
                  {data.planAccess?.required && (
                    <p className="text-xs text-neutral-500 mt-3">
                      Unlocks:{" "}
                      {ALL_SELLER_MODULES.filter((m) => !m.isEssential && (!plan.accessibleModules?.length || plan.accessibleModules.includes(m.key)))
                        .map((m) => m.label)
                        .join(", ") || "Dashboard and Subscriptions only"}
                    </p>
                  )}
                  <button
                    onClick={() => setBuying(plan)}
                    className="mt-4 w-full py-2 rounded-lg bg-[var(--primary-dark)] text-white text-sm font-semibold hover:bg-[var(--primary-darker)]">
                    {current ? "Renew" : "Subscribe"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-[var(--primary-dark)] text-white px-5 py-3"><h2 className="font-semibold">History</h2></div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>{["Plan", "Categories", "Period", "Status", "Amount", ""].map((h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {data.history.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-500">No subscriptions yet</td></tr>}
              {data.history.map((s) => (
                <tr key={s._id}>
                  <td className="px-4 py-3">{s.planSnapshot.name}</td>
                  <td className="px-4 py-3 text-xs">{s.categories.map((c) => c.name).join(", ")}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">{formatDateIN(s.startDate)} – {formatDateIN(s.endDate)}</td>
                  <td className="px-4 py-3">{s.isTrial && s.status === "Active" ? "Free trial" : s.status}</td>
                  <td className="px-4 py-3">{s.payment.totalAmount ? formatINR(s.payment.totalAmount) : "—"}</td>
                  <td className="px-4 py-3">
                    {s.payment.paidAt && s.payment.method !== "Trial" && s.payment.totalAmount > 0 && (
                      <button onClick={() => downloadInvoice(s)} className="text-[var(--primary-color)] hover:underline whitespace-nowrap">
                        {s.billType === "receipt" ? "Receipt" : "GST invoice"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment choice */}
      {buying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => !processing && setBuying(null)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6 space-y-4">
            <h2 className="text-lg font-semibold">{buying.name}</h2>
            <p className="text-sm text-neutral-600">
              {formatINR(buying.price)}
              {buying.gstPercent ? ` + ${buying.gstPercent}% GST = ${formatINR(buying.totalPrice || buying.price)}` : ""} for{" "}
              {formatDuration(buying.durationValue, buying.durationUnit)}. If you already have this plan, the new period starts when the current one ends.
            </p>
            <div className="space-y-2">
              {methods.online && (
                <button disabled={processing} onClick={() => pay(buying, "Online")}
                  className="w-full py-2.5 rounded-lg bg-[var(--primary-dark)] text-white text-sm font-semibold disabled:opacity-60">
                  {processing ? "Processing…" : "Pay online (UPI / Card)"}
                </button>
              )}
              {methods.wallet && (
                <button disabled={processing} onClick={() => pay(buying, "Wallet")}
                  className="w-full py-2.5 rounded-lg border border-[var(--primary-dark)] text-[var(--primary-dark)] text-sm font-semibold disabled:opacity-60">
                  Pay from wallet balance
                </button>
              )}
              {methods.manual && (
                <p className="text-xs text-neutral-500 text-center">Paying by cash or bank transfer? Contact the admin to activate your plan.</p>
              )}
            </div>
            <button disabled={processing} onClick={() => setBuying(null)} className="w-full py-2 text-sm text-neutral-600">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
