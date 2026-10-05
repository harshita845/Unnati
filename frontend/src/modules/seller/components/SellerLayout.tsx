import { ReactNode, useState, useCallback, useEffect } from 'react';
import SellerHeader from './SellerHeader';
import SubscriptionBanner from './SubscriptionBanner';
import SellerSidebar from './SellerSidebar';
import { useSellerSocket, SellerNotification } from '../hooks/useSellerSocket';
import SellerNotificationAlert from './SellerNotificationAlert';
import { broadcastSellerOrderUpdate } from '../hooks/useSellerOrderUpdates';
import { getStaffSession, normalizeStaffMember, setStaffSession, setStoredStaffList } from '../../../utils/staffSession';
import { getStaff as apiGetStaff } from '../../../services/api/admin/adminStaffService';

interface SellerLayoutProps {
  children: ReactNode;
}

export default function SellerLayout({ children }: SellerLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [activeNotification, setActiveNotification] = useState<SellerNotification | null>(null);
  const [, setStaffSyncTick] = useState(0);

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

    syncStaffPermissions();

    return () => {
      isMounted = false;
    };
  }, []);

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
          {children}
        </main>
      </div>
    </div>
  );
}

