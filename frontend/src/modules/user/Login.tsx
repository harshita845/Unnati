import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const videoRef = useRef<HTMLVideoElement>(null);

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
      const errorMsg = err.response?.data?.message ||
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

  const handleZomatoLogin = () => {
    // Handle Zomato login logic here
    navigate('/');
  };



  return (
    <div className="login-page-wrapper">
      <div className="login-card">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-50 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-neutral-50 transition-colors"
        aria-label="Back"
      >
        <svg width="18" height="18" className="sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Banner Image Section */}
      <div className="login-video-container">
        <img
          src="/assets/login/login_banner.png"
          alt="E-commerce"
          className="login-video"
        />
        {/* Subtle decorative overlay on desktop */}
        <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-transparent to-white/5 pointer-events-none" />
      </div>

      {/* Login Section */}
      <div className="login-section-container">
        <div className="w-full max-w-sm flex flex-col items-center">
          {/* Brand header on desktop */}
          <div className="hidden md:flex flex-col items-center mb-8">
            <img src={config?.appLogo || "/assets/unnati_logo.png"} alt="Logo" className="h-14 w-auto object-contain rounded-md mb-3" />
            <h2 className="text-2xl font-bold text-neutral-800">Welcome Back</h2>
            <p className="text-sm text-neutral-500 mt-1">Please login to your account of {config?.appName || 'Ecommerce Stores'}</p>
          </div>

          {!showOTP ? (
            <>
              {/* Mobile Number Input */}
              <div className="w-full mb-3 px-4 relative z-10">
                <label className="hidden md:block text-xs font-semibold text-neutral-600 mb-1.5 self-start">Mobile Number</label>
                <div className="flex items-center bg-white border border-neutral-300 rounded-lg overflow-hidden focus-within:border-neutral-400 transition-colors">
                  <div className="px-3 py-2 sm:py-2.5 text-sm font-medium text-neutral-400 border-r border-neutral-300 bg-white">
                    +91
                  </div>
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Enter mobile number"
                    className="flex-1 px-3 py-2 sm:py-2.5 text-sm placeholder:text-neutral-400 focus:outline-none bg-white text-black"
                    style={{ backgroundColor: '#ffffff' }}
                    maxLength={10}
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <div className="w-full mb-2 px-4 relative z-10 text-xs text-[var(--customer-primary-dark)] bg-[var(--customer-primary-alpha-10)] p-2 rounded">
                  {error}
                </div>
              )}

              {/* Continue Button */}
              <div className="w-full mb-2 px-4 relative z-10">
                <button
                  onClick={handleContinue}
                  disabled={mobileNumber.length !== 10 || loading}
                  className={`w-full py-2 sm:py-2.5 rounded-lg font-semibold text-sm transition-colors border px-3 ${mobileNumber.length === 10 && !loading
                    ? 'bg-[var(--customer-primary-alpha-10)] text-[var(--customer-primary-dark)] border-[var(--customer-primary)] hover:bg-[var(--customer-primary-alpha-20)]'
                    : 'bg-neutral-300 text-neutral-500 cursor-not-allowed border-neutral-300'
                    }`}
                >
                  {loading ? 'Calling...' : 'Continue'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* OTP Verification */}
              <div className="w-full mb-3 px-4 relative z-10 text-center">
                <p className="text-xs text-neutral-600 mb-2">
                  Enter the 4-digit OTP sent via voice call to
                </p>
                <p className="text-xs font-semibold text-neutral-800">+91 {mobileNumber}</p>
              </div>
              <div className="w-full mb-3 px-4 relative z-10 flex justify-center">
                <OTPInput onComplete={handleOTPComplete} disabled={loading} />
              </div>
              {error && (
                <div className="w-full mb-2 px-4 relative z-10 text-xs text-[var(--customer-primary-dark)] bg-[var(--customer-primary-alpha-10)] p-2 rounded text-center">
                  {error}
                </div>
              )}
              <div className="w-full mb-2 px-4 relative z-10 flex gap-2">
                <button
                  onClick={() => {
                    setShowOTP(false);
                    setError('');
                  }}
                  disabled={loading}
                  className="flex-1 py-2 rounded-lg font-semibold text-xs bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors border border-neutral-300"
                >
                  Change Number
                </button>
                <button
                  onClick={handleContinue}
                  disabled={loading}
                  className="flex-1 py-2 rounded-lg font-semibold text-xs bg-[var(--customer-primary-alpha-10)] text-[var(--customer-primary-dark)] border border-[var(--customer-primary)] hover:bg-[var(--customer-primary-alpha-20)] transition-colors"
                >
                  {loading ? 'Verifying...' : 'Resend OTP'}
                </button>
              </div>
            </>
          )}

          {/* Sign Up Link */}
          {!showOTP && (
            <div className="text-center pt-2 px-4 relative z-10">
              <p className="text-xs text-neutral-600">
                Don't have an account?{' '}
                <button
                  onClick={() => navigate('/signup')}
                  className="text-[var(--customer-primary-dark)] hover:text-[var(--customer-primary-dark)] font-semibold"
                >
                  Sign Up
                </button>
              </p>
            </div>
          )}

          {/* Privacy Text */}
          <p className="text-[9px] sm:text-[10px] text-neutral-500 text-center max-w-sm leading-tight px-4 relative z-10 pb-1 mt-6">
            Access your saved addresses from Ecommerce automatically!
          </p>
        </div>
      </div>
    </div>
    </div>
  );
}

