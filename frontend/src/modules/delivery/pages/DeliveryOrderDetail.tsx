import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrderDetails, updateOrderStatus, sendDeliveryOtp, verifyDeliveryOtp, updateDeliveryLocation, acceptOfferedOrder, verifyStorePickup } from '../../../services/api/delivery/deliveryService';
import deliveryIcon from '@assets/deliveryboy/deliveryIcon.png';
import GoogleMapsTracking from '../../../components/GoogleMapsTracking';
import QRScannerModal from '../../../components/QRScannerModal';
import { openBarcodeScanner } from '../../../utils/scannerPlatform';

// Helper to get delivery icon URL (works in both dev and production)
const getDeliveryIconUrl = () => {
    // Try imported path first (Vite will process this in production)
    if (deliveryIcon && typeof deliveryIcon === 'string') {
        return deliveryIcon;
    }
    // Fallback to public path
    return '/assets/deliveryboy/deliveryIcon.png';
};

// Icons components to avoid external dependency issues
const Icons = {
    ChevronLeft: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M15 18l-6-6 6-6" />
        </svg>
    ),
    MapPin: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    ),
    User: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    ),
    Phone: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    ),
    Clock: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    ),
    CheckCircle: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    ),
    Truck: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect x="1" y="3" width="15" height="13" />
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
    ),
    ShoppingBag: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
    ),
    Navigation: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
    ),
    Store: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    ),
    AlertTriangle: ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    )
};

type DeliveryOrderStatus = 'Pending' | 'Ready for pickup' | 'Picked up' | 'Out for Delivery' | 'Delivered' | 'Cancelled' | 'Returned';

/** One store on the order, as the backend reports it (its own packing / collection progress). */
interface StoreStop {
    sellerId: string;
    storeName: string;
    address: string;
    city: string;
    phone?: string;
    latitude: number | null;
    longitude: number | null;
    accepted: boolean;
    ready: boolean;
    pickedUp: boolean;
    pickedUpAt: string | null;
    itemCount: number;
}

