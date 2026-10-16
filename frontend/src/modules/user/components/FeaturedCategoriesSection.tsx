import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FadeImage, Skeleton } from "../../../components/motion";
import { getCategories } from "../../../services/api/customerProductService";

// A curated list of beautiful pastel background colors
const PASTEL_BG_COLORS = [
  "#F2FCE4", // Light Green
  "#FFF3EB", // Light Peach/Orange
  "#ECFFEC", // Light Mint Green
  "#FEEFEA", // Light Pink/Rose
  "#FFF8EB", // Light Yellow
  "#F5F5FF", // Light Lavender/Blue
  "#F8F0FF", // Light Violet
];

export default function FeaturedCategoriesSection() {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
      try {
        const response = await getCategories(false);
        if (isMounted && response.success && Array.isArray(response.data) && response.data.length > 0) {
          const valid = response.data
            .filter((cat: any) => cat.status !== "Inactive" && cat.isActive !== false)
            .slice(0, 16)
            .map((cat: any) => ({
              id: cat._id || cat.id,
              name: cat.name,
              itemCount: cat.totalProducts ?? cat.productCount ?? 0,
              image: cat.image || "",
              slug: cat.slug || cat._id
            }));
          setCategories(valid);
        } else {
          if (isMounted) setCategories([]);
        }
      } catch (error) {
        console.error("Error fetching categories for Featured Section:", error);
        if (isMounted) setCategories([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleScroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = container.clientWidth * 0.7;
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  if (!loading && categories.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-transparent py-2 pb-3.5 px-2 md:py-6 md:px-6 lg:px-8 border-b border-[var(--brand-border,#E9E2D3)]/60 animate-fade-in font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Section Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-baseline gap-4 md:gap-6">
            <h2 
              className="text-lg md:text-2xl lg:text-[28px] font-display font-bold text-[var(--brand-green-deep,#14401F)] tracking-tight"
            >
              Featured Categories
            </h2>
          </div>

          {/* Navigation Arrows (Hidden on mobile) */}
          <div className="hidden sm:flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => handleScroll("left")}
              className="w-8 h-8 rounded-full border border-[var(--brand-border,#E9E2D3)] bg-white hover:bg-[var(--brand-leaf-tint)] hover:text-[var(--brand-green)] flex items-center justify-center text-neutral-600 transition-all hover:shadow-xs active:scale-95"
              aria-label="Scroll left"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <button
              onClick={() => handleScroll("right")}
              className="w-8 h-8 rounded-full border border-[var(--brand-border,#E9E2D3)] bg-white hover:bg-[var(--brand-leaf-tint)] hover:text-[var(--brand-green)] flex items-center justify-center text-neutral-600 transition-all hover:shadow-xs active:scale-95"
              aria-label="Scroll right"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        </div>

        {/* Categories Horizontal Scroll Grid */}
        <div
          ref={scrollContainerRef}
          className="flex gap-2.5 md:gap-4 overflow-x-auto scrollbar-hide py-1 px-0.5"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {/* While loading: shimmering placeholders the same size as the cards */}
          {loading && categories.length === 0 &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="flex-shrink-0 flex flex-col items-center w-[92px] md:w-[136px]" aria-hidden="true">
                <Skeleton className="w-[92px] h-[92px] md:w-full md:h-[120px] rounded-[24px] md:rounded-[16px]" />
                <Skeleton className="mt-2 h-3 w-16 md:w-20 rounded-full" />
              </div>
            ))}
          {categories.map((category, index) => {
            const bgColor = PASTEL_BG_COLORS[index % PASTEL_BG_COLORS.length];
            const formattedName = category.name
              ? category.name.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
              : "";
            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.04 }}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-shrink-0 flex flex-col items-center cursor-pointer transition-all w-[92px] md:w-[136px]"
                onClick={() => {
                  if (category.slug) {
                    navigate(`/category/${category.slug}`);
                  } else {
                    navigate(`/category/${category.id}`);
                  }
                }}
              >
                {/* Card Container */}
                <div 
                  className="w-[92px] h-[92px] md:w-full md:h-[120px] flex items-center justify-center border border-[var(--brand-border,#E9E2D3)]/70 rounded-2xl bg-white p-1 shadow-[0_2px_8px_rgba(35,107,52,0.04)] md:shadow-none md:p-3 overflow-hidden"
                  style={{
                    backgroundColor: window.innerWidth < 768 ? '#ffffff' : bgColor,
                  }}
                >
                  {category.image ? (
                    <FadeImage
                      src={category.image}
                      alt={category.name}
                      wrapperClassName="w-full h-full rounded-xl"
                      className="w-full h-full object-cover rounded-xl hover:scale-110"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center rounded-xl bg-[var(--brand-cream-soft,#F6EFE2)] text-[var(--brand-ink-muted,#5B6B60)]">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                      </svg>
                    </div>
                  )}
                </div>

                {/* Category Text Information */}
                <div className="w-full mt-2 text-center">
                  <h3 
                    className="text-[11px] md:text-[14px] font-bold text-[var(--brand-ink,#1C2B20)] leading-tight w-full px-0.5 line-clamp-2"
                  >
                    {formattedName}
                  </h3>
                  {category.itemCount > 0 && (
                    <span className="hidden md:inline-block text-[11px] text-[var(--brand-ink-muted,#5B6B60)] font-semibold leading-none mt-1">
                      {category.itemCount} items
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
