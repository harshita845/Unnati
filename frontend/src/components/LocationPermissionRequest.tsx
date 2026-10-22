import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from '../hooks/useLocation';
import GoogleMapsAutocomplete from './GoogleMapsAutocomplete';
import { getAvailableCitiesService } from '../services/api/customerHomeService';

interface LocationPermissionRequestProps {
  onLocationGranted: () => void;
  skipable?: boolean;
  title?: string;
  description?: string;
  isChangeMode?: boolean;
}

export default function LocationPermissionRequest({
  onLocationGranted,
  skipable = false,
  title = 'Location Access Required',
  description = 'We need your location to show you products available near you and enable delivery services.',
  isChangeMode = false,
}: LocationPermissionRequestProps) {
  const { requestLocation, updateLocation, isLocationEnabled, isLocationLoading, locationError, locationPermissionStatus, clearLocation } = useLocation();
  const [showManualInput, setShowManualInput] = useState(isChangeMode);
  const [manualAddress, setManualAddress] = useState('');
  const [manualLat, setManualLat] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const [manualLng, setManualLng] = useState(0);
  const [availableCities, setAvailableCities] = useState<Array<{ city: string; latitude?: number; longitude?: number }>>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (isLocationEnabled && !isChangeMode) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isLocationEnabled, isChangeMode]);

  // Fetch serviceable cities
  useEffect(() => {
    let isMounted = true;
    const fetchCities = async () => {
      setLoadingCities(true);
      try {
        const res = await getAvailableCitiesService();
        if (isMounted && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setAvailableCities(res.data);
        } else if (isMounted) {
          setAvailableCities([
            { city: 'Hyderabad', latitude: 17.4156, longitude: 78.4347 },
            { city: 'Indore', latitude: 22.7244, longitude: 75.8839 },
          ]);
        }
      } catch (err) {
        console.error('Failed to fetch serviceable cities:', err);
        if (isMounted) {
          setAvailableCities([
            { city: 'Hyderabad', latitude: 17.4156, longitude: 78.4347 },
            { city: 'Indore', latitude: 22.7244, longitude: 75.8839 },
          ]);
        }
      } finally {
        if (isMounted) setLoadingCities(false);
      }
    };
    fetchCities();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-grant if already enabled in normal (initial) mode
  useEffect(() => {
    if (isLocationEnabled && !isChangeMode) {
      console.log('[LocationPermissionRequest] Location is enabled, notifying parent.');
      onLocationGranted();
    }
  }, [isLocationEnabled, isChangeMode, onLocationGranted]);

  const handleAllowLocation = async () => {
    setManualAddress('');
    setManualLat(0);
    setManualLng(0);

    try {
      await requestLocation();
      onLocationGranted();
    } catch (error) {
      // Error handled by context
    }
  };

  const handleManualLocationSelect = (address: string, lat: number, lng: number, _placeName: string) => {
    setSaveError('');
    setManualAddress(address);
    setManualLat(lat);
    setManualLng(lng);
  };

  /**
   * Typed text without picking a suggestion has no coordinates yet: use a serviceable city with
   * that name, else look the address up (Google, then OpenStreetMap).
   */
  const findCoordinates = async (text: string): Promise<{ lat: number; lng: number; address: string } | null> => {
    const query = text.trim();
    const city = availableCities.find((c) => c.city.trim().toLowerCase() === query.toLowerCase());
    if (city?.latitude && city?.longitude) return { lat: city.latitude, lng: city.longitude, address: city.city };

    type Geo = { geocode: (r: object) => Promise<{ results: Array<{ formatted_address?: string; geometry?: { location?: { lat(): number; lng(): number } } }> }> };
    const geocoder = (window as unknown as { google?: { maps?: { Geocoder?: new () => Geo } } }).google?.maps?.Geocoder;
    if (geocoder) {
      try {
        const { results } = await new geocoder().geocode({ address: query, componentRestrictions: { country: 'in' } });
        const loc = results?.[0]?.geometry?.location;
        if (loc) return { lat: loc.lat(), lng: loc.lng(), address: results[0].formatted_address || query };
      } catch {
        // fall through to OpenStreetMap
      }
    }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=1`);
      const [hit] = await res.json();
      if (hit?.lat && hit?.lon) return { lat: Number(hit.lat), lng: Number(hit.lon), address: hit.display_name || query };
    } catch {
      // nothing found
    }
    return null;
  };

  const handleSaveManualLocation = async () => {
    if (!manualAddress.trim() || savingManual) return;
    setSaveError('');
    setSavingManual(true);
    try {
      let lat = manualLat;
      let lng = manualLng;
      let address = manualAddress;
      if (!lat || !lng) {
        const found = await findCoordinates(manualAddress);
        if (!found) {
          setSaveError("Couldn't find that place. Pick one from the suggestions or choose a city below.");
          return;
        }
        ({ lat, lng, address } = found);
      }
      await updateLocation({ latitude: lat, longitude: lng, address });
      onLocationGranted();
    } catch (error) {
      console.error('Failed to save manual location:', error);
      setSaveError("Couldn't save this location. Please try again.");
    } finally {
      setSavingManual(false);
    }
  };

  const handleSelectCity = async (cityItem: { city: string; latitude?: number; longitude?: number }) => {
    try {
      await updateLocation({
        latitude: cityItem.latitude || 0,
        longitude: cityItem.longitude || 0,
        address: cityItem.city,
        city: cityItem.city,
      });
      onLocationGranted();
    } catch (error) {
      console.error('Failed to save city location:', error);
    }
  };

  if (isLocationEnabled && !isChangeMode) {
    return null;
  }

  if (!isMounted || typeof document === 'undefined') {
    return null;
  }

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto overflow-x-hidden bg-black/60 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
        {/* Backdrop click to dismiss if skipable / changeMode */}
        <div
          className="fixed inset-0"
          aria-hidden="true"
          onClick={isChangeMode || skipable ? onLocationGranted : undefined}
        />

        <div className="relative w-full max-w-md my-auto bg-white rounded-2xl border border-[var(--brand-border,#E9E2D3)] shadow-2xl p-5 sm:p-6 text-left transform transition-all animate-in fade-in zoom-in-95 duration-200 z-10 box-border">
          {/* Close Button if in change mode or skipable */}
          {(isChangeMode || skipable) && (
            <button
              onClick={onLocationGranted}
              className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 w-8 h-8 rounded-full bg-[var(--brand-cream-soft,#F6EFE2)] hover:bg-[var(--brand-border,#E9E2D3)] flex items-center justify-center text-[var(--brand-ink-muted,#5B6B60)] hover:text-[var(--brand-ink,#1C2B20)] transition-colors z-20"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}

          <div className="text-center mb-4 sm:mb-5 pr-6 sm:pr-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[var(--brand-leaf-tint,#EAF5E0)] border border-[var(--brand-leaf,#5FA82E)]/30 rounded-full flex items-center justify-center mx-auto mb-2.5 sm:mb-3 text-[var(--brand-green,#236B34)]">
              <svg width="24" height="24" className="sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <h2 className="text-base sm:text-lg md:text-xl font-display font-extrabold text-[var(--brand-green-deep,#14401F)] leading-snug break-words">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--brand-ink-muted,#5B6B60)] mt-1 max-w-sm mx-auto leading-relaxed">
              {description}
            </p>
          </div>

        {/* GPS Button */}
        <div className="mb-3.5 sm:mb-4">
          <button
            onClick={handleAllowLocation}
            disabled={isLocationLoading}
            className="w-full py-2.5 sm:py-3 px-4 bg-[var(--brand-green,#236B34)] text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-[var(--brand-green-dark,#1B5128)] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] cursor-pointer"
          >
            {isLocationLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Detecting GPS Location...</span>
              </>
            ) : (
              <>
                <svg width="16" height="16" className="sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                </svg>
                <span>Use Current GPS Location</span>
              </>
            )}
          </button>
        </div>

        {locationError && (
          <div className="mb-3.5 sm:mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left">
            <p className="text-xs font-semibold text-amber-900">{locationError}</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              You can search for your address or select your city below.
            </p>
          </div>
        )}

        <div className="relative my-3.5 sm:my-4 flex items-center justify-center">
          <div className="border-t border-[var(--brand-border,#E9E2D3)] w-full"></div>
          <span className="bg-white px-2.5 sm:px-3 text-[10px] sm:text-xs font-bold text-[var(--brand-ink-muted,#5B6B60)] uppercase tracking-wider absolute">
            Or Enter Manually
          </span>
        </div>

        {/* Address Search Field */}
        <div className="space-y-2.5 sm:space-y-3 mb-3.5 sm:mb-4">
          <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[var(--brand-ink-muted,#5B6B60)] text-left">
            Search Address / Locality
          </label>
          <GoogleMapsAutocomplete
            value={manualAddress}
            onChange={handleManualLocationSelect}
            placeholder="Search area, locality, or landmark..."
            required
          />
          {manualAddress && (
            <button
              onClick={handleSaveManualLocation}
              disabled={savingManual}
              className="w-full py-2.5 bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {savingManual ? 'Finding location…' : 'Confirm & Save Location'}
            </button>
          )}
          {saveError && (
            <p role="alert" className="text-xs font-medium text-red-600 text-left">
              {saveError}
            </p>
          )}
        </div>

        {/* Available / Popular Serviceable Cities */}
        {availableCities.length > 0 && (
          <div className="mt-3.5 sm:mt-4 pt-3 border-t border-[var(--brand-border-light,#F2ECE0)] text-left">
            <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[var(--brand-ink-muted,#5B6B60)] mb-2">
              Serviceable Cities
            </label>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 max-h-28 sm:max-h-32 overflow-y-auto pr-1">
              {availableCities.map((c) => (
                <button
                  key={c.city}
                  type="button"
                  onClick={() => handleSelectCity(c)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-[var(--brand-border,#E9E2D3)] bg-[var(--brand-cream-soft,#F6EFE2)]/50 hover:bg-[var(--brand-green,#236B34)] hover:text-white hover:border-[var(--brand-green,#236B34)] text-xs font-medium text-[var(--brand-ink,#1C2B20)] transition-colors active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  </svg>
                  <span>{c.city}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Skip button for initial onboarding */}
        {skipable && !isChangeMode && (
          <div className="mt-3 pt-2 text-center">
            <button
              onClick={onLocationGranted}
              className="text-xs text-neutral-400 hover:text-neutral-600 font-medium"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
  );

  return createPortal(modalContent, document.body);
}
