import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOTP, verifyOTP } from '../../../services/api/auth/adminAuthService';
import OTPInput from '../../../components/OTPInput';
import { useAuth } from '../../../context/AuthContext';
import { useAppContext } from '../../../context/AppContext';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { config } = useAppContext();
  const [mobileNumber, setMobileNumber] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleMobileLogin = async () => {
    if (mobileNumber.length !== 10) return;

    setLoading(true);
    setError("");

    try {
      await sendOTP(mobileNumber);
      setShowOTP(true);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message ||
        (err.code === 'ECONNABORTED' || err.message?.includes('Network Error')
          ? "Server is waking up or connection timed out. Please try again."
          : "Failed to send OTP. Please try again.");
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (otp: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await verifyOTP(mobileNumber, otp);
      if (response.success && response.data) {
        // Update AuthContext with token and user data
        login(response.data.token, {
          ...response.data.user,
          userType: "Admin",
        });
        navigate("/admin");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEcommerceStoresLogin = () => {
    // Handle Ecommerce login logic here
    navigate("/admin");
  };

  const handleSellerLogin = () => {
    // Navigate to seller login page
    navigate("/seller/login");
  };

  const handleStaffLogin = () => {
    navigate("/admin/staff-login");
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
            alt="Admin Portal"
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
              <h1 className="text-xl font-bold text-neutral-800">Admin Login</h1>
              <p className="text-neutral-500 text-xs mt-0.5">Access your admin dashboard</p>
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
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleMobileLogin}
                    disabled={mobileNumber.length !== 10 || loading}
                    className={`w-full py-2 sm:py-2.5 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] ${mobileNumber.length === 10 && !loading
                      ? 'bg-gradient-to-r from-[var(--primary-color)] to-[var(--primary-dark)] text-white hover:shadow-sm'
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
                      className="flex-1 py-2 rounded-lg font-semibold text-xs bg-gradient-to-r from-[var(--primary-color)] to-[var(--primary-dark)] text-white hover:bg-[var(--primary-dark)] transition-all active:scale-[0.98]"
                    >
                      {loading ? 'Verifying...' : 'Resend OTP'}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleStaffLogin}
                className="w-full py-2 rounded-lg font-semibold text-xs bg-white border border-[var(--primary-color)]/40 text-[var(--primary-color)] hover:bg-[var(--primary-color)]/5 transition-colors"
              >
                Staff Login
              </button>
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
