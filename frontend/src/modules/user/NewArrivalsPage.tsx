import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ProductCard from "./components/ProductCard";
import { getProducts } from "../../services/api/customerProductService";
import { useLocation } from "../../hooks/useLocation";

const BRAND_GRADIENT =
  "var(--gradient-leaf, linear-gradient(135deg, #8CC63F 0%, #236B34 100%))";

export default function NewArrivalsPage() {
  const navigate = useNavigate();
  const { location } = useLocation();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNewArrivals = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getProducts({
          limit: 50,
          latitude: location?.latitude,
          longitude: location?.longitude,
          city: location?.city,
        });
        if (response && response.success && Array.isArray(response.data)) {
          setProducts(
            response.data.map((p: any) => ({
              ...p,
              id: p._id || p.id,
            }))
          );
        } else {
          setProducts([]);
        }
      } catch (err) {
        console.error("Error fetching new arrivals:", err);
        setError("Failed to load new arrivals. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchNewArrivals();
  }, [location?.latitude, location?.longitude, location?.city]);

  return (
    <div className="min-h-screen bg-[var(--brand-cream,#FDF9F2)] text-[var(--brand-ink,#1C2B20)] pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[var(--brand-border,#E9E2D3)] shadow-sm">
        <div className="px-4 md:px-6 lg:px-8 py-3 md:py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-[var(--brand-ink,#1C2B20)] hover:bg-[var(--brand-cream-soft,#F6EFE2)] rounded-full transition-colors"
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18L9 12L15 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[var(--brand-green-deep,#14401F)] text-white flex items-center justify-center shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <circle cx="7" cy="7" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="text-base md:text-xl font-display font-bold text-[var(--brand-green-deep,#14401F)] leading-tight">
                New Arrivals
              </h1>
              <p className="text-[10px] md:text-xs text-[var(--brand-ink-muted,#5B6B60)] font-medium tracking-tight">
                Fresh products just added
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Banner */}
      <div
        className="px-4 md:px-6 lg:px-8 py-6 md:py-10 text-white shadow-inner"
        style={{ background: BRAND_GRADIENT }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold tracking-wider uppercase mb-2">
            Just Dropped
          </span>
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-display font-extrabold mb-2 tracking-tight drop-shadow-sm">
            NEW ARRIVALS
          </h2>
          <p className="text-white/90 text-xs md:text-base font-medium max-w-xl mx-auto">
            Discover the latest trends, newly added essentials, and brand-new collections.
          </p>
        </div>
      </div>

      {/* Products Grid */}
      <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8 max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] bg-white rounded-2xl animate-pulse border border-[var(--brand-border,#E9E2D3)] shadow-sm"
              />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm inline-block border border-[var(--brand-border,#E9E2D3)] max-w-md">
              <p className="text-[var(--brand-error,#D6402F)] font-medium mb-3">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : products.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs md:text-sm text-[var(--brand-ink-muted,#5B6B60)] font-semibold">
                Showing {products.length} products
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5">
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
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-[var(--brand-border,#E9E2D3)] p-8 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-[var(--brand-cream-soft,#F6EFE2)] text-[var(--brand-ink-muted,#5B6B60)] flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <circle cx="7" cy="7" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <h3 className="text-base font-display font-bold text-[var(--brand-ink,#1C2B20)] mb-1">No New Arrivals Found</h3>
            <p className="text-xs text-[var(--brand-ink-muted,#5B6B60)] mb-4 max-w-sm mx-auto">
              We couldn't find newly added products for your location right now. Check back soon!
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
