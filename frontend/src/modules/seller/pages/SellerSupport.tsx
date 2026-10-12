import SupportCenter from "../../../components/support/SupportCenter";

/** Seller → Support: raise tickets to the Super Admin and follow the replies */
export default function SellerSupport() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-neutral-900">Support</h1>
        <p className="mt-1 text-sm text-neutral-500">Questions about orders, payouts, products or the panel? Raise a ticket and the admin team will reply here.</p>
      </div>
      <div className="max-w-3xl">
        <SupportCenter showPriority intro="Raise a ticket and the admin team will reply here." />
      </div>
    </div>
  );
}
