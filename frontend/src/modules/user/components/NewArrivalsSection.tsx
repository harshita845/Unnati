import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getProducts } from "../../../services/api/customerProductService";
import { Product } from "../../../types/domain";
import { useLocation } from "../../../hooks/useLocation";

// A list of high-quality mock product images matching the user's heels, watches, sneakers mockup
const MOCK_NEW_ARRIVALS = [
  { id: "arrival-1", imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=150&auto=format&fit=crop&q=80" }, // Designer Heels
  { id: "arrival-2", imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=150&auto=format&fit=crop&q=80" }, // Minimalist Watch
  { id: "arrival-3", imageUrl: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=150&auto=format&fit=crop&q=80" }, // Leather Strap Watch
  { id: "arrival-4", imageUrl: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=150&auto=format&fit=crop&q=80" }, // Clean White Athletic Shoes
  { id: "arrival-5", imageUrl: "https://images.unsplash.com/photo-1597045566677-8cf032ed6634?w=150&auto=format&fit=crop&q=80" }, // Athletic Sport Sneakers
  { id: "arrival-6", imageUrl: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=150&auto=format&fit=crop&q=80" }, // Classic Retro Shoes
  { id: "arrival-7", imageUrl: "https://images.unsplash.com/photo-1539185441755-769473a23570?w=150&auto=format&fit=crop&q=80" }  // Premium Orange & White Running Shoes
];

export default function NewArrivalsSection() {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { location } = useLocation();
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchNewArrivals = async () => {
      try {
        const response = await getProducts({
          limit: 10,
          latitude: location?.latitude,
          longitude: location?.longitude,
          city: location?.city,
        });
        if (response.success && Array.isArray(response.data) && response.data.length > 0) {
          // Map real products to image array, filtering those that have mainImage/imageUrl
          const mapped = response.data
            .filter((p: any) => p.mainImage || p.imageUrl)
            .map((p: any) => ({
              id: p._id || p.id,
              imageUrl: p.mainImage || p.imageUrl
            }));
          
          if (mapped.length >= 3) {
            setProducts(mapped);
          } else {
            setProducts(MOCK_NEW_ARRIVALS);
          }
        } else {
          setProducts(MOCK_NEW_ARRIVALS);
        }
      } catch (error) {
        console.error("Error fetching new arrivals:", error);
        setProducts(MOCK_NEW_ARRIVALS);
      }
    };
    fetchNewArrivals();
  }, []);

  return (
    <div className="px-2 md:px-4 lg:px-4 mt-4 mb-6">
      {/* Curved Container Card */}
      <div className="w-full bg-white rounded-[20px] md:rounded-[24px] p-4 md:p-6 shadow-sm border border-neutral-100/60 flex flex-col gap-5">
        
        {/* Header Row */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2.5">
            {/* Tag Icon Badge */}
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#163F2E] text-white flex items-center justify-center shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="md:w-4.5 md:h-4.5">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <circle cx="7" cy="7" r="1.5" fill="currentColor" />
              </svg>
            </div>
            
            {/* Header Text */}
            <div className="flex flex-col text-left">
              <h2 
                className="text-base md:text-xl font-bold tracking-tight"
                style={{ fontFamily: "'Quicksand', 'Nunito', 'Inter', sans-serif", color: '#253D4E' }}
              >
                New Arrivals
              </h2>
              <span className="text-[10px] md:text-xs text-neutral-400 font-medium tracking-wide">
                Fresh products just added
              </span>
            </div>
          </div>

          {/* See All Button */}
          <Link
            to="/new-arrivals"
            className="bg-[#163F2E] hover:bg-[#1D543E] text-white font-extrabold text-[10px] md:text-xs px-3.5 md:px-5 py-1.5 md:py-2 rounded-full shadow-sm active:scale-95 transition-all"
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
              onClick={() => navigate(product.id.startsWith("arrival-") ? "/new-arrivals" : `/product/${product.id}`)}
              className="flex-shrink-0 w-[90px] h-[90px] md:w-28 md:h-28 rounded-xl md:rounded-2xl bg-neutral-50 flex items-center justify-center overflow-hidden border border-neutral-150/60 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
              style={{ scrollSnapAlign: "start" }}
            >
              <img
                src={product.imageUrl}
                alt="New Arrival"
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=150&auto=format&fit=crop&q=80"; // Fallback to watch image
                }}
              />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
