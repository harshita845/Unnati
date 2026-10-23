import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { bannerService } from "../../../services/bannerService";
import { Banner } from "../../../types/banner";

export default function HomeFlashSaleBanner() {
  const navigate = useNavigate();
  const [slides, setSlides] = useState<any[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const loadBanners = async () => {
      try {
        const banners = await bannerService.getActiveBannersForPosition("Flash Deals");
        if (Array.isArray(banners) && banners.length > 0) {
          const bgGradients = [
            "linear-gradient(135deg, #FFB020 0%, #F97316 60%, #E8590C 100%)",
            "linear-gradient(135deg, #14401F 0%, #236B34 100%)",
            "linear-gradient(135deg, #1B5128 0%, #14401F 100%)"
          ];
          const mappedSlides = banners.map((b: Banner, idx: number) => {
            let target = "/flash-deals";
            if (b.resourceType === "Category" && (b.resourceId || b.categoryName)) {
              target = `/category/${b.resourceId || b.categoryName}`;
            } else if (b.resourceType === "Product" && b.resourceId) {
              target = `/product/${b.resourceId}`;
            } else if (b.redirectType === "CATEGORY" && b.redirectValue) {
              target = `/category/${b.redirectValue}`;
            } else if (b.redirectType === "PRODUCT" && b.redirectValue) {
              target = `/product/${b.redirectValue}`;
            }

            return {
              title: b.title || "Special Deal",
              subtitle: b.subtitle || (b.categoryName && b.categoryName !== "No Category Selected" ? `Exclusive offers on ${b.categoryName}` : "Limited time offers you can't miss"),
              badge: "Flash Deal",
              buttonText: b.categoryName && b.categoryName !== "No Category Selected" ? `Shop ${b.categoryName}` : "Shop Deals",
              imageUrl: b.imageUrl || b.image,
              bgColor: bgGradients[idx % bgGradients.length],
              targetUrl: target,
            };
          });
          setSlides(mappedSlides);
        } else {
          setSlides([]);
        }
      } catch (err) {
        console.error("Failed to fetch flash deal banners", err);
        setSlides([]);
      }
    };
    loadBanners();

    const handleBannerUpdate = (e?: any) => {
      if (!e || !e.detail || e.detail.type === 'banners' || e.detail.type === 'all') {
        loadBanners();
      }
    };

    window.addEventListener('unnati_banners_updated', loadBanners);
    window.addEventListener('unnati_content_updated', handleBannerUpdate);

    return () => {
      window.removeEventListener('unnati_banners_updated', loadBanners);
      window.removeEventListener('unnati_content_updated', handleBannerUpdate);
    };
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const slide = slides[currentSlide] || slides[0];
  if (!slide) return null;

  return (
    <div className="px-2 md:px-4 lg:px-4 mt-4 mb-4">
      <div 
        className="w-full rounded-[20px] md:rounded-[28px] overflow-hidden relative shadow-md transition-all duration-500 h-[125px] md:h-[160px] cursor-pointer"
        style={{ background: slide.bgColor }}
        onClick={() => navigate(slide.targetUrl)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4 }}
            className="w-full h-full flex items-center justify-between px-6 md:px-12 lg:px-16"
          >
            {/* Left Content Column */}
            <div className="flex flex-col items-start justify-center max-w-[55%] z-10">
              <div className="flex items-center gap-1 text-[9px] md:text-xs text-yellow-300 font-extrabold uppercase tracking-widest mb-1 md:mb-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-300 animate-pulse">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <span>{slide.badge}</span>
              </div>
              
              <h2 className="text-base md:text-2xl font-display font-extrabold text-white leading-tight tracking-tight mb-0.5">
                {slide.title}
              </h2>
              
              <p className="text-[9px] md:text-xs text-white/90 mb-2 font-semibold tracking-wide">
                {slide.subtitle}
              </p>

              <Link
                to={slide.targetUrl}
                onClick={(e) => e.stopPropagation()}
                className="bg-[var(--brand-amber,#FFB020)] hover:bg-[var(--brand-orange,#F97316)] text-[var(--brand-green-deep,#14401F)] font-bold text-[8px] md:text-xs px-3.5 md:px-5 py-1.5 md:py-2 rounded-full flex items-center gap-1 shadow-sm active:scale-95 transition-all"
              >
                <span>{slide.buttonText}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </Link>
            </div>

            {/* Right Product Image Column */}
            <div className="relative h-full flex items-center justify-end z-10 w-[45%]">
              <motion.img
                initial={{ scale: 0.8, rotate: -5, opacity: 0 }}
                animate={{ scale: 1, rotate: -15, opacity: 1 }}
                transition={{ type: "spring", stiffness: 100, damping: 10 }}
                src={slide.imageUrl}
                alt={slide.title}
                className="max-h-[110%] md:max-h-[125%] object-contain drop-shadow-[0_20px_20px_rgba(0,0,0,0.35)] select-none pointer-events-none transform -rotate-12 translate-y-1.5 md:translate-y-2"
              />
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Carousel Slide Indicators */}
        {slides.length > 1 && (
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex items-center gap-1.5 z-20">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentSlide(idx);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentSlide === idx ? "w-4 bg-white" : "w-1.5 bg-white/50"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
