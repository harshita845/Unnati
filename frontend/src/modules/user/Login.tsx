import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, AlertCircle, Loader2, Check, ShieldCheck, Phone } from 'lucide-react';
import { shake, tapSoft, fadeUp, staggerContainer, staggerItem } from '../../lib/motion';
import { sendOTP, verifyOTP } from '../../services/api/auth/customerAuthService';
import { useAuth } from '../../context/AuthContext';
import OTPInput from '../../components/OTPInput';
import { requestNotificationPermission } from '../../services/pushNotificationService';
import { useAppContext } from '../../context/AppContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { config } = useAppContext();
  const [mobileNumber, setMobileNumber] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (mobileNumber.length !== 10) return;

    setLoading(true);
    setError('');

    try {
      const response = await sendOTP(mobileNumber);
      if (response.sessionId) {
        setSessionId(response.sessionId);
      }
      setShowOTP(true);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        (err.code === 'ECONNABORTED' || err.message?.includes('Network Error')
          ? 'Server is waking up or connection timed out. Please try again.'
          : 'Failed to send OTP. Please try again.');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (otp: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await verifyOTP(mobileNumber, otp, sessionId);
      if (response.success && response.data) {
        // Update auth context with user data
        login(response.data.token, {
          id: response.data.user.id,
          name: response.data.user.name,
          phone: response.data.user.phone,
          email: response.data.user.email,
          walletAmount: response.data.user.walletAmount,
          refCode: response.data.user.refCode,
          status: response.data.user.status,
        });

        // Request notification permission
        await requestNotificationPermission('customer', response.data.token);

        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const logoSrc = config?.appLogo || '/brand/unnati-logo.png';
  const isPhoneValid = mobileNumber.length === 10;

  return (
    <div className="login-page-wrapper customer-auth-wrapper">
      <div className="login-card">
        {/* Interactive Floating Back Button */}
        <motion.button
          onClick={() => navigate(-1)}
          whileHover={{ scale: 1.06, backgroundColor: '#ffffff' }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="absolute top-4 left-4 z-50 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 backdrop-blur-sm shadow-md border border-[var(--brand-border,#E9E2D3)] flex items-center justify-center text-[var(--brand-ink,#1C2B20)] hover:text-[var(--brand-green,#236B34)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-leaf,#5FA82E)]/30"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.25} />
        </motion.button>

        {/* Hero Banner Image Section */}
        <div className="login-video-container">
          <motion.img
            src="/assets/login/login_banner.png"
            alt="Unnati Shopping Experience"
            className="login-video"
            initial={{ scale: 1.04, opacity: 0.85 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
          {/* Soft decorative gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 pointer-events-none md:hidden" />
          <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-transparent via-white/0 to-white/10 pointer-events-none" />
        </div>

        {/* Login Form Section */}
        <div className="login-section-container">
          <motion.div
            variants={staggerContainer(0.08, 0.05)}
            initial="hidden"
            animate="show"
            className="w-full max-w-sm flex flex-col items-center"
          >
            {/* Prominent Unnati Branding Header */}
            <motion.div variants={staggerItem} className="flex flex-col items-center mb-4 sm:mb-5 text-center">
              <motion.img
                src={logoSrc}
                alt="Unnati"
                initial={{ opacity: 0, scale: 0.94, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="h-14 sm:h-16 w-auto object-contain mb-2 select-none drop-shadow-sm"
              />
              <motion.h1
                variants={staggerItem}
                className="font-display text-2xl sm:text-[1.7rem] font-bold text-[var(--brand-ink,#1C2B20)] tracking-tight leading-snug"
              >
                Welcome to Unnati
              </motion.h1>
              <motion.p
                variants={staggerItem}
                className="text-xs sm:text-sm text-[var(--brand-ink-muted,#5B6B60)] font-medium mt-1 max-w-[280px]"
              >
                Everything You Need, All in One Place.
              </motion.p>
            </motion.div>

            {/* Step Transitions (Phone Entry <-> OTP Verification) */}
            <div className="w-full relative z-10">
              <AnimatePresence mode="wait">
                {!showOTP ? (
                  <motion.div
                    key="phone-step"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full flex flex-col items-center"
                  >
                    {/* Mobile Number Input Container */}
                    <div className="w-full mb-3 px-1 sm:px-2">
                      <label
                        htmlFor="customer-login-mobile"
                        className="block text-xs font-semibold text-[var(--brand-ink-muted,#5B6B60)] mb-1.5 text-left"
                      >
                        Mobile Number
                      </label>
                      <div className="flex items-center bg-white border-2 border-[var(--brand-border,#E9E2D3)] rounded-xl overflow-hidden focus-within:border-[var(--brand-green,#236B34)] focus-within:ring-4 focus-within:ring-[var(--brand-leaf,#5FA82E)]/15 transition-all duration-200 shadow-sm">
                        <div className="px-3.5 py-3 text-sm font-semibold text-[var(--brand-ink,#1C2B20)] border-r border-[var(--brand-border,#E9E2D3)] bg-[var(--brand-cream-soft,#F6EFE2)]/50 select-none flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-[var(--brand-green,#236B34)] opacity-80" />
                          <span>+91</span>
                        </div>
                        <input
                          id="customer-login-mobile"
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="Enter 10-digit mobile number"
                          className="flex-1 px-3.5 py-3 text-sm font-medium placeholder:text-neutral-400 focus:outline-none bg-white text-[var(--brand-ink,#1C2B20)]"
                          maxLength={10}
                          disabled={loading}
                          autoFocus
                        />
                        {isPhoneValid && (
                          <div className="pr-3 text-[var(--brand-green,#236B34)] animate-in fade-in zoom-in duration-200">
                            <span className="w-5 h-5 rounded-full bg-[var(--brand-leaf-tint,#EAF5E0)] flex items-center justify-center">
                              <Check className="w-3.5 h-3.5" strokeWidth={3} />
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Error Alert Box */}
                    {error && (
                      <motion.div
                        key={error}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0, ...shake }}
                        role="alert"
                        className="w-full mb-3 px-1 sm:px-2"
                      >
                        <div className="flex items-center gap-2 text-xs text-[var(--brand-error,#D6402F)] bg-red-50/80 border border-red-200 px-3 py-2.5 rounded-xl">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 text-[var(--brand-error,#D6402F)]" />
                          <span className="font-medium text-left">{error}</span>
                        </div>
                      </motion.div>
                    )}

                    {/* Interactive Continue CTA Button */}
                    <div className="w-full mb-3 px-1 sm:px-2">
                      <motion.button
                        onClick={handleContinue}
                        disabled={!isPhoneValid || loading}
                        whileHover={isPhoneValid && !loading ? { y: -1 } : undefined}
                        whileTap={isPhoneValid && !loading ? tapSoft : undefined}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                          isPhoneValid && !loading
                            ? 'bg-[var(--brand-green,#236B34)] text-white hover:bg-[var(--brand-green-dark,#1B5128)] shadow-md shadow-[var(--brand-green,#236B34)]/25 cursor-pointer active:shadow-sm'
                            : 'bg-neutral-200 text-neutral-400 cursor-not-allowed border border-neutral-200'
                        }`}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Sending OTP...</span>
                          </>
                        ) : (
                          <span>Continue</span>
                        )}
                      </motion.button>
                    </div>

                    {/* Sign Up Link */}
                    <div className="text-center pt-1 px-2">
                      <p className="text-xs text-[var(--brand-ink-muted,#5B6B60)]">
                        Don't have an account?{' '}
                        <button
                          type="button"
                          onClick={() => navigate('/signup')}
                          className="text-[var(--brand-green,#236B34)] hover:text-[var(--brand-green-dark,#1B5128)] font-semibold transition-colors hover:underline focus:outline-none"
                        >
                          Sign Up
                        </button>
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="otp-step"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full flex flex-col items-center"
                  >
                    {/* OTP Header Note */}
                    <div className="w-full mb-3 px-2 text-center">
                      <p className="text-xs text-[var(--brand-ink-muted,#5B6B60)] mb-1">
                        Enter the 4-digit OTP sent via call/SMS to
                      </p>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--brand-leaf-tint,#EAF5E0)]/70 border border-[var(--brand-leaf,#5FA82E)]/30 rounded-full">
                        <span className="font-price text-sm font-bold text-[var(--brand-ink,#1C2B20)]">
                          +91 {mobileNumber}
                        </span>
                        <button
                          onClick={() => {
                            setShowOTP(false);
                            setError('');
                          }}
                          disabled={loading}
                          className="text-[11px] font-semibold text-[var(--brand-green,#236B34)] hover:underline ml-1 focus:outline-none"
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    {/* Enhanced OTP Input Component */}
                    <div className="w-full mb-3 px-2 flex justify-center">
                      <OTPInput
                        length={4}
                        onComplete={handleOTPComplete}
                        disabled={loading}
                        hasError={Boolean(error)}
                      />
                    </div>

                    {/* Error Alert Box */}
                    {error && (
                      <motion.div
                        key={error}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0, ...shake }}
                        role="alert"
                        className="w-full mb-3 px-1 sm:px-2"
                      >
                        <div className="flex items-center gap-2 text-xs text-[var(--brand-error,#D6402F)] bg-red-50/80 border border-red-200 px-3 py-2.5 rounded-xl">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 text-[var(--brand-error,#D6402F)]" />
                          <span className="font-medium text-left">{error}</span>
                        </div>
                      </motion.div>
                    )}

                    {/* Action Buttons: Change Number / Resend OTP */}
                    <div className="w-full mb-2 px-1 sm:px-2 flex gap-2.5">
                      <motion.button
                        type="button"
                        onClick={() => {
                          setShowOTP(false);
                          setError('');
                        }}
                        disabled={loading}
                        whileTap={{ scale: 0.97 }}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-xs bg-white text-[var(--brand-ink,#1C2B20)] hover:bg-[var(--brand-cream-soft,#F6EFE2)] transition-colors border border-[var(--brand-border,#E9E2D3)] shadow-sm disabled:opacity-50"
                      >
                        Change Number
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={handleContinue}
                        disabled={loading}
                        whileTap={{ scale: 0.97 }}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-xs bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green,#236B34)] border border-[var(--brand-leaf,#5FA82E)]/40 hover:bg-[var(--brand-leaf,#5FA82E)] hover:text-white transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Resending...</span>
                          </>
                        ) : (
                          <span>Resend OTP</span>
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Subtle E-commerce Benefit/Trust Badge */}
            <motion.div
              variants={staggerItem}
              className="mt-6 sm:mt-8 px-4 py-2 rounded-full bg-[var(--brand-cream-soft,#F6EFE2)]/60 border border-[var(--brand-border,#E9E2D3)]/70 flex items-center gap-2 max-w-xs text-center"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--brand-green,#236B34)] flex-shrink-0" />
              <p className="text-[10px] sm:text-[11px] text-[var(--brand-ink-muted,#5B6B60)] font-medium leading-tight">
                Access your saved addresses from Ecommerce automatically!
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
