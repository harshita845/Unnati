import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'

interface DeliveryPartner {
    name?: string
    phone?: string
    profileImage?: string
    vehicleNumber?: string
}

interface DeliveryPartnerCardProps {
    partner: DeliveryPartner | null
    eta: number
    distance: number
    isTracking: boolean
    deliveryOtp?: string
    otpExpiryTime?: string | Date
    onCall?: () => void
    onMessage?: () => void
    onRefreshOtp?: () => void
}

export default function DeliveryPartnerCard({
    partner,
    eta,
    distance,
    isTracking,
    deliveryOtp,
    otpExpiryTime,
    onCall,
    onMessage,
    onRefreshOtp
}: DeliveryPartnerCardProps) {
    const [timeLeft, setTimeLeft] = useState<number>(0)
    const [isCopied, setIsCopied] = useState(false)

    // Calculate initial time left and start countdown
    useEffect(() => {
        if (!otpExpiryTime) {
            // Default to 15 minutes if no expiry time provided
            setTimeLeft(15 * 60)
            return
        }

        const calculateTimeLeft = () => {
            const expiry = new Date(otpExpiryTime).getTime()
            const now = new Date().getTime()
            const diff = Math.max(0, Math.floor((expiry - now) / 1000))
            setTimeLeft(diff)
        }

        calculateTimeLeft()
        const timer = setInterval(calculateTimeLeft, 1000)

        return () => clearInterval(timer)
    }, [otpExpiryTime])

    // Auto-refresh OTP when timer hits zero
    useEffect(() => {
        if (timeLeft === 0 && deliveryOtp && onRefreshOtp) {
            onRefreshOtp()
        }
    }, [timeLeft, deliveryOtp, onRefreshOtp])

    const handleCopyOtp = useCallback(async () => {
        if (!deliveryOtp) return
        try {
            await navigator.clipboard.writeText(deliveryOtp)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy OTP:', err)
        }
    }, [deliveryOtp])

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    if (!partner && !isTracking && !deliveryOtp) return null

    const formatDistance = (meters: number): { value: string; unit: string } => {
        if (!meters || meters <= 0) return { value: '0', unit: 'm' }
        if (meters < 1000) {
            return { value: `${Math.round(meters)}`, unit: 'm' }
        }
        return { value: (meters / 1000).toFixed(1), unit: 'km' }
    }

    const formatETA = (minutes: number): { value: string; unit: string } => {
        const safeMins = Math.max(1, Math.round(minutes || 1))
        if (safeMins < 60) {
            return { value: `${safeMins}`, unit: 'min' }
        }
        const hours = Math.floor(safeMins / 60)
        const mins = safeMins % 60
        return { value: `${hours}h ${mins}`, unit: 'm' }
    }

    const formattedDistance = formatDistance(distance)
    const formattedETA = formatETA(eta)
    const progressPercent = Math.max(12, Math.min(96, 100 - (distance / 50)))
    const otpDigits = deliveryOtp ? String(deliveryOtp).trim().split('') : []

    return (
        <motion.div
            className="mx-3 sm:mx-4 mt-3 sm:mt-4 bg-white rounded-3xl shadow-[0_12px_36px_-6px_rgba(0,0,0,0.07),0_4px_12px_-2px_rgba(0,0,0,0.03)] border border-neutral-100 overflow-hidden relative"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
        >
            {/* Top ambient decorative glow */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-gradient-to-br from-emerald-100/50 via-teal-50/20 to-transparent rounded-full blur-2xl pointer-events-none" />

            {/* Delivery Partner Header */}
            <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 relative z-10">
                <div className="flex items-center gap-3 min-w-0">
                    {/* Partner Avatar with live beacon */}
                    <div className="relative shrink-0">
                        <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-600/20 overflow-hidden ring-2 ring-emerald-500/15">
                            {partner?.profileImage ? (
                                <img
                                    src={partner.profileImage}
                                    alt={partner.name || 'Delivery Partner'}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-2xl select-none" role="img" aria-label="Delivery Partner">
                                    🛵
                                </span>
                            )}
                        </div>
                        {isTracking && (
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5" title="Live GPS Active">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white shadow-xs"></span>
                            </span>
                        )}
                    </div>

                    {/* Partner Details */}
                    <div className="min-w-0">
                        <h3 className="font-bold text-sm sm:text-base text-neutral-900 truncate tracking-tight">
                            {partner?.name || 'Delivery Partner'}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {isTracking ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-[11px] font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    On the way
                                </span>
                            ) : (
                                <span className="text-xs text-neutral-400 font-medium">Assigned Partner</span>
                            )}
                            {partner?.vehicleNumber && (
                                <span className="text-xs text-neutral-500 font-medium truncate">
                                    • {partner.vehicleNumber}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Call Button */}
                {partner?.phone && onCall && (
                    <motion.button
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/70 flex items-center justify-center shrink-0 shadow-sm active:scale-95 transition-all cursor-pointer"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onCall}
                        title={`Call ${partner.name || 'partner'}`}
                        aria-label={`Call ${partner.name || 'partner'}`}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                    </motion.button>
                )}
            </div>

            {/* Live Metrics: ETA & Distance Tiles */}
            {isTracking && (
                <div className="mx-3.5 sm:mx-4 mb-3.5 bg-gradient-to-br from-neutral-50/90 via-white to-emerald-50/20 rounded-2xl p-3.5 sm:p-4 border border-neutral-100 shadow-sm relative z-10">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        {/* ETA Tile */}
                        <div className="flex items-start gap-2.5 sm:gap-3">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                            </div>
                            <div className="min-w-0">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-0.5 truncate">
                                    Estimated arrival
                                </span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
                                        {formattedETA.value}
                                    </span>
                                    <span className="text-xs sm:text-sm font-bold text-neutral-500">
                                        {formattedETA.unit}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Distance Tile */}
                        <div className="flex items-start gap-2.5 sm:gap-3 pl-2 sm:pl-3 border-l border-neutral-100">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-100/70 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                </svg>
                            </div>
                            <div className="min-w-0">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-0.5 truncate">
                                    Away from you
                                </span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
                                        {formattedDistance.value}
                                    </span>
                                    <span className="text-xs sm:text-sm font-bold text-neutral-500">
                                        {formattedDistance.unit}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Progress Bar */}
                    {distance > 0 && (
                        <div className="mt-3 pt-3 border-t border-neutral-100">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 mb-1.5">
                                <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    Live en route
                                </span>
                                <span className="text-[10px] font-medium text-neutral-400">
                                    {formattedDistance.value} {formattedDistance.unit} away
                                </span>
                            </div>
                            <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden p-[1px]">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 rounded-full shadow-xs"
                                    initial={{ width: '0%' }}
                                    animate={{ width: `${progressPercent}%` }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Delivery OTP Pass Section */}
            {deliveryOtp && (
                <div className="mx-3.5 sm:mx-4 mb-3.5 bg-gradient-to-br from-emerald-50/70 via-emerald-50/30 to-amber-50/20 rounded-2xl p-3.5 sm:p-4 border border-emerald-200/80 shadow-sm relative overflow-hidden">
                    {/* Watermark accent */}
                    <div className="absolute -bottom-8 -right-8 w-28 h-28 bg-emerald-100/30 rounded-full blur-xl pointer-events-none" />

                    <div className="relative z-10">
                        {/* Header: Label & Countdown Timer Capsule */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold tracking-widest uppercase shadow-xs">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    Delivery OTP
                                </span>
                                <p className="text-[11px] text-neutral-600 font-medium mt-1 leading-tight">
                                    Share with partner at delivery
                                </p>
                            </div>

                            {/* Timer Badge */}
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold font-mono tracking-tight border shadow-xs ${
                                timeLeft < 60
                                    ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse'
                                    : 'bg-white border-emerald-200/80 text-emerald-800'
                            }`}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={timeLeft < 60 ? 'text-rose-500' : 'text-emerald-600'}>
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span>{formatTime(timeLeft)}</span>
                            </div>
                        </div>

                        {/* Digits & Action Buttons */}
                        <div className="flex items-center justify-between gap-2 bg-white rounded-xl p-2 sm:p-2.5 border border-emerald-100 shadow-xs">
                            {/* Individual Digit Tiles */}
                            <div className="flex items-center gap-1 sm:gap-1.5 select-all">
                                {otpDigits.map((digit, idx) => (
                                    <span
                                        key={idx}
                                        className="w-7 h-9 sm:w-8 sm:h-10 rounded-lg bg-gradient-to-b from-neutral-50 to-emerald-50/40 border border-emerald-200/80 text-emerald-950 font-mono font-black text-lg sm:text-xl flex items-center justify-center shadow-xs"
                                    >
                                        {digit}
                                    </span>
                                ))}
                            </div>

                            {/* Action Buttons Group */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                {/* Copy Button */}
                                <motion.button
                                    onClick={handleCopyOtp}
                                    className="px-2.5 sm:px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/70 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer relative"
                                    whileTap={{ scale: 0.95 }}
                                    title="Copy OTP"
                                    aria-label="Copy OTP"
                                >
                                    <AnimatePresence mode="wait">
                                        {isCopied ? (
                                            <motion.span
                                                key="copied"
                                                initial={{ scale: 0.8, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0.8, opacity: 0 }}
                                                className="flex items-center gap-1 text-emerald-700 font-bold"
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                                <span className="hidden sm:inline">Copied</span>
                                            </motion.span>
                                        ) : (
                                            <motion.span
                                                key="copy"
                                                initial={{ scale: 0.8, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0.8, opacity: 0 }}
                                                className="flex items-center gap-1 text-emerald-800"
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                </svg>
                                                <span className="hidden sm:inline">Copy</span>
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </motion.button>

                                {/* Refresh Button */}
                                {onRefreshOtp && (
                                    <motion.button
                                        onClick={onRefreshOtp}
                                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 border border-neutral-200/90 flex items-center justify-center transition-all active:scale-95 shadow-xs cursor-pointer"
                                        whileTap={{ rotate: 180 }}
                                        transition={{ duration: 0.3 }}
                                        title="Request new OTP"
                                        aria-label="Request new OTP"
                                    >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M23 4v6h-6" />
                                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                        </svg>
                                    </motion.button>
                                )}
                            </div>
                        </div>

                        {/* Security reassurance */}
                        <p className="text-[10px] text-neutral-500 mt-2 flex items-center justify-center gap-1 font-medium text-center">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 shrink-0">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Only share this code after receiving your items
                        </p>
                    </div>
                </div>
            )}
        </motion.div>
    )
}
