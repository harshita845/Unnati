import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getProducts } from "../../../services/api/customerProductService";
import { useLocation } from "../../../hooks/useLocation";

export default function NewArrivalsSection() {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { location } = useLocation();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchNewArrivals = async () => {
      setLoading(true);
      try {
        const response = await getProducts({
          limit: 12,
          sort: 'price_asc', // or newest
          latitude: location?.latitude,
          longitude: location?.longitude,
          city: location?.city,
        });
        if (isMounted && response.success && Array.isArray(response.data) && response.data.length > 0) {
          const mapped = response.data
            .filter((p: any) => p.mainImage || p.imageUrl)
            .map((p: any) => ({
              id: p._id || p.id,
              name: p.productName || p.name,
              imageUrl: p.mainImage || p.imageUrl,
              price: p.price,
            }));
          setProducts(mapped);
        } else {
          if (isMounted) setProducts([]);
        }
      } catch (error) {
        console.error("Error fetching new arrivals:", error);
        if (isMounted) setProducts([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchNewArrivals();
    return () => {
      isMounted = false;
    };
  }, [location?.latitude, location?.longitude, location?.city]);

  if (!loading && products.length === 0) {
    return null;
  }

  return (
    <div className="px-2 md:px-4 lg:px-4 mt-4 mb-6">
      {/* Curved Container Card */}
      <div className="w-full bg-white rounded-[20px] md:rounded-[24px] p-4 md:p-6 shadow-[0_4px_16px_rgba(35,107,52,0.06)] border border-[var(--brand-border,#E9E2D3)] flex flex-col gap-5">
        
        {/* Header Row */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2.5">
            {/* Tag Icon Badge */}
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[var(--brand-green-deep,#14401F)] text-white flex items-center justify-center shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="md:w-4.5 md:h-4.5">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <circle cx="7" cy="7" r="1.5" fill="currentColor" />
              </svg>
            </div>
            
            {/* Header Text */}
            <div className="flex flex-col text-left">
              <h2 
                className="text-base md:text-xl font-display font-bold tracking-tight text-[var(--brand-green-deep,#14401F)]"
              >
                New Arrivals
              </h2>
              <span className="text-[10px] md:text-xs text-[var(--brand-ink-muted,#5B6B60)] font-medium tracking-wide">
                Fresh products just added
              </span>
            </div>
          </div>

          {/* See All Button */}
          <Link
            to="/new-arrivals"
            className="bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] text-white font-bold text-[10px] md:text-xs px-3.5 md:px-5 py-1.5 md:py-2 rounded-full shadow-sm active:scale-95 transition-all"
          >
            See All
          </Link>
        </div>

        <div
          ref={scrollContainerRef}
          className="grid grid-flow-col grid-rows-2 md:flex gap-2.5 md:gap-3.5 overflow-x-auto scrollbar-hide py-0.5 px-0.5"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => navigate(`/product/${product.id}`)}
              className="flex-shrink-0 w-[90px] h-[90px] md:w-28 md:h-28 rounded-xl md:rounded-2xl bg-[var(--brand-cream-soft,#F6EFE2)]/40 flex items-center justify-center overflow-hidden border border-[var(--brand-border,#E9E2D3)] shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
              style={{ scrollSnapAlign: "start" }}
              title={product.name}
            >
              <img
                src={product.imageUrl}
                alt={product.name || "New Arrival"}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
