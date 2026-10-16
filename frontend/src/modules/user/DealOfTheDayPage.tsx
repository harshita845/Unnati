import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ProductCard from "./components/ProductCard";
import { getProductById } from "../../services/api/customerProductService";
import { bannerService } from "../../services/bannerService";
import { useLocation } from "../../hooks/useLocation";
import BannerSlider from "./components/banners/BannerSlider";

// Drive the hero band and CTA off the Unnati brand tokens
const BRAND_GRADIENT = "var(--gradient-signature, linear-gradient(135deg, #FFB020 0%, #F97316 60%, #E8590C 100%))";

// Products whose store doesn't deliver to the user's location are left out (the API returns 404)
async function fetchProductsByIds(ids: string[], location?: { latitude?: number; longitude?: number } | null) {
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        return await getProductById(id, location?.latitude, location?.longitude);
      } catch {
        return null;
      }
    })
  );

  return results
    .filter((res) => res?.success && res.data)
    .map((res) => ({
      ...res!.data,
      id: (res!.data as any)._id || (res!.data as any).id,
    }));
}

export default function DealOfTheDayPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { location } = useLocation();

  useEffect(() => {
    const fetchDeals = async () => {
      setLoading(true);
      setError(null);
      try {
        const configResponse = await bannerService.getDealsConfig();
        let fetchedProducts: any[] = [];

        if (configResponse.dealOfTheDayProductIds && configResponse.dealOfTheDayProductIds.length > 0) {
          fetchedProducts = await fetchProductsByIds(configResponse.dealOfTheDayProductIds, location);
        } else if ((configResponse as any).dealOfTheDayProductId) {
          fetchedProducts = await fetchProductsByIds([(configResponse as any).dealOfTheDayProductId], location);
        }

        setProducts(fetchedProducts);
      } catch (err) {
        console.error("Error fetching deals of the day:", err);
        setError("Failed to load deals. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, [location?.latitude, location?.longitude]);

  return (
    <div className="min-h-screen bg-[var(--brand-cream,#FDF9F2)] text-[var(--brand-ink,#1C2B20)] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[var(--brand-border,#E9E2D3)]">
        <div className="px-4 md:px-6 lg:px-8 py-3 md:py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-[var(--brand-ink,#1C2B20)] hover:bg-[var(--brand-cream-soft,#F6EFE2)] rounded-full transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18L9 12L15 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-col">
            <h1 className="text-base md:text-xl font-display font-bold text-[var(--brand-green-deep,#14401F)] leading-tight">Deal of the Day</h1>
            <p className="text-[10px] md:text-xs text-[var(--brand-ink-muted,#5B6B60)] font-medium tracking-tight">Handpicked savings just for today</p>
          </div>
        </div>
      </div>

      {/* Admin-uploaded deal-of-the-day banners */}
      <div
        className="px-4 md:px-6 lg:px-8 pt-4 pb-2"
        style={{ background: BRAND_GRADIENT }}
      >
        <BannerSlider position="Deal of the Day" />
      </div>

      {/* Hero Banner Area — shown when no admin slider images */}
      <div
        className="px-4 md:px-6 lg:px-8 py-6 md:py-10 text-white"
        style={{ background: BRAND_GRADIENT }}
      >
        <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-display font-extrabold mb-2 tracking-tight uppercase drop-shadow-sm">DEAL OF THE DAY</h2>
            <p className="text-white/90 text-sm md:text-base font-medium italic">Handpicked deals at unbeatable prices, only for 24 hours!</p>
        </div>
      </div>

      {/* Products Grid */}
      <div className="px-4 md:px-6 lg:px-8 py-6 md:py-10 max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-white rounded-2xl animate-pulse border border-[var(--brand-border,#E9E2D3)] shadow-sm" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-[var(--brand-ink-muted,#5B6B60)] bg-white p-6 rounded-2xl shadow-sm inline-block border border-[var(--brand-border,#E9E2D3)]">
              {error}
            </p>
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                showBadge={true}
                categoryStyle={true}
                showStockInfo={false}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="bg-white p-10 rounded-3xl shadow-sm border border-[var(--brand-border,#E9E2D3)] inline-block">
                <span className="text-5xl mb-4 block">🔥</span>
                <p className="text-[var(--brand-ink-muted,#5B6B60)] font-bold text-lg">No active deals found for today.</p>
                <button
                    onClick={() => navigate('/')}
                    className="mt-6 px-8 py-3 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                    style={{ backgroundColor: 'var(--brand-green, #236B34)' }}
                >Continue Shopping</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
