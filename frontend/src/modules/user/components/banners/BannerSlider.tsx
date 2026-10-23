import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { spring } from '../../../../lib/motion';

/** Autoplay step, also the length of the active dot's fill */
const AUTOPLAY_MS = 5000;
import { bannerService } from '../../../../services/bannerService';
import { Banner, BannerPosition } from '../../../../types/banner';
import { getBannerAspectClass } from './bannerDisplayUtils';

interface Props {
  position: BannerPosition;
  className?: string;
  /** @deprecated Use aspect-ratio fitting instead of fixed heights */
  heightClass?: string;
  roundedClass?: string;
  activeCategory?: string;
}

const FALLBACK_BANNERS: Record<string, Banner[]> = {
  'Main Banner': [
    {
      id: 'fallback-1',
      title: 'Super Savings Sale',
      subtitle: 'Up to 50% Off on Fresh & Organic Groceries',
      imageUrl: '/grocery_banner.jpg',
      image: '/grocery_banner.jpg',
      position: 'Main Banner',
      resourceType: 'Category',
      resourceId: 'grocery',
      categoryName: 'Grocery',
      isActive: true,
    },
    {
      id: 'fallback-2',
      title: 'Premium Smart Devices',
      subtitle: 'Elevate Your Digital Life with Top Electronics',
      imageUrl: '/electronics_banner.jpg',
      image: '/electronics_banner.jpg',
      position: 'Main Banner',
      resourceType: 'Category',
      resourceId: 'electronics',
      categoryName: 'Electronics',
      isActive: true,
    },
    {
      id: 'fallback-3',
      title: 'Exclusive Fashion Collection',
      subtitle: 'Redefine Your Style with Premium Apparel & Accessories',
      imageUrl: '/fashion_banner.jpg',
      image: '/fashion_banner.jpg',
      position: 'Main Banner',
      resourceType: 'Category',
      resourceId: 'fashion',
      categoryName: 'Fashion',
      isActive: true,
    }
  ],
  'HOME_MAIN_SLIDER': [
    {
      id: 'fallback-1',
      title: 'Super Savings Sale',
      subtitle: 'Up to 50% Off on Fresh & Organic Groceries',
      imageUrl: '/grocery_banner.jpg',
      image: '/grocery_banner.jpg',
      position: 'Main Banner',
      resourceType: 'Category',
      resourceId: 'grocery',
      categoryName: 'Grocery',
      isActive: true,
    },
    {
      id: 'fallback-2',
      title: 'Premium Smart Devices',
      subtitle: 'Elevate Your Digital Life with Top Electronics',
      imageUrl: '/electronics_banner.jpg',
      image: '/electronics_banner.jpg',
      position: 'Main Banner',
      resourceType: 'Category',
      resourceId: 'electronics',
      categoryName: 'Electronics',
      isActive: true,
    },
    {
      id: 'fallback-3',
      title: 'Exclusive Fashion Collection',
      subtitle: 'Redefine Your Style with Premium Apparel & Accessories',
      imageUrl: '/fashion_banner.jpg',
      image: '/fashion_banner.jpg',
      position: 'Main Banner',
      resourceType: 'Category',
      resourceId: 'fashion',
      categoryName: 'Fashion',
      isActive: true,
    }
  ]
};

