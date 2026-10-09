import React, { useState, useEffect, useRef } from "react";
import { useToast } from "../../../context/ToastContext";
import {
  Camera,
  Save,
  ArrowLeft,
  Loader2,
  Trash2,
  Phone,
  MapPin,
  Building,
  FileText,
  QrCode,
  Type,
  LayoutGrid,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sliders,
  Image as ImageIcon,
  Check,
  RotateCcw,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { uploadImage } from "../../../services/api/uploadService";
import {
  PosBillSettings,
  ADMIN_POS_BILL_SETTINGS_KEY,
  ADMIN_POS_BILL_SETTINGS_UPDATED_EVENT,
  getDefaultPosBillSettings,
} from "../../../utils/adminPosBillSettings";
import { ThermalReceiptPreview } from "../../../components/ThermalReceiptPreview";
import {
  getAdminBillSettings,
  updateAdminBillSettings,
} from "../../../services/api/admin/adminSettingsService";

const AdminPOSBillSettings = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<PosBillSettings>(getDefaultPosBillSettings());

  useEffect(() => {
    const loadSettings = async () => {
      // 1. Try local cache first for fast display
      const local = localStorage.getItem(ADMIN_POS_BILL_SETTINGS_KEY);
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setSettings((prev) => ({
            ...prev,
            ...parsed,
            tableColumns: {
              ...prev.tableColumns,
              ...(parsed.tableColumns || {}),
            },
            margins: {
              ...prev.margins,
              ...(parsed.margins || {}),
            },
          }));
        } catch (e) {
          // ignore
        }
      }

      // 2. Fetch from backend API
      try {
        const res = await getAdminBillSettings();
        if (res.success && res.data && Object.keys(res.data).length > 0) {
          setSettings((prev) => {
            const merged = {
              ...prev,
              ...res.data,
              tableColumns: {
                ...prev.tableColumns,
                ...(res.data.tableColumns || {}),
              },
              margins: {
                ...prev.margins,
                ...(res.data.margins || {}),
              },
            };
            localStorage.setItem(ADMIN_POS_BILL_SETTINGS_KEY, JSON.stringify(merged));
            return merged;
          });
        }
      } catch (err) {
        console.error("Failed to fetch admin bill settings from API", err);
      }
    };

    loadSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === "phone") {
      const numericValue = value.replace(/\D/g, "");
      if (numericValue.length <= 10) {
        setSettings((prev) => ({
          ...prev,
          phone: numericValue,
        }));
      }
    } else {
      setSettings((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingQR(true);
      const result = await uploadImage(file, "pos-settings");
      setSettings((prev) => ({
        ...prev,
        qrCode: result.secureUrl,
        qrSettings: {
          enabled: true,
          url: result.secureUrl,
          size: prev.qrSettings?.size || "medium",
          alignment: prev.qrSettings?.alignment || "center",
        },
      }));
      showToast("QR code image uploaded successfully", "success");
    } catch (error) {
      console.error("QR Upload failed:", error);
      showToast("Upload failed", "error");
    } finally {
      setUploadingQR(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const result = await uploadImage(file, "pos-settings");
      setSettings((prev) => ({
        ...prev,
        logo: {
          enabled: true,
          url: result.secureUrl,
          size: prev.logo?.size || "medium",
          alignment: prev.logo?.alignment || "center",
        },
      }));
      showToast("Store logo uploaded successfully", "success");
    } catch (error) {
      console.error("Logo Upload failed:", error);
      showToast("Upload failed", "error");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (settings.phone && !/^\d{10}$/.test(settings.phone)) {
      showToast("Phone number must be exactly 10 digits", "error");
      return;
    }

    try {
      setSaving(true);
      // Save to backend
      const res = await updateAdminBillSettings(settings);
      if (res.success) {
        // Sync local storage
        localStorage.setItem(ADMIN_POS_BILL_SETTINGS_KEY, JSON.stringify(settings));
        window.dispatchEvent(new Event(ADMIN_POS_BILL_SETTINGS_UPDATED_EVENT));
        showToast("POS Bill settings saved successfully", "success");
      } else {
        showToast(res.message || "Failed to save bill settings to server", "error");
      }
    } catch (error) {
      console.error("Save error:", error);
      // Fallback local save if offline
      localStorage.setItem(ADMIN_POS_BILL_SETTINGS_KEY, JSON.stringify(settings));
      window.dispatchEvent(new Event(ADMIN_POS_BILL_SETTINGS_UPDATED_EVENT));
      showToast("Settings saved to local cache", "success");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-12 max-w-7xl mx-auto">
      {/* Top Header Card */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-full p-2.5 hover:bg-neutral-100 transition-colors border border-neutral-200 bg-white"
          >
            <ArrowLeft className="h-5 w-5 text-neutral-700" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-neutral-800">POS Bill Settings</h1>
            <p className="text-xs text-neutral-500">Configure thermal receipt typography, paper size, margins & branding</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset all settings to default values?")) {
                setSettings(getDefaultPosBillSettings());
                showToast("Reset to default settings", "info");
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 active:scale-95 transition-all"
          >
            <RotateCcw className="h-4 w-4 text-neutral-500" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[var(--primary-color)] px-6 py-2.5 font-semibold text-white shadow-lg shadow-[var(--primary-color)]/20 hover:bg-[var(--primary-dark)] active:scale-95 transition-all disabled:opacity-50 text-sm"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{saving ? "Saving..." : "Save Settings"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Configuration Controls */}
        <div className="lg:col-span-7 space-y-6">

          {/* 1. Paper & Margins */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-neutral-200">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-[var(--primary-color)]" />
              <h2 className="text-base font-bold text-neutral-800">Paper Size & Margins</h2>
            </div>
            <p className="text-xs text-neutral-500 mb-5">
              Supports 3-inch (80mm) and 2-inch (58mm) POS thermal printers (e.g. Helett H80i)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Paper Width
                </label>
                <select
                  value={settings.paperWidth || "80mm"}
                  onChange={(e) => setSettings((prev) => ({ ...prev, paperWidth: e.target.value as any }))}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-sm font-semibold text-neutral-800 focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)]/10 transition-all outline-none"
                >
                  <option value="80mm">3 Inches (80mm) - Standard Thermal POS</option>
                  <option value="58mm">2 Inches (58mm) - Compact Thermal POS</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Line Spacing (Height)
                </label>
                <select
                  value={settings.lineSpacing || "normal"}
                  onChange={(e) => setSettings((prev) => ({ ...prev, lineSpacing: e.target.value as any }))}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-sm font-semibold text-neutral-800 focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-color)]/10 transition-all outline-none"
                >
                  <option value="compact">Compact (Saves paper)</option>
                  <option value="normal">Normal (Standard)</option>
                  <option value="comfortable">Comfortable (More spacious)</option>
                </select>
              </div>
            </div>

            {/* Margins */}
            <div className="pt-3 border-t border-neutral-100">
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                Receipt Margins (in mm)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-neutral-500">Top</span>
                  <select
                    value={settings.margins?.top ?? 2}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        margins: { ...prev.margins!, top: Number(e.target.value) },
                      }))
                    }
                    className="w-full mt-1 rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-xs font-bold text-neutral-800 focus:border-[var(--primary-color)] outline-none"
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((m) => (
                      <option key={m} value={m}>{m} mm</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-neutral-500">Right</span>
                  <select
                    value={settings.margins?.right ?? 3}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        margins: { ...prev.margins!, right: Number(e.target.value) },
                      }))
                    }
                    className="w-full mt-1 rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-xs font-bold text-neutral-800 focus:border-[var(--primary-color)] outline-none"
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((m) => (
                      <option key={m} value={m}>{m} mm</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-neutral-500">Bottom</span>
                  <select
                    value={settings.margins?.bottom ?? 4}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        margins: { ...prev.margins!, bottom: Number(e.target.value) },
                      }))
                    }
                    className="w-full mt-1 rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-xs font-bold text-neutral-800 focus:border-[var(--primary-color)] outline-none"
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((m) => (
                      <option key={m} value={m}>{m} mm</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-neutral-500">Left</span>
                  <select
                    value={settings.margins?.left ?? 2}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        margins: { ...prev.margins!, left: Number(e.target.value) },
                      }))
                    }
                    className="w-full mt-1 rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-xs font-bold text-neutral-800 focus:border-[var(--primary-color)] outline-none"
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((m) => (
                      <option key={m} value={m}>{m} mm</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Typography Settings */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-neutral-200">
            <div className="flex items-center gap-2 mb-2">
              <Type className="h-5 w-5 text-[var(--primary-color)]" />
              <h2 className="text-base font-bold text-neutral-800">Receipt Typography</h2>
            </div>
            <p className="text-xs text-neutral-500 mb-5">
              Select font family, scaling, and weight optimized for thermal print heads
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Receipt Font
                </label>
                <select
                  value={settings.fontFamily || "sans"}
                  onChange={(e) => setSettings((prev) => ({ ...prev, fontFamily: e.target.value as any }))}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-3 py-3 text-xs font-semibold text-neutral-800 focus:border-[var(--primary-color)] outline-none"
                >
                  <option value="sans">Modern Sans (Crisp & Clean)</option>
                  <option value="inter">Inter (Modern & Balanced)</option>
                  <option value="roboto">Roboto (High Legibility)</option>
                  <option value="arial">Arial (Standard Sans)</option>
                  <option value="helvetica">Helvetica (Clear & Sharp)</option>
                  <option value="opensans">Open Sans (Friendly Sans)</option>
                  <option value="mono">Monospace (Cash Register)</option>
                  <option value="serif">Classic Serif (Times Roman)</option>
                  <option value="georgia">Georgia (Editorial Serif)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Base Font Size
                </label>
                <select
                  value={settings.fontSize || "normal"}
                  onChange={(e) => setSettings((prev) => ({ ...prev, fontSize: e.target.value as any }))}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-3 py-3 text-xs font-semibold text-neutral-800 focus:border-[var(--primary-color)] outline-none"
                >
                  <option value="xsmall">Extra Small (10px - Maximum Content)</option>
                  <option value="small">Small / Compact (11px)</option>
                  <option value="normal">Normal (12px - Recommended)</option>
                  <option value="medium">Medium (13px)</option>
                  <option value="large">Large (14px - High Readability)</option>
                  <option value="xlarge">Extra Large (16px)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Font Weight
                </label>
                <select
                  value={settings.fontWeight || "normal"}
                  onChange={(e) => setSettings((prev) => ({ ...prev, fontWeight: e.target.value as any }))}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-3 py-3 text-xs font-semibold text-neutral-800 focus:border-[var(--primary-color)] outline-none"
                >
                  <option value="normal">Normal (400)</option>
                  <option value="medium">Medium (500)</option>
                  <option value="semibold">Semi Bold (600)</option>
                  <option value="bold">Bold (700)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Shop Information & Branding Header */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-neutral-800">Store Information & Header</h2>
                <p className="text-xs text-neutral-500">Contact information printed at the top of the receipt</p>
              </div>

              {/* Header Alignment Controls */}
              <div className="flex items-center bg-neutral-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, headerAlignment: "left" }))}
                  className={`p-1.5 rounded-lg text-xs font-semibold transition-all ${
                    (settings.headerAlignment || "left") === "left"
                      ? "bg-white text-black shadow-sm"
                      : "text-neutral-500 hover:text-black"
                  }`}
                  title="Align Header Left"
                >
                  <AlignLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, headerAlignment: "center" }))}
                  className={`p-1.5 rounded-lg text-xs font-semibold transition-all ${
                    settings.headerAlignment === "center"
                      ? "bg-white text-black shadow-sm"
                      : "text-neutral-500 hover:text-black"
                  }`}
                  title="Align Header Center"
                >
                  <AlignCenter className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, headerAlignment: "right" }))}
                  className={`p-1.5 rounded-lg text-xs font-semibold transition-all ${
                    settings.headerAlignment === "right"
                      ? "bg-white text-black shadow-sm"
                      : "text-neutral-500 hover:text-black"
                  }`}
                  title="Align Header Right"
                >
                  <AlignRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Store Logo Section */}
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-[var(--primary-color)]" />
                    Receipt Logo (Optional)
                  </h3>
                  <p className="text-[11px] text-neutral-500">Prints store logo on top of receipt</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      logo: {
                        enabled: !prev.logo?.enabled,
                        url: prev.logo?.url || "",
                        size: prev.logo?.size || "medium",
                        alignment: prev.logo?.alignment || "center",
                      },
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    settings.logo?.enabled ? "bg-[var(--primary-color)]" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.logo?.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {settings.logo?.enabled && (
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative h-20 w-32 flex items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white overflow-hidden shadow-inner">
                    {settings.logo?.url ? (
                      <div className="relative w-full h-full p-2 flex items-center justify-center">
                        <img src={settings.logo.url} alt="Logo" className="max-h-full max-w-full object-contain" />
                        <button
                          type="button"
                          onClick={() => setSettings((prev) => ({ ...prev, logo: { ...prev.logo!, url: "" } }))}
                          className="absolute top-1 right-1 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="text-xs text-neutral-500 hover:text-[var(--primary-color)] flex flex-col items-center gap-1 font-semibold"
                      >
                        {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                        <span>Upload Logo</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={logoInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleLogoUpload}
                  />

                  {settings.logo?.url && (
                    <div className="flex-1 grid grid-cols-2 gap-3 w-full">
                      <div>
                        <span className="text-[11px] font-bold text-neutral-600">Logo Size</span>
                        <select
                          value={settings.logo.size || "medium"}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              logo: { ...prev.logo!, size: e.target.value as any },
                            }))
                          }
                          className="w-full mt-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold outline-none"
                        >
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                        </select>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-neutral-600">Alignment</span>
                        <select
                          value={settings.logo.alignment || "center"}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              logo: { ...prev.logo!, alignment: e.target.value as any },
                            }))
                          }
                          className="w-full mt-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold outline-none"
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4">
              <div>
                <label className="text-xs font-bold text-neutral-600 ml-1 flex items-center gap-1.5 mb-1">
                  <Building className="h-3.5 w-3.5 text-[var(--primary-color)]" />
                  Shop Name (on Bill)
                </label>
                <input
                  type="text"
                  name="shopName"
                  value={settings.shopName || ""}
                  onChange={handleChange}
                  placeholder="e.g. My Store"
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/30 px-4 py-2.5 text-sm font-semibold text-neutral-800 outline-none focus:border-[var(--primary-color)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-600 ml-1 flex items-center gap-1.5 mb-1">
                  <Phone className="h-3.5 w-3.5 text-[var(--primary-color)]" />
                  Contact Phone (10 digits)
                </label>
                <input
                  type="text"
                  name="phone"
                  value={settings.phone || ""}
                  onChange={handleChange}
                  placeholder="e.g. 9876543210"
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/30 px-4 py-2.5 text-sm font-semibold text-neutral-800 outline-none focus:border-[var(--primary-color)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-600 ml-1 flex items-center gap-1.5 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-[var(--primary-color)]" />
                  Shop Address
                </label>
                <textarea
                  name="address"
                  value={settings.address || ""}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Address lines printed on bill"
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/30 px-4 py-2.5 text-sm font-semibold text-neutral-800 outline-none focus:border-[var(--primary-color)] resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-600 ml-1 flex items-center gap-1.5 mb-1">
                  <User className="h-3.5 w-3.5 text-[var(--primary-color)]" />
                  Seller Name (Store Operator / Cashier)
                </label>
                <input
                  type="text"
                  name="sellerName"
                  value={settings.sellerName || ""}
                  onChange={handleChange}
                  placeholder="e.g. Rahul Sharma / Store Attendant"
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/30 px-4 py-2.5 text-sm font-semibold text-neutral-800 outline-none focus:border-[var(--primary-color)]"
                />
              </div>
            </div>

            {/* GST & FSSAI Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-neutral-100">
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-700">GST Number</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        gst: { enabled: !prev.gst?.enabled, text: prev.gst?.text || "" },
                      }))
                    }
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      settings.gst?.enabled ? "bg-[var(--primary-color)]" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        settings.gst?.enabled ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                {settings.gst?.enabled && (
                  <input
                    type="text"
                    value={settings.gst?.text || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        gst: { ...prev.gst!, text: e.target.value },
                      }))
                    }
                    placeholder="Enter GSTIN"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold outline-none"
                  />
                )}
              </div>

              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-700">FSSAI Number</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        fssai: { enabled: !prev.fssai?.enabled, text: prev.fssai?.text || "" },
                      }))
                    }
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      settings.fssai?.enabled ? "bg-[var(--primary-color)]" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        settings.fssai?.enabled ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                {settings.fssai?.enabled && (
                  <input
                    type="text"
                    value={settings.fssai?.text || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        fssai: { ...prev.fssai!, text: e.target.value },
                      }))
                    }
                    placeholder="Enter FSSAI license"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold outline-none"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 4. Table Columns & Dividers */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-neutral-200">
            <div className="flex items-center gap-2 mb-2">
              <LayoutGrid className="h-5 w-5 text-[var(--primary-color)]" />
              <h2 className="text-base font-bold text-neutral-800">Item Table Columns & Dividers</h2>
            </div>
            <p className="text-xs text-neutral-500 mb-4">Control what appears in the receipt item rows and divider lines</p>

            {/* Column Toggles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
              {[
                { id: "showIndex", label: "Serial No (#)" },
                { id: "showQty", label: "Quantity (Qty)" },
                { id: "showMrp", label: "MRP Column" },
                { id: "showSp", label: "Selling Price" },
                { id: "showTotal", label: "Total Amount" },
                { id: "showWarranty", label: "Warranty Line" },
              ].map((col) => {
                const isChecked = (settings.tableColumns as any)?.[col.id] !== false;
                return (
                  <label
                    key={col.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                      isChecked
                        ? "bg-[var(--primary-color)]/5 border-[var(--primary-color)]/30 text-neutral-800"
                        : "bg-neutral-50 border-neutral-200 text-neutral-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          tableColumns: {
                            ...prev.tableColumns!,
                            [col.id]: e.target.checked,
                          },
                        }))
                      }
                      className="rounded border-neutral-300 text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                    />
                    <span className="text-xs font-bold">{col.label}</span>
                  </label>
                );
              })}
            </div>

            {/* Dividers & Grand Total */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-neutral-100">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Divider Line Style
                </label>
                <select
                  value={settings.dividerStyle || "single"}
                  onChange={(e) => setSettings((prev) => ({ ...prev, dividerStyle: e.target.value as any }))}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-3 py-2.5 text-xs font-semibold outline-none"
                >
                  <option value="single">Single Solid Line</option>
                  <option value="double">Double Line</option>
                  <option value="dashed">Dashed Line</option>
                  <option value="dotted">Dotted Line</option>
                  <option value="none">No Dividers</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Grand Total Size
                </label>
                <select
                  value={settings.grandTotalSize || "normal"}
                  onChange={(e) => setSettings((prev) => ({ ...prev, grandTotalSize: e.target.value as any }))}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/50 px-3 py-2.5 text-xs font-semibold outline-none"
                >
                  <option value="normal">Standard Prominent</option>
                  <option value="medium">Medium Large</option>
                  <option value="large">Extra Large Bold</option>
                </select>
              </div>
            </div>
          </div>

          {/* 5. Custom Footer, Notes & Terms */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-neutral-200 space-y-6">
            <h2 className="text-base font-bold text-neutral-800">Footer Tagline, Notes & Terms</h2>

            {/* Custom Slogan / Tagline */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-800">Custom Tagline / Slogan</h3>
                  <p className="text-xs text-neutral-500">Store greeting or blessing (strictly hidden when disabled)</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      footerSlogan: {
                        enabled: !prev.footerSlogan?.enabled,
                        text: prev.footerSlogan?.text || "Thank you for your business",
                        alignment: prev.footerSlogan?.alignment || "center",
                      },
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    settings.footerSlogan?.enabled ? "bg-[var(--primary-color)]" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.footerSlogan?.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {settings.footerSlogan?.enabled && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={settings.footerSlogan.text}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        footerSlogan: { ...prev.footerSlogan!, text: e.target.value },
                      }))
                    }
                    placeholder="e.g. Visit Again! Have a great day."
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/30 px-4 py-2.5 text-xs font-semibold outline-none"
                  />
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-neutral-500">Alignment:</span>
                    {(["left", "center", "right"] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            footerSlogan: { ...prev.footerSlogan!, alignment: align },
                          }))
                        }
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg uppercase tracking-wider ${
                          (settings.footerSlogan?.alignment || "center") === align
                            ? "bg-neutral-800 text-white"
                            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                        }`}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Notes */}
            <div className="space-y-3 pt-4 border-t border-neutral-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-800">Footer Note</h3>
                  <p className="text-xs text-neutral-500">Notice or instructions printed below the totals</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      notes: {
                        enabled: !prev.notes?.enabled,
                        text: prev.notes?.text || "Thank you for shopping with us!",
                        alignment: prev.notes?.alignment || "center",
                      },
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    settings.notes?.enabled ? "bg-[var(--primary-color)]" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.notes?.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {settings.notes?.enabled && (
                <textarea
                  value={settings.notes.text}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      notes: { ...prev.notes!, text: e.target.value },
                    }))
                  }
                  rows={2}
                  placeholder="Notes content..."
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/30 px-4 py-2.5 text-xs font-semibold outline-none resize-none"
                />
              )}
            </div>

            {/* Terms & Conditions */}
            <div className="space-y-3 pt-4 border-t border-neutral-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-800">Terms & Conditions</h3>
                  <p className="text-xs text-neutral-500">Legal or return policies (completely excluded when disabled)</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      terms: {
                        enabled: !prev.terms?.enabled,
                        text: prev.terms?.text || "Goods once sold will not be taken back.",
                        fontSize: prev.terms?.fontSize || "normal",
                        alignment: prev.terms?.alignment || "center",
                      },
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    settings.terms?.enabled ? "bg-[var(--primary-color)]" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.terms?.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {settings.terms?.enabled && (
                <div className="space-y-2">
                  <textarea
                    value={settings.terms.text}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        terms: { ...prev.terms!, text: e.target.value },
                      }))
                    }
                    rows={2}
                    placeholder="Terms and conditions..."
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/30 px-4 py-2.5 text-xs font-semibold outline-none resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-neutral-500">Alignment:</span>
                      {(["left", "center", "right"] as const).map((align) => (
                        <button
                          key={align}
                          type="button"
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              terms: { ...prev.terms!, alignment: align },
                            }))
                          }
                          className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                            (settings.terms?.alignment || "center") === align
                              ? "bg-neutral-800 text-white"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {align}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-neutral-500">Size:</span>
                      {(["small", "normal", "large"] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              terms: { ...prev.terms!, fontSize: sz },
                            }))
                          }
                          className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                            (settings.terms?.fontSize || "normal") === sz
                              ? "bg-neutral-800 text-white"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 6. QR Code Scanner Settings */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-neutral-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-neutral-800 flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-[var(--primary-color)]" />
                  QR Scanner Code (Optional)
                </h2>
                <p className="text-xs text-neutral-500">Displays UPI or payment QR code at the bottom of the bill</p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    qrSettings: {
                      enabled: prev.qrSettings?.enabled === false ? true : false,
                      url: prev.qrSettings?.url || prev.qrCode || "",
                      size: prev.qrSettings?.size || "medium",
                      alignment: prev.qrSettings?.alignment || "center",
                    },
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  settings.qrSettings?.enabled !== false ? "bg-[var(--primary-color)]" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.qrSettings?.enabled !== false ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {settings.qrSettings?.enabled !== false && (
              <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
                <div className="group relative h-36 w-36 flex items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 shadow-inner overflow-hidden">
                  {settings.qrSettings?.url || settings.qrCode ? (
                    <div className="relative w-full h-full p-2 flex items-center justify-center">
                      <img
                        src={settings.qrSettings?.url || settings.qrCode}
                        alt="QR Scanner"
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            qrCode: "",
                            qrSettings: { ...prev.qrSettings!, url: "" },
                          }))
                        }
                        className="absolute top-1 right-1 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-neutral-400 p-2 text-center">
                      <QrCode className="h-8 w-8" />
                      <span className="text-[10px] font-semibold">Click to upload QR code</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => qrInputRef.current?.click()}
                      className="h-10 w-10 flex items-center justify-center rounded-full bg-white shadow-lg text-[var(--primary-color)]"
                    >
                      {uploadingQR ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <input
                  type="file"
                  ref={qrInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleQRUpload}
                />

                <div className="space-y-3 flex-1">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                      QR Code Size
                    </label>
                    <select
                      value={settings.qrSettings?.size || "medium"}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          qrSettings: { ...prev.qrSettings!, size: e.target.value as any },
                        }))
                      }
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold outline-none"
                    >
                      <option value="small">Small (48px)</option>
                      <option value="medium">Medium (64px)</option>
                      <option value="large">Large (80px)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                      QR Code Alignment
                    </label>
                    <select
                      value={settings.qrSettings?.alignment || "center"}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          qrSettings: { ...prev.qrSettings!, alignment: e.target.value as any },
                        }))
                      }
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold outline-none"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Interactive Thermal Receipt Preview */}
        <div className="lg:col-span-5 lg:sticky lg:top-6">
          <ThermalReceiptPreview settings={settings} />
        </div>
      </div>
    </div>
  );
};

export default AdminPOSBillSettings;
