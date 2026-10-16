import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import SupportCenter from "../../components/support/SupportCenter";

/** Customer → Help & Support: raise tickets and chat with the support team */
export default function Support() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--brand-cream,#FDF9F2)] text-[var(--brand-ink,#1C2B20)] pb-24 md:pb-8">
      <div className="mx-auto max-w-3xl px-4 pt-6 md:pt-10">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-[var(--brand-ink,#1C2B20)] hover:text-[var(--brand-green,#236B34)] transition-colors" aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-xl font-display font-bold text-[var(--brand-green-deep,#14401F)]">Help &amp; Support</h1>
        </div>
        {user ? (
          <SupportCenter accent="var(--brand-green, #236B34)" intro="Problem with an order, payment or delivery? Raise a ticket and we'll reply here." />
        ) : (
          <div className="rounded-2xl border border-[var(--brand-border,#E9E2D3)] bg-white p-6 text-center shadow-[0_4px_16px_rgba(35,107,52,0.06)]">
            <p className="text-sm text-[var(--brand-ink-muted,#5B6B60)]">Please log in to raise a support ticket.</p>
            <Link to="/login" className="mt-3 inline-block rounded-xl bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors">
              Log in
            </Link>
            <p className="mt-4 text-xs text-[var(--brand-ink-muted,#5B6B60)]">
              Looking for quick answers? See the <Link to="/faq" className="text-[var(--brand-green,#236B34)] font-medium underline">FAQs</Link>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
