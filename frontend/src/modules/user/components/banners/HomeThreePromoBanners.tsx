import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { bannerService } from "../../../../services/bannerService";
import { getCategories } from "../../../../services/api/customerProductService";

const BG_COLORS = ["#EAF5E0", "#F6EFE2", "#EAF5E0"];

export default function HomeThreePromoBanners() {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadBanners = async (forceRefresh: boolean = false) => {
      try {
        // 1. Try to load banners configured for Main Section Banner
        const promoBanners = await bannerService.getBannersByPosition("Main Section Banner");
        if (isMounted && promoBanners && promoBanners.length > 0) {
          const mapped = promoBanners.slice(0, 3).map((b, idx) => {
            const catTarget = b.resourceId || b.categoryName || b.resourceName;
            let link = '/categories';
            if (b.resourceType === 'Category' && catTarget && catTarget !== 'No Category Selected') {
              link = `/category/${catTarget}`;
            } else if (b.redirectType === 'CATEGORY' && b.redirectValue) {
              link = `/category/${b.redirectValue}`;
            } else if (b.resourceType === 'Product' && b.resourceId) {
              link = `/product/${b.resourceId}`;
            } else if (b.redirectType === 'PRODUCT' && b.redirectValue) {
              link = `/product/${b.redirectValue}`;
            } else if (b.categoryName && b.categoryName !== 'No Category Selected') {
              link = `/category/${encodeURIComponent(b.categoryName)}`;
            }

            return {
              id: b.id,
              title: b.title || (b.categoryName && b.categoryName !== 'No Category Selected' ? b.categoryName : "Special Offer"),
              subtitle: b.subtitle || "Handpicked for you",
              priceText: "Shop",
              price: "Now",
              imageUrl: b.image || b.imageUrl,
              bgColor: BG_COLORS[idx % BG_COLORS.length],
              link,
            };
          });
          setBanners(mapped);
          return;
        }

        // 2. Fallback: dynamically load top categories from database
        const catRes = await getCategories(false, forceRefresh);
        if (isMounted && catRes.success && Array.isArray(catRes.data) && catRes.data.length >= 3) {
          const activeCats = catRes.data.filter((c: any) => c.status !== 'Inactive' && c.isActive !== false);
          if (activeCats.length >= 3) {
            const mapped = activeCats.slice(0, 3).map((c: any, idx: number) => ({
              id: c._id || c.id,
              title: c.name,
              subtitle: c.description || `Explore top ${c.name} items`,
              priceText: "Explore",
              price: "Deals",
              imageUrl: c.image || "/brand/unnati-logo.png",
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
    loadBanners(false);

    const handleUpdate = () => loadBanners(true);
    window.addEventListener("unnati_categories_updated", handleUpdate);
    window.addEventListener("focus", handleUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("unnati_categories_updated", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, []);

  if (banners.length === 0) {
    return null;
  }

  return (
    <div className="px-2 md:px-4 lg:px-4 py-2 mt-2 mb-4">
      <div className={`grid grid-cols-1 ${banners.length === 2 ? 'md:grid-cols-2' : banners.length >= 3 ? 'md:grid-cols-3' : ''} gap-4 lg:gap-6`}>
        {banners.map((banner) => (
          <motion.div
            key={banner.id}
            whileHover={{ y: -4, scale: 1.01 }}
            onClick={() => navigate(banner.link)}
            className="rounded-2xl p-6 relative overflow-hidden flex justify-between items-center shadow-sm hover:shadow-md transition-all duration-300 min-h-[145px] cursor-pointer border border-[var(--brand-border,#E9E2D3)]"
            style={{ backgroundColor: banner.bgColor }}
          >
            {/* Left Column Information */}
            <div className="flex flex-col items-start text-left max-w-[58%] z-10 font-sans">
              <h3 className="text-[var(--brand-green-deep,#14401F)] font-display font-extrabold text-sm md:text-lg leading-tight truncate w-full">
                {banner.title}
              </h3>
              <p className="text-[var(--brand-ink-muted,#5B6B60)] text-[11px] md:text-xs font-medium leading-normal mb-1 truncate w-full">
                {banner.subtitle}
              </p>

              <div className="flex flex-col items-start mb-3">
                <span className="text-[var(--brand-ink-muted,#5B6B60)] text-[9px] md:text-[10px] font-semibold leading-none">
                  {banner.priceText}
                </span>
                <span className="text-[var(--brand-orange,#F97316)] text-base md:text-lg font-display font-extrabold leading-none mt-0.5">
                  {banner.price}
                </span>
              </div>

              <span className="bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] text-white font-bold text-[9px] md:text-xs px-4 md:px-5 py-1.5 md:py-2 rounded-full transition-all shadow-sm active:scale-95">
                Shop Now
              </span>
            </div>

            {/* Right Column Product Graphic */}
            <div className="w-[38%] h-full relative flex items-center justify-end z-10">
              <div className="w-[85px] h-[85px] md:w-[105px] md:h-[105px] rounded-full overflow-hidden bg-white/60 flex items-center justify-center p-1 shadow-inner border border-white/40">
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
