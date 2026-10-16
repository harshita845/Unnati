import { useState, useEffect } from 'react';
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
      isActive: true,
    }
  ]
};

export default function BannerSlider({
  position,
  className = '',
  roundedClass = 'rounded-none',
}: Props) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

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
  }, [position]);

  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (banners.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, AUTOPLAY_MS);

    return () => clearInterval(interval);
  }, [banners.length, isPaused, currentIndex]);

  if (banners.length === 0) return null;

  const aspectClass = getBannerAspectClass(position);
  const currentBanner = banners[currentIndex];
  const showTextOverlay = Boolean(
    (typeof currentBanner?.title === 'string' && currentBanner.title) ||
      (typeof currentBanner?.subtitle === 'string' && currentBanner.subtitle)
  );

  return (
    <div
      className={`w-full relative group ${className}`}
    >
      <motion.div
        className={`w-full relative overflow-hidden ${roundedClass} ${aspectClass} bg-transparent shadow-[0_4px_20px_rgba(0,0,0,0.08)] rounded-xl md:rounded-2xl`}
        // Swipe left/right to change banner; it springs back into place (vertical page scroll still works)
        drag={banners.length > 1 ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 30 }}
        onDragEnd={(_, info) => {
          const swipe = info.offset.x + info.velocity.x * 0.2;
          if (swipe < -50) setCurrentIndex((prev) => (prev + 1) % banners.length);
          else if (swipe > 50) setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
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
          return (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-all duration-[1200ms] ease-in-out ${
                isActive ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 z-0 pointer-events-none'
              }`}
            >
              <img
                src={banner.image || banner.imageUrl}
                alt={banner.title || 'Banner'}
                className={`w-full h-full object-cover object-center transition-transform duration-[6000ms] ease-out ${
                  isActive ? 'scale-[1.04] md:scale-105' : 'scale-100'
                }`}
                loading={index === 0 ? 'eager' : 'lazy'}
                draggable={false}
              />
              
              {/* Dynamic text overlay optimized for desktop */}
              {showTextOverlay && isActive && (
                <div className="absolute inset-0 bg-transparent flex flex-col justify-center px-8 md:px-16 text-white pointer-events-none transition-all duration-700">
                  <div className="max-w-xl space-y-2 md:space-y-3">
                    {/* Top small label / tag for premium feel (desktop only) */}
                    <span className="hidden md:inline-block px-3 py-1 bg-emerald-500/80 backdrop-blur-md rounded-full text-[11px] font-bold tracking-widest uppercase text-white mb-1">
                      Exclusive Deal
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
                        className="flex items-center gap-2 px-6 py-2.5 bg-white text-neutral-900 rounded-full font-bold text-sm hover:bg-emerald-500 hover:text-white transform hover:-translate-y-0.5 transition-all duration-300 shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (banner.resourceType === 'Category' && banner.resourceId) {
                            window.location.href = `/category/${banner.resourceId}`;
                          } else {
                            window.location.href = '/categories';
                          }
                        }}
                      >
                        <span>Shop Now</span>
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
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {banners.map((_, idx) => (
              <motion.button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Go to banner ${idx + 1}`}
                animate={{ width: idx === currentIndex ? 32 : 10 }}
                transition={spring.snappy}
                className={`relative h-1.5 rounded-full overflow-hidden ${
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
              onClick={() => setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length)}
              aria-label="Previous banner"
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-emerald-500 hover:text-white backdrop-blur-md text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-md z-20 border border-white/20 hidden md:flex items-center justify-center transform active:scale-95 hover:scale-105"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentIndex((prev) => (prev + 1) % banners.length)}
              aria-label="Next banner"
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-emerald-500 hover:text-white backdrop-blur-md text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-md z-20 border border-white/20 hidden md:flex items-center justify-center transform active:scale-95 hover:scale-105"
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
