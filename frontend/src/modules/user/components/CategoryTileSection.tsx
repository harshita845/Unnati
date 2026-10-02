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

  // Fallback tiles if we have too few bestseller tiles
  const displayTiles = [...tiles];
  if (showProductCount && displayTiles.length < 3) {
    const mockBestsellers: CategoryTile[] = [
      { id: "mock-best-grocery", name: "Groceries", productCount: 15, slug: "grocery", productImages: ["/dairy.jpg"], categoryId: "grocery", type: "category" },
      { id: "mock-best-fashion", name: "Fashion", productCount: 22, slug: "fashion", productImages: ["/shirt1.jpg"], categoryId: "fashion", type: "category" },
      { id: "mock-best-electronics", name: "Electronics", productCount: 18, slug: "electronics", productImages: ["/electronics.jpg"], categoryId: "electronics", type: "category" }
    ];
    mockBestsellers.forEach(mock => {
      if (!displayTiles.some(t => t.name.toLowerCase().includes(mock.slug || ''))) {
        displayTiles.push(mock);
      }
    });
  }

  return (
    <div className="mb-6 md:mb-8 mt-0 overflow-visible relative">
      <h2 
        className="text-xl md:text-3xl font-bold mb-3 md:mb-6 px-2 md:px-4 lg:px-4 tracking-tight"
        style={{ fontFamily: "'Quicksand', 'Nunito', 'Inter', sans-serif", color: '#253D4E' }}
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
            const slug = (tile.slug || tile.id || tile.name || '').toLowerCase();
            let fallbackImage = '/dairy.jpg';
            if (slug.includes('women') || slug.includes('lady') || slug.includes('ladies') || slug.includes('female')) fallbackImage = "/women.jpg";
            else if (slug.includes('shirt') || slug.includes('cloth') || slug.includes('fashion') || slug.includes('men')) fallbackImage = "/shirt1.jpg";
            else if (slug.includes('cold') || slug.includes('bev') || slug.includes('drink') || slug.includes('winter')) fallbackImage = "/cold.jpg";
            else if (slug.includes('dairy') || slug.includes('grocer') || slug.includes('food') || slug.includes('milk') || slug.includes('egg')) fallbackImage = "/dairy.jpg";
            else if (slug.includes('person') || slug.includes('beaut') || slug.includes('hygiene') || slug.includes('care')) fallbackImage = "/personal.jpg";
            else if (slug.includes('bucket') || slug.includes('home') || slug.includes('clean') || slug.includes('house')) fallbackImage = "/bucket.jpg";
            else if (slug.includes('electron') || slug.includes('gadget') || slug.includes('tech')) fallbackImage = "/electronics.jpg";
            else if (slug.includes('sport') || slug.includes('fit') || slug.includes('gym')) fallbackImage = "/sports.jpg";

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
                   className="block bg-white rounded-xl shadow-sm border border-neutral-200 hover:shadow-md transition-shadow h-full p-2"
                >
                  {/* Image - Single image */}
                  <div
                    className={`w-full rounded-lg overflow-hidden bg-neutral-50 flex items-center justify-center ${
                      showProductCount ? "h-28 md:h-36 mb-2" : "aspect-square"
                    } ${tile.bgColor || "bg-cyan-50"}`}
                  >
                    {hasImages ? (
                      <img
                        src={images[0]}
                        alt={tile.name}
                        className="w-full h-full object-contain rounded-lg"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = `<img src="${fallbackImage}" class="w-full h-full object-cover rounded-lg" />`;
                          }
                        }}
                      />
                    ) : (
                      <img
                        src={fallbackImage}
                        alt={tile.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    )}
                  </div>

                  {/* Category Name */}
                  <div className="text-xs md:text-sm font-bold text-neutral-800 leading-snug text-center w-full block mt-2 mb-1 px-1 line-clamp-2 font-sans">
                    {tile.name ? tile.name.charAt(0).toUpperCase() + tile.name.slice(1).toLowerCase() : ""}
                  </div>

                  {/* Product Count (Orange Subtext) */}
                  {showProductCount && tile.productCount && (
                    <div className="text-xs md:text-sm font-bold text-orange-500 text-center w-full block pb-1.5 font-sans">
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
                  ? 'w-5 bg-[var(--customer-primary)]' 
                  : 'w-2 bg-neutral-300 hover:bg-neutral-400'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
