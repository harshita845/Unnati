import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DeliveryHeader from '../components/DeliveryHeader';
import DeliveryBottomNav from '../components/DeliveryBottomNav';
import { updateSettings, getDeliveryProfile } from '../../../services/api/delivery/deliveryService';

type ActiveModal = 'language' | 'privacy' | 'terms' | null;

interface LanguageOption {
  code: string;
  name: string;
  native: string;
}

const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'hinglish', name: 'Hinglish', native: 'Hinglish' },
];

export default function DeliverySettings() {
  const navigate = useNavigate();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    return localStorage.getItem('delivery_app_lang') || 'English';
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const profile = await getDeliveryProfile();
        if (profile.settings) {
          setNotificationsEnabled(profile.settings.notifications ?? true);
          setLocationEnabled(profile.settings.location ?? true);
          setSoundEnabled(profile.settings.sound ?? true);
        }
      } catch (error) {
        console.error("Failed to fetch settings", error);
      }
    };
    fetchSettings();
  }, []);

  const handleSettingChange = async (key: string, value: boolean) => {
    if (key === 'notifications') setNotificationsEnabled(value);
    if (key === 'location') setLocationEnabled(value);
    if (key === 'sound') setSoundEnabled(value);

    try {
      await updateSettings({ [key]: value });
    } catch (error) {
      console.error("Failed to update settings", error);
    }
  };

  const handleSelectLanguage = (langName: string) => {
    setSelectedLanguage(langName);
    localStorage.setItem('delivery_app_lang', langName);
    setActiveModal(null);
  };

  const settingsOptions = [
    {
      id: 'notifications',
      title: 'Push Notifications',
      description: 'Receive notifications for new orders',
      value: notificationsEnabled,
      onChange: (val: boolean) => handleSettingChange('notifications', val),
    },
    {
      id: 'location',
      title: 'Location Services',
      description: 'Allow app to access your location',
      value: locationEnabled,
      onChange: (val: boolean) => handleSettingChange('location', val),
    },
    {
      id: 'sound',
      title: 'Sound Alerts',
      description: 'Play sound for new order alerts',
      value: soundEnabled,
      onChange: (val: boolean) => handleSettingChange('sound', val),
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      <DeliveryHeader />
      <div className="px-4 py-4 max-w-lg mx-auto">
        <div className="flex items-center mb-4">
          <button
            onClick={() => navigate(-1)}
            className="mr-3 p-2 hover:bg-neutral-200 rounded-full transition-colors cursor-pointer"
            aria-label="Back"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h2 className="text-neutral-900 text-xl font-bold">Settings</h2>
        </div>

        {/* Preferences Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/80 overflow-hidden mb-4">
          <div className="p-4 border-b border-neutral-100 bg-neutral-50/50">
            <h3 className="text-neutral-900 font-semibold text-sm">Preferences</h3>
          </div>
          <div className="divide-y divide-neutral-100">
            {settingsOptions.map((option) => (
              <div key={option.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-neutral-900 text-sm font-semibold mb-0.5">{option.title}</p>
                  <p className="text-neutral-500 text-xs">{option.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => option.onChange(!option.value)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    option.value ? 'bg-emerald-600' : 'bg-neutral-300'
                  }`}
                  aria-label={`Toggle ${option.title}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      option.value ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Other Settings (Clickable) */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/80 overflow-hidden">
          <div className="p-4 border-b border-neutral-100 bg-neutral-50/50">
            <h3 className="text-neutral-900 font-semibold text-sm">Other</h3>
          </div>
          <div className="divide-y divide-neutral-100">
            {/* Language */}
            <button
              type="button"
              onClick={() => setActiveModal('language')}
              className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors cursor-pointer text-left active:bg-neutral-100"
            >
              <div className="flex-1">
                <p className="text-neutral-900 text-sm font-semibold">Language</p>
                <p className="text-emerald-700 font-medium text-xs mt-0.5">{selectedLanguage}</p>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M9 18L15 12L9 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-400"
                />
              </svg>
            </button>

            {/* Privacy Policy */}
            <button
              type="button"
              onClick={() => setActiveModal('privacy')}
              className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors cursor-pointer text-left active:bg-neutral-100"
            >
              <div className="flex-1">
                <p className="text-neutral-900 text-sm font-semibold">Privacy Policy</p>
                <p className="text-neutral-500 text-xs mt-0.5">How your data and GPS location are handled</p>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M9 18L15 12L9 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-400"
                />
              </svg>
            </button>

            {/* Terms & Conditions */}
            <button
              type="button"
              onClick={() => setActiveModal('terms')}
              className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors cursor-pointer text-left active:bg-neutral-100"
            >
              <div className="flex-1">
                <p className="text-neutral-900 text-sm font-semibold">Terms & Conditions</p>
                <p className="text-neutral-500 text-xs mt-0.5">Partner guidelines, orders & payouts</p>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M9 18L15 12L9 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-400"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* App Version */}
        <div className="mt-6 text-center">
          <p className="text-neutral-400 text-xs font-medium">App Version 1.0.0</p>
          <p className="text-neutral-300 text-[11px] mt-0.5">Unnati Delivery Partner App</p>
        </div>
      </div>

      {/* Interactive Modals */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                <h3 className="text-neutral-900 font-bold text-base">
                  {activeModal === 'language' && 'Select App Language'}
                  {activeModal === 'privacy' && 'Delivery Partner Privacy Policy'}
                  {activeModal === 'terms' && 'Delivery Partner Terms & Conditions'}
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-8 h-8 rounded-full bg-neutral-200/80 hover:bg-neutral-300 text-neutral-600 flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-sm text-neutral-700">
                {activeModal === 'language' && (
                  <div className="space-y-2">
                    <p className="text-xs text-neutral-500 mb-3">
                      Choose your preferred language for notifications, alerts, and navigation instructions.
                    </p>
                    {AVAILABLE_LANGUAGES.map((lang) => {
                      const isSelected = selectedLanguage.toLowerCase().includes(lang.name.toLowerCase());
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => handleSelectLanguage(lang.name)}
                          className={`w-full p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50/60 shadow-xs'
                              : 'border-neutral-200 hover:border-neutral-300 bg-white'
                          }`}
                        >
                          <div>
                            <span className="font-semibold text-neutral-900 block text-sm">{lang.name}</span>
                            <span className="text-xs text-neutral-500">{lang.native}</span>
                          </div>
                          {isSelected && (
                            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {activeModal === 'privacy' && (
                  <div className="space-y-3 leading-relaxed text-xs sm:text-sm">
                    <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 text-emerald-900 text-xs">
                      <strong>Your Privacy Matters:</strong> We only collect data essential for order routing, payments, and safety.
                    </div>

                    <h4 className="font-bold text-neutral-900 text-sm mt-3">1. Live GPS Location Tracking</h4>
                    <p className="text-neutral-600">
                      While you are marked Online and handling active deliveries, your device GPS coordinates are used exclusively to calculate distance, estimate delivery time, and guide turn-by-turn routing between stores and customer delivery locations. Live tracking stops automatically when orders are delivered.
                    </p>

                    <h4 className="font-bold text-neutral-900 text-sm mt-3">2. Partner Verification & Information</h4>
                    <p className="text-neutral-600">
                      We store your registration details (Name, Mobile Number, Driver License, and Vehicle info) securely for identity verification, regulatory compliance, and weekly payout disbursements.
                    </p>

                    <h4 className="font-bold text-neutral-900 text-sm mt-3">3. Customer Information Protection</h4>
                    <p className="text-neutral-600">
                      Customer delivery address and contact information provided during active orders must only be used for fulfilling the delivery. Retaining, copying, or using customer personal details outside the delivery scope is strictly prohibited.
                    </p>

                    <h4 className="font-bold text-neutral-900 text-sm mt-3">4. Security & Data Protection</h4>
                    <p className="text-neutral-600">
                      All communication between your device and our servers is encrypted using industry-standard TLS. We never sell your personal or financial data to third-party advertisers.
                    </p>
                  </div>
                )}

                {activeModal === 'terms' && (
                  <div className="space-y-3 leading-relaxed text-xs sm:text-sm">
                    <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-amber-900 text-xs">
                      <strong>Delivery Partner Agreement:</strong> By accepting assignments on Unnati, you agree to these operational guidelines.
                    </div>

                    <h4 className="font-bold text-neutral-900 text-sm mt-3">1. Order Fulfillment & Pickup Protocol</h4>
                    <p className="text-neutral-600">
                      Always verify the store's pickup code when collecting packages from partner stores. Ensure packages are intact, sealed, and handled with care during transit.
                    </p>

                    <h4 className="font-bold text-neutral-900 text-sm mt-3">2. Customer Delivery OTP Verification</h4>
                    <p className="text-neutral-600">
                      Orders must be completed by requesting and entering the customer's 4-digit Delivery OTP. Handing over packages without OTP verification or self-generating codes is a violation of policy.
                    </p>

                    <h4 className="font-bold text-neutral-900 text-sm mt-3">3. Cash on Delivery (COD) Collection</h4>
                    <p className="text-neutral-600">
                      For COD orders, collect the exact invoice amount indicated in the app before handing over goods. All collected cash must be deposited promptly according to settlement schedules.
                    </p>

                    <h4 className="font-bold text-neutral-900 text-sm mt-3">4. Vehicle, Equipment & Road Safety</h4>
                    <p className="text-neutral-600">
                      Delivery partners must wear a helmet, obey traffic laws, maintain an active driver's license and vehicle insurance, and prioritize road safety over speed at all times.
                    </p>

                    <h4 className="font-bold text-neutral-900 text-sm mt-3">5. Payouts & Performance</h4>
                    <p className="text-neutral-600">
                      Delivery earnings, bonuses, and incentives are calculated transparently and disbursed to your linked bank account or wallet. High order completion rates and positive customer ratings ensure consistent order priority.
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  {activeModal === 'language' ? 'Done' : 'Got it'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeliveryBottomNav />
    </div>
  );
}
