import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useCallback, useMemo } from 'react'

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
    onRefreshOtp
}: DeliveryPartnerCardProps) {
    const [timeLeft, setTimeLeft] = useState<number>(0)
    const [isCopied, setIsCopied] = useState(false)

    // Calculate initial time left and start countdown
    useEffect(() => {
        if (!otpExpiryTime) {
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

    // Clean partner name: separate main name and area if in brackets
    const parsedName = useMemo(() => {
        const raw = partner?.name || 'Delivery Partner'
        const match = raw.match(/^([^(]+)(\((.+)\))?$/)
        if (match) {
            return {
                main: match[1].trim(),
                area: match[3]?.trim() || ''
            }
        }
        return { main: raw, area: '' }
    }, [partner?.name])

    // Distance formatting (Blinkit / Zepto style)
    const distanceInfo = useMemo(() => {
        if (!distance || distance <= 0) {
            return { value: '0', unit: 'm', isDoorstep: false, full: 'Nearby' }
        }
        if (distance < 50) {
            return { value: 'At Door', unit: '', isDoorstep: true, full: 'At your doorstep' }
        }
        if (distance < 1000) {
            const m = Math.round(distance)
            return { value: `${m}`, unit: 'm', isDoorstep: false, full: `${m} m away` }
        }
        const km = (distance / 1000).toFixed(1)
        return { value: km, unit: 'km', isDoorstep: false, full: `${km} km away` }
    }, [distance])

    // ETA formatting
    const etaInfo = useMemo(() => {
        const safeMins = Math.max(1, Math.round(eta || 1))
        if (distanceInfo.isDoorstep) {
            return { value: '< 1', unit: 'min', headline: 'Arriving right now!' }
        }
        if (safeMins < 60) {
            return {
                value: `${safeMins}`,
                unit: safeMins === 1 ? 'min' : 'mins',
                headline: `Arriving in ${safeMins} ${safeMins === 1 ? 'min' : 'mins'}`
            }
        }
        const hours = Math.floor(safeMins / 60)
        const mins = safeMins % 60
        return {
            value: `${hours}h ${mins}`,
            unit: 'm',
            headline: `Arriving in ${hours} hr ${mins} mins`
        }
    }, [eta, distanceInfo.isDoorstep])

    // Progress percentage: 100% when close, minimum 15%
    const progressPercent = useMemo(() => {
        if (distanceInfo.isDoorstep) return 96
        if (!distance || distance <= 0) return 85
        // Scale smoothly: > 3km ~ 20%, 1km ~ 50%, 200m ~ 80%, <50m ~ 96%
        const pct = Math.max(18, Math.min(94, 100 - (distance / 35)))
        return Math.round(pct)
    }, [distance, distanceInfo.isDoorstep])

    const otpDigits = deliveryOtp ? String(deliveryOtp).trim().split('') : []

    return (
        <motion.div
            className="mx-3.5 sm:mx-4 mt-3 sm:mt-4 bg-white rounded-3xl shadow-[0_12px_36px_-6px_rgba(0,0,0,0.08),0_4px_16px_-2px_rgba(0,0,0,0.03)] border border-neutral-100/90 overflow-hidden relative"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
        >
            {/* Top Zepto/Blinkit Style Live Delivery Banner */}
            <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white px-4 py-3 sm:py-3.5 relative overflow-hidden">
                {/* Subtle decorative circles */}
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
                <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-teal-400/15 rounded-full blur-lg pointer-events-none" />

                <div className="flex items-center justify-between gap-3 relative z-10">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {/* Live Pulsing Dot */}
                        <span className="relative flex h-3 w-3 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-80" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 border border-white/60 shadow-xs" />
                        </span>

                        <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight truncate">
                                {distanceInfo.isDoorstep ? 'Arriving at your doorstep' : etaInfo.headline}
                            </h2>
                            <p className="text-[11px] text-emerald-100 font-medium truncate mt-0.5">
                                {distanceInfo.isDoorstep
                                    ? 'Partner has reached your location'
                                    : `${distanceInfo.full} • Live GPS tracking active`}
                            </p>
                        </div>
                    </div>

                    {/* On Time / Live Badge */}
                    <div className="shrink-0 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/25 flex items-center gap-1.5 shadow-xs">
                        <span className="text-[11px] font-bold tracking-wide">
                            {distanceInfo.isDoorstep ? '⚡ Doorstep' : '🛵 On the way'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Delivery Partner Details & Call Action */}
            <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 border-b border-neutral-100/80 bg-white">
                <div className="flex items-center gap-3 min-w-0">
                    {/* Partner Avatar with verified check */}
                    <div className="relative shrink-0">
                        <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/70 border border-emerald-200/60 flex items-center justify-center overflow-hidden shadow-xs">
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
                        {/* Verified Partner Badge */}
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-[9px] shadow-xs">
                            ✓
                        </span>
                    </div>

                    {/* Name & Trust Signals */}
                    <div className="min-w-0">
                        <h3 className="font-extrabold text-sm sm:text-base text-neutral-900 leading-snug truncate">
                            {parsedName.main}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200/60">
                                <span>★</span> 4.9
                            </span>
                            <span className="text-[11px] text-neutral-500 font-medium">
                                Delivery Partner
                            </span>
                            {partner?.vehicleNumber && (
                                <span className="text-[11px] text-neutral-400 font-medium truncate">
                                    • {partner.vehicleNumber}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Call Button (Blinkit style green pill button) */}
                {partner?.phone && onCall && (
                    <motion.button
                        className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300/80 font-bold text-xs sm:text-sm flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer active:scale-95 transition-all"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={onCall}
                        title={`Call ${parsedName.main}`}
                        aria-label={`Call ${parsedName.main}`}
                    >
                        <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-emerald-700"
                        >
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        <span>Call</span>
                    </motion.button>
                )}
            </div>

            {/* Live Metrics: Clean, uncluttered Blinkit/Zepto Cards (NO truncated labels) */}
            {isTracking && (
                <div className="p-3.5 sm:p-4 bg-gradient-to-b from-neutral-50/60 to-white">
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                        {/* ETA Card */}
                        <div className="bg-white rounded-2xl p-3 border border-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100/80">
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                            </div>
                            <div className="min-w-0">
                                <span className="text-[11px] font-semibold text-neutral-400 block leading-tight">
                                    Est. Time
                                </span>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                    <span className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                                        {etaInfo.value}
                                    </span>
                                    <span className="text-xs font-bold text-neutral-500">
                                        {etaInfo.unit}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Distance Card */}
                        <div className="bg-white rounded-2xl p-3 border border-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 border border-sky-100/80">
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            </div>
                            <div className="min-w-0">
                                <span className="text-[11px] font-semibold text-neutral-400 block leading-tight">
                                    Distance
                                </span>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                    <span className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                                        {distanceInfo.value}
                                    </span>
                                    {distanceInfo.unit && (
                                        <span className="text-xs font-bold text-neutral-500">
                                            {distanceInfo.unit}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Animated Quick-Commerce Progress Bar with Gliding Scooter */}
                    <div className="mt-3.5 pt-3 border-t border-neutral-100">
                        <div className="flex items-center justify-between text-[11px] font-bold text-neutral-600 mb-2">
                            <span className="flex items-center gap-1.5 text-emerald-700">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                                Live en route
                            </span>
                            <span className="text-neutral-500 font-semibold">
                                {distanceInfo.full}
                            </span>
                        </div>

                        {/* Progress Track */}
                        <div className="relative h-2.5 w-full bg-neutral-100 rounded-full overflow-visible p-[2px]">
                            <motion.div
                                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 rounded-full relative"
                                initial={{ width: '0%' }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                            >
                                {/* Gliding Scooter Icon on top of the progress head */}
                                <span
                                    className="absolute -right-3 -top-2.5 text-sm select-none drop-shadow-md"
                                    role="img"
                                    aria-label="scooter"
                                >
                                    🛵
                                </span>
                            </motion.div>
                        </div>

                        {/* Milestone Footnotes */}
                        <div className="flex items-center justify-between text-[10px] text-neutral-400 font-semibold mt-2.5 px-0.5">
                            <span>Packed & Dispatched</span>
                            <span className="text-emerald-700 font-bold">On the way</span>
                            <span>Doorstep</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Delivery OTP Security Card (Blinkit Style) */}
            {deliveryOtp && (
                <div className="mx-3.5 sm:mx-4 mb-3.5 bg-gradient-to-br from-amber-50/70 via-emerald-50/30 to-white rounded-2xl p-3.5 sm:p-4 border border-amber-200/70 shadow-xs relative overflow-hidden">
                    {/* Header: Label & Countdown Timer */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black tracking-wider uppercase shadow-xs">
                                <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                Delivery OTP
                            </span>
                            <span className="text-[11px] text-neutral-600 font-medium">
                                Share on arrival
                            </span>
                        </div>

                        {/* Timer Badge */}
                        <div
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold font-mono tracking-tight border ${
                                timeLeft < 60
                                    ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse'
                                    : 'bg-white border-neutral-200 text-neutral-700'
                            }`}
                        >
                            <svg
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={timeLeft < 60 ? 'text-rose-500' : 'text-neutral-500'}
                            >
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                            <span>{formatTime(timeLeft)}</span>
                        </div>
                    </div>

                    {/* Blinkit-Style OTP Container */}
                    <div className="bg-white rounded-2xl p-3 border border-amber-200/90 shadow-xs space-y-2.5">
                        {/* Digit Boxes: Centered and evenly spaced across full card width */}
                        <div 
                            onClick={handleCopyOtp}
                            className="flex items-center justify-between gap-1 sm:gap-2 select-all cursor-pointer group"
                            title="Click to copy OTP"
                        >
                            {otpDigits.map((digit, idx) => (
                                <span
                                    key={idx}
                                    className="flex-1 max-w-[44px] h-11 sm:h-12 rounded-xl bg-gradient-to-b from-amber-50/60 to-amber-100/30 border-2 border-amber-300/90 text-neutral-900 font-mono font-black text-xl sm:text-2xl flex items-center justify-center shadow-xs group-hover:border-amber-400 group-hover:scale-[1.02] transition-all"
                                >
                                    {digit}
                                </span>
                            ))}
                        </div>

                        {/* Copy Action Bar below digits: Full width, clean, never clips or breaks */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-amber-100">
                            <motion.button
                                onClick={handleCopyOtp}
                                className="flex-1 py-1.5 px-3 rounded-lg bg-amber-50 hover:bg-amber-100/90 text-amber-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                                whileTap={{ scale: 0.98 }}
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
                                            className="flex items-center gap-1.5 text-emerald-700 font-bold"
                                        >
                                            <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            <span>OTP Copied to Clipboard</span>
                                        </motion.span>
                                    ) : (
                                        <motion.span
                                            key="copy"
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0.8, opacity: 0 }}
                                            className="flex items-center gap-1.5 text-amber-900"
                                        >
                                            <svg
                                                width="13"
                                                height="13"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                            <span>Tap to Copy OTP</span>
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </motion.button>

                            {/* Refresh Button */}
                            {onRefreshOtp && (
                                <motion.button
                                    onClick={onRefreshOtp}
                                    className="ml-2 w-8 h-8 rounded-lg bg-white hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 border border-neutral-200 flex items-center justify-center transition-all active:scale-95 shadow-xs cursor-pointer shrink-0"
                                    whileTap={{ rotate: 180 }}
                                    transition={{ duration: 0.3 }}
                                    title="Request new OTP"
                                    aria-label="Request new OTP"
                                >
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M23 4v6h-6" />
                                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                    </svg>
                                </motion.button>
                            )}
                        </div>
                    </div>

                    {/* Security note */}
                    <p className="text-[10px] text-neutral-500 mt-2 flex items-center justify-center gap-1 font-medium text-center">
                        <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-amber-600 shrink-0"
                        >
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Share this OTP only after receiving and verifying your items
                    </p>
                </div>
            )}
        </motion.div>
    )
}
