import { useNavigate } from "react-router-dom";
import DeliveryHeader from "../components/DeliveryHeader";
import DeliveryBottomNav from "../components/DeliveryBottomNav";
import SupportCenter from "../../../components/support/SupportCenter";

/** Delivery partner → Support tickets */
export default function DeliverySupport() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      <DeliveryHeader />
      <div className="px-4 py-4">
        <div className="mb-4 flex items-center">
          <button onClick={() => navigate("/delivery/help")} className="mr-3 rounded-full p-2 transition-colors hover:bg-neutral-200" aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h2 className="text-xl font-semibold text-neutral-900">Support Tickets</h2>
        </div>
        <SupportCenter intro="Problem with an order, payment or the app? Raise a ticket and the team will reply here." />
      </div>
      <DeliveryBottomNav />
    </div>
  );
}
