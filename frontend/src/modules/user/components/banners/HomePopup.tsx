import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bannerService } from '../../../../services/bannerService';
import { Banner } from '../../../../types/banner';

export default function HomePopup() {
  const navigate = useNavigate();
  const [popupData, setPopupData] = useState<Banner | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const banners = await bannerService.getActiveBannersForPosition('POPUP_ON_FIRST_VISIT');
        if (banners && banners.length > 0) {
            const hasSeen = localStorage.getItem('has_seen_popup_' + banners[0].id);
            if (!hasSeen) {
                setPopupData(banners[0]);
                // Small delay to not overwhelm user immediately
                setTimeout(() => {
                    setIsOpen(true);
                }, 2000);
            }
        }
      } catch (error) {
        console.error("Failed to load popup banner", error);
      }
    };
    fetchBanners();
  }, []);

  const handleClose = () => {
    if (popupData) {
        localStorage.setItem('has_seen_popup_' + popupData.id, 'true');
    }
    setIsOpen(false);
  };

  const handleAction = () => {
    handleClose();
    if (!popupData) return;
    const catTarget = popupData.resourceId || popupData.categoryName || (popupData as any).resourceName;
    if (popupData.resourceType === 'Category' && catTarget && catTarget !== 'No Category Selected') {
      navigate(`/category/${catTarget}`);
    } else if (popupData.redirectType === 'CATEGORY' && popupData.redirectValue) {
      navigate(`/category/${popupData.redirectValue}`);
    } else if (popupData.resourceType === 'Product' && popupData.resourceId) {
      navigate(`/product/${popupData.resourceId}`);
    } else if (popupData.redirectType === 'PRODUCT' && popupData.redirectValue) {
      navigate(`/product/${popupData.redirectValue}`);
    } else if (popupData.categoryName && popupData.categoryName !== 'No Category Selected') {
      navigate(`/category/${encodeURIComponent(popupData.categoryName)}`);
    } else {
      navigate('/categories');
    }
  };

  if (!isOpen || !popupData) return null;

  const bannerCategory =
    popupData.categoryName && popupData.categoryName !== 'No Category Selected'
      ? popupData.categoryName
      : (popupData as any).resourceName && (popupData as any).resourceName !== 'No Category Selected'
      ? (popupData as any).resourceName
      : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleClose}
      ></div>
      <div className="relative bg-white rounded-2xl overflow-hidden max-w-md w-full shadow-2xl transform transition-all duration-300 scale-100 animate-in zoom-in-95">
         <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-10 p-2 bg-white/80 rounded-full hover:bg-white text-gray-800 transition-colors shadow-sm cursor-pointer"
            aria-label="Close offer"
         >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
         </button>

         <div
            onClick={handleAction}
            className="relative bg-gray-50 flex items-center justify-center min-h-[200px] max-h-[55vh] cursor-pointer group"
         >
            <img
                src={popupData.image || popupData.imageUrl}
                alt={popupData.title || bannerCategory || 'Offer'}
                className="w-full h-auto max-h-[55vh] object-contain group-hover:scale-102 transition-transform duration-300"
            />
            {(popupData.title || popupData.subtitle) && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            )}
            {bannerCategory && (
              <div className="absolute top-3 left-3 z-10">
                <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-bold">
                  {bannerCategory}
                </span>
              </div>
            )}
         </div>

         <div className="p-6 text-center relative -mt-6 bg-white rounded-t-3xl">
             <h3 className="text-2xl font-bold text-gray-900 mb-2">
                 {typeof popupData.title === 'string' ? popupData.title : bannerCategory || 'Special Offer'}
             </h3>
             <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                 {typeof popupData.subtitle === 'string' ? popupData.subtitle : (bannerCategory ? `Explore ${bannerCategory} deals` : '')}
             </p>
             <button
                onClick={handleAction}
                className="w-full py-3.5 bg-[var(--brand-green-deep,#14401F)] text-white rounded-xl font-bold text-sm hover:bg-[var(--brand-green,#236B34)] transition-all active:scale-95 shadow-lg cursor-pointer"
             >
                Shop {bannerCategory ? bannerCategory : 'Now'} &rarr;
             </button>
         </div>
      </div>
    </div>
  );
}
