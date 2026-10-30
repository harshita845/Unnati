import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import EcommerceStoresLogo from '@assets/unnati_logo.png';
import { io, Socket } from 'socket.io-client';
import { getSocketBaseURL, isRealtimeAvailable } from '../../../services/api/config';
import { getNotifications, markAsRead, Notification as AdminNotificationData } from '../../../services/api/admin/adminNotificationService';
import {
  adminGlobalSearch,
  GlobalSearchResult,
  AdminSearchOrder,
  AdminSearchProduct,
  AdminSearchCustomer,
  AdminSearchSeller,
  AdminSearchCategory,
  AdminSearchSubCategory,
} from '../../../services/api/admin/adminSearchService';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useAppContext } from '../../../context/AppContext';
import AdminNotificationAlert, { AdminNotificationData as AlertNotificationData } from './AdminNotificationAlert';

const ADMIN_NAV_PAGES = [
  { title: "Orders (All Orders)", path: "/admin/orders", category: "Sales", icon: "📦" },
  { title: "POS Orders", path: "/admin/pos/orders", category: "POS", icon: "🧾" },
  { title: "Scan Bill / Billing", path: "/admin/pos/scan-bill", category: "POS", icon: "⚡" },
  { title: "Product List & Stock", path: "/admin/product/list", category: "Products", icon: "🛍️" },
  { title: "Add Product", path: "/admin/product/add", category: "Products", icon: "➕" },
  { title: "Manage Categories", path: "/admin/category", category: "Catalog", icon: "📁" },
  { title: "Header Category", path: "/admin/category/header", category: "Catalog", icon: "🏷️" },
  { title: "Sub Category", path: "/admin/subcategory", category: "Catalog", icon: "📂" },
  { title: "Manage Customer", path: "/admin/customers", category: "Customers", icon: "👤" },
  { title: "Manage Seller List", path: "/admin/manage-seller/list", category: "Sellers", icon: "🏪" },
  { title: "Add Seller", path: "/admin/manage-seller/add", category: "Sellers", icon: "➕" },
  { title: "Seller Subscriptions", path: "/admin/seller-subscriptions", category: "Sellers", icon: "💳" },
  { title: "Coupons", path: "/admin/coupons", category: "Marketing", icon: "🎟️" },
  { title: "Delivery Boys", path: "/admin/delivery-boys", category: "Delivery", icon: "🛵" },
  { title: "Manage Staff", path: "/admin/manage-staff", category: "Staff", icon: "👥" },
];

const getRoleBadge = (msg: string) => {
  if (!msg) return null;
  const lower = msg.toLowerCase();
  if (lower.startsWith('delivery partner') || lower.includes('[delivery partner]')) {
    return { label: 'Delivery partner', className: 'bg-amber-100 text-amber-800 border-amber-300' };
  }
  if (lower.startsWith('seller') || lower.includes('[seller]')) {
    return { label: 'Seller', className: 'bg-purple-100 text-purple-800 border-purple-300' };
  }
  if (lower.startsWith('customer') || lower.includes('[customer]')) {
    return { label: 'Customer', className: 'bg-blue-100 text-blue-800 border-blue-300' };
  }
  return null;
};

interface AdminHeaderProps {
  onMenuClick: () => void;
  isSidebarOpen: boolean;
}

