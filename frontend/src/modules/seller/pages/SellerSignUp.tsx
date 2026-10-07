import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register, sendOTP, verifyOTP } from '../../../services/api/auth/sellerAuthService';
import OTPInput from '../../../components/OTPInput';
import GoogleMapsAutocomplete from '../../../components/GoogleMapsAutocomplete';
import { useAuth } from '../../../context/AuthContext';
import { getHeaderCategoriesPublic, HeaderCategory } from '../../../services/api/headerCategoryService';
import { formatDuration, formatINR, getSignupPlans, SignupPlan } from '../../../services/api/subscriptionService';
import { ALL_SELLER_MODULES } from '../../../constants/sellerModules';
import { useEffect } from 'react';
import { removeAuthToken } from '../../../services/api/config';
import { requestNotificationPermission } from '../../../services/pushNotificationService';
import { useAppContext } from '../../../context/AppContext';

export default function SellerSignUp() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { config } = useAppContext();
  const [formData, setFormData] = useState({
    sellerName: '',
    mobile: '',
    email: '',
    storeName: '',
    category: '',
    categories: [] as string[],
    address: '',
    city: '',
    panCard: '',
    taxName: '',
    taxNumber: '',
    searchLocation: '',
    latitude: '',
    longitude: '',
    serviceRadiusKm: '10', // Default 10km
    accountName: '',
    bankName: '',
    branch: '',
    accountNumber: '',
    ifsc: '',
  });
  const [showOTP, setShowOTP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<HeaderCategory[]>([]);
  // Subscription plans shown before the account is created, so the seller knows the cost up front
  const [plans, setPlans] = useState<SignupPlan[]>([]);
  const [planRequired, setPlanRequired] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');

  useEffect(() => {
    getSignupPlans()
      .then((res) => {
        setPlans(res.data?.plans || []);
        setPlanRequired(!!res.data?.required);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await getHeaderCategoriesPublic();
        if (Array.isArray(res)) {
          setCategories(res.filter(cat => cat.status === 'Published'));
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    fetchCats();
  }, []);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'mobile') {
      setFormData(prev => ({
        ...prev,
        [name]: value.replace(/\D/g, '').slice(0, 10),
      }));
    } else if (name === 'serviceRadiusKm') {
      // Allow only numbers and a single decimal point
      const cleanedValue = value.replace(/[^0-9.]/g, '');
      // Ensure only one decimal point
      const parts = cleanedValue.split('.');
      const finalValue = parts.length > 2 ? `${parts[0]}.${parts[1]}` : cleanedValue;

      setFormData(prev => ({
        ...prev,
        [name]: finalValue,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const toggleCategory = (cat: string) => {
    setFormData(prev => {
      const exists = prev.categories.includes(cat);
      const nextCategories = exists
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat];
      return {
        ...prev,
        categories: nextCategories,
        category: nextCategories[0] || '',
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields (password removed - not needed during signup)
    if (!formData.sellerName || !formData.mobile || !formData.email ||
      !formData.storeName || formData.categories.length === 0 || !formData.address || !formData.city) {
      setError('Please fill all required fields (select at least one category)');
      return;
    }

    if (formData.mobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    if (planRequired && !selectedPlanId) {
      setError('Please choose a subscription plan. Every store needs an active plan to sell.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Validate location is selected
      if (!formData.searchLocation || !formData.latitude || !formData.longitude ||
          formData.latitude === '0' || formData.longitude === '0') {
        setError('Please search and SELECT your store location from the suggestions list.');
        return;
      }

      // Validate service radius
      const radius = parseFloat(formData.serviceRadiusKm);
      if (isNaN(radius) || radius < 0.1 || radius > 100) {
        setError('Service radius must be between 0.1 and 100 kilometers');
        return;
      }

      const response = await register({
        sellerName: formData.sellerName,
        mobile: formData.mobile,
        email: formData.email,
        storeName: formData.storeName,
        category: formData.categories[0], // primary
        categories: formData.categories,
        address: formData.address || formData.searchLocation,
        city: formData.city,
        searchLocation: formData.searchLocation,
        latitude: formData.latitude,
        longitude: formData.longitude,
        serviceRadiusKm: formData.serviceRadiusKm,
        ...(selectedPlanId ? { selectedPlanId } : {}),
      });

      if (response.success) {
        // Clear token from registration (we'll get it after OTP verification)
        removeAuthToken();
        // Registration successful, now send OTP for verification
        try {
          await sendOTP(formData.mobile);
          setShowOTP(true);
        } catch (otpErr: any) {
          setError(otpErr.response?.data?.message || 'Registration successful but failed to send OTP.');
        }

        // Capture FCM Token immediately after registration (even before OTP)
        if (response.data?.token) {
          requestNotificationPermission('seller', response.data.token);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (otp: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await verifyOTP(formData.mobile, otp);
      if (response.success && response.data) {
        // Update auth context with seller data
        login(response.data.token, {
          id: response.data.user.id,
          name: response.data.user.sellerName,
          email: response.data.user.email,
          phone: response.data.user.mobile,
          userType: 'Seller',
          storeName: response.data.user.storeName,
          status: response.data.user.status,
          address: response.data.user.address,
          city: response.data.user.city,
          accessibleModules: (response.data.user as any).accessibleModules,
        } as any);

        // Request notification permission
        await requestNotificationPermission('seller', response.data.token);

        // A plan was chosen: go straight to paying for it (the store stays locked until it's active)
        navigate(selectedPlanId ? `/seller/subscriptions?plan=${selectedPlanId}` : '/seller', { replace: true });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
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
            alt="Seller Portal"
            className="login-video"
          />
          {/* Subtle decorative overlay on desktop */}
          <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-transparent to-white/5 pointer-events-none" />
        </div>

        {/* Sign Up Section */}
        <div className="login-section-container">
          <div className="w-full max-w-sm flex flex-col items-center">
            {/* Header / Logo */}
            <div className="flex flex-col items-center mb-4">
              <img
                src={config?.appLogo || "/assets/unnati_logo.png"}
                alt={config?.appName || "Ecommerce"}
                className="h-12 w-auto object-contain mb-1"
              />
              <h1 className="text-lg font-bold text-neutral-800">Seller Sign Up</h1>
              <p className="text-neutral-500 text-[10px] mt-0.5">Create your seller account</p>
            </div>

            {/* Sign Up Form */}
            <div className="p-3 w-full space-y-2 seller-signup-form" style={{ maxHeight: '280px', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <style>{`
                .seller-signup-form::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
          {!showOTP ? (
            <form onSubmit={handleSubmit} className="space-y-2 md:space-y-4">
              {/* Required Fields Section */}
              <div className="space-y-2 md:space-y-4">
                <h3 className="text-sm font-semibold text-neutral-700 border-b pb-2">Required Information</h3>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Seller Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="sellerName"
                    value={formData.sellerName}
                    onChange={handleInputChange}
                    placeholder="Enter your name"
                    required
                    className="w-full px-3 py-1.5 md:py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)]"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center bg-white border border-neutral-300 rounded-lg overflow-hidden focus-within:border-[var(--primary-color)] focus-within:ring-2 focus-within:ring-[var(--primary-alpha-30)]">
                    <div className="px-3 py-2.5 text-sm font-medium text-neutral-600 border-r border-neutral-300 bg-neutral-50">
                      +91
                    </div>
                    <input
                      type="tel"
                      name="mobile"
                      value={formData.mobile}
                      onChange={handleInputChange}
                      placeholder="Enter mobile number"
                      required
                      maxLength={10}
                      className="flex-1 px-3 py-1.5 md:py-2 text-sm placeholder:text-neutral-400 focus:outline-none"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter email address"
                    required
                    className="w-full px-3 py-1.5 md:py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)]"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Store Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="storeName"
                    value={formData.storeName}
                    onChange={handleInputChange}
                    placeholder="Enter store name"
                    required
                    className="w-full px-3 py-1.5 md:py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)]"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Categories <span className="text-red-500">*</span>
                  </label>
                  {categories.length === 0 ? (
                    <div className="text-sm text-neutral-500 py-2">
                      Loading categories...
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border border-neutral-200 rounded-lg">
                      {categories.map((cat) => {
                        const checked = formData.categories.includes(cat.name);
                        return (
                          <label key={cat._id} className="flex items-center gap-2 text-sm text-neutral-700">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCategory(cat.name)}
                              disabled={loading}
                              className="h-4 w-4 text-[var(--primary-dark)] border-neutral-300 rounded focus:ring-[var(--primary-color)]"
                            />
                            <span>{cat.name}</span>
                            {cat.subscriptionRequired && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium whitespace-nowrap">
                                Plan required
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {formData.categories.length === 0 && categories.length > 0 && (
                    <p className="text-xs text-red-600 mt-1">Select at least one category</p>
                  )}
                </div>

                {/* Subscription plan: shown before signing up so the seller knows the cost up front */}
                {plans.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Subscription plan {planRequired && <span className="text-red-500">*</span>}
                    </label>
                    <p className="text-xs text-neutral-500 mb-2">
                      {planRequired
                        ? "Every store needs an active plan to sell. You'll pay right after creating your account; your store goes live once the plan is active and your account is approved."
                        : "Optional now. Some categories need a plan to sell; you can also subscribe later from your seller panel."}
                    </p>
                    <div className="space-y-2">
                      {plans.map((plan) => {
                        const groups = Array.from(new Set(plan.categories.map((c) => c.headerCategory || c.name)));
                        const matches = formData.categories.length > 0 && groups.some((g) => formData.categories.includes(g));
                        const unlocked = ALL_SELLER_MODULES.filter((m) => !m.isEssential && plan.accessibleModules.includes(m.key)).map((m) => m.label);
                        const selected = selectedPlanId === plan._id;
                        return (
                          <label
                            key={plan._id}
                            className={`block rounded-lg border p-3 cursor-pointer text-left ${selected ? 'border-[var(--primary-color)] ring-2 ring-[var(--primary-alpha-30)] bg-[var(--primary-alpha-10)]' : 'border-neutral-200'}`}>
                            <div className="flex items-start gap-2">
                              <input
                                type="radio"
                                name="selectedPlan"
                                checked={selected}
                                onChange={() => setSelectedPlanId(plan._id)}
                                disabled={loading}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold text-neutral-900">{plan.name}</span>
                                  {matches && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--primary-alpha-20)] text-[var(--primary-darker)] font-medium whitespace-nowrap">
                                      Fits your categories
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-bold text-[var(--primary-dark)]">
                                  {formatINR(plan.totalPrice)}
                                  <span className="text-xs font-medium text-neutral-500"> / {formatDuration(plan.durationValue, plan.durationUnit)}</span>
                                  {plan.gstPercent > 0 && <span className="text-[10px] font-normal text-neutral-500"> incl. {plan.gstPercent}% GST</span>}
                                </p>
                                {plan.description && <p className="text-xs text-neutral-600 mt-0.5">{plan.description}</p>}
                                <p className="text-[11px] text-neutral-500 mt-1">Categories: {groups.join(', ') || '—'}</p>
                                <p className="text-[11px] text-neutral-500">
                                  {plan.limits?.maxProducts ? `Up to ${plan.limits.maxProducts} products` : 'Unlimited products'}
                                  {unlocked.length ? ` · Includes: ${unlocked.join(', ')}` : ''}
                                </p>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Store Location <span className="text-red-500">*</span>
                  </label>
                  <GoogleMapsAutocomplete
                    value={formData.searchLocation}
                    onChange={(address: string, lat: number, lng: number, placeName: string, components?: { city?: string; state?: string }) => {
                      setFormData(prev => ({
                        ...prev,
                        searchLocation: address,
                        latitude: lat.toString(),
                        longitude: lng.toString(),
                        address: address,
                        city: components?.city || prev.city,
                      }));
                    }}
                    placeholder="Search and select your store location..."
                    disabled={loading}
                    required
                  />
                  {formData.latitude && formData.longitude && (
                    <p className="mt-1 text-xs text-neutral-500">
                      Location: {formData.latitude}, {formData.longitude}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Delivery/Service Radius (KM) <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-neutral-500 ml-1">(Distance you can deliver)</span>
                  </label>
                  <input
                    type="number"
                    name="serviceRadiusKm"
                    value={formData.serviceRadiusKm}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (['e', 'E', '+', '-'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    placeholder="Enter service radius in KM (e.g. 10)"
                    required
                    min="0.1"
                    max="100"
                    step="0.1"
                    className="w-full px-3 py-1.5 md:py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)]"
                    disabled={loading}
                  />
                  <p className="mt-1 text-xs text-neutral-500">
                    Only customers within this radius can see and order your products
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Enter city"
                    required
                    className="w-full px-3 py-1.5 md:py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)]"
                    disabled={loading}
                  />
                </div>

                {/* Hidden fields for coordinates */}
                <input type="hidden" name="latitude" value={formData.latitude} />
                <input type="hidden" name="longitude" value={formData.longitude} />



              </div>

              {/* Optional Fields Section */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-semibold text-neutral-700 border-b pb-2">Optional Information</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">PAN Card</label>
                    <input
                      type="text"
                      name="panCard"
                      value={formData.panCard}
                      onChange={handleInputChange}
                      placeholder="PAN Card Number"
                      className="w-full px-3 py-1.5 md:py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)]"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Tax Name</label>
                    <input
                      type="text"
                      name="taxName"
                      value={formData.taxName}
                      onChange={handleInputChange}
                      placeholder="Tax Name"
                      className="w-full px-3 py-1.5 md:py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)]"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Tax Number</label>
                    <input
                      type="text"
                      name="taxNumber"
                      value={formData.taxNumber}
                      onChange={handleInputChange}
                      placeholder="Tax Number"
                      className="w-full px-3 py-1.5 md:py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)]"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">IFSC Code</label>
                    <input
                      type="text"
                      name="ifsc"
                      value={formData.ifsc}
                      onChange={handleInputChange}
                      placeholder="IFSC Code"
                      className="w-full px-3 py-1.5 md:py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)]"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-[0.98] ${!loading
                  ? 'bg-gradient-to-r from-[var(--primary-color)] to-[var(--primary-dark)] text-white hover:shadow-xl'
                  : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                  }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating Account...</span>
                  </div>
                ) : 'Sign Up'}
              </button>

              {/* Login Link */}
              <div className="text-center pt-2 border-t border-neutral-200">
                <p className="text-sm text-neutral-600">
                  Already have a seller account?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/seller/login')}
                    className="text-[var(--primary-color)] hover:text-[var(--primary-dark)] font-bold"
                  >
                    Login
                  </button>
                </p>
              </div>
            </form>
          ) : (
            /* OTP Verification Form */
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-neutral-600 mb-2">
                  Enter the 4-digit OTP sent to
                </p>
                <p className="text-sm font-semibold text-neutral-800">+91 {formData.mobile}</p>
              </div>

              <OTPInput onComplete={handleOTPComplete} disabled={loading} />

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded text-center">
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
                  className="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors border border-neutral-300"
                >
                  Back
                </button>
                <button
                  onClick={async () => {
                    setLoading(true);
                    setError('');
                    try {
                      await sendOTP(formData.mobile);
                    } catch (err: any) {
                      setError(err.response?.data?.message || 'Failed to resend OTP.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-[var(--primary-dark)] text-white hover:bg-[var(--primary-darker)] transition-colors"
                >
                  {loading ? 'Sending...' : 'Resend OTP'}
                </button>
              </div>
            </div>
          )}
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

