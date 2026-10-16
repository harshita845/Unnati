import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface ShopItem {
  id: string;
  name: string;
  storeBanner?: string;
  logo?: string;
  image?: string;
  productImages?: string[];
  productsPreview?: Array<{
    id: string;
    title: string;
    image?: string;
    price?: number;
    regularPrice?: number;
  }>;
  slug?: string;
  category?: string;
  city?: string;
  address?: string;
  serviceableArea?: string;
  distance?: string;
  rating?: number;
  ratingCount?: number;
  totalProducts?: number;
  deliveryTime?: string;
  bgColor?: string;
  isFeatured?: boolean;
}

interface ShopByStoreSectionProps {
  shops: ShopItem[];
  currentCity?: string;
}

export default function ShopByStoreSection({ shops = [], currentCity }: ShopByStoreSectionProps) {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  if (!shops || shops.length === 0) {
    return null;
  }

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -360, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 360, behavior: 'smooth' });
    }
  };

  const handleStoreClick = (shop: ShopItem) => {
    const storeSlug = shop.slug || shop.id.replace('-store', '');
    navigate(`/store/${storeSlug}`, {
      state: {
        storeName: shop.name,
        storeImage: shop.image || (shop as any).storeBanner || (shop as any).banner,
      },
    });
  };

  return (
    <section className="mb-8 mt-6 md:mb-12 md:mt-10 px-2 md:px-4 lg:px-4">
      {/* Header with Title, Stats & Interactive Navigation Controls */}
      <div className="flex items-end justify-between mb-4 md:mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green,#236B34)]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand-green,#236B34)]">
              Local Verified Stores
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-display font-bold text-[var(--brand-green-deep,#14401F)] tracking-tight">
            Shop by Store
          </h2>
          <p className="text-xs md:text-sm text-[var(--brand-ink-muted,#5B6B60)] mt-0.5">
            {shops.length} verified {shops.length === 1 ? 'store' : 'stores'}{' '}
            {currentCity ? `delivering in ${currentCity}` : 'delivering near you'}
          </p>
        </div>

        {/* Carousel Arrow Controls (Visible when more than 1 store) */}
        {shops.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={scrollLeft}
              aria-label="Previous store"
              className="w-8 h-8 md:w-9 md:h-9 rounded-full border border-[var(--brand-border,#E9E2D3)] bg-white hover:bg-[var(--brand-cream-soft,#F6EFE2)] active:scale-95 text-[var(--brand-ink,#1C2B20)] flex items-center justify-center transition-all shadow-xs"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={scrollRight}
              aria-label="Next store"
              className="w-8 h-8 md:w-9 md:h-9 rounded-full border border-[var(--brand-border,#E9E2D3)] bg-white hover:bg-[var(--brand-green,#236B34)] hover:text-white hover:border-[var(--brand-green,#236B34)] active:scale-95 text-[var(--brand-ink,#1C2B20)] flex items-center justify-center transition-all shadow-xs"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Interactive Horizontal Scroll / Grid of Large Store Cards */}
      <div
        ref={scrollContainerRef}
        className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory pb-4 pt-1 px-1 scrollbar-none"
      >
        {shops.map((shop) => {
          const bannerImage = shop.storeBanner || shop.image || (shop.productImages && shop.productImages[0]) || '';
          const previewList = (shop.productImages || []).filter(Boolean).slice(0, 4);
          const totalProds = shop.totalProducts || (shop.productImages ? shop.productImages.length : 0);
          const categoryName = shop.category || 'Grocery & Essentials';
          const ratingValue = shop.rating || 4.8;
          const deliveryTime = shop.deliveryTime || '15-25 mins';
          const addressText = shop.address || shop.city || 'Local Store';

          return (
            <div
              key={shop.id}
              onClick={() => handleStoreClick(shop)}
              className="w-[300px] sm:w-[340px] md:w-auto flex-shrink-0 snap-start group bg-white rounded-2xl md:rounded-3xl border border-[var(--brand-border,#E9E2D3)] shadow-[0_4px_20px_rgba(35,107,52,0.05)] hover:shadow-[0_12px_32px_rgba(35,107,52,0.12)] hover:-translate-y-1.5 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between"
            >
              {/* Top Banner & Visual Collage */}
              <div>
                <div className="relative h-44 sm:h-48 md:h-52 w-full overflow-hidden bg-[var(--brand-cream-soft,#F6EFE2)]">
                  {bannerImage ? (
                    <img
                      src={bannerImage}
                      alt={shop.name}
                      className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[var(--brand-green,#236B34)] to-[var(--brand-green-deep,#14401F)] flex items-center justify-center text-white text-5xl font-display font-extrabold tracking-wider opacity-90">
                      {shop.name.charAt(0)}
                    </div>
                  )}

                  {/* Dark subtle gradient overlay at bottom for readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                  {/* Top Badges: Live Status, Delivery Time & Rating */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-[11px] font-semibold shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-[var(--brand-leaf-light,#8CC63F)] animate-pulse" />
                      <span>{deliveryTime}</span>
                    </div>

                    <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full text-[var(--brand-ink,#1C2B20)] text-xs font-bold shadow-xs">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFB020" stroke="#FFB020">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      <span>{ratingValue}</span>
                    </div>
                  </div>

                  {/* Bottom Image Overlay: Category Pill & Store Name preview */}
                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-white/20 backdrop-blur-md text-white text-[11px] font-medium border border-white/30 mb-1">
                      {categoryName}
                    </span>
                    <h3 className="text-white text-base sm:text-lg font-display font-bold leading-tight drop-shadow-sm truncate">
                      {shop.name}
                    </h3>
                  </div>
                </div>

                {/* Content Body */}
                <div className="p-4 sm:p-5">
                  {/* Location & Product count row */}
                  <div className="flex items-center justify-between text-xs text-[var(--brand-ink-muted,#5B6B60)] mb-3">
                    <div className="flex items-center gap-1 truncate max-w-[70%]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--brand-ink-muted,#5B6B60)] flex-shrink-0">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className="truncate">{addressText}</span>
                    </div>
                    {totalProds > 0 && (
                      <span className="text-[11px] font-semibold text-[var(--brand-green,#236B34)] bg-[var(--brand-leaf-tint,#EAF5E0)] px-2 py-0.5 rounded-full whitespace-nowrap">
                        {totalProds}+ items
                      </span>
                    )}
                  </div>

                  {/* Interactive Product Preview Shelf */}
                  {previewList.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[var(--brand-border-light,#F2ECE0)]">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--brand-ink-muted,#5B6B60)] mb-2">
                        <span>Popular In This Store</span>
                        <span className="text-[var(--brand-green,#236B34)] group-hover:underline">Explore</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {previewList.map((img, idx) => (
                          <div
                            key={idx}
                            className="aspect-square rounded-xl bg-[var(--brand-cream-soft,#F6EFE2)]/40 border border-[var(--brand-border,#E9E2D3)] p-1 overflow-hidden flex items-center justify-center hover:scale-105 transition-transform duration-200"
                          >
                            <img
                              src={img}
                              alt="Store Product"
                              className="w-full h-full object-contain mix-blend-multiply"
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded-xl bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                >
                  <span>Visit Store</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="group-hover:translate-x-1 transition-transform"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