export default function AdminHeader({ onMenuClick, isSidebarOpen }: AdminHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, token, isAuthenticated } = useAuth();
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResult>({
    orders: [],
    products: [],
    customers: [],
    sellers: [],
    categories: [],
    subcategories: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentAlert, setCurrentAlert] = useState<AlertNotificationData | null>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const isActive = (path: string) => location.pathname.includes(path);
  const isPosOrdersPage = location.pathname.startsWith('/admin/pos/orders');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotificationsDropdown(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchModal(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSearchModal(false);
        setShowNotificationsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!showSearchModal || !searchQuery.trim()) {
      setSearchResults({
        orders: [],
        products: [],
        customers: [],
        sellers: [],
        categories: [],
        subcategories: [],
      });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      adminGlobalSearch(searchQuery.trim())
        .then((data) => {
          setSearchResults(data);
        })
        .catch((err) => {
          console.error('Search fetch error:', err);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, showSearchModal]);

  const handleSelectSearchResult = (path: string) => {
    navigate(path);
    setShowSearchModal(false);
    setSearchQuery('');
  };

  // Fetch admin notifications
  const fetchNotificationsList = async () => {
    if (!isAuthenticated || !token) return;
    try {
      const adminId = user?.userId || user?.id;
      const response = await getNotifications({ limit: 10, recipientType: 'Admin', recipientId: adminId });
      if (response.success && Array.isArray(response.data)) {
        setNotifications(response.data);
        setUnreadCount(response.data.filter(n => !n.isRead).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotificationsList();
  }, [isAuthenticated, token, user?.userId, user?.id]);

  // Socket.io initialization
  useEffect(() => {
    const userRole = user?.role || user?.userType;
    if (!isAuthenticated || !token || !user || (userRole !== 'Admin' && userRole !== 'Super Admin')) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    if (!isRealtimeAvailable()) return;
    const socketUrl = getSocketBaseURL();
    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 3,
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('✅ Admin connected to socket server');
      newSocket.emit('join-admin-room', user.userId || user.id);
    });

    newSocket.on('new-order-alert', (alertData: AlertNotificationData) => {
      console.log('🚨 New Order Alert Received:', alertData);
      setCurrentAlert(alertData);
    });

    newSocket.on('new-notification', async (notification: AdminNotificationData) => {
      console.log('🔔 New dynamic notification received:', notification);
      setNotifications(prev => [notification, ...prev].slice(0, 10));
      setUnreadCount(prev => prev + 1);

      // Show Toast for immediate UI feedback (especially important on mobile)
      toast.success(
        <div>
          <p className="font-bold text-sm">{notification.title}</p>
          <p className="text-xs">{notification.message}</p>
        </div>,
        {
          duration: 5000,
          position: window.innerWidth < 768 ? 'top-center' : 'top-right',
          icon: '🔔',
        }
      );

      // Improved Native Browser Notification for Mobile
      if (window.Notification && window.Notification.permission === "granted") {
        try {
          // On mobile browsers, using service worker registration is much more reliable
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration && registration.showNotification) {
              registration.showNotification(notification.title, {
                body: notification.message,
                icon: '/notification-icon.png',
                tag: 'admin-notification',
                renotify: true
              } as any);
              return;
            }
          }

          // Fallback to basic notification
          new window.Notification(notification.title, {
            body: notification.message,
            icon: '/notification-icon.png'
          });
        } catch (err) {
          console.error('[AdminNotification] Native notification failed:', err);
        }
      }
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Admin disconnected from socket server');
    });

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, token, user?.userId, user?.id, user?.userType, user?.role]);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const handleLogoClick = () => {
    navigate('/admin');
  };

  const { config } = useAppContext();

  return (
    <>
      <AdminNotificationAlert 
        notification={currentAlert}
        onClose={() => setCurrentAlert(null)}
        onActionComplete={() => setCurrentAlert(null)}
      />
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 h-[60px] flex items-center w-full px-4 sm:px-6 premium-header">
        <div className="flex items-center justify-between w-full h-full">
          {/* Logo and Hamburger Menu */}
          <div className="flex items-center gap-3">
            {/* Hamburger Menu Button */}
            <button
              onClick={onMenuClick}
              className="p-1.5 text-neutral-600 hover:text-[#6DBB2D] hover:bg-neutral-50 rounded-lg transition-all duration-150 flex-shrink-0"
              aria-label="Toggle menu"
            >
              {isSidebarOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M4 6H20M4 12H20M4 18H20"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            {/* Ecommerce Logo */}
            <button
              onClick={handleLogoClick}
              className="hover:opacity-90 transition-opacity flex items-center"
            >
              <img
                src={config?.appLogo || "/assets/unnati_logo.png"}
                alt={config?.appName || "Ecommerce"}
                className="h-8 w-auto object-contain cursor-pointer"
                style={{ maxWidth: '160px' }}
              />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="hidden md:flex items-center gap-2 h-full">
            <button
              onClick={() => navigate('/admin/orders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${isActive('/admin/orders') ? 'text-[#6DBB2D] bg-[#6DBB2D]/10' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
            >
              Orders
            </button>
            <button
              onClick={() => navigate('/admin/customers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap ${isActive('/admin/customers') ? 'text-[#6DBB2D] bg-[#6DBB2D]/10' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
            >
              Manage Customer
            </button>
          </div>

        {/* Action Icons */}
        <div className="flex items-center gap-2 md:gap-4 relative">
          {/* Search Button */}
          <div className="relative" ref={searchRef}>
            <button
              onClick={() => {
                setShowSearchModal(!showSearchModal);
                setShowNotificationsDropdown(false);
              }}
              className={`p-2 rounded-lg transition-colors ${
                showSearchModal ? 'text-[#236B34] bg-neutral-100' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
              }`}
              aria-label="Search"
              title="Search"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showSearchModal && (
              <div
                className="absolute right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-neutral-200 p-3.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                style={{ width: '420px', minWidth: '320px', maxWidth: 'calc(100vw - 32px)' }}
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (searchQuery.trim()) {
                      navigate(`/admin/search?q=${encodeURIComponent(searchQuery.trim())}`);
                      setShowSearchModal(false);
                    }
                  }}
                  className="relative flex items-center w-full"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="M21 21L16.65 16.65"></path>
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search orders, customers, products..."
                    className="w-full pl-10 pr-9 py-2 border border-neutral-300 rounded-xl text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#236B34] focus:ring-2 focus:ring-[#236B34]/20 transition-all bg-white"
                    style={{ height: '42px', width: '100%' }}
                    autoFocus
                  />
                  {isSearching ? (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin h-4 w-4 border-2 border-neutral-300 border-t-[#236B34] rounded-full"></div>
                    </div>
                  ) : searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition-colors"
                      title="Clear text"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  ) : null}
                </form>

                {/* Live Results or Quick Suggestions */}
                <div className="mt-3 max-h-[360px] overflow-y-auto divide-y divide-neutral-100 pr-0.5">
                  {!searchQuery.trim() ? (
                    <div className="py-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-1 mb-2">
                        Quick Shortcuts
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {ADMIN_NAV_PAGES.slice(0, 6).map((page, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectSearchResult(page.path)}
                            className="flex items-center gap-2 p-2 rounded-lg text-left text-xs font-medium text-neutral-700 hover:text-[#236B34] hover:bg-neutral-50 border border-transparent hover:border-neutral-200 transition-colors"
                          >
                            <span>{page.icon}</span>
                            <span className="truncate">{page.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 py-1">
                      {/* Matching Navigation Pages */}
                      {ADMIN_NAV_PAGES.filter(
                        (p) =>
                          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchQuery.toLowerCase())
                      ).length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-1 mb-1.5">
                            Pages & Navigation
                          </p>
                          <div className="space-y-1">
                            {ADMIN_NAV_PAGES.filter(
                              (p) =>
                                p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                p.category.toLowerCase().includes(searchQuery.toLowerCase())
                            )
                              .slice(0, 3)
                              .map((page, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleSelectSearchResult(page.path)}
                                  className="w-full flex items-center justify-between p-2 rounded-lg text-left text-xs hover:bg-[#236B34]/5 text-neutral-800 hover:text-[#236B34] transition-colors group"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span>{page.icon}</span>
                                    <span className="font-medium truncate">{page.title}</span>
                                  </div>
                                  <span className="text-[10px] text-neutral-400 group-hover:text-[#236B34]">
                                    {page.category} →
                                  </span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Matching Orders */}
                      {searchResults.orders.length > 0 && (
                        <div className="pt-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-1 mb-1.5 flex items-center justify-between">
                            <span>Orders</span>
                            <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full font-semibold">
                              {searchResults.orders.length}
                            </span>
                          </p>
                          <div className="space-y-1">
                            {searchResults.orders.slice(0, 3).map((ord) => (
                              <button
                                key={ord._id}
                                type="button"
                                onClick={() => handleSelectSearchResult(`/admin/orders/${ord._id}`)}
                                className="w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-neutral-50 transition-colors"
                              >
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-neutral-900">
                                      #{ord.orderNumber}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-700 font-medium">
                                      {ord.status}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-neutral-500 mt-0.5">
                                    {ord.customerName}
                                  </p>
                                </div>
                                <span className="text-xs font-bold text-neutral-900">
                                  ₹{ord.total?.toFixed(2)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Matching Products */}
                      {searchResults.products.length > 0 && (
                        <div className="pt-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-1 mb-1.5 flex items-center justify-between">
                            <span>Products</span>
                            <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full font-semibold">
                              {searchResults.products.length}
                            </span>
                          </p>
                          <div className="space-y-1">
                            {searchResults.products.slice(0, 3).map((prod) => (
                              <button
                                key={prod._id}
                                type="button"
                                onClick={() => handleSelectSearchResult('/admin/product/list')}
                                className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-neutral-50 transition-colors"
                              >
                                <div className="w-8 h-8 rounded bg-neutral-100 flex-shrink-0 overflow-hidden flex items-center justify-center border border-neutral-200">
                                  {prod.image ? (
                                    <img src={prod.image} alt={prod.productName} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-xs">🛍️</span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-neutral-900 truncate">
                                    {prod.productName}
                                  </p>
                                  <p className="text-[10px] text-neutral-400">
                                    ₹{prod.price} • Stock: {prod.stock}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Matching Customers */}
                      {searchResults.customers.length > 0 && (
                        <div className="pt-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-1 mb-1.5 flex items-center justify-between">
                            <span>Customers</span>
                            <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full font-semibold">
                              {searchResults.customers.length}
                            </span>
                          </p>
                          <div className="space-y-1">
                            {searchResults.customers.slice(0, 2).map((cust) => (
                              <button
                                key={cust._id}
                                type="button"
                                onClick={() => handleSelectSearchResult('/admin/customers')}
                                className="w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-neutral-50 transition-colors"
                              >
                                <div>
                                  <p className="text-xs font-semibold text-neutral-900">
                                    {cust.name}
                                  </p>
                                  <p className="text-[11px] text-neutral-500">
                                    {cust.phone} {cust.email ? `• ${cust.email}` : ''}
                                  </p>
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-medium">
                                  Customer
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Matching Sellers */}
                      {searchResults.sellers.length > 0 && (
                        <div className="pt-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-1 mb-1.5 flex items-center justify-between">
                            <span>Sellers</span>
                            <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full font-semibold">
                              {searchResults.sellers.length}
                            </span>
                          </p>
                          <div className="space-y-1">
                            {searchResults.sellers.slice(0, 2).map((sel) => (
                              <button
                                key={sel._id}
                                type="button"
                                onClick={() => handleSelectSearchResult('/admin/manage-seller/list')}
                                className="w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-neutral-50 transition-colors"
                              >
                                <div>
                                  <p className="text-xs font-semibold text-neutral-900">
                                    {sel.storeName}
                                  </p>
                                  <p className="text-[11px] text-neutral-500">
                                    {sel.city ? `${sel.city} • ` : ''}{sel.mobile || sel.email}
                                  </p>
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium border border-amber-200">
                                  Seller
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* No Results Message */}
                      {!isSearching &&
                        searchResults.orders.length === 0 &&
                        searchResults.products.length === 0 &&
                        searchResults.customers.length === 0 &&
                        searchResults.sellers.length === 0 &&
                        searchResults.categories.length === 0 &&
                        ADMIN_NAV_PAGES.filter(
                          (p) =>
                            p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.category.toLowerCase().includes(searchQuery.toLowerCase())
                        ).length === 0 && (
                          <div className="py-6 text-center text-neutral-500 text-xs">
                            <p className="font-medium text-neutral-700">No records found for "{searchQuery}"</p>
                            <p className="mt-1 text-[11px] text-neutral-400">Press Enter to view the full search page.</p>
                          </div>
                        )}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500 px-1">
                  {searchQuery.trim() ? (
                    <button
                      type="button"
                      onClick={() => {
                        navigate(`/admin/search?q=${encodeURIComponent(searchQuery.trim())}`);
                        setShowSearchModal(false);
                      }}
                      className="text-[#236B34] hover:text-[#1B5128] font-semibold text-xs flex items-center gap-1 transition-colors"
                    >
                      <span>View all results for "{searchQuery}"</span>
                      <span>→</span>
                    </button>
                  ) : (
                    <span>
                      Press <kbd className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-[11px] font-mono text-neutral-700 font-medium">Enter ↵</kbd> to search
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowSearchModal(false);
                      setSearchQuery('');
                    }}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors text-xs font-medium ml-auto"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notifications Button */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => {
                const next = !showNotificationsDropdown;
                setShowNotificationsDropdown(next);
                setShowSearchModal(false);
                if (next) {
                  fetchNotificationsList();
                }
              }}
              className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors relative"
              aria-label="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 8A6 6 0 0 0 6 8C6 11.3137 4 14 4 17H20C20 14 18 11.3137 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
              )}
            </button>
            {showNotificationsDropdown && (
              <div 
                className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-neutral-200 py-2 z-50 max-h-96 overflow-y-auto"
                style={{ minWidth: '320px' }}
              >
                <div className="px-4 py-2 border-b border-neutral-200 flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-neutral-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">
                      {unreadCount} NEW
                    </span>
                  )}
                </div>
                {notifications.length > 0 ? (
                  <div className="divide-y divide-neutral-100 max-h-[300px] overflow-y-auto">
                    {notifications.map((notif) => {
                      const roleBadge = getRoleBadge(notif.message);
                      let cleanMsg = notif.message || '';
                      if (roleBadge) {
                        cleanMsg = cleanMsg.replace(/^(delivery partner|seller|customer)[\s:]+/i, '').replace(/^\[(delivery partner|seller|customer)\][\s:]+/i, '');
                      }

                      return (
                        <div
                          key={notif._id}
                          onClick={async () => {
                            if (!notif.isRead && notif._id) {
                              try {
                                await markAsRead(notif._id);
                                setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n));
                                setUnreadCount(prev => Math.max(0, prev - 1));
                              } catch (e) {
                                console.error('Failed to mark notification read', e);
                              }
                            }
                            if (notif.link) navigate(notif.link);
                            setShowNotificationsDropdown(false);
                          }}
                          className={`px-4 py-3 hover:bg-neutral-50 transition-colors cursor-pointer`}
                          style={!notif.isRead ? { backgroundColor: 'var(--primary-alpha-10, rgba(241,135,181,0.1))' } : {}}
                        >
                          <div className="flex gap-3">
                            <div className="w-2 h-2 mt-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: !notif.isRead ? 'var(--primary-color, var(--primary-color))' : '#d4d4d4' }} />
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 justify-between">
                                <p className="text-sm font-semibold text-neutral-900 leading-tight">
                                  {notif.title}
                                </p>
                                {roleBadge && (
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${roleBadge.className}`}>
                                    {roleBadge.label}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-neutral-600 mt-1 line-clamp-2">
                                {cleanMsg}
                              </p>
                              <p className="text-[10px] text-neutral-400 mt-1">
                                {notif.createdAt ? formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true }) : 'Just now'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 px-4 text-center">
                    <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                        <path d="M18 8A6 6 0 0 0 6 8C6 11.3137 4 14 4 17H20C20 14 18 11.3137 18 8Z" />
                        <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" />
                      </svg>
                    </div>
                    <p className="text-sm text-neutral-500">No new notifications</p>
                  </div>
                )}
                <div className="px-4 py-2 border-t border-neutral-200">
                  <button
                    onClick={() => {
                      navigate('/admin/notification');
                      setShowNotificationsDropdown(false);
                    }}
                    className="w-full text-center text-sm font-medium"
                    style={{ color: 'var(--primary-color, var(--primary-color))' }}
                  >
                    View All Notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profile Button */}
          <button
            onClick={() => navigate('/admin/profile')}
            className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors"
            aria-label="Profile"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors"
            aria-label="Logout"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9M16 17L21 12M21 12L16 7M21 12H9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      </header>
    </>
  );
}
