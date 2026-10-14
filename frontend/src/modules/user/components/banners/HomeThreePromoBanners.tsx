import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { bannerService } from "../../../../services/bannerService";
import { getCategories } from "../../../../services/api/customerProductService";

const BG_COLORS = ["#E4F0EB", "#FAF0D4", "#E4F2EE"];

export default function HomeThreePromoBanners() {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadBanners = async () => {
      try {
        // 1. Try to load banners configured for Main Section Banner
        const promoBanners = await bannerService.getBannersByPosition("Main Section Banner");
        if (isMounted && promoBanners && promoBanners.length >= 3) {
          const mapped = promoBanners.slice(0, 3).map((b, idx) => ({
            id: b.id,
            title: b.title || b.categoryName || "Special Offer",
            subtitle: b.subtitle || "Handpicked for you",
            priceText: "Shop",
            price: "Now",
            imageUrl: b.image || b.imageUrl,
            bgColor: BG_COLORS[idx % BG_COLORS.length],
            link: b.redirectType === 'CATEGORY' && b.redirectValue 
              ? `/category/${b.redirectValue}` 
              : b.redirectType === 'PRODUCT' && b.redirectValue 
              ? `/product/${b.redirectValue}` 
              : '/categories',
          }));
          setBanners(mapped);
          return;
        }

        // 2. Fallback: dynamically load top categories from database
        const catRes = await getCategories(false);
        if (isMounted && catRes.success && Array.isArray(catRes.data) && catRes.data.length >= 3) {
          const activeCats = catRes.data.filter((c: any) => c.status !== 'Inactive' && c.isActive !== false);
          if (activeCats.length >= 3) {
            const mapped = activeCats.slice(0, 3).map((c: any, idx: number) => ({
              id: c._id || c.id,
              title: c.name,
              subtitle: c.description || `Explore top ${c.name} items`,
              priceText: "Explore",
              price: "Deals",
              imageUrl: c.image || "/assets/unnati_logo.png",
              bgColor: BG_COLORS[idx % BG_COLORS.length],
              link: `/category/${c.slug || c._id || c.id}`,
            }));
            setBanners(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to load promo banners:", err);
      }
    };
    loadBanners();
    return () => {
      isMounted = false;
    };
  }, []);

  if (banners.length === 0) {
    return null;
  }

  return (
    <div className="px-2 md:px-4 lg:px-4 py-2 mt-2 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {banners.map((banner) => (
          <motion.div
            key={banner.id}
            whileHover={{ y: -4, scale: 1.01 }}
            onClick={() => navigate(banner.link)}
            className="rounded-[20px] p-6 relative overflow-hidden flex justify-between items-center shadow-sm hover:shadow-md transition-all duration-300 min-h-[145px] cursor-pointer"
            style={{ backgroundColor: banner.bgColor }}
          >
            {/* Left Column Information */}
            <div className="flex flex-col items-start text-left max-w-[58%] z-10 font-sans" style={{ fontFamily: "'Quicksand', 'Nunito', 'Inter', sans-serif" }}>
              <h3 className="text-[#253D4E] font-black text-sm md:text-lg leading-tight truncate w-full">
                {banner.title}
              </h3>
              <p className="text-[#253D4E] text-[11px] md:text-xs font-bold leading-normal mb-1 opacity-90 truncate w-full">
                {banner.subtitle}
              </p>

              <div className="flex flex-col items-start mb-3">
                <span className="text-[#253D4E] text-[9px] md:text-[10px] font-semibold leading-none opacity-75">
                  {banner.priceText}
                </span>
                <span className="text-[#253D4E] text-base md:text-lg font-black leading-none mt-0.5">
                  {banner.price}
                </span>
              </div>

              <span className="bg-white hover:bg-[#163F2E] hover:text-white text-[#253D4E] font-black text-[9px] md:text-xs px-4 md:px-5 py-1.5 md:py-2 rounded-full transition-all shadow-sm active:scale-95">
                Shop Now
              </span>
            </div>

            {/* Right Column Product Graphic */}
            <div className="w-[38%] h-full relative flex items-center justify-end z-10">
              <div className="w-[85px] h-[85px] md:w-[105px] md:h-[105px] rounded-full overflow-hidden bg-white/40 flex items-center justify-center p-1 shadow-inner">
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="w-full h-full object-cover rounded-full transition-transform duration-300 hover:scale-105"
                  loading="lazy"
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
