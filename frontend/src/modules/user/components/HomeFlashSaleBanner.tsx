import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

// High-quality floating products for the Flash Sale banner slider
const FLASH_SALE_SLIDES = [
  {
    title: "Flash Sale",
    subtitle: "Shop now before it ends!",
    badge: "Limited Time Offer",
    buttonText: "Up to 50% OFF",
    imageUrl: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=350&auto=format&fit=crop&q=80", // Premium Green Nike Sneakers
    bgColor: "linear-gradient(135deg, #14401F 0%, #236B34 100%)",
  },
  {
    title: "Weekend Deals",
    subtitle: "Fresh items on discount!",
    badge: "Special Event",
    buttonText: "Grab 40% OFF",
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=350&auto=format&fit=crop&q=80", // Premium Red Sneakers
    bgColor: "linear-gradient(135deg, #FFB020 0%, #F97316 60%, #E8590C 100%)",
  },
  {
    title: "Super Saver",
    subtitle: "Hurry up, stock is limited!",
    badge: "Exclusive Promo",
    buttonText: "Save 30% Now",
    imageUrl: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=350&auto=format&fit=crop&q=80", // Purple Fashion Sneakers
    bgColor: "linear-gradient(135deg, #1B5128 0%, #14401F 100%)",
  }
];

export default function HomeFlashSaleBanner() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % FLASH_SALE_SLIDES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const slide = FLASH_SALE_SLIDES[currentSlide];

  return (
    <div className="px-2 md:px-4 lg:px-4 mt-4 mb-4">
      <div 
        className="w-full rounded-[20px] md:rounded-[28px] overflow-hidden relative shadow-md transition-all duration-500 h-[125px] md:h-[160px]"
        style={{ background: slide.bgColor }}
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
            <div className="flex flex-col items-start justify-center max-w-[50%] z-10">
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
                to="/flash-deals"
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
        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex items-center gap-1.5 z-20">
          {FLASH_SALE_SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentSlide === idx ? "w-4 bg-white" : "w-1.5 bg-white/50"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
