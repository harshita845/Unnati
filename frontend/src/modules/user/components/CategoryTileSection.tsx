import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";

interface CategoryTile {
  id: string;
  name: string;
  productImages?: (string | undefined)[];
  image?: string; // Support single image property
  productCount?: number;
  categoryId?: string;
  subcategoryId?: string;
  productId?: string;
  sellerId?: string;
  bgColor?: string;
  slug?: string;
  type?: "subcategory" | "product" | "category";
}

interface CategoryTileSectionProps {
  title: string;
  tiles: CategoryTile[];
  columns?: 2 | 3 | 4 | 6 | 8; // Support all column options
  showProductCount?: boolean; // Show product count only for bestsellers
}

export default function CategoryTileSection({
  title,
  tiles,
  columns = 4,
  showProductCount = false,
}: CategoryTileSectionProps) {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeDot, setActiveDot] = useState(0);
  const [showDots, setShowDots] = useState(false);

  // We can show up to 5 dots for navigation
  const totalDots = Math.min(5, Math.ceil(tiles.length / 2));

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    if (scrollWidth <= clientWidth + 10) {
      setShowDots(false);
      return;
    }
    setShowDots(true);
    const maxScroll = scrollWidth - clientWidth;
    const percentage = scrollLeft / maxScroll;
    const index = Math.round(percentage * (totalDots - 1));
    setActiveDot(index);
  };

  useEffect(() => {
    handleScroll();
    // Add small delay to make sure layouts are loaded
    const timer = setTimeout(handleScroll, 200);
    window.addEventListener('resize', handleScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleScroll);
    };
  }, [tiles]);

  const scrollToDot = (dotIndex: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollWidth, clientWidth } = container;
    const maxScroll = scrollWidth - clientWidth;
    const targetScroll = (dotIndex / (totalDots - 1)) * maxScroll;
    container.scrollTo({ left: targetScroll, behavior: 'smooth' });
  };

  const handleTileClick = (tile: CategoryTile) => {
    if (tile.subcategoryId || tile.type === "subcategory") {
      // Navigate to subcategory page or category with subcategory filter
      if (tile.categoryId) {
        navigate(
          `/category/${tile.categoryId}?subcategory=${tile.subcategoryId || tile.id
          }`
        );
      } else if (tile.slug) {
        navigate(`/category/${tile.slug}`);
      } else {
        navigate(`/category/subcategory/${tile.subcategoryId || tile.id}`);
      }
      return;
    }
    if (tile.categoryId) {
      navigate(`/category/${tile.categoryId}`);
      return;
    }
    if (tile.productId) {
      navigate(`/product/${tile.productId}`);
      return;
    }
    if ((tile as any).sellerId) {
      // Navigate to seller's products page or category
      navigate(`/seller/${(tile as any).sellerId}`);
      return;
    }
    // Otherwise just log for now
    console.log("Clicked tile", tile.id);
  };

  // Only what the store actually has. Invented tiles used to be padded in here, which showed
  // customers categories and product counts that did not exist and led nowhere when tapped.
  const displayTiles = tiles;

  return (
    <div className="mb-6 md:mb-8 mt-0 overflow-visible relative font-sans">
      <h2 
        className="text-xl md:text-2xl font-display font-bold text-[var(--brand-green-deep,#14401F)] mb-3 md:mb-5 px-2 md:px-4 lg:px-4 tracking-tight"
      >
        {title}
      </h2>
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="px-2 md:px-4 lg:px-4 overflow-x-auto scrollbar-hide"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        <div className="flex gap-3 md:gap-4 pb-3 pt-1">
          {displayTiles.map((tile) => {
            const images =
              tile.productImages || (tile.image ? [tile.image] : []);
            const hasImages = images.filter(Boolean).length > 0;
            const cardWidth = showProductCount ? "w-[170px] md:w-[200px]" : "w-[130px] md:w-[160px]";

            return (
              <motion.div
                key={tile.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex-shrink-0 ${cardWidth} flex flex-col`}
                style={{ scrollSnapAlign: 'start' }}
              >
                <Link
                  to={
                    tile.subcategoryId || tile.type === "subcategory"
                      ? tile.categoryId
                        ? `/category/${tile.categoryId}?subcategory=${tile.subcategoryId || tile.id
                        }`
                        : tile.slug
                          ? `/category/${tile.slug}`
                          : `/category/subcategory/${tile.subcategoryId || tile.id
                          }`
                      : tile.productId
                        ? `/product/${tile.productId}`
                        : tile.type === "category"
                          ? tile.slug
                            ? `/category/${tile.slug}`
                            : tile.categoryId
                              ? `/category/${tile.categoryId}`
                              : "#"
                          : tile.categoryId
                            ? `/category/${tile.categoryId}`
                            : (tile as any).sellerId
                              ? `/seller/${(tile as any).sellerId}`
                              : "#"
                  }
                  onClick={(e) => {
                    if (
                      !tile.categoryId &&
                      !tile.productId &&
                      !tile.subcategoryId &&
                      !(tile as any).sellerId
                    ) {
                      e.preventDefault();
                      handleTileClick(tile);
                    }
                  }}
                   className="block bg-white rounded-2xl shadow-[0_4px_16px_rgba(35,107,52,0.04)] border border-[var(--brand-border,#E9E2D3)] hover:shadow-md transition-shadow h-full p-2.5"
                >
                  {/* Image - Single image */}
                  <div
                    className={`w-full rounded-xl overflow-hidden bg-[var(--brand-cream-soft,#F6EFE2)]/50 flex items-center justify-center ${
                      showProductCount ? "h-28 md:h-36 mb-2" : "aspect-square"
                    }`}
                  >
                    {hasImages ? (
                      <img
                        key={images[0]}
                        src={images[0]}
                        alt={tile.name}
                        className="w-full h-full object-contain rounded-xl p-1"
                        onError={(e) => {
                          // Show the plain placeholder rather than an unrelated stock photo
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          target.parentElement?.classList.add("tile-image-missing");
                        }}
                      />
                    ) : null}
                    {!hasImages && (
                      <span className="text-2xl md:text-3xl font-display font-bold text-[var(--brand-green-deep,#14401F)]/35 select-none">
                        {(tile.name || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Category Name */}
                  <div className="text-xs md:text-sm font-bold text-[var(--brand-ink,#1C2B20)] leading-snug text-center w-full block mt-2 mb-1 px-1 line-clamp-2">
                    {tile.name ? tile.name.charAt(0).toUpperCase() + tile.name.slice(1).toLowerCase() : ""}
                  </div>

                  {/* Product Count (Orange Subtext) */}
                  {showProductCount && tile.productCount && (
                    <div className="text-xs md:text-sm font-display font-price font-bold text-[var(--brand-orange,#F97316)] text-center w-full block pb-1.5 font-sans">
                      {tile.productCount} items
                    </div>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Pagination / Scroll Indicator Dots */}
      {showDots && totalDots > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-2">
          {[...Array(totalDots)].map((_, idx) => (
            <button
              key={idx}
              onClick={() => scrollToDot(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${
                activeDot === idx 
                  ? 'w-6 bg-[var(--brand-green,#236B34)]' 
                  : 'w-2 bg-[var(--brand-border,#E9E2D3)] hover:bg-[var(--brand-leaf-light,#8CC63F)]'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
