import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  register,
  sendOTP,
  verifyOTP,
} from "../../../services/api/auth/deliveryAuthService";
import { uploadDocument } from "../../../services/api/uploadService";
import { validateDocumentFile } from "../../../utils/imageUpload";
import OTPInput from "../../../components/OTPInput";
import { removeAuthToken } from "../../../services/api/config";
import { requestNotificationPermission } from "../../../services/pushNotificationService";
import { useAuth } from "../../../context/AuthContext";
import { useAppContext } from "../../../context/AppContext";

export default function DeliverySignUp() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { config } = useAppContext();
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    email: "",
    dateOfBirth: "",
    password: "",
    address: "",
    city: "",
    pincode: "",
    drivingLicenseUrl: "",
    nationalIdentityCardUrl: "",
    accountName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    bonusType: "",
  });

  // File state for UI
  const [drivingLicenseFile, setDrivingLicenseFile] = useState<File | null>(
    null
  );
  const [nationalIdentityCardFile, setNationalIdentityCardFile] =
    useState<File | null>(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isCityLoading, setIsCityLoading] = useState(false);

  const bonusTypes = [
    "Select Bonus Type",
    "Fixed or Salaried",
    "Fixed",
    "Salaried",
    "Commission Based",
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "mobile") {
      setFormData((prev) => ({
        ...prev,
        [name]: value.replace(/\D/g, "").slice(0, 10),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const fetchCityFromLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setIsCityLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
          );
          const data = await response.json();
          if (data.status === "OK") {
            const addressComponents = data.results[0].address_components;
            const cityComponent = addressComponents.find((c: any) =>
              c.types.includes("locality") || c.types.includes("administrative_area_level_2")
            );
            if (cityComponent) {
              setFormData((prev) => ({ ...prev, city: cityComponent.long_name }));
            }
          } else {
            setError("Could not fetch city from your location");
          }
        } catch (err) {
          setError("Failed to fetch city details");
        } finally {
          setIsCityLoading(false);
        }
      },
      (err) => {
        setError("Location access denied. Please type your city manually.");
        setIsCityLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files } = e.target;
    if (!files || !files[0]) return;

    const file = files[0];
    const validation = validateDocumentFile(file);
    if (!validation.valid) {
      setError(validation.error || "Invalid document file");
      return;
    }

    if (name === "drivingLicense") {
      setDrivingLicenseFile(file);
    } else if (name === "nationalIdentityCard") {
      setNationalIdentityCardFile(file);
    }
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (
      !formData.name ||
      !formData.mobile ||
      !formData.email ||
      !formData.password ||
      !formData.address ||
      !formData.city
    ) {
      setError("Please fill all required fields");
      return;
    }

    if (formData.mobile.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Upload documents if provided
      let drivingLicenseUrl = formData.drivingLicenseUrl;
      let nationalIdentityCardUrl = formData.nationalIdentityCardUrl;

      if (drivingLicenseFile || nationalIdentityCardFile) {
        setUploadingDocs(true);

        if (drivingLicenseFile) {
          const drivingLicenseResult = await uploadDocument(
            drivingLicenseFile,
            "Unnati Stores/delivery/documents"
          );
          drivingLicenseUrl = drivingLicenseResult.secureUrl;
        }

        if (nationalIdentityCardFile) {
          const nationalIdResult = await uploadDocument(
            nationalIdentityCardFile,
            "Unnati Stores/delivery/documents"
          );
          nationalIdentityCardUrl = nationalIdResult.secureUrl;
        }

        setUploadingDocs(false);
      }

      const response = await register({
        name: formData.name,
        mobile: formData.mobile,
        email: formData.email,
        dateOfBirth: formData.dateOfBirth || undefined,
        password: formData.password,
        address: formData.address,
        city: formData.city,
        pincode: formData.pincode || undefined,
        drivingLicense: drivingLicenseUrl || undefined,
        nationalIdentityCard: nationalIdentityCardUrl || undefined,
        accountName: formData.accountName || undefined,
        bankName: formData.bankName || undefined,
        accountNumber: formData.accountNumber || undefined,
        ifscCode: formData.ifscCode || undefined,
        bonusType: formData.bonusType || undefined,
      });

      if (response.success) {
        // Clear token from registration (we'll get it after OTP verification)
        removeAuthToken();
        // Registration successful, now send SMS OTP for verification
        try {
          const otpRes = await sendOTP(formData.mobile);
          if (otpRes.sessionId) setSessionId(otpRes.sessionId);
          setShowOTP(true);
        } catch (otpErr: any) {
          setError(
            otpErr.message ||
            "Registration successful but failed to send OTP."
          );
        }

        // Capture FCM Token immediately after registration (even before OTP)
        console.log('[FCM-DEBUG] Delivery Register Response Data:', response.data);
        if (response.data?.token) {
          console.log('[FCM-DEBUG] Found token after register, requesting permission...');
          requestNotificationPermission('delivery', response.data.token);
        } else {
          console.warn('[FCM-DEBUG] No token found in delivery register response');
        }
      }
    } catch (err: any) {
      setError(
        err.message || "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (otp: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await verifyOTP(formData.mobile, otp, sessionId);
      if (response.success && response.data) {
        // Update auth context with delivery data
        login(response.data.token, {
          ...response.data.user,
          userType: 'Delivery'
        });

        // Request notification permission
        await requestNotificationPermission('delivery', response.data.token);

        navigate("/delivery");
      }
    } catch (err: any) {
      setError(err.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper customer-auth-wrapper">
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
        <div className="login-video-container md:!h-auto md:self-stretch md:!bg-[var(--brand-cream-soft,#F6EFE2)]">
          <img
            src="/assets/login/login_banner.png"
            alt="Delivery Portal"
            className="login-video md:!h-auto md:!w-full"
          />
          {/* Subtle decorative overlay on desktop */}
          <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-transparent to-white/5 pointer-events-none" />
        </div>

        {/* Sign Up Section */}
        <div className="login-section-container">
          <div className="w-full max-w-sm sm:max-w-md flex flex-col items-center">
            {/* Header / Logo */}
            <div className="flex flex-col items-center mb-4 sm:mb-6">
              <img
                src={config?.appLogo || "/assets/unnati_logo.png"}
                alt={config?.appName || "Unnati"}
                className="h-12 w-auto object-contain mb-1.5"
              />
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-800">Delivery Sign Up</h1>
              <p className="text-neutral-500 text-xs mt-0.5">Create your delivery partner account</p>
            </div>

            {/* Sign Up Form */}
            <div className="w-full space-y-4 delivery-signup-form py-1">
          {!showOTP ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Personal Information */}
              <div className="space-y-3.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 border-b border-neutral-200 pb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--primary-color)]"></span>
                  Personal Information
                </h3>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-neutral-700 mb-1.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] transition-all"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-neutral-700 mb-1.5">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center bg-white border border-neutral-300 rounded-xl overflow-hidden focus-within:border-[var(--primary-color)] focus-within:ring-2 focus-within:ring-[var(--primary-alpha-30)] transition-all">
                    <div className="px-3.5 py-2.5 text-sm font-semibold text-neutral-600 border-r border-neutral-300 bg-neutral-50">
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
                      className="flex-1 px-3.5 py-2.5 text-sm placeholder:text-neutral-400 focus:outline-none bg-transparent"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-neutral-700 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter email address"
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] transition-all"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-neutral-700 mb-1.5">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] transition-all text-neutral-700"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-neutral-700 mb-1.5">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter password (min 6 characters)"
                    required
                    minLength={4}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] transition-all"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-neutral-700 mb-1.5">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Enter your address"
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] transition-all"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-neutral-700 mb-1.5">
                    City <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="Enter your city"
                      required
                      className="w-full px-3.5 py-2.5 pr-10 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] transition-all"
                      disabled={loading || isCityLoading}
                    />
                    <button
                      type="button"
                      onClick={fetchCityFromLocation}
                      disabled={isCityLoading || loading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[var(--primary-color)] hover:bg-[var(--primary-alpha-10)] rounded-lg transition-colors disabled:text-neutral-400"
                      title="Fetch current location"
                    >
                      {isCityLoading ? (
                        <div className="w-4 h-4 border-2 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-neutral-700 mb-1.5">
                    Pincode
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleInputChange}
                    placeholder="Enter pincode"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] transition-all"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Bank Information */}
              <div className="space-y-3.5 pt-3 border-t border-neutral-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 border-b border-neutral-200 pb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--primary-color)]"></span>
                  Bank Account Information (Optional)
                </h3>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-neutral-700 mb-1.5">
                    Account Name
                  </label>
                  <input
                    type="text"
                    name="accountName"
                    value={formData.accountName}
                    onChange={handleInputChange}
                    placeholder="Account holder name"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] transition-all"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-neutral-700 mb-1.5">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleInputChange}
                    placeholder="Bank name"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] transition-all"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-neutral-700 mb-1.5">
                    Account Number
                  </label>
                  <input
                    type="text"
                    name="accountNumber"
                    value={formData.accountNumber}
                    onChange={handleInputChange}
                    placeholder="Account number"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] transition-all"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-neutral-700 mb-1.5">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    name="ifscCode"
                    value={formData.ifscCode}
                    onChange={handleInputChange}
                    placeholder="IFSC code"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] transition-all"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-neutral-700 mb-1.5">
                    Bonus Type
                  </label>
                  <select
                    name="bonusType"
                    value={formData.bonusType}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] transition-all cursor-pointer"
                    disabled={loading}>
                    {bonusTypes.map((type) => (
                      <option
                        key={type}
                        value={type === "Select Bonus Type" ? "" : type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Documents Section */}
              <div className="space-y-3.5 pt-3 border-t border-neutral-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 border-b border-neutral-200 pb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--primary-color)]"></span>
                  Documents (Optional)
                </h3>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-neutral-700 mb-1.5">
                    Driving License
                  </label>
                  <div className="space-y-1.5">
                    <input
                      type="file"
                      name="drivingLicense"
                      onChange={handleFileChange}
                      accept="image/*,.pdf"
                      className="w-full px-3 py-2 text-xs text-neutral-700 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--primary-color)] file:text-white hover:file:bg-[var(--primary-dark)] transition-all cursor-pointer"
                      disabled={loading || uploadingDocs}
                    />
                    {drivingLicenseFile && (
                      <p className="text-xs text-[var(--primary-color)] font-medium flex items-center gap-1">
                        <span>✓</span> {drivingLicenseFile.name}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-neutral-700 mb-1.5">
                    National Identity Card
                  </label>
                  <div className="space-y-1.5">
                    <input
                      type="file"
                      name="nationalIdentityCard"
                      onChange={handleFileChange}
                      accept="image/*,.pdf"
                      className="w-full px-3 py-2 text-xs text-neutral-700 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--primary-color)] file:text-white hover:file:bg-[var(--primary-dark)] transition-all cursor-pointer"
                      disabled={loading || uploadingDocs}
                    />
                    {nationalIdentityCardFile && (
                      <p className="text-xs text-[var(--primary-color)] font-medium flex items-center gap-1">
                        <span>✓</span> {nationalIdentityCardFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || uploadingDocs}
                className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.99] ${
                  !loading && !uploadingDocs
                    ? "bg-[var(--primary-color)] text-white hover:bg-[var(--primary-dark)] shadow-[var(--primary-alpha-20)]"
                    : "bg-neutral-300 text-neutral-500 cursor-not-allowed"
                }`}>
                {uploadingDocs
                  ? "Uploading Documents..."
                  : loading
                    ? "Creating Account..."
                    : "Sign Up"}
              </button>

              {/* Login Link */}
              <div className="text-center pt-3 border-t border-neutral-200">
                <p className="text-sm text-neutral-600">
                  Already have a delivery partner account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/delivery/login")}
                    className="text-[var(--primary-color)] hover:text-[var(--primary-dark)] font-bold transition-colors">
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
                  Enter the 4-digit OTP sent via voice call to
                </p>
                <p className="text-base font-bold text-neutral-800">
                  +91 {formData.mobile}
                </p>
              </div>

              <OTPInput onComplete={handleOTPComplete} disabled={loading} />

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl text-center">
                  {error}
                </div>
              )}

              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    setShowOTP(false);
                    setError("");
                  }}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors border border-neutral-300">
                  Back
                </button>
                <button
                  onClick={async () => {
                    setLoading(true);
                    setError("");
                    try {
                      const res = await sendOTP(formData.mobile);
                      if (res.sessionId) setSessionId(res.sessionId);
                    } catch (err: any) {
                      setError(
                        err.message || "Failed to resend OTP."
                      );
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-[var(--primary-color)] text-white hover:bg-[var(--primary-dark)] transition-colors shadow-sm">
                  {loading ? "Calling..." : "Resend OTP"}
                </button>
              </div>
            </div>
          )}
            </div>

            {/* Footer Text */}
            <p className="mt-4 text-[10px] text-neutral-400 text-center max-w-sm leading-relaxed">
              By continuing, you agree to Unnati Stores's Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
