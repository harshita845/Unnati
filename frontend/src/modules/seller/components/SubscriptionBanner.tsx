import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getMySubscriptions, SellerCategoryStatus } from "../../../services/api/subscriptionService";

/** Shown on every seller page when a plan the seller depends on is expiring or has expired. */
export default function SubscriptionBanner() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [alert, setAlert] = useState<{ level: "warning" | "danger"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMySubscriptions()
      .then((res) => {
        if (cancelled) return;
        const relevant = (res.data?.categories || []).filter((c: SellerCategoryStatus) => c.sellsHere || c.planName);
        const hidden = relevant.filter((c) => (c.state === "Expired" || c.state === "NotSubscribed") && c.sellsHere);
        const grace = relevant.filter((c) => c.state === "Grace");
        const soon = relevant.filter((c) => c.state === "ExpiringSoon");
        const names = (list: SellerCategoryStatus[]) => list.map((c) => c.name).join(", ");
        const days = (list: SellerCategoryStatus[]) => Math.min(...list.map((c) => c.daysLeft ?? 0));
        const planAccess = res.data?.planAccess;
        if (planAccess?.locked) {
          setAlert({ level: "danger", text: "Your store isn't live: you need an active subscription plan. Until then customers can't see your store and most of your panel is locked." });
        } else if (planAccess?.required && planAccess.inGrace) {
          setAlert({ level: "danger", text: "Your subscription plan has ended. Renew now or your store will be hidden from customers." });
        } else if (hidden.length) {
          setAlert({ level: "danger", text: `You need an active plan for ${names(hidden)}. Your products there are hidden from customers.` });
        } else if (grace.length) {
          const d = days(grace);
          setAlert({ level: "danger", text: `Your plan for ${names(grace)} has expired. Products will be hidden in ${d} day${d === 1 ? "" : "s"}.` });
        } else if (soon.length) {
          const d = days(soon);
          setAlert({ level: "warning", text: `Your plan for ${names(soon)} expires in ${d} day${d === 1 ? "" : "s"}.` });
        } else {
          setAlert(null);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!alert || pathname.startsWith("/seller/subscriptions")) return null;

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${
        alert.level === "danger" ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"
      }`}>
      <p className="text-sm font-medium flex-1">{alert.text}</p>
      <button
        onClick={() => navigate("/seller/subscriptions#plans")}
        className={`px-4 py-1.5 rounded-lg text-sm font-semibold text-white ${alert.level === "danger" ? "bg-red-600" : "bg-amber-600"}`}>
        Renew now
      </button>
    </div>
  );
}
