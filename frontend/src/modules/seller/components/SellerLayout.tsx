import { ReactNode, useState, useCallback, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import SellerHeader from './SellerHeader';
import SubscriptionBanner from './SubscriptionBanner';
import SellerSidebar from './SellerSidebar';
import { useSellerSocket, SellerNotification } from '../hooks/useSellerSocket';
import SellerNotificationAlert from './SellerNotificationAlert';
import { broadcastSellerOrderUpdate } from '../hooks/useSellerOrderUpdates';
import { getStaffSession, normalizeStaffMember, setStaffSession, setStoredStaffList } from '../../../utils/staffSession';
import { getStaff as apiGetStaff } from '../../../services/api/admin/adminStaffService';
import { getSellerProfile } from '../../../services/api/auth/sellerAuthService';
import { getModuleUserData, setModuleUserData } from '../../../utils/moduleAuth';
import { isSellerPathAllowed, SELLER_ACCESSIBILITY_UPDATED_EVENT, SELLER_PLAN_CHANGED_EVENT } from '../../../constants/sellerModules';

interface SellerLayoutProps {
  children: ReactNode;
}

export default function SellerLayout({ children }: SellerLayoutProps) {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [activeNotification, setActiveNotification] = useState<SellerNotification | null>(null);
  const [, setStaffSyncTick] = useState(0);
  const [accessibilityTick, setAccessibilityTick] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    // Set initial state correctly
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNotificationReceived = useCallback((notification: SellerNotification) => {
    // Every change refreshes open order pages; only a new order needs the store's attention
    broadcastSellerOrderUpdate(notification);
    if (notification.type === 'NEW_ORDER') setActiveNotification(notification);
  }, []);

  useSellerSocket(handleNotificationReceived);

  useEffect(() => {
    let isMounted = true;

    const syncStaffPermissions = async () => {
      const activeSession = getStaffSession('seller');
      if (!activeSession) return;

      try {
        const response = await apiGetStaff();
        if (!response.success || !Array.isArray(response.data)) return;

        const mapped = response.data.map((item: any) =>
          normalizeStaffMember({
            id: item._id || item.id,
            name: item.name,
            phone: item.phone,
            role: item.role,
            commission: item.commission ?? 0,
            permissions: item.permissions,
          })
        );

        setStoredStaffList('seller', mapped);

        const matched = mapped.find(
          (member) => member.id === activeSession.id || member.phone === activeSession.phone
        );
        if (!matched) return;

        setStaffSession('seller', matched);
        if (isMounted) {
          setStaffSyncTick((tick) => tick + 1);
        }
      } catch {
        // keep current session if sync request fails
      }
    };

    const syncSellerAccessibility = async () => {
      try {
        const response = await getSellerProfile();
        if (response.success && response.data) {
          const current = getModuleUserData('seller') || {};
          const updated = {
            ...current,
            ...response.data,
            accessibleModules: response.data.accessibleModules,
          };
          setModuleUserData(updated, 'seller');
          if (isMounted) {
            setAccessibilityTick((t) => t + 1);
            window.dispatchEvent(new CustomEvent(SELLER_ACCESSIBILITY_UPDATED_EVENT, { detail: response.data.accessibleModules }));
          }
        }
      } catch {
        // silent catch if network issue
      }
    };

    syncStaffPermissions();
    syncSellerAccessibility();
    // A plan was just bought / renewed: re-read what it unlocks
    window.addEventListener(SELLER_PLAN_CHANGED_EVENT, syncSellerAccessibility);

    return () => {
      isMounted = false;
      window.removeEventListener(SELLER_PLAN_CHANGED_EVENT, syncSellerAccessibility);
    };
  }, []);

  const user = getModuleUserData('seller');
  const accessibleModules = Array.isArray(user?.accessibleModules) ? user.accessibleModules : null;
  const isCurrentRouteAllowed = isSellerPathAllowed(location.pathname, location.search, accessibleModules);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeNotification = () => {
    setActiveNotification(null);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F7F4] premium-theme">
      {/* Real-time Notification Alert */}
      <SellerNotificationAlert
        notification={activeNotification}
        onClose={closeNotification}
      />

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Fixed */}
      <div
        className={`fixed left-0 top-0 h-screen z-50 transition-transform duration-300 ease-in-out w-72 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SellerSidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 w-full min-w-0 ${
          isSidebarOpen ? 'lg:pl-72' : ''
        }`}
      >
        {/* Header */}
        <SellerHeader onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F5F7F4]">
          <SubscriptionBanner />
          {!isCurrentRouteAllowed ? (
            <div className="max-w-2xl mx-auto my-12 p-8 bg-white border border-neutral-200 rounded-2xl shadow-sm text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900 mb-2">Module Access Restricted</h2>
              <p className="text-sm text-neutral-600 mb-6 max-w-md mx-auto">
                Your store administrator has customized module access for your seller account. This section is currently disabled.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link
                  to="/seller"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary-color)] text-white text-sm font-semibold hover:opacity-95 shadow-sm transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Return to Dashboard
                </Link>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

