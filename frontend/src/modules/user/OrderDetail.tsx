import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../../components/ui/button";
import { useOrders } from "../../hooks/useOrders";
import { OrderStatus } from "../../types/order";
import GoogleMapsTracking from "../../components/GoogleMapsTracking";
import { useDeliveryTracking } from "../../hooks/useDeliveryTracking";
import DeliveryPartnerCard from "../../components/DeliveryPartnerCard";
import { cancelOrder, updateOrderNotes, getSellerLocationsForOrder, refreshDeliveryOtp, requestReturnOrReplace, retryOrderPayment, verifyOnlinePayment, switchToCod } from "../../services/api/customerOrderService";
import { uploadImage } from "../../services/api/uploadService";
import { useAppContext } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import { getCoupons, Coupon as ApiCoupon } from "../../services/api/customerCouponService";

// Icon Components
const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const Share2Icon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const RefreshCwIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.48L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const PhoneIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const HomeIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const MessageSquareIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const HelpCircleIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
  </svg>
);

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ChefHatIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M6 13h12M6 13c-1.1 0-2-.9-2-2V9c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v2c0 1.1-.9 2-2 2M6 13v5c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-5" />
    <path d="M9 9V7a3 3 0 0 1 6 0v2" />
  </svg>
);

const ReceiptIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="16" y2="11" />
    <line x1="8" y1="15" x2="16" y2="15" />
  </svg>
);

const CircleSlashIcon = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

// Animated checkmark component
const AnimatedCheckmark = ({ delay = 0 }) => (
  <motion.svg
    width="80"
    height="80"
    viewBox="0 0 80 80"
    initial="hidden"
    animate="visible"
    className="mx-auto">
    <motion.circle
      cx="40"
      cy="40"
      r="36"
      fill="none"
      stroke="#22c55e"
      strokeWidth="4"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    />
    <motion.path
      d="M24 40 L35 51 L56 30"
      fill="none"
      stroke="#22c55e"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.4, delay: delay + 0.4, ease: "easeOut" }}
    />
  </motion.svg>
);

