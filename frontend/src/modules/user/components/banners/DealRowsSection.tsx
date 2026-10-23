import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProductById } from '../../../../services/api/customerProductService';
import { Product } from '../../../../types/domain';
import { calculateCardPrice } from '../../../../utils/priceUtils';
import { mapApiProductForCustomerDisplay } from '../../../../utils/customerVariantUtils';
import { bannerService } from '../../../../services/bannerService';

// Admin-managed Customer App Theme tokens, so these admin-curated sections follow the brand
// colour picked in the Customer App Theme settings.
const BRAND = {
  primary: 'var(--customer-primary)',
  primaryLight: 'var(--customer-primary-light)',
  tint: 'var(--customer-primary-alpha-10)',
  border: 'var(--customer-primary-alpha-30)',
};

interface DealRowsSectionProps {
  title: string;
  subtitle: string;
  viewAllPath: string;
  /** Small pill shown on every row, e.g. "Active Deal" */
  badge: string;
  /** Which admin-picked list of product ids this section shows */
  idsKey: 'dealOfTheDayProductIds' | 'featuredDealProductIds';
  /** Older configs stored a single id instead of a list */
  legacyIdKey: 'dealOfTheDayProductId' | 'featuredDealProductId';
  /** Rendered above the card, and kept even when there are no deals */
  topSlot?: ReactNode;
}

/**
 * The admin picks the products on the Promotion screens; this shows them. The server already drops
 * anything the customer cannot buy (out of range, hidden by a lapsed subscription), so an empty
 * list simply hides the section instead of showing made-up products.
 */
export default function DealRowsSection({
  title,
  subtitle,
  viewAllPath,
  badge,
  idsKey,
  legacyIdKey,
  topSlot,
}: DealRowsSectionProps) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchProducts = async () => {
      try {
        const config = (await bannerService.getDealsConfig()) as unknown as Record<string, unknown>;
        const ids = Array.isArray(config[idsKey]) ? (config[idsKey] as string[]) : [];
        const legacyId = typeof config[legacyIdKey] === 'string' ? (config[legacyIdKey] as string) : '';
        const wanted = ids.length > 0 ? ids : legacyId ? [legacyId] : [];

        const results = await Promise.all(
          wanted.map(async (id) => {
            try {
              return await getProductById(id);
            } catch (error) {
              console.warn(`[${title}] Product ID ${id} not found or error occurred:`, error);
              return null;
            }
          })
        );

        const found: Product[] = [];
        results.forEach((res) => {
          if (res && res.success && res.data) found.push(mapApiProductForCustomerDisplay(res.data));
        });
        if (isMounted) setProducts(found);
      } catch (err) {
        console.error(`Failed to fetch ${title}`, err);
      }
    };

    fetchProducts();

    const handleUpdate = (e?: Event) => {
      const type = (e as CustomEvent | undefined)?.detail?.type;
      if (!type || type === 'deals' || type === 'all') fetchProducts();
    };
    window.addEventListener('unnati_deals_updated', handleUpdate);
    window.addEventListener('unnati_content_updated', handleUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('unnati_deals_updated', handleUpdate);
      window.removeEventListener('unnati_content_updated', handleUpdate);
    };
  }, [idsKey, legacyIdKey, title]);

  // Auto-scroll when there is more than one row
  useEffect(() => {
    if (products.length <= 1) return;

    const interval = setInterval(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const scrollAmount = container.clientWidth;
      const maxScroll = container.scrollWidth - container.clientWidth;
      if (container.scrollLeft + scrollAmount >= maxScroll) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [products]);

  if (products.length === 0) {
    return topSlot ? <div className="px-2 md:px-4 lg:px-4 mb-6">{topSlot}</div> : null;
  }

  return (
    <div className="px-2 md:px-4 lg:px-4 mb-6">
      {topSlot && <div className="mb-3">{topSlot}</div>}
      <div
        className="rounded-2xl p-3 md:p-5 shadow-sm relative overflow-hidden flex flex-col gap-3"
        style={{
          background: `linear-gradient(to bottom, white, ${BRAND.tint})`,
          border: `1px solid ${BRAND.border}`,
        }}
      >
        {/* Header: same type treatment as the other home sections */}
        <div className="flex justify-between items-center gap-3 z-10 text-left">
          <div className="min-w-0">
            <h3 className="text-lg md:text-2xl font-display font-bold text-[var(--brand-green-deep,#14401F)] tracking-tight leading-tight">
              {title}
            </h3>
            <p className="text-[11px] md:text-sm text-neutral-500 mt-0.5 truncate">{subtitle}</p>
          </div>
          <button
            onClick={() => navigate(viewAllPath)}
            className="text-xs md:text-sm font-bold flex items-center gap-0.5 whitespace-nowrap shrink-0 transition-opacity hover:opacity-80"
            style={{ color: BRAND.primary }}
          >
            View All{' '}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Compact rows: picture on the left, details on the right */}
        <div
          ref={scrollContainerRef}
          className="flex overflow-x-auto gap-3 snap-x snap-mandatory scrollbar-hide text-left"
          style={{ scrollBehavior: 'smooth' }}
        >
          {products.map((product) => {
            const { displayPrice, mrp, discount } = calculateCardPrice(product);
            return (
              <div
                key={product.id}
                className="flex-none w-full md:w-[48%] lg:w-[40%] xl:w-[30%] snap-center bg-white rounded-2xl p-3 shadow-[0_4px_16px_rgba(35,107,52,0.04)] border flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
                style={{ borderColor: BRAND.border }}
                onClick={() => navigate(`/product/${product.id}`)}
              >
                <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-[var(--brand-cream-soft,#F6EFE2)]/50">
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
                </div>

                <div className="min-w-0 flex-1 flex flex-col items-start">
                  <div className="flex items-center gap-1.5 mb-1">
                    {discount > 0 && (
                      <span
                        className="text-white text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: BRAND.primary }}
                      >
                        {discount}% OFF
                      </span>
                    )}
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border"
                      style={{ color: BRAND.primary, borderColor: BRAND.border }}
                    >
                      {badge}
                    </span>
                  </div>
                  <h4 className="font-display font-bold text-sm md:text-base text-[var(--brand-green-deep,#14401F)] leading-snug tracking-tight line-clamp-2">
                    {product.name}
                  </h4>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="font-display font-price text-lg md:text-xl font-bold" style={{ color: BRAND.primary }}>
                      ₹{displayPrice}
                    </span>
                    {mrp > displayPrice && (
                      <span className="text-xs text-neutral-400 line-through font-price">₹{mrp}</span>
                    )}
                  </div>
                  <button
                    className="mt-1.5 text-white text-xs font-bold py-1.5 px-4 rounded-lg transition-opacity hover:opacity-90 active:opacity-80"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    View Deal
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dots Indicator if multiple */}
        {products.length > 1 && (
          <div className="flex justify-center gap-1.5">
            {products.map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full transition-colors" style={{ backgroundColor: BRAND.primaryLight }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
