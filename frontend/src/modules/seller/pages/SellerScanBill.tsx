import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminScanBill from '../../admin/pages/AdminScanBill';
import { sellerScanScope } from '../../admin/scanBill/scanScope';
import { getModuleUserData } from '../../../utils/moduleAuth';
import { SELLER_ACCESSIBILITY_UPDATED_EVENT } from '../../../constants/sellerModules';

/**
 * Seller POS → Scan Bill. A premium plan feature: the same page as Admin POS, working only on this
 * store's products, suppliers and history (the server checks the plan and scopes every request).
 */
export default function SellerScanBill() {
  const [access, setAccess] = useState(() => getModuleUserData('seller')?.scanBill);

  // The layout refreshes the profile on load and after a plan purchase
  useEffect(() => {
    const refresh = () => setAccess(getModuleUserData('seller')?.scanBill);
    window.addEventListener(SELLER_ACCESSIBILITY_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(SELLER_ACCESSIBILITY_UPDATED_EVENT, refresh);
  }, []);

  if (!access?.enabled) {
    return (
      <div className="p-4 sm:p-6">
        <div className="max-w-xl mx-auto bg-white border border-neutral-200 rounded-xl p-6 text-center">
          <h1 className="text-lg font-bold text-neutral-900">Scan Bill</h1>
          <p className="text-sm text-neutral-600 mt-2">
            Photograph a supplier bill and the stock, purchase entry and supplier ledger fill in for you. Scan Bill is part of
            premium plans.
          </p>
          <Link
            to="/seller/subscriptions"
            className="inline-block mt-4 bg-[var(--primary-color)] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[var(--primary-dark)]"
          >
            See plans
          </Link>
        </div>
      </div>
    );
  }

  return <AdminScanBill scope={sellerScanScope} />;
}