// Promotional banner carousel (dynamic from backend coupons)
const PromoCarousel = () => {
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState<ApiCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [appliedCode, setAppliedCode] = useState<string | null>(() => {
    return localStorage.getItem("unnati_preselected_coupon") || null;
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchPromoCoupons = async () => {
    try {
      const response = await getCoupons();
      if (response?.success && Array.isArray(response.data)) {
        setCoupons(response.data);
      }
    } catch (err) {
      console.error("Error loading promo coupons in OrderDetail:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromoCoupons();

    const handleUpdate = () => fetchPromoCoupons();
    window.addEventListener("unnati_deals_updated", handleUpdate);
    window.addEventListener("unnati_content_updated", handleUpdate);
    return () => {
      window.removeEventListener("unnati_deals_updated", handleUpdate);
      window.removeEventListener("unnati_content_updated", handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (coupons.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % coupons.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [coupons.length]);

  if (loading || coupons.length === 0) {
    return null;
  }

  const activeIndex = currentSlide % coupons.length;
  const currentPromo = coupons[activeIndex];
  if (!currentPromo) return null;

  const colorGradients = [
    "from-purple-50 to-pink-50",
    "from-blue-50 to-indigo-50",
    "from-orange-50 to-red-50",
    "from-teal-50 to-cyan-50",
    "from-emerald-50 to-teal-50",
  ];
  const colorClass = colorGradients[activeIndex % colorGradients.length];

  const handleApply = (coupon: ApiCoupon) => {
    try {
      const code = coupon.code.toUpperCase();
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(code).catch(() => {});
      }
      localStorage.setItem("unnati_preselected_coupon", code);
      setAppliedCode(code);
      setToastMessage(`Coupon "${code}" applied for your next order!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error("Failed to apply coupon:", err);
    }
  };

  const isApplied =
    appliedCode?.toUpperCase() === currentPromo.code.toUpperCase() ||
    localStorage.getItem("unnati_preselected_coupon")?.toUpperCase() === currentPromo.code.toUpperCase();

  const minOrder = currentPromo.minimumPurchase ?? currentPromo.minOrderValue;
  const subtext =
    currentPromo.description ||
    (minOrder && minOrder > 0
      ? `Valid on orders above ₹${minOrder}`
      : "On all orders | No minimum order value");

  const offerTitle =
    currentPromo.title ||
    (String(currentPromo.discountType).toLowerCase() === "percentage"
      ? `${currentPromo.discountValue}% OFF`
      : `Flat ₹${currentPromo.discountValue} off`);

  return (
    <motion.div
      className="bg-white rounded-xl p-4 shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}>
      <div className="overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPromo._id || currentPromo.code}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className={`flex items-center gap-4 p-3.5 rounded-xl bg-gradient-to-r ${colorClass} border border-neutral-100`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xs font-bold bg-blue-900 text-white px-2.5 py-0.5 rounded-md uppercase tracking-wider shadow-xs">
                  {currentPromo.code}
                </span>
                {minOrder && minOrder > 0 ? (
                  <span className="text-[10px] font-semibold text-neutral-500 bg-white/80 px-2 py-0.5 rounded">
                    Min ₹{minOrder}
                  </span>
                ) : null}
              </div>
              <p className="font-bold text-gray-900 text-base leading-snug">
                {offerTitle}
              </p>
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                {subtext}
              </p>
              <button
                type="button"
                onClick={() => handleApply(currentPromo)}
                className={`font-semibold text-sm mt-2.5 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-95 ${
                  isApplied
                    ? "text-emerald-700 bg-emerald-100/90 border border-emerald-300 px-3 py-1 rounded-full shadow-xs"
                    : "text-[var(--customer-primary-dark)] hover:underline"
                }`}
              >
                {isApplied ? (
                  <>
                    <CheckIcon className="w-4 h-4 text-emerald-600" />
                    Applied
                  </>
                ) : (
                  <>
                    Apply now <ChevronRightIcon className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            <div className="w-16 h-16 shrink-0 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-md">
              <span className="text-2xl select-none">💳</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {toastMessage && (
        <div className="mt-2.5 px-3 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between animate-in fade-in duration-200 shadow-xs">
          <span className="flex items-center gap-1.5">
            <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            {toastMessage}
          </span>
          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="text-emerald-700 font-bold underline hover:text-emerald-800 ml-2 shrink-0 cursor-pointer"
          >
            Go to Cart
          </button>
        </div>
      )}

      {/* Dots indicator */}
      {coupons.length > 1 && (
        <div className="flex justify-center gap-2 mt-3">
          {coupons.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                index === activeIndex
                  ? "bg-[var(--customer-primary-dark)] w-5"
                  : "bg-gray-300 w-2 hover:bg-gray-400"
              }`}
              aria-label={`Slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};

// Tip selection component
const TipSection = () => {
  const [selectedTip, setSelectedTip] = useState<number | "other" | null>(null);
  const [customTip, setCustomTip] = useState("");
  const tips = [20, 30, 50];

  return (
    <motion.div
      className="bg-white rounded-xl p-4 shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}>
      <p className="text-gray-700 text-sm mb-3">
        Make their day by leaving a tip. 100% of the amount will go to them
        after delivery
      </p>
      <div className="flex gap-3">
        {tips.map((tip) => (
          <motion.button
            key={tip}
            onClick={() => {
              setSelectedTip(tip);
              setCustomTip("");
            }}
            className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
              selectedTip === tip
                ? "border-[var(--customer-primary-dark)] bg-[var(--customer-primary-alpha-10)] text-[var(--customer-primary-dark)]"
                : "border-gray-200 text-gray-700 hover:border-gray-300"
            }`}
            whileTap={{ scale: 0.95 }}>
            ₹{tip}
          </motion.button>
        ))}
        <motion.button
          onClick={() => {
            setSelectedTip("other");
          }}
          className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
            selectedTip === "other"
              ? "border-[var(--customer-primary-dark)] bg-[var(--customer-primary-alpha-10)] text-[var(--customer-primary-dark)]"
              : "border-gray-200 text-gray-700 hover:border-gray-300"
          }`}
          whileTap={{ scale: 0.95 }}>
          Other
        </motion.button>
      </div>

      <AnimatePresence>
        {selectedTip === "other" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <input
              type="number"
              placeholder="Enter custom amount"
              value={customTip}
              onChange={(e) => setCustomTip(e.target.value)}
              className="mt-3 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--customer-primary)]"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Section item component
const SectionItem = ({
  icon: Icon,
  title,
  subtitle,
  onClick,
  showArrow = true,
  rightContent,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  showArrow?: boolean;
  rightContent?: React.ReactNode;
}) => (
  <motion.button
    onClick={onClick}
    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left border-b border-dashed border-gray-200 last:border-0"
    whileTap={{ scale: 0.99 }}>
    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5 text-gray-600" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-gray-900 truncate">{title}</p>
      {subtitle && <p className="text-sm text-gray-500 truncate">{subtitle}</p>}
    </div>
    {rightContent ||
      (showArrow && <ChevronRightIcon className="w-5 h-5 text-gray-400" />)}
  </motion.button>
);

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const confirmed = searchParams.get("confirmed") === "true";
  const { getOrderById, fetchOrderById, updateOrderStatus, refreshOrders, loading: contextLoading } = useOrders();
  const { config } = useAppContext();
  const [order, setOrder] = useState<any>(id ? getOrderById(id) : undefined);
  const [loading, setLoading] = useState(!order);

  const [showConfirmation, setShowConfirmation] = useState(confirmed);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(
    order?.status || "Placed"
  );
  const [estimatedTime, setEstimatedTime] = useState(29);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
    durationValue: number;
    distanceValue: number;
  } | null>(null);
  const { showToast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isSwitchingCod, setIsSwitchingCod] = useState(false);

  // Modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [showSpecialRequestsModal, setShowSpecialRequestsModal] =
    useState(false);

  // Form states
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");

  // Return/Replace states
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [returnReason, setReturnReason] = useState("Damaged");
  const [replaceReason, setReplaceReason] = useState("Damaged");
  const [requestComment, setRequestComment] = useState("");
  const [replaceImage, setReplaceImage] = useState<File | null>(null);
  const [returnRequestStatus, setReturnRequestStatus] = useState<string | null>(null);
  const [replaceRequestStatus, setReplaceRequestStatus] = useState<string | null>(null);

  // Real-time delivery tracking via WebSocket
  const {
    deliveryLocation,
    eta,
    distance,
    isConnected,
    lastUpdate,
    error: trackingError,
    reconnectAttempts,
    reconnect,
  } = useDeliveryTracking(id, {
    onStatusUpdate: (newStatus) => {
      setOrderStatus(newStatus as OrderStatus);
      setOrder((prev: any) => (prev ? { ...prev, status: newStatus } : prev));
    },
    onOtpUpdate: ({ deliveryOtp, expiresAt }) => {
      setOrder((prev: any) =>
        prev ? { ...prev, deliveryOtp, deliveryOtpExpiresAt: expiresAt } : prev
      );
    },
    onPartnerAccepted: (partner) => {
      setOrder((prev: any) =>
        prev
          ? {
              ...prev,
              deliveryPartner: partner,
              deliveryBoy: partner?._id || partner?.id || prev?.deliveryBoy,
            }
          : prev
      );
    },
  });

  // Seller locations for the order
  const [sellerLocations, setSellerLocations] = useState<any[]>([]);
  const [loadingSellerLocations, setLoadingSellerLocations] = useState(false);

  // Fetch order if not in context
  useEffect(() => {
    const loadOrder = async () => {
      if (!id) return;

      // Show the cached copy immediately, but always load the latest (status, delivery OTP)
      const existingOrder = getOrderById(id);
      if (existingOrder) {
        setOrder(existingOrder);
        setOrderStatus(existingOrder.status);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const fetchedOrder = await fetchOrderById(id);
      if (fetchedOrder) {
        setOrder(fetchedOrder);
        setOrderStatus(fetchedOrder.status);
      }
      setLoading(false);
    };

    loadOrder();
  }, [id, getOrderById, fetchOrderById]);

  // Keep an active order fresh so new status and the delivery OTP appear without a manual refresh
  const fetchOrderByIdRef = useRef(fetchOrderById);
  fetchOrderByIdRef.current = fetchOrderById;
  useEffect(() => {
    if (!id || !order?.status) return;
    if (['Delivered', 'Cancelled', 'Rejected', 'Returned'].includes(order.status)) return;
    const timer = setInterval(async () => {
      const latest = await fetchOrderByIdRef.current(id);
      if (latest) {
        setOrder(latest);
        setOrderStatus(latest.status);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [id, order?.status]);

  // Fetch seller locations when order is loaded
  useEffect(() => {
    const fetchSellerLocations = async () => {
      if (!id || !order) return;

      // Only fetch if order has delivery boy assigned and status is before "Picked up" or "Out for Delivery"
      const shouldFetch = order.status &&
        order.status !== 'Delivered' &&
        order.status !== 'Cancelled' &&
        order.status !== 'Picked up' &&
        order.status !== 'Out for Delivery';

      if (shouldFetch) {
        try {
          setLoadingSellerLocations(true);
          const response = await getSellerLocationsForOrder(id);
          if (response.success && response.data) {
            setSellerLocations(response.data || []);
          }
        } catch (err) {
          console.error('Failed to fetch seller locations:', err);
        } finally {
          setLoadingSellerLocations(false);
        }
      }
    };

    fetchSellerLocations();
  }, [id, order?.status]);

  // Update orderStatus when order state changes
  useEffect(() => {
    if (order) {
      setOrderStatus(order.status);
    }
  }, [order]);

  // Simulate order status progression
  useEffect(() => {
    if (confirmed && order) {
      const timer1 = setTimeout(() => {
        setShowConfirmation(false);
        setOrderStatus("Accepted");
      }, 3000);
      return () => clearTimeout(timer1);
    }
  }, [confirmed, order]);

  // Countdown timer
  useEffect(() => {
    if (orderStatus === "Accepted" || orderStatus === "On the way") {
      const timer = setInterval(() => {
        setEstimatedTime((prev) => Math.max(0, prev - 1));
      }, 60000);
      return () => clearInterval(timer);
    }
  }, [orderStatus]);

  // Handler functions
  const handleRefresh = async () => {
    if (!id) return;
    setIsRefreshing(true);
    const fetchedOrder = await fetchOrderById(id);
    if (fetchedOrder) {
      setOrder(fetchedOrder);
      setOrderStatus(fetchedOrder.status);
    }
    // Add a small delay for the animation
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const loadScript = (src: string) => {
    return new Promise<boolean>((resolve) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayNow = async () => {
    if (!id || isProcessingPayment) return;
    setIsProcessingPayment(true);

    try {
      const res = await retryOrderPayment(id);
      if (!res.success) {
        showToast(res.message || "Unable to initiate payment", "error");
        setIsProcessingPayment(false);
        return;
      }

      if (res.alreadyPaid) {
        showToast("Order is already paid!", "success");
        const refreshed = await fetchOrderById(id);
        if (refreshed) {
          setOrder(refreshed);
          setOrderStatus(refreshed.status);
        }
        setIsProcessingPayment(false);
        return;
      }

      const { gateway, orderId, amount, key, razorpayOrderId, customer, paymentSessionId, isSandbox } = res.data || {};

      if (gateway === 'Razorpay') {
        const loaded = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
        if (!loaded) {
          showToast("Razorpay SDK failed to load. Please check your internet connection.", "error");
          setIsProcessingPayment(false);
          return;
        }

        const options = {
          key: key,
          amount: Math.round((amount || order?.totalAmount || 0) * 100),
          currency: "INR",
          name: "Unnati",
          description: "Order Payment",
          order_id: razorpayOrderId,
          handler: async function (response: any) {
            try {
              const verifyRes = await verifyOnlinePayment({
                orderId: orderId || id,
                paymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              });
              if (verifyRes.success) {
                showToast("Payment successful! Your order is confirmed.", "success");
                const refreshed = await fetchOrderById(id);
                if (refreshed) {
                  setOrder(refreshed);
                  setOrderStatus(refreshed.status);
                }
              } else {
                showToast(verifyRes.message || "Payment verification failed", "error");
              }
            } catch (err: any) {
              showToast(err?.response?.data?.message || err.message || "Payment verification error", "error");
            } finally {
              setIsProcessingPayment(false);
            }
          },
          prefill: {
            name: customer?.name || order?.customerName || "",
            email: customer?.email || order?.customerEmail || "",
            contact: customer?.contact || order?.customerPhone || ""
          },
          theme: {
            color: "#16a34a"
          },
          modal: {
            ondismiss: function () {
              setIsProcessingPayment(false);
            }
          }
        };

        const rzp1 = new (window as any).Razorpay(options);
        rzp1.on('payment.failed', function (response: any) {
          console.error('Razorpay Payment Failed:', response.error);
          showToast(response.error?.description || 'Payment failed. Please try again.', 'error');
          setIsProcessingPayment(false);
        });
        rzp1.open();
      } else if (gateway === 'Cashfree') {
        const loaded = await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js");
        if (!loaded) {
          showToast("Cashfree SDK failed to load", "error");
          setIsProcessingPayment(false);
          return;
        }
        const cashfree = new (window as any).Cashfree({
          mode: isSandbox ? "sandbox" : "production"
        });
        cashfree.checkout({
          paymentSessionId: paymentSessionId,
          redirectTarget: "_modal"
        }).then(async () => {
          const refreshed = await fetchOrderById(id);
          if (refreshed) {
            setOrder(refreshed);
            setOrderStatus(refreshed.status);
          }
          setIsProcessingPayment(false);
        });
      }
    } catch (err: any) {
      console.error("Pay now error:", err);
      showToast(err?.response?.data?.message || err.message || "Failed to process payment", "error");
      setIsProcessingPayment(false);
    }
  };

  const handleSwitchToCod = async () => {
    if (!id || isSwitchingCod) return;
    setIsSwitchingCod(true);
    try {
      const res = await switchToCod(id);
      if (res.success) {
        showToast("Switched to Cash on Delivery! Order is now placed.", "success");
        const refreshed = await fetchOrderById(id);
        if (refreshed) {
          setOrder(refreshed);
          setOrderStatus(refreshed.status);
        }
      } else {
        showToast(res.message || "Failed to switch to Cash on Delivery", "error");
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || err.message || "Error switching payment method", "error");
    } finally {
      setIsSwitchingCod(false);
    }
  };

  const handleRefreshOtp = async () => {
    if (!id || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshDeliveryOtp(id);
      // Re-fetch order to get updated OTP and expiry
      const fetchedOrder = await fetchOrderById(id);
      if (fetchedOrder) {
        setOrder(fetchedOrder);
        setOrderStatus(fetchedOrder.status);
      }
    } catch (error) {
      console.error("Failed to refresh OTP:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Order #${(order?.orderNumber || order?.id?.split("-").slice(-1)[0])}`,
      text: `Track my ${config?.appName || ""} order: Order #${
        (order?.orderNumber || order?.id?.split("-").slice(-1)[0])
      }`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy link to clipboard
        await navigator.clipboard.writeText(window.location.href);
        alert("Link copied to clipboard!");
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleCallStore = () => {
    const storeNumber = order?.items?.[0]?.seller?.phone || order?.seller?.phone || "1234567890";
    window.location.href = `tel:${storeNumber}`;
  };

  const handleCancelOrder = async () => {
    if (!cancellationReason.trim()) {
      alert("Please provide a cancellation reason");
      return;
    }

    if (!id) return;

    try {
      await cancelOrder(id, cancellationReason);
      setOrderStatus("Cancelled" as any);
      updateOrderStatus(id, "Cancelled" as any);
      await refreshOrders();
      setShowCancelModal(false);
      alert("Order cancelled successfully");
      // Refresh order to get updated status
      handleRefresh();
    } catch (error: any) {
      console.error("Error cancelling order:", error);
      const msg = error.response?.data?.message || error.message || "Failed to cancel order";
      alert(msg);
      setShowCancelModal(false);
      handleRefresh();
    }
  };

  const handleSaveInstructions = async () => {
    try {
      if (!id) return;
      await updateOrderNotes(id, { deliveryInstructions });
      setShowInstructionsModal(false);
      // alert("Delivery instructions saved!");
      handleRefresh();
    } catch (error) {
      console.error("Failed to save instructions:", error);
      alert("Failed to save instructions");
    }
  };

  const handleSaveSpecialRequests = async () => {
    try {
      if (!id) return;
      await updateOrderNotes(id, { specialRequests });
      setShowSpecialRequestsModal(false);
      // alert("Special requests saved!");
      handleRefresh();
    } catch (error) {
      console.error("Failed to save special requests:", error);
      alert("Failed to save special requests");
    }
  };

  const handleReturnSubmit = async () => {
    if (!selectedOrderItemId) {
      alert("Please select a product");
      return;
    }

    try {
      setLoading(true);
      const data = {
        orderId: id!,
        orderItemId: selectedOrderItemId,
        requestType: "Return" as const,
        reason: returnReason,
        description: requestComment,
        quantity: selectedQuantity
      };

      const response = await requestReturnOrReplace(data);
      if (response.success) {
        setReturnRequestStatus("Pending");
        setShowReturnModal(false);
        alert("Return request submitted successfully. Admin will review it.");
        handleRefresh();
      }
    } catch (error: any) {
      console.error("Return request failed:", error);
      alert(error.message || "Failed to submit return request");
    } finally {
      setLoading(false);
    }
  };

  const handleReplaceSubmit = async () => {
    if (!selectedOrderItemId) {
      alert("Please select a product");
      return;
    }

    if (!replaceImage) {
      alert("Please upload an image for replacement request");
      return;
    }

    try {
      setLoading(true);

      // Upload image first
      const uploadResult = await uploadImage(replaceImage, "returns");

      const data = {
        orderId: id!,
        orderItemId: selectedOrderItemId,
        requestType: "Replacement" as const,
        reason: replaceReason,
        description: requestComment,
        images: [uploadResult.url],
        quantity: selectedQuantity
      };

      const response = await requestReturnOrReplace(data);
      if (response.success) {
        setReplaceRequestStatus("Pending");
        setShowReplaceModal(false);
        alert("Replacement request submitted successfully. Admin will review it.");
        handleRefresh();
      }
    } catch (error: any) {
      console.error("Replacement request failed:", error);
      alert(error.message || "Failed to submit replacement request");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-[var(--brand-cream,#FDF9F2)] text-[var(--brand-ink,#1C2B20)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-green,#236B34)]"></div>
          <p className="text-sm text-[var(--brand-ink-muted,#5B6B60)]">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[var(--brand-cream,#FDF9F2)] text-[var(--brand-ink,#1C2B20)] p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <h1 className="text-lg sm:text-xl md:text-2xl font-display font-bold mb-4 text-[var(--brand-green-deep,#14401F)]">
            Order Not Found
          </h1>
          <Link to="/orders">
            <Button>Back to Orders</Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig: Record<
    string,
    { title: string; subtitle: string; color: string }
  > = {
    Placed: {
      title: "Order placed",
      subtitle: "Order will reach you shortly",
      color: "bg-[var(--brand-green,#236B34)]",
    },
    Accepted: {
      title: "Preparing your order",
      subtitle: `Arriving in ${estimatedTime} mins`,
      color: "bg-[var(--brand-green,#236B34)]",
    },
    "On the way": {
      title: "Order picked up",
      subtitle: `Arriving in ${estimatedTime} mins`,
      color: "bg-[var(--brand-green,#236B34)]",
    },
    Delivered: {
      title: "Order delivered",
      subtitle: "Enjoy your items!",
      color: "bg-[var(--brand-green-deep,#14401F)]",
    },
    // Backend status mappings
    Received: {
      title: "Order placed",
      subtitle: "Processing your order",
      color: "bg-[var(--brand-green,#236B34)]",
    },
    Pending: {
      title: "Order pending",
      subtitle: "Waiting for confirmation",
      color: "bg-[var(--brand-amber,#FFB020)]",
    },
    Processed: {
      title: "Order processed",
      subtitle: "Preparing for delivery",
      color: "bg-[var(--brand-green,#236B34)]",
    },
    Shipped: {
      title: "Order shipped",
      subtitle: "On the way to you",
      color: "bg-[var(--brand-green-deep,#14401F)]",
    },
    "Out for Delivery": {
      title: "Out for delivery",
      subtitle: `Arriving in ${estimatedTime} mins`,
      color: "bg-[var(--brand-green,#236B34)]",
    },
    Cancelled: {
      title: "Order cancelled",
      subtitle: "This order has been cancelled",
      color: "bg-[var(--brand-error,#D6402F)]",
    },
    Returned: {
      title: "Order returned",
      subtitle: "This order has been returned",
      color: "bg-[var(--brand-ink-muted,#5B6B60)]",
    },
  };

  const currentStatus = statusConfig[orderStatus] || statusConfig["Received"];

  return (
    <div className="min-h-screen bg-[var(--brand-cream,#FDF9F2)] text-[var(--brand-ink,#1C2B20)]">
      {/* Order Confirmed Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="text-center px-8">
              <AnimatedCheckmark delay={0.3} />
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="text-2xl font-bold text-gray-900 mt-6">
                Order Confirmed!
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="text-gray-600 mt-2">
                Your order has been placed successfully
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="mt-8">
                <div className="w-8 h-8 border-2 border-[var(--customer-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-3">
                  Loading order details...
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Green Header */}
      <motion.div
        className={`${currentStatus.color} text-white sticky top-0 z-40`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}>
        {/* Navigation bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/orders">
            <motion.button
              className="w-10 h-10 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}>
              <ArrowLeftIcon className="w-6 h-6" />
            </motion.button>
          </Link>
          <h2 className="font-semibold text-lg">{config?.appName || "Order details"}</h2>
          <motion.button
            className="w-10 h-10 flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
            onClick={handleShare}>
            <Share2Icon className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Status section */}
        <div className="px-4 pb-4 text-center">
          <motion.h1
            className="text-2xl font-bold mb-3"
            key={currentStatus.title}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}>
            {currentStatus.title}
          </motion.h1>

          {/* Status pill */}
          <motion.div
            className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}>
            <span className="text-sm">{currentStatus.subtitle}</span>
            {(orderStatus === "Accepted" || orderStatus === "On the way") && (
              <>
                <span className="w-1 h-1 rounded-full bg-white" />
                <span className="text-sm text-green-200">On time</span>
              </>
            )}
            <motion.button
              onClick={handleRefresh}
              className="ml-1"
              animate={{ rotate: isRefreshing ? 360 : 0 }}
              transition={{ duration: 0.5 }}>
              <RefreshCwIcon className="w-4 h-4" />
            </motion.button>
          </motion.div>
        </div>
      </motion.div>

      {/* Map Section */}
      {!showConfirmation && (() => {
        // 0/missing means this address was never geocoded — never fall back to a real city's
        // coordinates (e.g. New Delhi); just don't claim a location we don't actually have.
        const custLat = order?.deliveryAddress?.latitude || order?.address?.latitude || 0;
        const custLng = order?.deliveryAddress?.longitude || order?.address?.longitude || 0;
        const hasCustomerCoords = !!custLat && !!custLng;
        return (
        <GoogleMapsTracking
          sellerLocations={sellerLocations.map(s => ({
            lat: s.latitude,
            lng: s.longitude,
            name: s.storeName
          }))}
          customerLocation={{ lat: custLat, lng: custLng }}
          deliveryLocation={deliveryLocation || undefined}
          isTracking={isConnected && !!deliveryLocation}
          showRoute={
            isConnected &&
            !!deliveryLocation &&
            hasCustomerCoords &&
            order?.status !== 'Delivered' &&
            order?.status !== 'Cancelled' &&
            order?.status !== 'Returned'
          }
          routeOrigin={deliveryLocation || undefined}
          routeDestination={hasCustomerCoords ? { lat: custLat, lng: custLng } : undefined}
          routeWaypoints={
            order?.status === 'Picked up' || order?.status === 'Out for Delivery'
              ? []
              : sellerLocations.map(s => ({
                  lat: s.latitude,
                  lng: s.longitude,
                }))
          }
          destinationName={
            order?.status === 'Picked up' || order?.status === 'Out for Delivery'
              ? order?.deliveryAddress?.address?.split(',')[0] || order?.address?.split(',')[0] || "Delivery Address"
              : sellerLocations.length > 0
              ? "Sellers & Delivery Address"
              : "Delivery Address"
          }
          onRouteInfoUpdate={setRouteInfo}
          lastUpdate={lastUpdate}
        />
        );
      })()}

      {/* Tracking Error Display */}
      {trackingError && (
        <div className="mx-4 mt-2 px-4 py-2 bg-[var(--customer-primary-alpha-10)] text-red-700 text-xs rounded-lg border border-[var(--customer-primary-alpha-20)] flex items-center gap-2">
          <span>⚠️</span>
          <span>{trackingError}</span>
        </div>
      )}

      {/* Delivery Partner Card */}
      {/* Show while live tracking runs, and always once the delivery OTP exists or order is Out for Delivery */}
      {((isConnected && deliveryLocation) ||
        (order?.deliveryOtp && ['Picked up', 'Out for Delivery'].includes(order?.status)) ||
        (order?.status === 'Out for Delivery')) && (
        <DeliveryPartnerCard
          partner={{
            name: order?.deliveryPartner?.name || "Delivery Partner",
            phone: order?.deliveryPartner?.phone,
            profileImage: order?.deliveryPartner?.profileImage,
            vehicleNumber: order?.deliveryPartner?.vehicleNumber,
          }}
          eta={distance > 0 ? eta : (routeInfo?.durationValue ? Math.ceil(routeInfo.durationValue / 60) : eta)}
          distance={distance > 0 ? distance : (routeInfo?.distanceValue ?? distance)}
          isTracking={!!(isConnected && deliveryLocation)}
          deliveryOtp={order?.deliveryOtp}
          otpExpiryTime={order?.deliveryOtpExpiresAt}
          onRefreshOtp={handleRefreshOtp}
          onCall={() => {
            const phone = order?.deliveryPartner?.phone;
            if (phone) window.location.href = `tel:${phone}`;
          }}
        />
      )}

      {/* Scrollable Content */}
      <div className="px-4 py-4 space-y-4 pb-24">
        {/* Payment Pending - Only show if payment is NOT completed */}
        {order?.paymentStatus !== 'Paid' && order?.paymentStatus !== 'COMPLETED' && order?.paymentStatus !== 'Success' && (
          <motion.div
            className="bg-white rounded-xl p-4 shadow-sm border border-amber-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                  Payment of ₹{order.totalAmount?.toFixed(2) || "0.00"} pending
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Pay now to confirm your order, or choose Pay on Delivery.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {order?.paymentMethod !== 'Cash on Delivery' && order?.status === 'Pending' && (
                  <Button
                    onClick={handleSwitchToCod}
                    disabled={isSwitchingCod || isProcessingPayment}
                    className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs sm:text-sm rounded-full px-4 py-2 font-medium"
                  >
                    {isSwitchingCod ? "Switching..." : "Pay on Delivery"}
                  </Button>
                )}
                <Button
                  onClick={handlePayNow}
                  disabled={isProcessingPayment || isSwitchingCod}
                  className="bg-gray-900 hover:bg-gray-800 text-white rounded-full px-6 py-2 text-sm font-semibold flex items-center justify-center min-w-[120px]"
                >
                  {isProcessingPayment ? "Processing..." : (
                    <>
                      Pay now <ChevronRightIcon className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Promo Carousel */}
        <PromoCarousel />

        {/* Delivery Partner Assignment - Only show if no partner assigned yet */}
        {!order?.deliveryPartner && (
          <motion.div
            className="bg-white rounded-xl p-4 shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[var(--customer-primary-alpha-20)] flex items-center justify-center">
                <span className="text-2xl">👨‍🍳</span>
              </div>
              <p className="font-semibold text-gray-900">
                {order?.status === 'Placed' || order?.status === 'Accepted'
                  ? "Assigning delivery partner shortly"
                  : "Preparing your order"}
              </p>
            </div>
          </motion.div>
        )}

        {/* Tip Section */}
        <TipSection />

        {/* Delivery Partner Safety */}
        <motion.button
          className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileTap={{ scale: 0.99 }}>
          <ShieldIcon className="w-6 h-6 text-gray-600" />
          <span className="flex-1 text-left font-medium text-gray-900">
            Learn about delivery partner safety
          </span>
          <ChevronRightIcon className="w-5 h-5 text-gray-400" />
        </motion.button>

        {/* Delivery Details Banner */}
        <motion.div
          className="bg-yellow-50 rounded-xl p-4 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}>
          <p className="text-yellow-800 font-medium">
            All your delivery details in one place 👇
          </p>
        </motion.div>

        {/* Contact & Address Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}>
          <SectionItem
            icon={PhoneIcon}
            title={`${order.address?.name || "Customer"}, ${
              order.address?.phone || "9XXXXXXXX"
            }`}
            subtitle="Delivery partner may call this number"
          />
          <SectionItem
            icon={HomeIcon}
            title="Delivery at Home"
            subtitle={
              order.address
                ? `${order.address.address}, ${order.address.city}`
                : "Add delivery address"
            }
          />
          <SectionItem
            icon={MessageSquareIcon}
            title="Add delivery instructions"
            subtitle=""
            onClick={() => setShowInstructionsModal(true)}
          />
        </motion.div>

        {/* Store Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}>
          <div className="flex items-center gap-3 p-4 border-b border-dashed border-gray-200">
            <div className="w-12 h-12 rounded-full bg-[var(--customer-primary-alpha-20)] overflow-hidden flex items-center justify-center">
              <span className="text-2xl">🛒</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">
                {order.items?.[0]?.seller?.storeName || (order as any).storeName || order.seller?.storeName || "Unnati Store"}
              </p>
              <p className="text-sm text-gray-500">
                {order.items?.[0]?.seller?.city || order.seller?.city || order.address?.city || "Local Area"}
              </p>
            </div>
            <motion.button
              className="w-10 h-10 rounded-full bg-[var(--customer-primary-alpha-20)] flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
              onClick={handleCallStore}>
              <PhoneIcon className="w-5 h-5 text-[var(--customer-primary-dark)]" />
            </motion.button>
          </div>

          {/* Order Items */}
          <div
            className="p-4 border-b border-dashed border-gray-200"
            onClick={() => setShowItemsModal(true)}
            style={{ cursor: "pointer" }}>
            <div className="flex items-start gap-3">
              <ReceiptIcon className="w-5 h-5 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  Order #{order.orderNumber || order.id.split("-").slice(-1)[0]}
                </p>
                <div className="mt-2 space-y-1">
                  {order.items?.map((item: any, index: number) => {
                    const isFree = (item.total === 0 && item.quantity > 0) || item.unitPrice === 0 || item.price === 0;
                    return (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-4 h-4 rounded border border-[var(--customer-primary-dark)] flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-[var(--customer-primary-dark)]" />
                      </span>
                      <span>
                        {item.quantity} x{" "}
                        {item.product?.name || item.productName || "Product"}
                        {isFree && <span className="text-[var(--customer-primary-dark)] font-bold ml-1 text-xs">(Free Gift)</span>}
                      </span>
                    </div>
                    );
                  })}
                </div>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          <SectionItem
            icon={ChefHatIcon}
            title="Add special requests"
            subtitle=""
            onClick={() => setShowSpecialRequestsModal(true)}
          />
        </motion.div>

        {/* Help Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}>
          <div
            className="flex items-center gap-3 p-4 border-b border-dashed border-gray-200"
            onClick={() => window.open('/help', '_blank')}
            style={{ cursor: "pointer" }}>
            <div className="w-10 h-10 rounded-full bg-[var(--customer-primary-alpha-20)] flex items-center justify-center">
              <HelpCircleIcon className="w-5 h-5 text-[var(--customer-primary-dark)]" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">
                Need help with your order?
              </p>
              <p className="text-sm text-gray-500">Get help & support</p>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
          </div>
          <SectionItem
            icon={CircleSlashIcon}
            title="Cancel order"
            subtitle=""
            onClick={() => setShowCancelModal(true)}
          />
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          className="flex gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}>
          {order?.invoiceEnabled ? (
            <Link to={`/orders/${id}/invoice`} className="flex-1">
              <Button className="w-full bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] text-white shadow-sm">
                View Invoice
              </Button>
            </Link>
          ) : (
            <div className="flex-1">
              <Button
                className="w-full bg-[var(--brand-ink-muted,#5B6B60)]/40 cursor-not-allowed text-white"
                disabled
                title="Invoice will be available after delivery is completed">
                Invoice Unavailable
              </Button>
            </div>
          )}
          <Link to="/orders" className="flex-1">
            <Button variant="outline" className="w-full border-[var(--brand-border,#E9E2D3)]">
              All Orders
            </Button>
          </Link>
        </motion.div>

        {/* Return/Replace Buttons */}
        {order?.status === "Delivered" && (
          <motion.div
              className="flex gap-3 mt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}>
              <Button
              onClick={() => setShowReturnModal(true)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 border-2 border-transparent"
              >
                  Request Return
              </Button>
              <Button
              onClick={() => setShowReplaceModal(true)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 border-2 border-transparent"
              >
                  Request Replacement
              </Button>
          </motion.div>
        )}

        {/* Status Display */}
        {(returnRequestStatus || replaceRequestStatus) && (
            <div className="bg-[var(--customer-primary-alpha-10)] p-4 rounded-xl mt-4 border border-blue-100">
                {returnRequestStatus && (
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-700 font-medium">Return Request:</span>
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-bold uppercase">{returnRequestStatus}</span>
                    </div>
                )}
                 {replaceRequestStatus && (
                    <div className="flex justify-between items-center">
                        <span className="text-gray-700 font-medium">Measurement Request:</span>
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-bold uppercase">{replaceRequestStatus}</span>
                    </div>
                )}
                 <p className="text-xs text-gray-500 mt-2">⏳ Request under review</p>
            </div>
        )}
      </div>

      {/* Return Request Modal */}
       <AnimatePresence>
        {showReturnModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowReturnModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Request Return
              </h2>

               <div className="mb-4">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Select Product</label>
                 <select
                    className="w-full border rounded-lg p-2"
                    value={selectedOrderItemId}
                    onChange={(e) => {
                      setSelectedOrderItemId(e.target.value);
                      const item = order?.items?.find((it: any) => it._id === e.target.value);
                      if (item) setSelectedQuantity(item.quantity);
                    }}
                 >
                     <option value="">Select a product...</option>
                     {order?.items?.map((item: any) => (
                         <option key={item._id} value={item._id}>{item.product?.name || item.productName} (Qty: {item.quantity})</option>
                     ))}
                 </select>
               </div>

               {selectedOrderItemId && (
                 <div className="mb-4">
                   <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Return</label>
                   <input
                     type="number"
                     min="1"
                     max={order?.items?.find((it: any) => it._id === selectedOrderItemId)?.quantity || 1}
                     className="w-full border rounded-lg p-2"
                     value={selectedQuantity}
                     onChange={(e) => setSelectedQuantity(parseInt(e.target.value))}
                   />
                 </div>
               )}

                <div className="mb-4">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                 <select
                    className="w-full border rounded-lg p-2"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                 >
                     <option value="Damaged">Damaged Product</option>
                     <option value="Wrong Item">Wrong Item Received</option>
                     <option value="Quality Issue">Quality Issue</option>
                     <option value="Other">Other</option>
                 </select>
               </div>

               <div className="mb-4">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                 <textarea
                   className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[var(--customer-primary)]"
                   rows={3}
                   placeholder="Additional details..."
                   value={requestComment}
                   onChange={(e) => setRequestComment(e.target.value)}
                 />
               </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowReturnModal(false)}>Cancel</Button>
                <Button className="flex-1 bg-[var(--customer-primary-dark)] hover:bg-[var(--customer-primary-darker)] text-white" onClick={handleReturnSubmit}>Submit Return</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Replace Request Modal */}
       <AnimatePresence>
        {showReplaceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowReplaceModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Request Replacement
              </h2>

               <div className="mb-4">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Select Product</label>
                 <select
                    className="w-full border rounded-lg p-2"
                    value={selectedOrderItemId}
                    onChange={(e) => {
                      setSelectedOrderItemId(e.target.value);
                      const item = order?.items?.find((it: any) => it._id === e.target.value);
                      if (item) setSelectedQuantity(item.quantity);
                    }}
                 >
                     <option value="">Select a product...</option>
                     {order?.items?.map((item: any) => (
                         <option key={item._id} value={item._id}>{item.product?.name || item.productName} (Qty: {item.quantity})</option>
                     ))}
                 </select>
               </div>

               {selectedOrderItemId && (
                 <div className="mb-4">
                   <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Replace</label>
                   <input
                     type="number"
                     min="1"
                     max={order?.items?.find((it: any) => it._id === selectedOrderItemId)?.quantity || 1}
                     className="w-full border rounded-lg p-2"
                     value={selectedQuantity}
                     onChange={(e) => setSelectedQuantity(parseInt(e.target.value))}
                   />
                 </div>
               )}

                <div className="mb-4">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                 <select
                    className="w-full border rounded-lg p-2"
                    value={replaceReason}
                    onChange={(e) => setReplaceReason(e.target.value)}
                 >
                     <option value="Damaged">Damaged Product</option>
                     <option value="Wrong Item">Wrong Item Received</option>
                     <option value="Size Issue">Size Issue</option>
                 </select>
               </div>

               <div className="mb-4">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image (Mandatory) 📸</label>
                 <input
                   type="file"
                   accept="image/*"
                   className="w-full border rounded-lg p-2"
                   onChange={(e) => setReplaceImage(e.target.files ? e.target.files[0] : null)}
                 />
               </div>

               <div className="mb-4">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                 <textarea
                   className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[var(--customer-primary)]"
                   rows={3}
                   placeholder="Describe the issue..."
                   value={requestComment}
                   onChange={(e) => setRequestComment(e.target.value)}
                 />
               </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowReplaceModal(false)}>Cancel</Button>
                <Button className="flex-1 bg-[var(--customer-primary-dark)] hover:bg-[var(--customer-primary-darker)] text-white" onClick={handleReplaceSubmit}>Submit Replacement</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Order Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowCancelModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Cancel Order
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to cancel this order? Please provide a
                reason:
              </p>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-[var(--customer-primary)]"
                rows={3}
                placeholder="Enter cancellation reason..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCancelModal(false)}>
                  Keep Order
                </Button>
                <Button
                  className="flex-1 bg-[var(--customer-primary-dark)] hover:bg-[var(--customer-primary-darker)] text-white"
                  onClick={handleCancelOrder}>
                  Cancel Order
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delivery Instructions Modal */}
      <AnimatePresence>
        {showInstructionsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowInstructionsModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Add Delivery Instructions
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Share details to help the delivery partner find you
              </p>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-[var(--customer-primary)]"
                rows={4}
                maxLength={200}
                placeholder="e.g., Ring the bell, Leave at door, etc."
                value={deliveryInstructions}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
              />
              <p className="text-xs text-gray-500 mb-4">
                {deliveryInstructions.length}/200
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowInstructionsModal(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-[var(--customer-primary-dark)] hover:bg-[var(--customer-primary-darker)] text-white"
                  onClick={handleSaveInstructions}>
                  Save
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Items Detail Modal */}
      <AnimatePresence>
        {showItemsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowItemsModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Order Items
              </h2>
              <div className="space-y-4">
                {order?.items?.map((item: any, index: number) => {
                   const isFree = (item.total === 0 && item.quantity > 0) || item.unitPrice === 0 || item.price === 0;
                   return (
                  <div
                    key={index}
                    className="flex gap-3 border-b border-gray-200 pb-4 last:border-0">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      {item.product?.mainImage ? (
                        <img
                          src={item.product.mainImage}
                          alt={
                            item.product?.name || item.productName || "Product"
                          }
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <span className="text-2xl">📦</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {item.product?.name || item.productName}
                        {isFree && <span className="text-[var(--customer-primary-dark)] font-bold ml-2 text-xs bg-[var(--customer-primary-alpha-10)] px-2 py-0.5 rounded">Free Gift</span>}
                      </p>
                      <p className="text-sm text-gray-500">
                        Qty: {item.quantity} {item.quantity > 1 && !isFree && (item.total || item.unitPrice) ? `(₹${((item.total || (item.unitPrice * item.quantity)) / item.quantity).toFixed(2)} each)` : ""}
                      </p>
                      {item.variant && (
                        <p className="text-xs text-gray-500">{item.variant}</p>
                      )}
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {isFree ? (
                            <span className="text-[var(--customer-primary-dark)]">Free</span>
                        ) : (
                            <>₹{(item.total || (item.unitPrice * item.quantity)).toFixed(2)}</>
                        )}
                      </p>
                    </div>
                  </div>
                   );
                })}
              </div>
              {/* The line prices add up to more than the amount charged whenever a discount
                  applied, which reads as a mistake unless the difference is shown here. Every
                  figure comes from the order record, so this always reconciles with what was paid. */}
              {(() => {
                const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
                const o: any = order;
                const lineSum = (o?.items || []).reduce(
                  (sum: number, it: any) => sum + (num(it.total) || num(it.unitPrice) * num(it.quantity)),
                  0
                );
                const itemTotal = num(o?.subtotal) || lineSum;
                const charges = [
                  { label: "Delivery fee", value: num(o?.shipping ?? o?.fees?.deliveryFee) },
                  { label: "Handling charge", value: num(o?.platformFee ?? o?.fees?.platformFee) },
                  { label: "Delivery tip", value: num(o?.tipAmount) },
                  { label: "Gift packaging", value: num(o?.giftPackagingFee) },
                ].filter((r) => r.value > 0);

                const named = [
                  { label: o?.couponCode ? `Coupon (${o.couponCode})` : "Coupon discount", value: num(o?.couponDiscount) },
                  { label: "First order discount", value: num(o?.firstOrderDiscount) },
                  { label: "Offer discount", value: num(o?.cartRuleDiscount) },
                  { label: "Online payment discount", value: num(o?.onlineDiscount) },
                ].filter((r) => r.value > 0);
                // anything the order recorded as a discount but did not itemise
                const unnamed = Number((num(o?.discount) - named.reduce((s, r) => s + r.value, 0)).toFixed(2));
                const discounts = unnamed > 0 ? [...named, { label: "Discount", value: unnamed }] : named;

                const paid = num(o?.totalAmount ?? o?.total);
                const isPaid = String(o?.paymentStatus || "").toLowerCase() === "paid";

                return (
                  <div className="mt-5 pt-4 border-t border-gray-200 space-y-2">
                    <div className="flex justify-between text-sm text-gray-700">
                      <span>Item total</span>
                      <span className="font-price">₹{itemTotal.toFixed(2)}</span>
                    </div>
                    {charges.map((row) => (
                      <div key={row.label} className="flex justify-between text-sm text-gray-700">
                        <span>{row.label}</span>
                        <span className="font-price">₹{row.value.toFixed(2)}</span>
                      </div>
                    ))}
                    {discounts.map((row) => (
                      <div key={row.label} className="flex justify-between text-sm text-[var(--customer-primary-dark)]">
                        <span>{row.label}</span>
                        <span className="font-price">-₹{row.value.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 mt-1 border-t border-gray-200 text-base font-bold text-gray-900">
                      <span>{isPaid ? "Amount paid" : "Amount to pay"}</span>
                      <span className="font-price">₹{paid.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}
              <Button
                className="w-full mt-4 bg-[var(--customer-primary-dark)] hover:bg-[var(--customer-primary-darker)] text-white"
                onClick={() => setShowItemsModal(false)}>
                Close
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Special Requests Modal */}
      <AnimatePresence>
        {showSpecialRequestsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowSpecialRequestsModal(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Add Special Requests
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Let the store know if you have any special preferences
              </p>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-[var(--customer-primary)]"
                rows={4}
                maxLength={200}
                placeholder="e.g., No onions, Extra napkins, etc."
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
              />
              <p className="text-xs text-gray-500 mb-4">
                {specialRequests.length}/200
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowSpecialRequestsModal(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-[var(--customer-primary-dark)] hover:bg-[var(--customer-primary-darker)] text-white"
                  onClick={handleSaveSpecialRequests}>
                  Save
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
