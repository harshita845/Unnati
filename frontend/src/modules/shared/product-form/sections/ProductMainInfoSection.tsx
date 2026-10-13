import { useEffect, useState } from "react";
import { ProductMainInfoForm } from "../types/productForm.types";
import FormField, { inputClass, selectClass } from "../components/FormField";
import FormSectionCard from "../components/FormSectionCard";
import CategoryCascadeFields from "../components/CategoryCascadeFields";
import { getBrands, Brand } from "../../../../services/api/brandService";
import { getShops, Shop } from "../../../../services/api/productService";
import { compressVideo } from "../../../../utils/videoCompressor";
import { uploadVideo } from "../../../../services/api/uploadService";
import { getStorageLocationHierarchy } from "../../../../services/api/storageLocationService";

const DEFAULT_STORAGE_LOCATIONS: Record<string, Record<string, Record<string, string[]>>> = {
  "Mumbai": {
    "Mumbai Central Warehouse (MC-01)": {
      "Room A": ["Rack 1", "Rack 2", "Rack 3", "Rack 4", "Rack 5"],
      "Room B": ["Rack 1", "Rack 2", "Rack 3", "Rack 4", "Rack 5"]
    },
    "Andheri Warehouse (AW-02)": {
      "Room 101": ["Rack A", "Rack B", "Rack C"],
      "Room 102": ["Rack A", "Rack B", "Rack C"]
    }
  },
  "Delhi": {
    "Okhla Warehouse (OW-01)": {
      "Room X": ["Rack R1", "Rack R2", "Rack R3"],
      "Room Y": ["Rack R1", "Rack R2", "Rack R3"]
    }
  },
  "Bangalore": {
    "Whitefield Warehouse (WW-01)": {
      "Room 1": ["Rack B1", "Rack B2", "Rack B3", "Rack B4"],
      "Room 2": ["Rack B1", "Rack B2", "Rack B3", "Rack B4"]
    }
  }
};

interface Props {
  role: "admin" | "seller";
  mainInfo: ProductMainInfoForm;
  onChange: (patch: Partial<ProductMainInfoForm>) => void;
  showSellerPicker?: boolean;
  isFieldEnabled: (sectionId: string, fieldId: string) => boolean;
}

const yesNoSelect = (
  value: "Yes" | "No",
  onChange: (v: "Yes" | "No") => void
) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value as "Yes" | "No")}
    className={selectClass}
  >
    <option value="Yes">Yes</option>
    <option value="No">No</option>
  </select>
);