export default function BannerSlider({
  position,
  className = '',
  roundedClass = 'rounded-none',
  activeCategory,
}: Props) {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const activeBanners = await bannerService.getActiveBannersForPosition(position);
        const resolvedBanners = Array.isArray(activeBanners) ? activeBanners : [];
        
        // Prioritize banners configured from the admin panel / database
        if (resolvedBanners.length > 0) {
          setBanners(resolvedBanners);
        } else if (FALLBACK_BANNERS[position]) {
          setBanners(FALLBACK_BANNERS[position]);
        } else {
          setBanners([]);
        }
      } catch (error) {
        console.error('Failed to load banners', error);
        if (FALLBACK_BANNERS[position]) {
          setBanners(FALLBACK_BANNERS[position]);
        } else {
          setBanners([]);
        }
      }
    };
    fetchBanners();

    const handleBannerUpdate = (e?: any) => {
      if (!e || !e.detail || e.detail.type === 'banners' || e.detail.type === 'all') {
        fetchBanners();
      }
    };

    window.addEventListener('unnati_banners_updated', fetchBanners);
    window.addEventListener('unnati_content_updated', handleBannerUpdate);

    return () => {
      window.removeEventListener('unnati_banners_updated', fetchBanners);
      window.removeEventListener('unnati_content_updated', handleBannerUpdate);
    };
  }, [position]);

  // Sync with active category if selected from home header tabs
  useEffect(() => {
    if (!activeCategory || activeCategory === 'all' || banners.length === 0) return;
    const targetSlug = activeCategory.toLowerCase();
    const matchIndex = banners.findIndex((b) => {
      const catId = String(b.resourceId || '').toLowerCase();
      const catName = String(b.categoryName || b.resourceName || '').toLowerCase();
      return catId === targetSlug || catName.includes(targetSlug) || targetSlug.includes(catName);
    });
    if (matchIndex !== -1) {
      setCurrentIndex(matchIndex);
    }
  }, [activeCategory, banners]);

  useEffect(() => {
    if (banners.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, AUTOPLAY_MS);

    return () => clearInterval(interval);
  }, [banners.length, isPaused, currentIndex]);

  const handleBannerClick = (banner: Banner) => {
    if (isDraggingRef.current) return;
    if (!banner) return;

    const catTarget = banner.resourceId || banner.categoryName || banner.resourceName;
    if (banner.resourceType === 'Category' && catTarget && catTarget !== 'No Category Selected') {
      navigate(`/category/${catTarget}`);
    } else if (banner.resourceType === 'Product' && banner.resourceId) {
      navigate(`/product/${banner.resourceId}`);
    } else if (banner.redirectType === 'CATEGORY' && banner.redirectValue) {
      navigate(`/category/${banner.redirectValue}`);
    } else if (banner.redirectType === 'PRODUCT' && banner.redirectValue) {
      navigate(`/product/${banner.redirectValue}`);
    } else if (banner.redirectType === 'URL' && banner.redirectValue) {
      window.location.href = banner.redirectValue;
    } else if (banner.categoryName && banner.categoryName !== 'No Category Selected') {
      navigate(`/category/${encodeURIComponent(banner.categoryName)}`);
    } else if (banner.resourceName && banner.resourceName !== 'No Category Selected') {
      navigate(`/category/${encodeURIComponent(banner.resourceName)}`);
    } else {
      navigate('/categories');
    }
  };

  if (banners.length === 0) return null;

  const aspectClass = getBannerAspectClass(position);
  const currentBanner = banners[currentIndex];
  const showTextOverlay = Boolean(
    (typeof currentBanner?.title === 'string' && currentBanner.title) ||
      (typeof currentBanner?.subtitle === 'string' && currentBanner.subtitle)
  );

  return (
    <div className={`w-full relative group ${className}`}>
      <motion.div
        className={`w-full relative overflow-hidden ${roundedClass} ${aspectClass} bg-transparent shadow-[0_4px_20px_rgba(0,0,0,0.08)] rounded-xl md:rounded-2xl`}
        // Swipe left/right to change banner; it springs back into place (vertical page scroll still works)
        drag={banners.length > 1 ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 30 }}
        onDragStart={() => {
          isDraggingRef.current = true;
        }}
        onDragEnd={(_, info) => {
          const swipe = info.offset.x + info.velocity.x * 0.2;
          if (swipe < -50) setCurrentIndex((prev) => (prev + 1) % banners.length);
          else if (swipe > 50) setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
          setTimeout(() => {
            isDraggingRef.current = false;
          }, 80);
        }}
        // Autoplay waits while a finger or the mouse is on the banner
        onPointerDown={() => setIsPaused(true)}
        onPointerUp={() => setIsPaused(false)}
        onPointerCancel={() => setIsPaused(false)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {banners.map((banner, index) => {
          const isActive = index === currentIndex;
          const bannerCategory =
            banner.categoryName && banner.categoryName !== 'No Category Selected'
              ? banner.categoryName
              : banner.resourceName && banner.resourceName !== 'No Category Selected'
              ? banner.resourceName
              : null;

          return (
            <div
              key={banner.id || index}
              onClick={() => handleBannerClick(banner)}
              role="button"
              tabIndex={isActive ? 0 : -1}
              aria-label={`Open ${bannerCategory || banner.title || 'category'}`}
              onKeyDown={(e) => {
                if (isActive && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleBannerClick(banner);
                }
              }}
              className={`absolute inset-0 transition-all duration-[1200ms] ease-in-out cursor-pointer select-none ${
                isActive ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 z-0 pointer-events-none'
              }`}
            >
              <img
                src={banner.image || banner.imageUrl}
                alt={banner.title || bannerCategory || 'Banner'}
                className={`w-full h-full object-cover object-center transition-transform duration-[6000ms] ease-out pointer-events-none ${
                  isActive ? 'scale-[1.04] md:scale-105' : 'scale-100'
                }`}
                loading={index === 0 ? 'eager' : 'lazy'}
                draggable={false}
              />

              {/* Floating Category Tag Badge */}
              {isActive && bannerCategory && (
                <div className="absolute top-2.5 left-2.5 sm:top-3.5 sm:left-3.5 z-20 pointer-events-none">
                  <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-[11px] sm:text-xs font-bold tracking-tight border border-white/20 shadow-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{bannerCategory}</span>
                    <span className="text-white/70 font-normal hidden sm:inline">• Tap to view items &rarr;</span>
                  </span>
                </div>
              )}
              
              {/* Dynamic text overlay optimized for desktop */}
              {showTextOverlay && isActive && (
                <div className="absolute inset-0 bg-transparent flex flex-col justify-center px-8 md:px-16 text-white pointer-events-none transition-all duration-700">
                  <div className="max-w-xl space-y-2 md:space-y-3">
                    {/* Top small label / tag for premium feel (desktop only) */}
                    <span className="hidden md:inline-block px-3 py-1 bg-emerald-500/80 backdrop-blur-md rounded-full text-[11px] font-bold tracking-widest uppercase text-white mb-1">
                      {bannerCategory || 'Exclusive Deal'}
                    </span>
                    
                    {typeof banner.title === 'string' && banner.title && (
                      <h2
                        className="text-2xl md:text-5xl font-extrabold tracking-tight leading-tight select-none"
                        style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
                      >
                        {banner.title}
                      </h2>
                    )}
                    {typeof banner.subtitle === 'string' && banner.subtitle && (
                      <p
                        className="text-xs md:text-lg text-neutral-200 font-medium tracking-wide max-w-lg select-none"
                        style={{ textShadow: '0 1px 6px rgba(0,0,0,0.4)' }}
                      >
                        {banner.subtitle}
                      </p>
                    )}
                    
                    {/* Interactive button (desktop only) */}
                    <div className="hidden md:block pt-3 pointer-events-auto">
                      <button 
                        className="flex items-center gap-2 px-6 py-2.5 bg-white text-neutral-900 rounded-full font-bold text-sm hover:bg-emerald-500 hover:text-white transform hover:-translate-y-0.5 transition-all duration-300 shadow-lg cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBannerClick(banner);
                        }}
                      >
                        <span>Shop {bannerCategory ? bannerCategory : 'Now'}</span>
                        <svg className="w-4 h-4 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Elegant Dot Indicators */}
        {banners.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {banners.map((_, idx) => (
              <motion.button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                aria-label={`Go to banner ${idx + 1}`}
                animate={{ width: idx === currentIndex ? 32 : 10 }}
                transition={spring.snappy}
                className={`relative h-1.5 rounded-full overflow-hidden cursor-pointer ${
                  idx === currentIndex ? 'bg-emerald-500/40' : 'bg-white/50 hover:bg-white/80'
                }`}
              >
                {/* The active dot fills up as the next banner approaches */}
                {idx === currentIndex && (
                  <span
                    key={currentIndex}
                    className="banner-dot-fill absolute inset-0 rounded-full bg-emerald-500 origin-left"
                    style={{
                      animationDuration: `${AUTOPLAY_MS}ms`,
                      animationPlayState: isPaused ? 'paused' : 'running',
                    }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        )}

        {/* Glassmorphism navigation arrows (desktop only) */}
        {banners.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
              }}
              aria-label="Previous banner"
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-emerald-500 hover:text-white backdrop-blur-md text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-md z-20 border border-white/20 hidden md:flex items-center justify-center transform active:scale-95 hover:scale-105 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev + 1) % banners.length);
              }}
              aria-label="Next banner"
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-emerald-500 hover:text-white backdrop-blur-md text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-md z-20 border border-white/20 hidden md:flex items-center justify-center transform active:scale-95 hover:scale-105 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
