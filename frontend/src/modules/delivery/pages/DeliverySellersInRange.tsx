import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import DeliveryHeader from '../components/DeliveryHeader';
import DeliveryBottomNav from '../components/DeliveryBottomNav';
import { getSellersInRadius } from '../../../services/api/delivery/deliveryService';
import { useDeliveryStatus } from '../context/DeliveryStatusContext';

export default function DeliverySellersInRange() {
  const navigate = useNavigate();
  const { isOnline, sellersInRange, isLoadingSellers, locationError } = useDeliveryStatus();
  const [error, setError] = useState('');

  useEffect(() => {
    if (locationError) {
      setError(locationError);
    }
  }, [locationError]);

  if (!isOnline) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center pb-20 px-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">You are Offline</h2>
          <p className="text-neutral-500 mb-6">Go online to see sellers in your current service area.</p>
          <button
            onClick={() => navigate('/delivery')}
            className="w-full bg-[var(--primary-dark)] text-white py-3 rounded-xl font-semibold hover:bg-[var(--primary-darker)] transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
        <DeliveryBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 pb-20 overflow-x-hidden">
      <DeliveryHeader />

      <div className="px-3 sm:px-4 py-4 max-w-lg mx-auto w-full">
        <div className="flex items-center mb-5 sm:mb-6">
          <button
            onClick={() => navigate(-1)}
            className="mr-3 p-2 hover:bg-neutral-200 rounded-full transition-colors bg-white shadow-sm border border-neutral-200 shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18L9 12L15 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0">
            <h2 className="text-neutral-900 text-lg sm:text-xl font-bold truncate">Sellers in Range</h2>
            <p className="text-xs text-neutral-500 truncate">Showing stores that include your current location</p>
          </div>
        </div>

        {isLoadingSellers ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-neutral-500 text-sm">Updating sellers in range...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        ) : sellersInRange.length > 0 ? (
          <div className="space-y-3.5 sm:space-y-4">
            {sellersInRange.map((seller) => (
              <div
                key={seller._id}
                className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm border border-neutral-100 hover:border-teal-200 transition-all group overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                      <h3 className="text-neutral-900 font-bold text-sm sm:text-base leading-snug break-words">
                        {seller.storeName}
                      </h3>
                      <span className="px-2 py-0.5 bg-[var(--primary-alpha-10)] text-[var(--primary-dark)] text-[10px] font-bold rounded-full border border-teal-100 shrink-0">
                        IN RANGE
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-500 text-xs mb-2 min-w-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className="truncate">{seller.address || 'Address not available'}</span>
                    </div>

                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-neutral-50">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Distance</span>
                        <span className="text-xs sm:text-sm font-bold text-neutral-700">
                          {(seller.distanceFromDeliveryBoy / 1000).toFixed(2)} km
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Service Radius</span>
                        <span className="text-xs sm:text-sm font-bold text-neutral-700">
                          {seller.serviceRadiusKm} km
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-neutral-50 rounded-xl flex items-center justify-center text-[var(--primary-dark)] group-hover:bg-[var(--primary-alpha-10)] transition-colors">
                      <svg width="20" height="20" className="sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 sm:p-10 text-center border border-neutral-200 shadow-sm">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-neutral-900 mb-1">No Sellers Found</h3>
            <p className="text-neutral-500 text-xs sm:text-sm">You are not currently within any seller's service radius.</p>
          </div>
        )}
      </div>

      <DeliveryBottomNav />
    </div>
  );
}