export default function DeliveryOrderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [otpValue, setOtpValue] = useState('');
    const [otpSending, setOtpSending] = useState(false);
    const [otpVerifying, setOtpVerifying] = useState(false);
    const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [deliveryBoyLocation, setDeliveryBoyLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [actionBusy, setActionBusy] = useState(false);
    const [pickupNotice, setPickupNotice] = useState<string | null>(null);
    const [copiedOrderId, setCopiedOrderId] = useState(false);

    const handleCopyOrderId = () => {
        if (!order?.orderId) return;
        navigator.clipboard.writeText(order.orderId);
        setCopiedOrderId(true);
        setTimeout(() => setCopiedOrderId(false), 2000);
    };

    const fetchOrder = async (silent = false) => {
        if (!id) return;
        try {
            if (!silent) setLoading(true);
            const data = await getOrderDetails(id);
            setOrder(data);
        } catch (err: any) {
            if (!silent) setError(err.message || 'Failed to load order details');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrder();
        // Keep the status in step with the store and the customer (accepted, packed, cancelled, ...)
        const timer = setInterval(() => {
            if (document.visibilityState === 'visible') fetchOrder(true);
        }, 10000);
        return () => clearInterval(timer);
    }, [id]);

    // Clean up when component unmounts
    useEffect(() => {
        return () => {
            if (locationIntervalRef.current) {
                clearInterval(locationIntervalRef.current);
            }
        };
    }, []);

    const handleScanSuccess = async (decodedText: string) => {
        setShowScanner(false);
        if (!order || !id) return;
        const code = decodedText.trim();
        // At the store: the code identifies the store; only that store's items are marked collected
        try {
            setActionBusy(true);
            const result = await verifyStorePickup(id, code);
            setPickupNotice(result.message);
            await fetchOrder(true);
        } catch (err: any) {
            alert(err.message || 'Could not verify this pickup code. Please try again.');
        } finally {
            setActionBusy(false);
        }
    };

    const handleAcceptOffer = async () => {
        if (!id) return;
        try {
            setActionBusy(true);
            await acceptOfferedOrder(id);
            await fetchOrder(true);
        } catch (err: any) {
            alert(err.message || 'Could not accept the order');
            await fetchOrder(true);
        } finally {
            setActionBusy(false);
        }
    };

    /** All stores collected: head to the customer. The backend sends the customer's delivery OTP. */
    const handleStartDelivery = async () => {
        if (!id) return;
        try {
            setActionBusy(true);
            const res = await updateOrderStatus(id, 'Out for Delivery');
            await fetchOrder(true);
            setPickupNotice(res?.message || 'Out for delivery. The customer has been sent their delivery OTP.');
        } catch (err: any) {
            alert(err.message || 'Could not start the delivery');
        } finally {
            setActionBusy(false);
        }
    };

    const handleSendOtp = async () => {
        if (!id) return;
        try {
            setOtpSending(true);
            await sendDeliveryOtp(id);
            setShowOtpInput(true);
            alert('OTP sent. The customer can see it in their app on this order.');
        } catch (err: any) {
            alert(err.response?.data?.message || err.message || 'Failed to send OTP');
        } finally {
            setOtpSending(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!id || !otpValue) {
            alert('Please enter OTP');
            return;
        }
        try {
            setOtpVerifying(true);
            const result = await verifyDeliveryOtp(id, otpValue);
            alert(result.message || 'OTP verified successfully. Order marked as delivered.');
            await fetchOrder(); // Refresh order data
            setShowOtpInput(false);
            setOtpValue('');
        } catch (err: any) {
            const message = err.response?.data?.message || err.message || 'Failed to verify OTP';
            if (/expired|No delivery OTP/i.test(message)) {
                setOtpValue('');
                alert(`${message}\n\nTap "Resend OTP" and ask the customer for the new code.`);
            } else {
                alert(message);
            }
        } finally {
            setOtpVerifying(false);
        }
    };

    // Track if location permission was denied
    const locationPermissionDeniedRef = useRef<boolean>(false);

    // Get delivery boy's current location
    useEffect(() => {
        const getCurrentLocation = () => {
            if (!navigator.geolocation) {
                console.warn('Geolocation is not supported by this browser');
                return;
            }

            if (locationPermissionDeniedRef.current) {
                // Don't retry if permission was denied
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setDeliveryBoyLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                    locationPermissionDeniedRef.current = false; // Reset on success
                    setLocationError(null);
                },
                (error: GeolocationPositionError) => {
                    // Handle different error types
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            locationPermissionDeniedRef.current = true;
                            setLocationError('Location permission denied. Please enable location access in your browser settings to track delivery.');
                            console.warn('Location permission denied. Please enable location access in your browser settings.');
                            break;
                        case error.POSITION_UNAVAILABLE:
                            setLocationError('Location information unavailable. Please check your device settings.');
                            console.warn('Location information unavailable. Please check your device settings.');
                            break;
                        case error.TIMEOUT:
                            // High-accuracy GPS often times out indoors/on laptops: retry with network location
                            navigator.geolocation.getCurrentPosition(
                                (position) => {
                                    setDeliveryBoyLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
                                    setLocationError(null);
                                },
                                () => setLocationError('Location request timed out. Please try again.'),
                                { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
                            );
                            break;
                        default:
                            setLocationError(`Error getting location: ${error.message}`);
                            console.warn('Error getting location:', error.message);
                            break;
                    }
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        };

        getCurrentLocation();
    }, []);



    // Socket.io connection
    const socketRef = useRef<any>(null);
    const [socketConnected, setSocketConnected] = useState(false);

    // Initialize Socket
    useEffect(() => {
        let isMounted = true;
        let socket: any = null;

        const initializeSocket = async () => {
            try {
                const [{ io }, { getSocketBaseURL, getAuthToken, isRealtimeAvailable }] = await Promise.all([
                    import('socket.io-client'),
                    import('../../../services/api/config')
                ]);

                if (!isMounted || !isRealtimeAvailable()) return;

                const baseURL = getSocketBaseURL();
                const token = getAuthToken();

                socket = io(baseURL, {
                    auth: { token },
                    transports: ['polling', 'websocket'],
                    reconnection: true,
                    reconnectionAttempts: 3,
                    reconnectionDelay: 2000
                });

                socket.on('connect', () => {
                    if (isMounted) {
                        console.log('✅ Delivery Socket Connected:', socket.id);
                        setSocketConnected(true);
                    }
                });

                socket.on('disconnect', (reason: string) => {
                    if (isMounted) {
                        console.log('❌ Delivery Socket Disconnected:', reason);
                        setSocketConnected(false);
                    }
                });

                socket.on('connect_error', (error: any) => {
                    if (isMounted) {
                        console.error('❌ Delivery Socket Connection Error:', error.message);
                    }
                });

                socketRef.current = socket;
            } catch (err) {
                console.error('Failed to initialize socket:', err);
            }
        };

        initializeSocket();

        return () => {
            isMounted = false;
            if (socket) {
                console.log('🔌 Disconnecting delivery socket...');
                socket.disconnect();
                socketRef.current = null;
            }
        };
    }, []);

    // Helper to get socket (for use in other effects)
    const getSocket = useCallback(() => socketRef.current, []);


    // Live location while working on the order. The rider's own map always follows the GPS; the
    // position reaches the server (customer tracking) over the socket when it's connected, and
    // over HTTP otherwise (the backend has no socket server on serverless hosting).
    const lastHttpPushRef = useRef(0);
    useEffect(() => {
        if (!id || !order) return;
        const active = order.assignedToMe && !['Delivered', 'Cancelled', 'Returned', 'Rejected'].includes(order.status);
        if (!active) return;

        const updateLocation = () => {
            if (!navigator.geolocation || locationPermissionDeniedRef.current) return;
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setDeliveryBoyLocation({ lat: latitude, lng: longitude });
                    setLastUpdate(new Date());
                    setLocationError(null);
                    const socket = socketRef.current;
                    if (socket && socketConnected) {
                        socket.emit('update-location', { orderId: id, latitude, longitude });
                    } else if (Date.now() - lastHttpPushRef.current > 10000) {
                        lastHttpPushRef.current = Date.now();
                        updateDeliveryLocation(id, latitude, longitude).catch(() => undefined);
                    }
                },
                (error: GeolocationPositionError) => {
                    if (error.code === error.PERMISSION_DENIED && !locationPermissionDeniedRef.current) {
                        locationPermissionDeniedRef.current = true;
                        setLocationError('Location permission denied. Please enable location access in your browser settings to track delivery.');
                    }
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
            );
        };
        updateLocation();
        locationIntervalRef.current = setInterval(updateLocation, 5000);
        return () => {
            if (locationIntervalRef.current) {
                clearInterval(locationIntervalRef.current);
                locationIntervalRef.current = null;
            }
        };
    }, [id, order?.status, order?.assignedToMe, socketConnected]);


    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
                <p className="text-neutral-500">Loading order...</p>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-neutral-100 flex items-center justify-center flex-col">
                <p className="text-red-500 mb-4">{error || 'Order not found'}</p>
                <button
                    onClick={() => navigate(-1)}
                    className="px-4 py-2 bg-neutral-200 rounded-lg text-neutral-700 font-medium"
                >
                    Go Back
                </button>
            </div>
        );
    }

    // Each store's own progress, from the backend (packed / collected), and where to go next
    const stores: StoreStop[] = order.stores || [];
    const remainingStores = stores.filter((s) => !s.pickedUp);
    const collectedCount = stores.length - remainingStores.length;
    const nextStop: any = order.nextStop || null;
    const isOffer = !order.assignedToMe;
    const terminal = ['Delivered', 'Cancelled', 'Returned', 'Rejected'].includes(order.status);
    const waitingForStores = ['Received', 'Pending'].includes(order.status);
    const collecting = order.assignedToMe && !terminal && !waitingForStores && remainingStores.length > 0;
    const readyToStart = order.assignedToMe && order.status === 'Picked up';
    const outForDelivery = order.assignedToMe && order.status === 'Out for Delivery';

    // Progress shown to the rider: accepted -> collected from every store -> out for delivery -> delivered
    const steps = [
        { label: 'Accepted', done: !isOffer || ['Picked up', 'Out for Delivery', 'Delivered'].includes(order.status) },
        { label: stores.length > 1 ? `Picked up ${collectedCount}/${stores.length}` : 'Picked up', done: stores.length > 0 && remainingStores.length === 0 },
        { label: 'On the way', done: ['Out for Delivery', 'Delivered'].includes(order.status) },
        { label: 'Delivered', done: order.status === 'Delivered' },
    ];
    const currentStep = steps.filter((st) => st.done).length;

    // Map: route from the rider to the next stop only (the next store still to collect from, then
    // the customer). Collected stores drop off the map.
    const custLat = order.latitude || order.deliveryAddress?.latitude || 0;
    const custLng = order.longitude || order.deliveryAddress?.longitude || 0;
    const hasCustomerCoords = !!custLat && !!custLng;
    const headingToCustomer = !!nextStop && nextStop.type === 'customer';
    const destination =
        nextStop && Number.isFinite(nextStop.latitude) && Number.isFinite(nextStop.longitude) && nextStop.latitude !== null
            ? { lat: Number(nextStop.latitude), lng: Number(nextStop.longitude) }
            : headingToCustomer && hasCustomerCoords
                ? { lat: custLat, lng: custLng }
                : undefined;
    const mapStores = remainingStores.filter((s) => s.latitude !== null && s.longitude !== null);
    const isMapVisible = !terminal && (mapStores.length > 0 || (headingToCustomer && hasCustomerCoords));

    return (
        <div className="min-h-screen bg-neutral-50 pb-32 relative">

            {/* Top Bar with Back Button */}
            <div className="sticky top-0 z-20 bg-white border-b border-neutral-100 px-4 py-3 flex items-center shadow-sm">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition-colors"
                >
                    <Icons.ChevronLeft size={24} />
                </button>
                <span className="ml-2 font-semibold text-lg text-neutral-800">Order Details</span>

                <div className="ml-auto">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${order.status === 'Delivered' ? 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]' :
                        order.status === 'Picked up' ? 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]' :
                            order.status === 'Ready for pickup' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-orange-100 text-orange-700'
                        }`}>
                        {collecting && stores.length > 1 ? `Collecting ${collectedCount}/${stores.length}` : order.status}
                    </span>
                </div>
            </div>

            {/* Location Error Warning */}
            {locationError && (
                <div className="mx-4 mt-4 bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
                    <Icons.AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-red-800">Location Access Required</p>
                        <p className="text-xs text-red-600 mt-0.5">{locationError}</p>
                    </div>
                </div>
            )}

            {/* Map: the rider's live position and the route to the next stop */}
            {isMapVisible && (
                <GoogleMapsTracking
                    sellerLocations={mapStores.map((s) => ({ lat: s.latitude as number, lng: s.longitude as number, name: s.storeName }))}
                    customerLocation={{ lat: custLat, lng: custLng }}
                    deliveryLocation={deliveryBoyLocation || undefined}
                    isTracking={!!deliveryBoyLocation}
                    showRoute={!!deliveryBoyLocation && !!destination}
                    routeOrigin={deliveryBoyLocation || undefined}
                    routeDestination={destination}
                    routeWaypoints={[]}
                    destinationName={headingToCustomer ? order.address?.split(',')[0] : nextStop?.storeName}
                    onRouteInfoUpdate={setRouteInfo}
                    lastUpdate={lastUpdate}
                />
            )}

            {pickupNotice && (
                <div className="mx-4 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800 flex items-start gap-2">
                    <Icons.CheckCircle size={18} className="shrink-0 mt-0.5" />
                    <span className="flex-1">{pickupNotice}</span>
                    <button onClick={() => setPickupNotice(null)} className="text-emerald-700 text-xs font-semibold">OK</button>
                </div>
            )}

            {/* Stores to collect from: each one is verified separately with its own pickup code */}
            {stores.length > 0 && !terminal && (
                <div className="p-4 pb-0 max-w-lg mx-auto">
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                                <Icons.Store size={18} className="text-neutral-500" />
                                {stores.length > 1 ? `Pick up from ${stores.length} stores` : 'Pick up from'}
                            </h3>
                            <span className="text-xs font-semibold text-neutral-500">
                                {collectedCount}/{stores.length} collected
                            </span>
                        </div>
                        <ol className="space-y-2">
                            {stores.map((s, idx) => {
                                const isNext = nextStop?.type === 'store' && nextStop.sellerId === s.sellerId;
                                return (
                                    <li
                                        key={s.sellerId}
                                        className={`flex items-start gap-3 rounded-xl p-3 border ${s.pickedUp ? 'bg-neutral-50 border-neutral-100' : isNext ? 'bg-[var(--primary-alpha-10)] border-[var(--primary-color)]' : 'bg-white border-neutral-100'}`}
                                    >
                                        <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.pickedUp ? 'bg-[var(--primary-dark)] text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                                            {s.pickedUp ? <Icons.CheckCircle size={14} /> : idx + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className={`font-medium truncate ${s.pickedUp ? 'text-neutral-500' : 'text-neutral-900'}`}>{s.storeName}</p>
                                                {isNext && <span className="text-[10px] font-bold uppercase text-[var(--primary-dark)]">Next</span>}
                                            </div>
                                            <p className="text-xs text-neutral-500 truncate">{[s.address, s.city].filter(Boolean).join(', ')}</p>
                                            <p className={`mt-1 text-xs font-semibold ${s.pickedUp ? 'text-[var(--primary-dark)]' : s.ready ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                {s.pickedUp
                                                    ? `Collected${s.pickedUpAt ? ` at ${new Date(s.pickedUpAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`
                                                    : s.ready
                                                        ? `Packed: ask the store for its pickup code (${s.itemCount} item${s.itemCount === 1 ? '' : 's'})`
                                                        : s.accepted
                                                            ? 'Store is packing'
                                                            : 'Waiting for the store to accept'}
                                            </p>
                                        </div>
                                        {s.phone && !s.pickedUp && (
                                            <a href={`tel:${s.phone}`} className="p-2 rounded-full bg-neutral-100 text-neutral-600" aria-label={`Call ${s.storeName}`}>
                                                <Icons.Phone size={16} />
                                            </a>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                </div>
            )}

            <div className="p-4 space-y-4 max-w-lg mx-auto">

                {/* Progress */}
                {!terminal && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
                        <p className="text-neutral-500 text-xs font-medium uppercase tracking-wider mb-1">Process</p>
                        <h2 className="text-lg font-bold text-neutral-900 mb-5">Order Progress</h2>
                        <div className="relative">
                            <div className="absolute top-4 left-4 right-4 h-0.5 bg-neutral-100">
                                <div className="h-full bg-[var(--primary-dark)] transition-all duration-500" style={{ width: `${(Math.max(0, currentStep - 1) / (steps.length - 1)) * 100}%` }} />
                            </div>
                            <div className="relative flex justify-between">
                                {steps.map((st, idx) => (
                                    <div key={st.label} className="flex flex-1 flex-col items-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${st.done ? 'bg-[var(--primary-dark)] border-[var(--primary-dark)] text-white' : 'bg-white border-neutral-200 text-neutral-300'}`}>
                                            {st.done ? <Icons.CheckCircle size={14} /> : idx + 1}
                                        </div>
                                        <span className={`mt-2 text-center text-[10px] font-medium leading-tight ${idx === currentStep ? 'text-[var(--primary-dark)] font-bold' : 'text-neutral-500'}`}>{st.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Customer Details */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
                    <h3 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                        <Icons.User size={18} className="text-neutral-500" />
                        Customer Details
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-[var(--primary-alpha-10)] flex items-center justify-center flex-shrink-0 text-[var(--primary-dark)]">
                                <Icons.User size={20} />
                            </div>
                            <div>
                                <p className="font-medium text-neutral-900">{order.customerName}</p>
                                <p className="text-sm text-neutral-500">Customer</p>
                            </div>
                            <a href={`tel:${order.customerPhone}`} className="ml-auto p-3 bg-[var(--primary-color)] text-white rounded-full hover:bg-[var(--primary-dark)] shadow-md transition-transform hover:scale-105 active:scale-95">
                                <Icons.Phone size={20} />
                            </a>
                        </div>
                        <div className="flex items-start gap-3 pt-3 border-t border-neutral-50">
                            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0 text-orange-600">
                                <Icons.MapPin size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-neutral-600 leading-relaxed font-medium">{order.address}</p>
                                {order.distance && (
                                    <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-md">
                                        {order.distance} away
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Order Items */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                            <Icons.ShoppingBag size={18} className="text-neutral-500" />
                            Order Summary
                        </h3>
                        <span className="text-xs font-medium text-neutral-500 px-2 py-1 bg-neutral-100 rounded-md">
                            {order.items?.length || 0} Items
                        </span>
                    </div>

                    {/* Free Gift Warning Banner */}
                    {order.items?.some((i: any) => i.isFreeGift) && (
                        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-3">
                            <span className="text-xl">🎁</span>
                            <div>
                                <p className="font-bold text-yellow-800 text-sm">Includes Free Gift</p>
                                <p className="text-xs text-yellow-700">Please ensure the free gift is delivered.</p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {order.items?.map((item: any, idx: number) => (
                            <div key={idx} className={`flex justify-between items-center py-2 border-b border-neutral-50 last:border-0 ${item.isFreeGift ? 'bg-[var(--primary-alpha-10)] p-2 rounded border border-green-100' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${item.isFreeGift ? 'bg-green-200 text-[var(--primary-darker)]' : 'bg-neutral-100 text-neutral-600'}`}>
                                        {item.quantity}x
                                    </span>
                                    <div>
                                        <span className={`text-sm font-medium ${item.isFreeGift ? 'text-green-900' : 'text-neutral-700'}`}>
                                            {item.name || item.productName || item.product?.productName}
                                        </span>
                                        {item.isFreeGift && <span className="block text-[10px] text-[var(--primary-dark)] font-bold uppercase tracking-wider">Free Gift</span>}
                                    </div>
                                </div>
                                <span className={`text-sm font-semibold ${item.isFreeGift ? 'text-[var(--primary-darker)]' : 'text-neutral-900'}`}>
                                    {item.isFreeGift ? 'FREE' : `₹${item.total ?? (item.unitPrice ? item.unitPrice * item.quantity : item.price)}`}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-dashed border-neutral-200 flex justify-between items-center">
                        <span className="font-semibold text-neutral-700">Total Amount</span>
                        <span className="text-xl font-bold text-neutral-900">₹{order.totalAmount}</span>
                    </div>
                </div>

                {/* Order Info */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 mb-20">
                    <div className="grid grid-cols-2 gap-4">
                        <div
                            onClick={handleCopyOrderId}
                            className="p-3 bg-neutral-50 rounded-lg overflow-hidden cursor-pointer hover:bg-neutral-100 transition-colors group relative"
                            title="Click to copy Order ID"
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-neutral-500">Order ID</span>
                                <span className={`text-[10px] font-medium transition-colors ${copiedOrderId ? 'text-green-600 font-bold' : 'text-neutral-400 group-hover:text-neutral-700'}`}>
                                    {copiedOrderId ? '✓ Copied' : '📋 Copy'}
                                </span>
                            </div>
                            <p className="text-xs font-bold text-neutral-900 break-all leading-snug">{order.orderId}</p>
                        </div>
                        <div className="p-3 bg-neutral-50 rounded-lg">
                            <p className="text-xs text-neutral-500 mb-1">Order Date</p>
                            <p className="text-sm font-bold text-neutral-900">
                                {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                </div>

            </div>

            {/* OTP Input Section Modal */}
            {showOtpInput && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl border border-neutral-100 w-full max-w-sm flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                        {/* Lock / OTP Icon */}
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[var(--primary-dark)] flex items-center justify-center mb-4 border border-emerald-100 shadow-inner">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                        </div>

                        <h3 className="text-xl font-bold text-neutral-900 mb-1">Enter Delivery OTP</h3>
                        <p className="text-xs text-neutral-500 mb-5 leading-relaxed">
                            Ask the customer for the 6-digit verification code shown in their app to confirm delivery.
                        </p>

                        <div className="w-full mb-3">
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={otpValue}
                                onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="------"
                                className="w-full px-4 py-3.5 border-2 border-neutral-200 rounded-2xl text-2xl font-bold font-mono text-center tracking-[0.5em] text-neutral-900 focus:outline-none focus:border-[var(--primary-dark)] focus:ring-4 focus:ring-emerald-500/10 transition-all bg-neutral-50/50"
                                maxLength={6}
                                autoFocus
                            />
                        </div>

                        <div className="text-xs text-neutral-500 mb-6 flex items-center justify-center gap-1.5">
                            <span>Didn't get code?</span>
                            <button
                                type="button"
                                onClick={handleSendOtp}
                                disabled={otpSending}
                                className="font-bold text-[var(--primary-dark)] hover:underline disabled:opacity-50"
                            >
                                {otpSending ? 'Sending…' : 'Resend OTP'}
                            </button>
                        </div>

                        <div className="flex gap-3 w-full">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowOtpInput(false);
                                    setOtpValue('');
                                }}
                                className="flex-1 py-3.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-sm transition-colors active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleVerifyOtp}
                                className="flex-1 py-3.5 rounded-xl bg-[var(--primary-dark)] hover:bg-[var(--primary-darker)] text-white font-bold text-sm transition-all shadow-md shadow-emerald-900/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                disabled={otpVerifying || otpValue.length !== 6}
                            >
                                {otpVerifying ? 'Verifying...' : 'Verify OTP'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Action dock: one clear next step at a time */}
            {!showOtpInput && !terminal && (
                <div className="fixed bottom-20 sm:bottom-24 left-3 right-3 sm:left-4 sm:right-4 max-w-lg mx-auto z-30 box-border">
                    {isOffer ? (
                        waitingForStores ? (
                            <div className="w-full py-3.5 px-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm font-semibold text-center shadow-lg whitespace-normal break-words box-border">
                                Waiting for every store to accept this order
                            </div>
                        ) : (
                            <button
                                onClick={handleAcceptOffer}
                                disabled={actionBusy}
                                className="w-full py-3.5 px-4 rounded-2xl bg-[var(--primary-dark)] text-white font-bold text-sm sm:text-base shadow-xl active:scale-[0.98] disabled:opacity-60 whitespace-normal break-words box-border"
                            >
                                {actionBusy ? 'Accepting…' : 'Accept order'}
                            </button>
                        )
                    ) : collecting ? (
                        <div className="flex items-center gap-2 sm:gap-3 w-full box-border">
                            <button
                                onClick={() => openBarcodeScanner(() => setShowScanner(true))}
                                className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-lg active:scale-95"
                                title="Scan the store's pickup code"
                                aria-label="Scan the store's pickup code"
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><rect x="7" y="7" width="10" height="10" rx="1"></rect>
                                </svg>
                            </button>
                            <button
                                onClick={() => setShowScanner(true)}
                                disabled={actionBusy || !remainingStores.some((st) => st.ready)}
                                className="flex-1 min-w-0 py-3 px-3 sm:px-4 rounded-2xl bg-neutral-900 text-white font-bold text-xs sm:text-sm shadow-xl active:scale-[0.98] disabled:opacity-60 text-center leading-tight whitespace-normal break-words box-border"
                            >
                                <span className="line-clamp-2">
                                    {actionBusy
                                        ? 'Verifying…'
                                        : remainingStores.some((st) => st.ready)
                                            ? `Verify pickup${nextStop?.type === 'store' ? ` at ${nextStop.storeName}` : ''}`
                                            : `Waiting for ${remainingStores.map((st) => st.storeName).join(', ')} to pack`}
                                </span>
                            </button>
                        </div>
                    ) : readyToStart ? (
                        <button
                            onClick={handleStartDelivery}
                            disabled={actionBusy}
                            className="w-full py-3.5 px-4 rounded-2xl bg-[var(--primary-dark)] text-white font-bold text-sm sm:text-base shadow-xl active:scale-[0.98] disabled:opacity-60 text-center leading-snug whitespace-normal break-words box-border"
                        >
                            {actionBusy ? 'Starting…' : 'All stores collected: start delivery'}
                        </button>
                    ) : outForDelivery ? (
                        <button
                            onClick={() => setShowOtpInput(true)}
                            className="w-full py-3.5 px-4 rounded-2xl bg-[var(--primary-dark)] text-white font-bold text-sm sm:text-base shadow-xl active:scale-[0.98] text-center whitespace-normal break-words box-border"
                        >
                            Enter delivery OTP
                        </button>
                    ) : null}
                </div>
            )}

            {/* Scanner Modal */}
            {showScanner && (
                <QRScannerModal
                    onScanSuccess={handleScanSuccess}
                    onClose={() => setShowScanner(false)}
                    title="Verify pickup at the store"
                    manualPlaceholder="Or type this store's 6-digit pickup code"
                />
            )}
        </div>
    );
}
