import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOTP, verifyOTP } from '../../../services/api/auth/deliveryAuthService';
import OTPInput from '../../../components/OTPInput';
import { useAuth } from '../../../context/AuthContext';
import { requestNotificationPermission } from '../../../services/pushNotificationService';
import { useAppContext } from '../../../context/AppContext';

export default function DeliveryLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { config } = useAppContext();
  const [mobileNumber, setMobileNumber] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isNotRegistered, setIsNotRegistered] = useState(false);

  const handleMobileLogin = async () => {
    if (mobileNumber.length !== 10) return;

    setLoading(true);
    setError('');
    setIsNotRegistered(false);

    try {
      const response = await sendOTP(mobileNumber);
      if (response.success && response.sessionId) {
        setSessionId(response.sessionId);
        setShowOTP(true);
      } else {
        setError(response.message || 'Failed to initiate OTP');
      }
    } catch (err: any) {
      const status = err.response?.status;
      const message = err.response?.data?.message ||
        (err.code === 'ECONNABORTED' || err.message?.includes('Network Error')
          ? 'Server is waking up or connection timed out. Please try again.'
          : 'Failed to send OTP. Please try again.');

      setError(message);

      // Check for Bad Request / Not Found specific to user not found
      if ((status === 400 || status === 404) && (message.toLowerCase().includes('not found') || message.toLowerCase().includes('register'))) {
        setIsNotRegistered(true);
      }
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
        // Update auth context
        login(response.data.token, {
          ...response.data.user,
          userType: 'Delivery'
        });

        // Request notification permission
        await requestNotificationPermission('delivery', response.data.token);

        navigate('/delivery');
      }
    } catch (err: any) {
      // Also handle 401 Unauthorized for verify step
      const message = err.response?.data?.message || 'Invalid OTP. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
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
            alt="Delivery Portal"
            className="login-video"
          />
          {/* Subtle decorative overlay on desktop */}
          <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-transparent to-white/5 pointer-events-none" />
        </div>

        {/* Login Section */}
        <div className="login-section-container">
          <div className="w-full max-w-sm flex flex-col items-center">
            {/* Header / Logo */}
            <div className="flex flex-col items-center mb-6">
              <img
                src={config?.appLogo || "/assets/unnati_logo.png"}
                alt={config?.appName || "Ecommerce"}
                className="h-16 w-auto object-contain mb-2"
              />
              <h1 className="text-xl font-bold text-neutral-800">Delivery Login</h1>
              <p className="text-neutral-500 text-xs mt-0.5">Access your delivery dashboard</p>
            </div>

            {/* Login Form */}
            <div className="w-full space-y-3 px-4">
              {!showOTP ? (
                /* Mobile Login Form */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                      Mobile Number
                    </label>
                    <div className="flex items-center bg-white border border-neutral-300 rounded-lg overflow-hidden focus-within:border-[var(--primary-color)] transition-colors">
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
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 flex flex-col gap-2">
                      <span>{error}</span>
                      {isNotRegistered && (
                        <button
                          onClick={() => navigate('/delivery/signup')}
                          className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 py-1.5 px-3 rounded self-start transition-colors"
                        >
                          Register Now
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleMobileLogin}
                    disabled={mobileNumber.length !== 10 || loading}
                    className={`w-full py-2 sm:py-2.5 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] ${mobileNumber.length === 10 && !loading
                      ? 'bg-[var(--primary-dark)] text-white hover:bg-[var(--primary-darker)] shadow-sm'
                      : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                      }`}
                  >
                    {loading ? 'Sending...' : 'Continue'}
                  </button>
                </div>
              ) : (
                /* OTP Verification Form */
                <div className="space-y-3">
                  <div className="text-center">
                    <p className="text-xs text-neutral-600 mb-2">
                      Enter the 4-digit OTP sent to
                    </p>
                    <p className="text-xs font-semibold text-neutral-800">+91 {mobileNumber}</p>
                  </div>

                  <div className="flex justify-center">
                    <OTPInput onComplete={handleOTPComplete} disabled={loading} />
                  </div>

                  {error && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded text-center">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowOTP(false);
                        setError('');
                      }}
                      disabled={loading}
                      className="flex-1 py-2 rounded-lg font-semibold text-xs bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors border border-neutral-300"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleMobileLogin}
                      disabled={loading}
                      className="flex-1 py-2 rounded-lg font-semibold text-xs bg-[var(--primary-dark)] text-white hover:bg-[var(--primary-darker)] transition-colors"
                    >
                      {loading ? 'Verifying...' : 'Resend OTP'}
                    </button>
                  </div>
                </div>
              )}

              {/* Sign Up Link */}
              <div className="text-center pt-2 mt-4 border-t border-neutral-200">
                <p className="text-xs text-neutral-600">
                  Don't have a delivery partner account?{' '}
                  <button
                    onClick={() => navigate('/delivery/signup')}
                    className="text-[var(--primary-dark)] hover:text-[var(--primary-darker)] font-semibold"
                  >
                    Sign Up
                  </button>
                </p>
              </div>
            </div>

            {/* Footer Text */}
            <p className="mt-4 text-[9px] sm:text-[10px] text-neutral-500 text-center max-w-sm leading-tight">
              By continuing, you agree to Ecommerce's Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
