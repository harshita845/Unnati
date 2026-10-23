import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ProductCard from "./components/ProductCard";
import { getLowestPricesProducts } from "../../services/api/customerHomeService";
import { useLocation } from "../../hooks/useLocation";

const BRAND_GRADIENT =
  "var(--gradient-leaf, linear-gradient(135deg, #8CC63F 0%, #236B34 100%))";

export default function LowestPricesEverPage() {
  const navigate = useNavigate();
  const { location } = useLocation();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getLowestPricesProducts(
          location?.latitude,
          location?.longitude
        );
        if (response.success && Array.isArray(response.data)) {
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
        console.error("Error fetching lowest prices products:", err);
        setError("Failed to load products. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();

    const handleUpdate = (e?: any) => {
      const type = e?.detail?.type;
      if (!type || type === "home" || type === "products" || type === "all") {
        fetchProducts();
      }
    };

    window.addEventListener("unnati_content_updated", handleUpdate);
    window.addEventListener("productUpdated", handleUpdate);
    window.addEventListener("focus", handleUpdate);

    return () => {
      window.removeEventListener("unnati_content_updated", handleUpdate);
      window.removeEventListener("productUpdated", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, [location?.latitude, location?.longitude]);

  return (
    <div className="min-h-screen bg-[var(--brand-cream,#FDF9F2)] text-[var(--brand-ink,#1C2B20)] pb-20">
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[var(--brand-border,#E9E2D3)]">
        <div className="px-4 md:px-6 lg:px-8 py-3 md:py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-[var(--brand-ink,#1C2B20)] hover:bg-[var(--brand-cream-soft,#F6EFE2)] rounded-full transition-colors"
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18L9 12L15 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-col">
            <h1 className="text-base md:text-xl font-display font-bold text-[var(--brand-green-deep,#14401F)] leading-tight">
              Lowest Prices Ever
            </h1>
            <p className="text-[10px] md:text-xs text-[var(--brand-ink-muted,#5B6B60)] font-medium tracking-tight">
              Handpicked deals at unbeatable prices
            </p>
          </div>
        </div>
      </div>

      <div
        className="px-4 md:px-6 lg:px-8 py-6 md:py-10 text-white"
        style={{ background: BRAND_GRADIENT }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-display font-extrabold mb-2 tracking-tight uppercase drop-shadow-sm">
            LOWEST PRICES EVER
          </h2>
          <p className="text-white/90 text-sm md:text-base font-medium">
            Shop the best value picks curated just for you
          </p>
        </div>
      </div>

      <div className="px-4 md:px-6 lg:px-8 py-6 md:py-10 max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] bg-white rounded-2xl animate-pulse border border-[var(--brand-border,#E9E2D3)] shadow-sm"
              />
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
            <p className="text-[var(--brand-ink-muted,#5B6B60)] font-medium">No products found in this section.</p>
          </div>
        )}
      </div>
    </div>
  );
}
