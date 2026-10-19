import { useState } from "react";
import { updateHeaderSubscription, type HeaderCategory } from "../../../services/api/headerCategoryService";
import { dateInputToISO, toDateInput } from "../../../services/api/subscriptionService";
import { useToast } from "../../../context/ToastContext";

interface Props {
  header: HeaderCategory;
  onClose: () => void;
  onSaved: () => void;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Subscription rule for a whole header category (e.g. Winter). It applies to every category and
 * subcategory under the header; sellers need a plan that covers the header to sell there.
 */
export default function HeaderSubscriptionModal({ header, onClose, onSaved }: Props) {
  const { showToast } = useToast();
  const current = header.subscription;
  const wasEnabled = !!current?.subscriptionEnabled;

  const [enabled, setEnabled] = useState(wasEnabled);
  const [graceMode, setGraceMode] = useState<"default" | "custom">(typeof current?.subscriptionGraceDays === "number" ? "custom" : "default");
  const [graceDays, setGraceDays] = useState(typeof current?.subscriptionGraceDays === "number" ? current.subscriptionGraceDays : 3);
  const [billType, setBillType] = useState<"" | "gst" | "receipt">(current?.subscriptionBillType || "");
  const [existingMode, setExistingMode] = useState<"trial" | "buy">("trial");
  const [trialStart, setTrialStart] = useState(toDateInput(new Date()));
  const [trialEnd, setTrialEnd] = useState(toDateInput(new Date(Date.now() + 30 * DAY)));
  const [saving, setSaving] = useState(false);

  const categoryCount = current?.categoryCount ?? 0;

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateHeaderSubscription(header._id, {
        subscriptionEnabled: enabled,
        subscriptionGraceDays: graceMode === "custom" ? Math.max(0, Math.round(graceDays)) : null,
        subscriptionBillType: billType || null,
        // Switching the requirement on: what sellers already selling here get
        ...(enabled && !wasEnabled
          ? {
              existingSellers:
                existingMode === "buy"
                  ? { mode: "buy" as const }
                  : { mode: "trial" as const, trialStartDate: dateInputToISO(trialStart, "start"), trialEndDate: dateInputToISO(trialEnd, "end") },
            }
          : {}),
      });
      showToast(res.message || "Subscription rule saved", "success");
      onSaved();
      onClose();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(message || "Could not save the subscription rule", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        // Width and white background inline: the admin theme stretches white rounded boxes to 100% width
        style={{ width: "100%", maxWidth: 512, backgroundColor: "#ffffff" }}
        className="rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="header-subscription-title">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 id="header-subscription-title" className="text-base font-semibold text-neutral-900">
            Subscription · {header.name}
          </h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {categoryCount === 0 ? (
            <p className="text-sm text-neutral-600">
              "{header.name}" has no categories yet. Add a category to it first, then set its subscription rule here.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-neutral-700">Subscription required</p>
                  <p className="text-xs text-neutral-500">
                    Applies to everything in {header.name}: all {categoryCount} categor{categoryCount === 1 ? "y" : "ies"} and their
                    subcategories. Sellers need an active plan covering {header.name} to sell here. Plans and prices are managed in
                    Manage Seller → Seller Subscriptions.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => setEnabled((v) => !v)}
                  disabled={saving}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${enabled ? "bg-[var(--primary-color)]" : "bg-neutral-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : ""}`} />
                </button>
              </div>

              {enabled && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">After a seller's plan expires</label>
                      <select
                        value={graceMode === "custom" && graceDays === 0 ? "hide" : graceMode}
                        onChange={(e) => {
                          if (e.target.value === "hide") {
                            setGraceMode("custom");
                            setGraceDays(0);
                          } else if (e.target.value === "custom") {
                            setGraceMode("custom");
                            setGraceDays((d) => (d > 0 ? d : 3));
                          } else setGraceMode("default");
                        }}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                        disabled={saving}
                      >
                        <option value="default">Use default grace period</option>
                        <option value="custom">Custom grace period</option>
                        <option value="hide">Hide products immediately</option>
                      </select>
                      {graceMode === "custom" && graceDays > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={90}
                            value={graceDays}
                            onChange={(e) => setGraceDays(Number(e.target.value))}
                            className="w-24 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                            disabled={saving}
                          />
                          <span className="text-xs text-neutral-600">days, then products are hidden</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700">Bill for subscription payments</label>
                      <select
                        value={billType}
                        onChange={(e) => setBillType(e.target.value as "" | "gst" | "receipt")}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                        disabled={saving}
                      >
                        <option value="">Use default</option>
                        <option value="gst">GST invoice (GST charged)</option>
                        <option value="receipt">Payment receipt (no GST)</option>
                      </select>
                    </div>
                  </div>

                  {!wasEnabled && (
                    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-medium text-amber-900">Sellers already selling in {header.name}:</p>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" checked={existingMode === "trial"} onChange={() => setExistingMode("trial")} disabled={saving} />
                        Give a free trial
                      </label>
                      {existingMode === "trial" && (
                        <div className="grid grid-cols-2 gap-2 pl-6">
                          <div>
                            <label className="mb-1 block text-xs text-neutral-600">Start date</label>
                            <input type="date" value={trialStart} onChange={(e) => setTrialStart(e.target.value)}
                              className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" disabled={saving} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-neutral-600">End date</label>
                            <input type="date" value={trialEnd} onChange={(e) => setTrialEnd(e.target.value)}
                              className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" disabled={saving} />
                          </div>
                        </div>
                      )}
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" checked={existingMode === "buy"} onChange={() => setExistingMode("buy")} disabled={saving} />
                        They must buy a plan now (their products here are hidden until they do)
                      </label>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-200 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm" disabled={saving}>
            Cancel
          </button>
          {categoryCount > 0 && (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-[var(--primary-dark)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
