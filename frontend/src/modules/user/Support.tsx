import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import SupportCenter from "../../components/support/SupportCenter";

/** Customer → Help & Support: raise tickets and chat with the support team */
export default function Support() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-50 pb-24 md:pb-8">
      <div className="mx-auto max-w-3xl px-4 pt-6 md:pt-10">
        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-neutral-900" aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-neutral-900">Help &amp; Support</h1>
        </div>
        {user ? (
          <SupportCenter accent="var(--customer-primary, var(--primary-color))" intro="Problem with an order, payment or delivery? Raise a ticket and we'll reply here." />
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center">
            <p className="text-sm text-neutral-600">Please log in to raise a support ticket.</p>
            <Link to="/login" className="mt-3 inline-block rounded-lg bg-[var(--customer-primary,var(--primary-color))] px-4 py-2 text-sm font-semibold text-white">
              Log in
            </Link>
            <p className="mt-4 text-xs text-neutral-500">
              Looking for quick answers? See the <Link to="/faq" className="underline">FAQs</Link>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