export default function ProductMainInfoSection({
  role,
  mainInfo,
  onChange,
  showSellerPicker,
  isFieldEnabled,
}: Props) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [shops, setShops] = useState<Shop[]>([]);
  const [storageLocations, setStorageLocations] = useState<Record<string, Record<string, Record<string, string[]>>>>(DEFAULT_STORAGE_LOCATIONS);

  useEffect(() => {
    let isMounted = true;
    getStorageLocationHierarchy(role)
      .then((data) => {
        if (isMounted && data && Object.keys(data).length > 0) {
          setStorageLocations(data);
        }
      })
      .catch((err) => console.error("Error fetching storage locations:", err));
    return () => {
      isMounted = false;
    };
  }, [role]);

  const [videoStatus, setVideoStatus] = useState<{
    loading: boolean;
    progressText: string;
    error: string;
  }>({
    loading: false,
    progressText: "",
    error: "",
  });

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoStatus({ loading: true, progressText: "Loading video file...", error: "" });
    try {
      // 1. Compress
      const compressedFile = await compressVideo(file, (p) => {
        setVideoStatus((prev) => ({
          ...prev,
          progressText: p.status,
        }));
      });

      // 2. Upload
      setVideoStatus((prev) => ({
        ...prev,
        progressText: "Uploading video to server...",
      }));
      const uploadRes = await uploadVideo(compressedFile, "Ecommerce/videos");
      const videoUrl = uploadRes.secureUrl || uploadRes.url;
      
      onChange({ video: videoUrl });
      setVideoStatus({ loading: false, progressText: "", error: "" });
    } catch (err: any) {
      console.error("Video upload error:", err);
      const errorMessage = err.response?.data?.message || err.message || "Failed to upload video.";
      setVideoStatus({
        loading: false,
        progressText: "",
        error: errorMessage,
      });
    }

  };

  const handleRemoveVideo = () => {
    onChange({ video: "" });
    setVideoStatus({ loading: false, progressText: "", error: "" });
  };

  const [manualCity, setManualCity] = useState(false);
  const [manualWarehouse, setManualWarehouse] = useState(false);
  const [manualRoom, setManualRoom] = useState(false);
  const [manualRack, setManualRack] = useState(false);

  // Auto-detect custom values on load
  useEffect(() => {
    if (mainInfo.storageCity && !Object.keys(storageLocations).includes(mainInfo.storageCity)) {
      setManualCity(true);
    }
  }, [mainInfo.storageCity, storageLocations]);

  useEffect(() => {
    if (mainInfo.storageWarehouse) {
      const cityLocs = storageLocations[mainInfo.storageCity];
      if (!cityLocs || !Object.keys(cityLocs).includes(mainInfo.storageWarehouse)) {
        setManualWarehouse(true);
      }
    }
  }, [mainInfo.storageCity, mainInfo.storageWarehouse, storageLocations]);

  useEffect(() => {
    if (mainInfo.storageRoom) {
      const cityLocs = storageLocations[mainInfo.storageCity];
      const whLocs = cityLocs?.[mainInfo.storageWarehouse];
      if (!whLocs || !Object.keys(whLocs).includes(mainInfo.storageRoom)) {
        setManualRoom(true);
      }
    }
  }, [mainInfo.storageCity, mainInfo.storageWarehouse, mainInfo.storageRoom, storageLocations]);

  useEffect(() => {
    if (mainInfo.storageRack) {
      const cityLocs = storageLocations[mainInfo.storageCity];
      const whLocs = cityLocs?.[mainInfo.storageWarehouse];
      const roomLocs = whLocs?.[mainInfo.storageRoom];
      if (!roomLocs || !roomLocs.includes(mainInfo.storageRack)) {
        setManualRack(true);
      }
    }
  }, [mainInfo.storageCity, mainInfo.storageWarehouse, mainInfo.storageRoom, mainInfo.storageRack, storageLocations]);

  useEffect(() => {
    let cancelled = false;
    const loadBrands = async () => {
      setLoadingBrands(true);
      try {
        const response = await getBrands();
        if (!cancelled && response.success) {
          setBrands(response.data || []);
        }
      } catch {
        if (!cancelled) setBrands([]);
      } finally {
        if (!cancelled) setLoadingBrands(false);
      }
    };
    void loadBrands();
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    if (isFieldEnabled("visibility", "select_store")) {
      const fetchShopsData = async () => {
        try {
          const res = await getShops(role);
          if (res.success) {
            setShops(res.data || []);
          }
        } catch (err) {
          console.error("Error fetching shops:", err);
        }
      };
      fetchShopsData();
    }
  }, [isFieldEnabled, role]);

  const showSummary = isFieldEnabled("basic", "summary");
  const showDescription = isFieldEnabled("basic", "description");
  const showPack = isFieldEnabled("basic", "pack");
  const showVideo = true;


  const showHeaderCategory = isFieldEnabled("basic", "header_category");
  const showCategory = isFieldEnabled("basic", "category");
  const showSubcategory = isFieldEnabled("basic", "subcategory");
  const showBrand = isFieldEnabled("basic", "brand");

  const showTax = isFieldEnabled("pricing", "tax");
  const showHsn = isFieldEnabled("pricing", "hsn_code");
  const showDeliveryTime = isFieldEnabled("pricing", "delivery_time");
  const showMfgDate = isFieldEnabled("pricing", "mfg_date");
  const showExpiryDate = isFieldEnabled("pricing", "expiry_date");

  const showCategoryBrandSection = showHeaderCategory || showCategory || showSubcategory || showBrand;
  const showTaxSection = showTax || showHsn || showDeliveryTime || showMfgDate || showExpiryDate;

  const showVisibilitySection = isFieldEnabled("visibility", "shop_by_store_only") || isFieldEnabled("visibility", "select_store");

  return (
    <div className="space-y-6">
      <FormSectionCard
        title="Basic Details"
        subtitle="Name, descriptions, and visibility flags"
        accent="sky"
        icon={<span className="text-lg">📦</span>}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Product Name" required className="md:col-span-2">
            <input
              className={inputClass}
              value={mainInfo.productName}
              onChange={(e) => onChange({ productName: e.target.value })}
              placeholder="Enter product name"
              required
            />
          </FormField>

          {showSummary && (
            <FormField label="Short Description" className="md:col-span-2">
              <textarea
                className={inputClass}
                rows={2}
                value={mainInfo.smallDescription}
                onChange={(e) => onChange({ smallDescription: e.target.value })}
                placeholder="Brief summary for listings"
              />
            </FormField>
          )}

          {showDescription && (
            <FormField label="Full Description" className="md:col-span-2">
              <textarea
                className={inputClass}
                rows={4}
                value={mainInfo.description}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder="Detailed product information"
              />
            </FormField>
          )}

          {showPack && (
            <FormField label="Pack / Unit Size">
              <input
                className={inputClass}
                value={mainInfo.pack}
                onChange={(e) => onChange({ pack: e.target.value })}
                placeholder="e.g. 1kg, 500ml"
              />
            </FormField>
          )}

          {showVideo && (
            <FormField label="Product Video" hint="Upload product preview video (under 2MB, will be compressed automatically)">
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                {mainInfo.video ? (
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-lg bg-black aspect-video max-w-sm border border-slate-200 shadow-sm">
                      <video
                        src={mainInfo.video}
                        controls
                        className="h-full w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveVideo}
                        className="absolute right-2 top-2 rounded-full bg-rose-500 p-1.5 text-white shadow hover:bg-rose-600 transition"
                        title="Remove Video"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 break-all font-mono">{mainInfo.video}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-slate-300 rounded-lg hover:border-violet-400 transition bg-white">
                    {videoStatus.loading ? (
                      <div className="flex flex-col items-center space-y-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent"></div>
                        <p className="text-sm font-semibold text-slate-700">{videoStatus.progressText}</p>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="text-sm font-bold text-violet-600 hover:text-violet-700">Choose Video File</span>
                        <span className="text-xs text-slate-500 mt-1">MP4, WebM, or MOV up to 25MB (will be optimized)</span>
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={handleVideoChange}
                        />
                      </label>
                    )}
                    {videoStatus.error && (
                      <p className="mt-2 text-xs font-semibold text-rose-600 text-center px-4">{videoStatus.error}</p>
                    )}
                  </div>
                )}
              </div>
            </FormField>
          )}


          <FormField label="Publish">
            {yesNoSelect(mainInfo.publish, (v) => onChange({ publish: v }))}
          </FormField>
          <FormField label="Popular">
            {yesNoSelect(mainInfo.popular, (v) => onChange({ popular: v }))}
          </FormField>
          <FormField label="Deal of the Day">
            {yesNoSelect(mainInfo.dealOfDay, (v) => onChange({ dealOfDay: v }))}
          </FormField>
          <FormField label="Enquiry Only Mode">
            {yesNoSelect(mainInfo.isEnquiryOnly, (v) => onChange({ isEnquiryOnly: v }))}
          </FormField>
          {showSellerPicker && (
            <FormField label="Seller ID">
              <input
                className={inputClass}
                value={mainInfo.seller}
                onChange={(e) => onChange({ seller: e.target.value })}
                placeholder="Seller ObjectId"
              />
            </FormField>
          )}
        </div>
      </FormSectionCard>

      {showCategoryBrandSection && (
        <FormSectionCard
          title="Category & Brand"
          subtitle="Organize product in your catalog hierarchy"
          accent="amber"
          icon={<span className="text-lg">🏷️</span>}
        >
          <CategoryCascadeFields
            role={role}
            headerCategoryId={mainInfo.headerCategory}
            categoryId={mainInfo.category}
            subcategoryId={mainInfo.subcategory}
            onChange={(patch) => onChange(patch)}
            isFieldEnabled={isFieldEnabled}
          />

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {showBrand && (
              <FormField label="Brand Name">
                <select
                  className={selectClass}
                  value={mainInfo.brand}
                  onChange={(e) => onChange({ brand: e.target.value })}
                  disabled={loadingBrands}
                >
                  <option value="">
                    {loadingBrands ? "Loading brands..." : "Select brand (optional)"}
                  </option>
                  {brands.map((brand) => (
                    <option key={brand._id} value={brand._id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
          </div>
        </FormSectionCard>
      )}

      {showTaxSection && (
        <FormSectionCard
          title="Tax & Compliance"
          subtitle="GST, HSN, and tax configuration"
          accent="emerald"
          icon={<span className="text-lg">💰</span>}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {showTax && (
              <>
                <FormField label="GST %">
                  <input
                    type="number"
                    className={inputClass}
                    value={mainInfo.gst}
                    onChange={(e) => onChange({ gst: e.target.value })}
                  />
                </FormField>
                <FormField label="Tax Info">
                  <input
                    className={inputClass}
                    value={mainInfo.tax}
                    onChange={(e) => onChange({ tax: e.target.value })}
                    placeholder="e.g. Tax category or details"
                  />
                </FormField>
                <FormField label="Tax Visibility Label">
                  <select
                    className={selectClass}
                    value={mainInfo.taxPreference}
                    onChange={(e) => onChange({ taxPreference: e.target.value as any })}
                  >
                    <option value="included">Inclusive of all taxes</option>
                    <option value="excluded">Exclusive of all taxes</option>
                    <option value="hidden">Hide tax visibility label</option>
                  </select>
                </FormField>
              </>
            )}
            {showHsn && (
              <FormField label="HSN Code">
                <input
                  className={inputClass}
                  value={mainInfo.hsnCode}
                  onChange={(e) => onChange({ hsnCode: e.target.value })}
                />
              </FormField>
            )}
            {showDeliveryTime && (
              <FormField label="Delivery Time">
                <input
                  className={inputClass}
                  value={mainInfo.deliveryTime}
                  onChange={(e) => onChange({ deliveryTime: e.target.value })}
                  placeholder="e.g. 2-3 Days"
                />
              </FormField>
            )}
            {showMfgDate && (
              <FormField label="Mfg Date">
                <input
                  className={inputClass}
                  type="date"
                  value={mainInfo.mfgDate}
                  onChange={(e) => onChange({ mfgDate: e.target.value })}
                />
              </FormField>
            )}
            {showExpiryDate && (
              <FormField label="Expiry Date">
                <input
                  className={inputClass}
                  type="date"
                  value={mainInfo.expiryDate}
                  onChange={(e) => onChange({ expiryDate: e.target.value })}
                />
              </FormField>
            )}
          </div>
        </FormSectionCard>
      )}

      {showVisibilitySection && (
        <FormSectionCard
          title="Visibility & Store"
          subtitle="Configure product visibility for specific store"
          accent="indigo"
          icon={<span className="text-lg">👁️</span>}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {isFieldEnabled("visibility", "shop_by_store_only") && (
              <FormField label="Show in Shop by Store only?">
                {yesNoSelect(mainInfo.isShopByStoreOnly, (v) =>
                  onChange({ isShopByStoreOnly: v })
                )}
              </FormField>
            )}

            {isFieldEnabled("visibility", "select_store") && mainInfo.isShopByStoreOnly === "Yes" && (
              <FormField label="Select Store">
                <select
                  className={selectClass}
                  value={mainInfo.shopId}
                  onChange={(e) => onChange({ shopId: e.target.value })}
                >
                  <option value="">Select a store</option>
                  {shops.map((shop) => (
                    <option key={shop._id} value={shop._id}>
                      {shop.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
          </div>
        </FormSectionCard>
      )}

      <FormSectionCard
        title="Storage Location"
        subtitle="Specify the physical location of the product"
        accent="indigo"
        icon={<span className="text-lg">📍</span>}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FormField
            label={
              <div className="flex justify-between items-center w-full">
                <span>City</span>
                <button
                  type="button"
                  onClick={() => {
                    setManualCity(!manualCity);
                    onChange({ storageCity: "", storageWarehouse: "", storageRoom: "", storageRack: "" });
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 underline font-normal focus:outline-none"
                >
                  {manualCity ? "Select from list" : "Type custom"}
                </button>
              </div>
            }
          >
            {manualCity ? (
              <input
                className={inputClass}
                value={mainInfo.storageCity}
                onChange={(e) => onChange({
                  storageCity: e.target.value,
                  storageWarehouse: "",
                  storageRoom: "",
                  storageRack: ""
                })}
                placeholder="Enter city"
              />
            ) : (
              <select
                className={selectClass}
                value={mainInfo.storageCity}
                onChange={(e) => onChange({
                  storageCity: e.target.value,
                  storageWarehouse: "",
                  storageRoom: "",
                  storageRack: ""
                })}
              >
                <option value="">Select City</option>
                {Object.keys(storageLocations).map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            )}
          </FormField>

          <FormField
            label={
              <div className="flex justify-between items-center w-full">
                <span>Warehouse</span>
                <button
                  type="button"
                  onClick={() => {
                    setManualWarehouse(!manualWarehouse);
                    onChange({ storageWarehouse: "", storageRoom: "", storageRack: "" });
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 underline font-normal focus:outline-none"
                >
                  {manualWarehouse ? "Select from list" : "Type custom"}
                </button>
              </div>
            }
          >
            {manualWarehouse ? (
              <input
                className={inputClass}
                value={mainInfo.storageWarehouse}
                onChange={(e) => onChange({
                  storageWarehouse: e.target.value,
                  storageRoom: "",
                  storageRack: ""
                })}
                placeholder="Enter warehouse"
                disabled={!mainInfo.storageCity}
              />
            ) : (
              <select
                className={selectClass}
                value={mainInfo.storageWarehouse}
                onChange={(e) => onChange({
                  storageWarehouse: e.target.value,
                  storageRoom: "",
                  storageRack: ""
                })}
                disabled={!mainInfo.storageCity}
              >
                <option value="">Select Warehouse</option>
                {mainInfo.storageCity && Object.keys(storageLocations[mainInfo.storageCity] || {}).map((wh) => (
                  <option key={wh} value={wh}>{wh}</option>
                ))}
              </select>
            )}
          </FormField>

          <FormField
            label={
              <div className="flex justify-between items-center w-full">
                <span>Room</span>
                <button
                  type="button"
                  onClick={() => {
                    setManualRoom(!manualRoom);
                    onChange({ storageRoom: "", storageRack: "" });
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 underline font-normal focus:outline-none"
                >
                  {manualRoom ? "Select from list" : "Type custom"}
                </button>
              </div>
            }
          >
            {manualRoom ? (
              <input
                className={inputClass}
                value={mainInfo.storageRoom}
                onChange={(e) => onChange({
                  storageRoom: e.target.value,
                  storageRack: ""
                })}
                placeholder="Enter room"
                disabled={!mainInfo.storageWarehouse}
              />
            ) : (
              <select
                className={selectClass}
                value={mainInfo.storageRoom}
                onChange={(e) => onChange({
                  storageRoom: e.target.value,
                  storageRack: ""
                })}
                disabled={!mainInfo.storageWarehouse}
              >
                <option value="">Select Room</option>
                {mainInfo.storageCity && mainInfo.storageWarehouse && Object.keys(storageLocations[mainInfo.storageCity]?.[mainInfo.storageWarehouse] || {}).map((room) => (
                  <option key={room} value={room}>{room}</option>
                ))}
              </select>
            )}
          </FormField>

          <FormField
            label={
              <div className="flex justify-between items-center w-full">
                <span>Rack Number</span>
                <button
                  type="button"
                  onClick={() => {
                    setManualRack(!manualRack);
                    onChange({ storageRack: "" });
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 underline font-normal focus:outline-none"
                >
                  {manualRack ? "Select from list" : "Type custom"}
                </button>
              </div>
            }
          >
            {manualRack ? (
              <input
                className={inputClass}
                value={mainInfo.storageRack}
                onChange={(e) => onChange({ storageRack: e.target.value })}
                placeholder="Enter rack number"
                disabled={!mainInfo.storageRoom}
              />
            ) : (
              <select
                className={selectClass}
                value={mainInfo.storageRack}
                onChange={(e) => onChange({ storageRack: e.target.value })}
                disabled={!mainInfo.storageRoom}
              >
                <option value="">Select Rack Number</option>
                {mainInfo.storageCity && mainInfo.storageWarehouse && mainInfo.storageRoom && (storageLocations[mainInfo.storageCity]?.[mainInfo.storageWarehouse]?.[mainInfo.storageRoom] || []).map((rack) => (
                  <option key={rack} value={rack}>{rack}</option>
                ))}
              </select>
            )}
          </FormField>

        </div>
      </FormSectionCard>
    </div>
  );
}
