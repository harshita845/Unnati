import { useLayoutEffect, useRef, useState, useEffect, useMemo } from "react";
import { gsap } from "gsap";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { getTheme } from "../../../utils/themes";
import { getCachedHomeContent, getHomeContent } from "../../../services/api/customerHomeService";
import { useLocation } from "../../../hooks/useLocation";
import { calculateProductPrice } from "../../../utils/priceUtils";

import { useThemeContext } from "../../../context/ThemeContext";

interface PromoCard {
  id: string;
  badge: string;
  title: string;
  imageUrl?: string;
  categoryId?: string;
  slug?: string;
  bgColor?: string;
  /** Pictures of real products in this category (from stores that deliver to the customer) */
  productImages?: string[];
}

// Icon mappings for each category
const getCategoryIcons = (categoryId: string) => {
  const id = (categoryId || "").toLowerCase();
  if (id.includes("wedding") || id.includes("bridal")) return ["👰", "💍", "👑", "✨"];
  if (id.includes("cricket") || id.includes("bat") || id.includes("ball")) return ["🏏", "⚾", "🏆", "🧢"];
  if (id.includes("thermal") || id.includes("wool") || id.includes("winter")) return ["🧥", "🧣", "🧤", "🧶"];
  if (id.includes("clean") || id.includes("detergent") || id.includes("wash")) return ["🧼", "🧽", "🧴", "🫧"];
  if (id.includes("cloth") || id.includes("men") || id.includes("women") || id.includes("fashion")) return ["👕", "👗", "👖", "👔"];
  if (id.includes("jewel") || id.includes("gold") || id.includes("silver")) return ["💍", "💎", "📿", "👑"];
  if (id.includes("audio") || id.includes("earbud") || id.includes("electronic")) return ["🎧", "📱", "💻", "⌚"];
  if (id.includes("skin") || id.includes("care") || id.includes("beauty")) return ["🧴", "✨", "💄", "💆"];
  if (id.includes("rice") || id.includes("grain") || id.includes("atta")) return ["🌾", "🍚", "🫘", "🫒"];
  if (id.includes("snack") || id.includes("sweet")) return ["🍿", "🍪", "🍫", "🍬"];

  const iconMap: Record<string, string[]> = {
    "personal-care": ["🧴", "💧", "🧼", "💄"],
    "breakfast-instant": ["🍜", "☕", "🥛", "🍞"],
    "atta-rice": ["🌾", "🍚", "🫘", "🫒"],
    household: ["🧹", "🧽", "🧼", "🧴"],
    "home-office": ["🏠", "💼", "📦", "🎁"],
    fashion: ["👕", "👗", "👠", "👜"],
    electronics: ["📱", "💻", "⌚", "🎧"],
    "fruits-veg": ["🥬", "🥕", "🍅", "🥒"],
    "dairy-breakfast": ["🥛", "🧀", "🍞", "🥚"],
    snacks: ["🍿", "🍪", "🥨", "🍫"],
    sports: ["⚽", "🏏", "🏋️", "🎾"],
  };
  return iconMap[id] || ["🛍️", "🏷️", "✨", "🎁"];
};

/**
 * Converts alphanumeric characters to Unicode Mathematical Bold Serif (e.g. "HOUSEFULL SALE" -> "𝐇𝐎𝐔𝐒𝐄𝐅𝐔𝐋𝐋 𝐒𝐀𝐋𝐄")
 */
function toMathBold(text: string): string {
  if (!text) return "";
  return text
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      // Uppercase A-Z: 0x41 - 0x5A -> 0x1D400 - 0x1D419
      if (code >= 0x41 && code <= 0x5A) {
        return String.fromCodePoint(0x1d400 + (code - 0x41));
      }
      // Lowercase a-z: 0x61 - 0x7A -> 0x1D41A - 0x1D433
      if (code >= 0x61 && code <= 0x7A) {
        return String.fromCodePoint(0x1d41a + (code - 0x61));
      }
      // Digits 0-9: 0x30 - 0x39 -> 0x1D7CE - 0x1D7D7
      if (code >= 0x30 && code <= 0x39) {
        return String.fromCodePoint(0x1d7ce + (code - 0x30));
      }
      return char;
    })
    .join("");
}

interface PromoStripProps {
  activeTab?: string;
}

const VISIBLE_PROMO_CARD_LIMIT = 4;

export default function PromoStrip({ activeTab = "all" }: PromoStripProps) {
  const { location } = useLocation();
  const { currentTheme: theme } = useThemeContext();
  const navigate = useNavigate();
  const cachedHomeResponse = getCachedHomeContent(
    activeTab,
    location?.latitude,
    location?.longitude
  );
  const [categoryCards, setCategoryCards] = useState<PromoCard[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [headingText, setHeadingText] = useState(theme.bannerText);
  const [saleTextValue, setSaleTextValue] = useState(theme.saleText);
  const [dateRange, setDateRange] = useState("");
  const [saleEnds, setSaleEnds] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [crazyDealsTitle, setCrazyDealsTitle] = useState("CRAZY DEALS");
  const containerRef = useRef<HTMLDivElement>(null);
  const snowflakesRef = useRef<HTMLDivElement>(null);
  const housefullRef = useRef<HTMLDivElement>(null);
  const saleRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  // Rotation pauses while the customer is touching / hovering the deal
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  const visibleCategoryCards = useMemo(
    () => categoryCards.slice(0, VISIBLE_PROMO_CARD_LIMIT),
    [categoryCards]
  );

  useEffect(() => {
    const fetchData = async (forceRefresh: boolean = false) => {
      if (!cachedHomeResponse && !forceRefresh) {
        setLoading(true);
      }

      try {
        // Pass activeTab (header category slug) and location to filter categories
        const response = await getHomeContent(
          activeTab,
          location?.latitude,
          location?.longitude,
          !forceRefresh,
          forceRefresh ? 0 : 5 * 60 * 1000,
          false,
          undefined,
          forceRefresh
        );

        // Reset current product index when fetching new data
        setCurrentProductIndex(0);

        let fetchedCards: PromoCard[] = [];
        let fetchedProducts: any[] = [];
        let newHeadingText = theme.bannerText;
        let newSaleTextValue = theme.saleText;
        let newDateRange = "";

        if (response.success && response.data?.promoStrip && response.data.promoStrip.isActive) {
          const promoStrip = response.data.promoStrip;

          // Double check dates on client side - if expired or not yet started, strictly hide!
          const now = new Date();
          const start = promoStrip.startDate ? new Date(promoStrip.startDate) : null;
          const end = promoStrip.endDate ? new Date(promoStrip.endDate) : null;
          if (end && now > end) {
            // Expired - strictly hide the promo strip
            setHasData(false);
            setCategoryCards([]);
            setFeaturedProducts([]);
            setLoading(false);
            return;
          }
          if (start && now < start) {
            // Not yet started - strictly hide
            setHasData(false);
            setCategoryCards([]);
            setFeaturedProducts([]);
            setLoading(false);
            return;
          }

          newHeadingText = promoStrip.heading || "";
          newSaleTextValue = promoStrip.saleText || "";
          if (promoStrip.crazyDealsTitle) {
            setCrazyDealsTitle(promoStrip.crazyDealsTitle);
          } else {
            setCrazyDealsTitle("CRAZY DEALS");
          }

          setSaleEnds(end ? end.getTime() : null);
          // Format date range
          if (start && end) {
            newDateRange = `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()} - ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}`;
          }

          // Map category cards ONLY if explicitly configured in this PromoStrip
          if (promoStrip.categoryCards && promoStrip.categoryCards.length > 0) {
            fetchedCards = promoStrip.categoryCards
              .filter((card: any) => card.categoryId)
              .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
              .map((card: any) => {
                const category = typeof card.categoryId === 'object' ? card.categoryId : null;
                return {
                  id: card._id || card.categoryId?._id || card.categoryId,
                  badge: card.badge || (card.discountPercentage ? `Up to ${card.discountPercentage}% OFFER` : "OFFER"),
                  title: card.title || category?.name || "",
                  categoryId: category?._id || card.categoryId,
                  slug: category?.slug || card.categoryId,
                  imageUrl: category?.image,
                  productImages: Array.isArray(card.productImages) ? (card.productImages as Array<{ image?: string }>).map((x) => x?.image).filter((u): u is string => Boolean(u)) : [],
                  bgColor: "bg-yellow-50",
                };
              });
          }

          // Map featured products from PromoStrip
          if (promoStrip.featuredProducts && promoStrip.featuredProducts.length > 0) {
            fetchedProducts = promoStrip.featuredProducts.map((p: any) => {
              const product = typeof p === 'object' ? p : null;
              const price = Number(product?.price) || 0;
              const mrp = Number(product?.mrp) || Number(product?.compareAtPrice) || 0;
              const originalPrice = mrp > 0 ? mrp : 0;
              const discountedPrice = price > 0 ? price : 0;

              // Try multiple image field names and fallbacks
              const imageUrl =
                product?.mainImage ||
                product?.mainImageUrl ||
                product?.image ||
                product?.imageUrl ||
                (product?.galleryImageUrls && product.galleryImageUrls.length > 0 ? product.galleryImageUrls[0] : null) ||
                (product?.galleryImages && product.galleryImages.length > 0 ? product.galleryImages[0] : null) ||
                null;

              // Always prioritize productName to avoid showing category names
              const productName = (typeof product?.productName === 'string' ? product.productName : null) ||
                                 (typeof product?.name === 'string' ? product.name : null) || "Product";

              return {
                // The real product (variations, discPrice…) so its actual price is shown
                ...(product || {}),
                id: product?._id || p,
                _id: product?._id || p,
                name: productName,
                productName: productName,
                price: price,
                mrp: mrp,
                originalPrice: isNaN(originalPrice) ? 0 : originalPrice,
                discountedPrice: isNaN(discountedPrice) ? 0 : discountedPrice,
                imageUrl: imageUrl,
              };
            });
          }
        }

        // Must have at least 1 featured product AND category cards to be considered an active, working promo strip
        const isStripActive = Boolean(
          response.data?.promoStrip &&
          response.data.promoStrip.isActive &&
          fetchedProducts.length >= 1 &&
          fetchedCards.length >= 1
        );

        setCategoryCards(isStripActive ? fetchedCards : []);
        setFeaturedProducts(isStripActive ? fetchedProducts : []);
        setHeadingText(newHeadingText);
        setSaleTextValue(newSaleTextValue);
        setDateRange(newDateRange);
        if (!isStripActive) {
          setCrazyDealsTitle("CRAZY DEALS");
        }
        setHasData(isStripActive);
      } catch (error) {
        console.error("Error fetching home content for PromoStrip:", error);
        setCategoryCards([]);
        setFeaturedProducts([]);
        setHasData(false);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    const handlePromoSpecific = () => fetchData(true);
    const handlePromoUpdate = (e?: any) => {
      if (!e || !e.detail || e.detail.type === 'promo' || e.detail.type === 'home' || e.detail.type === 'all') {
        fetchData(true);
      }
    };

    window.addEventListener('unnati_promo_updated', handlePromoSpecific);
    window.addEventListener('unnati_content_updated', handlePromoUpdate);

    return () => {
      window.removeEventListener('unnati_promo_updated', handlePromoSpecific);
      window.removeEventListener('unnati_content_updated', handlePromoUpdate);
    };
  }, [activeTab, location?.latitude, location?.longitude]);

  // Countdown chip: refresh every minute
  useEffect(() => {
    if (!saleEnds) return;
    const t = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, [saleEnds]);
  const endsIn = (() => {
    if (!saleEnds) return "";
    const ms = saleEnds - nowTick;
    if (ms <= 0) return "";
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  })();

  // Reset product index when activeTab changes or featuredProducts change
  useEffect(() => {
    setCurrentProductIndex(0);
  }, [activeTab, featuredProducts.length]);

  useLayoutEffect(() => {
    if (!hasData) return;
    const container = containerRef.current;
    if (!container) return;

    let ctx: gsap.Context | null = null;

    // Defer card animation to prioritize content rendering
    const timeoutId = setTimeout(() => {
      ctx = gsap.context(() => {
      const cards = container.querySelectorAll(".promo-card");
      if (cards.length > 0) {
        gsap.fromTo(
          cards,
            { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
              duration: 0.4, // Reduced duration
              stagger: 0.05, // Reduced stagger
              ease: "power2.out", // Simpler easing
          }
        );
      }
    }, container);
    }, 100); // Start animation 100ms after render

    return () => {
      clearTimeout(timeoutId);
      if (ctx) {
        ctx.revert();
      }
    };
  }, [hasData]);

  // Snowflake animation - DEFERRED for faster initial load
  useLayoutEffect(() => {
    if (!hasData) return;
    const snowflakesContainer = snowflakesRef.current;
    if (!snowflakesContainer) return;

    // Defer animation start to prioritize content rendering
    const timeoutId = setTimeout(() => {
    const snowflakes = snowflakesContainer.querySelectorAll(".snowflake");

    snowflakes.forEach((snowflake, index) => {
      const delay = index * 0.3;
      const duration = 3 + Math.random() * 2; // 3-5 seconds
      const xOffset = (Math.random() - 0.5) * 40; // Random horizontal drift

      gsap.set(snowflake, {
        y: -20,
        x: xOffset,
        opacity: 0.8 + Math.random() * 0.2, // 0.8-1.0 opacity for better visibility
        scale: 0.6 + Math.random() * 0.4, // 0.6-1.0 scale for better visibility
      });

      gsap.to(snowflake, {
        y: "+=200",
        x: `+=${xOffset}`,
        duration: duration,
        delay: delay,
        ease: "none",
        repeat: -1,
      });
    });
    }, 200); // Start animation 200ms after render

    return () => {
      clearTimeout(timeoutId);
      const snowflakes = snowflakesContainer.querySelectorAll(".snowflake");
      snowflakes.forEach((snowflake) => {
        gsap.killTweensOf(snowflake);
      });
    };
  }, [hasData]);

  // HOUSEFULL SALE animation - SIMPLIFIED and DEFERRED for faster load
  useLayoutEffect(() => {
    if (!hasData) return;
    const housefullContainer = housefullRef.current;
    if (!housefullContainer) return;

    // Defer animation start to prioritize content rendering
    const timeoutId = setTimeout(() => {
      gsap.fromTo(
        housefullContainer,
        { opacity: 0, y: -6 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
      );
    }, 150);

    return () => {
      clearTimeout(timeoutId);
      gsap.killTweensOf(housefullContainer);
    };
  }, [hasData]);

  // Product rotation animation
  useEffect(() => {
    if (featuredProducts.length <= 1 || paused) return;
    const interval = setInterval(() => {
      setCurrentProductIndex((prev) => (prev + 1) % featuredProducts.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [featuredProducts.length, paused]);

  // Reset product index when featuredProducts change
  useEffect(() => {
    if (featuredProducts.length > 0 && currentProductIndex >= featuredProducts.length) {
      setCurrentProductIndex(0);
    }
  }, [featuredProducts.length, currentProductIndex]);

  const currentProduct = featuredProducts.length > 0 ? featuredProducts[currentProductIndex] : null;

  // Strictly hide from user app if loading, or if broken/expired (missing products or category cards)
  if (loading || !hasData || !currentProduct || featuredProducts.length === 0 || categoryCards.length === 0) {
    return null;
  }

  const displayProduct = currentProduct;

  // Calculate prices from actual product data using utility
  const { displayPrice, mrp } = calculateProductPrice(displayProduct);

  // Fallback prices if product data is incomplete
  const finalDiscountedPrice = displayPrice > 0 ? displayPrice : Number(displayProduct.discountedPrice) || 0;
  const finalOriginalPrice = mrp > 0 ? mrp : Number(displayProduct.originalPrice) || 0;
  const safeDiscountedPrice = Math.round(finalDiscountedPrice);
  // MRP is only shown struck-through when it is really higher than the selling price
  const safeOriginalPrice = finalOriginalPrice > finalDiscountedPrice ? Math.round(finalOriginalPrice) : 0;

  // Helper function to handle product navigation
  const handleProductClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Get product ID - handle both string and ObjectId formats
    const productId = displayProduct?.id || displayProduct?._id;

    if (productId && productId !== 'fallback') {
      // Convert to string if it's an object
      const idString = typeof productId === 'string' ? productId : String(productId);
      if (idString && idString !== 'fallback' && idString.length > 0) {
        navigate(`/product/${idString}`);
      }
    }
  };

  return (
    <div
      className="relative animate-fade-in mt-7 mb-5 sm:mt-9 sm:mb-7 md:mt-11 md:mb-9"
      style={{
        backgroundColor: "transparent",
      }}>
      {/* Top Promotional Header Banner: Spacious, Premium with Medium Green Gradient & Math Bold Font */}
      {(headingText || saleTextValue) && (
        <div ref={housefullRef} className="px-3 sm:px-4 md:px-6 mb-5 sm:mb-6">
          <div
            className="rounded-2xl overflow-hidden shadow-md border border-white/25 px-4 py-3.5 sm:px-5 sm:py-4.5 relative flex flex-col gap-2 transition-all duration-300 hover:shadow-xl group"
            style={{
              background: "linear-gradient(135deg, #1E7036 0%, #236B34 50%, #2D8C47 100%)",
            }}>
            {/* Subtle animated light sweep across banner */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

            {/* Row 1: Sale Heading (Math Bold) + Countdown Timer */}
            <div className="flex items-center justify-between gap-2.5 w-full">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-300 text-emerald-950 font-bold text-xs shadow-xs flex-shrink-0">
                  ⚡
                </span>
                <span className="font-serif font-black tracking-wide text-base sm:text-lg text-white drop-shadow-xs">
                  {toMathBold(headingText)}
                </span>
              </div>
              {endsIn && (
                <span className="inline-flex items-center gap-1.5 flex-shrink-0 rounded-full bg-black/35 backdrop-blur-md border border-white/20 text-amber-300 px-2.5 py-1 text-[9.5px] sm:text-[10.5px] font-black shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  ⏱ Ends in {endsIn}
                </span>
              )}
            </div>

            {/* Row 2: Subtitle & Date Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full pt-1.5 border-t border-white/20">
              <span className="text-emerald-50/95 font-medium text-xs sm:text-sm leading-relaxed drop-shadow-2xs">
                {saleTextValue}
              </span>
              {dateRange && (
                <span
                  ref={dateRef}
                  className="inline-flex items-center self-start sm:self-auto text-[10px] sm:text-xs text-white font-bold bg-white/20 backdrop-blur-md px-3 py-0.5 rounded-full border border-white/30 shadow-2xs whitespace-nowrap">
                  📅 {dateRange}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content: Crazy Deals + Category Cards (Mobile App Style Interactive Grid) */}
      <div className="px-2.5 sm:px-4 md:px-6">
        <div ref={containerRef} className="flex flex-row gap-2.5 sm:gap-3 items-stretch">
          {/* Crazy Deals Section - Left: Interactive App Deal Spotlight */}
          <div className="flex-shrink-0 w-[108px] sm:w-[122px] md:w-[140px] promo-card transition-all duration-300">
            <div
              className="h-full rounded-2xl p-2.5 flex flex-col items-center justify-between relative overflow-hidden border-2 border-orange-300/80 shadow-md transition-all duration-300 hover:shadow-xl hover:border-orange-400 group"
              style={{
                background: "linear-gradient(165deg, #FFFDF8 0%, #FFF5E6 45%, #FFE9CC 100%)",
                minHeight: "135px",
              }}>
              {/* Interactive light sheen */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

              {/* Header Title with Modern App Offer Styling */}
              <div className="w-full flex flex-col items-center justify-center text-center pb-1 flex-shrink-0">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-white shadow-xs">
                  <span className="text-[11px] animate-bounce" style={{ animationDuration: "1s" }}>🔥</span>
                  <span className="font-sans font-black italic tracking-wider uppercase text-[10px] sm:text-[11px] drop-shadow-xs leading-none">
                    {crazyDealsTitle}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping ml-0.5" />
                </div>
              </div>

              {/* The deal on show: hero product showcase filling the card */}
              <div
                className="flex w-full flex-1 flex-col items-center justify-center my-0.5"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                onTouchStart={() => setPaused(true)}
                onTouchEnd={() => setPaused(false)}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.button
                    type="button"
                    key={String(displayProduct.id || currentProductIndex)}
                    onClick={handleProductClick}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.94 }}
                    className="flex w-full flex-col items-center group/btn cursor-pointer py-0.5"
                    aria-label={`Open ${displayProduct.productName || displayProduct.name}`}>
                    
                    {/* Prices Badge with modern discount tag */}
                    {safeDiscountedPrice > 0 && (
                      <div className="flex items-center justify-center gap-1 mb-1 flex-wrap">
                        {safeOriginalPrice > 0 && (
                          <span className="text-neutral-400 text-[9.5px] line-through font-price">
                            ₹{safeOriginalPrice}
                          </span>
                        )}
                        <span className="bg-gradient-to-r from-emerald-600 to-green-600 text-white text-[10.5px] sm:text-[11px] font-black px-2 py-0.5 rounded-full shadow-2xs font-price group-hover/btn:scale-105 transition-transform">
                          ₹{safeDiscountedPrice}
                        </span>
                      </div>
                    )}

                    {/* Product Name in Clean Modern Sans */}
                    <div
                      className="text-neutral-900 font-sans font-bold text-[10.5px] sm:text-[11.5px] text-center mb-1 line-clamp-2 w-full px-0.5 leading-tight group-hover/btn:text-orange-600 transition-colors"
                      title={displayProduct.productName || displayProduct.name}>
                      {displayProduct.productName || displayProduct.name}
                    </div>

                    {/* Prominent Hero Product Image with Floating HOT badge */}
                    <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden border border-orange-200/90 shadow-2xs group-hover/btn:scale-105 group-hover/btn:shadow-sm transition-all duration-300">
                      <span className="absolute top-0.5 right-0.5 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[7.5px] font-black uppercase px-1 py-0.2 rounded shadow-2xs leading-none">
                        DEAL
                      </span>
                      {displayProduct.imageUrl ? (
                        <img
                          src={displayProduct.imageUrl}
                          alt={displayProduct.name}
                          className="w-full h-full object-contain transition-transform duration-500 group-hover/btn:scale-110"
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-xl" aria-hidden="true">🎁</span>
                      )}
                    </div>

                    {/* Interactive "Grab Deal →" Call-to-Action Pill */}
                    <div className="mt-1 flex items-center justify-center">
                      <span className="inline-flex items-center gap-0.5 text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider text-orange-700 bg-orange-100 hover:bg-orange-600 hover:text-white px-2 py-0.5 rounded-full border border-orange-300/80 transition-all duration-200 group-hover/btn:bg-gradient-to-r group-hover/btn:from-red-600 group-hover/btn:to-orange-500 group-hover/btn:text-white group-hover/btn:border-transparent group-hover/btn:scale-105 shadow-2xs">
                        Grab Deal →
                      </span>
                    </div>
                  </motion.button>
                </AnimatePresence>
              </div>

              {/* Interactive Pagination Dots */}
              {featuredProducts.length > 1 && (
                <div className="mt-auto pt-1 flex items-center justify-center gap-1 flex-shrink-0">
                  {featuredProducts.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Show deal ${i + 1}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentProductIndex(i);
                      }}
                      className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${
                        i === currentProductIndex
                          ? "w-3.5 bg-gradient-to-r from-red-500 to-orange-500 shadow-2xs"
                          : "w-1 bg-amber-300/80 hover:bg-amber-400"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Category Cards Grid - Right: Interactive 2x2 with Micro-Animations */}
          <div className="flex-1 grid grid-cols-2 gap-2 sm:gap-2.5">
            {visibleCategoryCards.map((card, cardIndex) => {
              const subcategoryImages = (card.productImages?.length ? card.productImages : card.imageUrl ? [card.imageUrl] : []).filter(Boolean);
              const hasSubcategoryImages = subcategoryImages.length > 0;
              const categoryIcons = getCategoryIcons(card.categoryId || card.slug || card.title || "");

              // Alternating green, yellow, and orange gradient badges
              const badgeGradients = [
                "from-emerald-600 via-green-600 to-teal-600",
                "from-amber-500 via-yellow-500 to-orange-500",
                "from-orange-500 via-rose-500 to-amber-600",
                "from-emerald-600 via-amber-500 to-orange-500",
              ];
              const badgeGradient = badgeGradients[cardIndex % badgeGradients.length];

              return (
                <div key={card.id} className="promo-card">
                  <Link
                    to={card.slug || card.categoryId ? `/category/${card.slug || card.categoryId}` : "#"}
                    className="group rounded-2xl transition-all duration-300 hover:shadow-lg hover:border-emerald-500/70 hover:-translate-y-1 active:scale-[0.97] h-full flex flex-col justify-between overflow-hidden relative border border-emerald-200/90 p-2 sm:p-2.5 shadow-xs"
                    style={{
                      minHeight: "122px",
                      background: "linear-gradient(150deg, #F0FDF4 0%, #ECFDF5 50%, #D1FAE5 100%)",
                    }}>
                    {/* App-style light shimmer gleam on hover */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

                    {/* Top Row: Full-Text Gradient Pill Badge + Gliding Arrow */}
                    <div className="flex items-center justify-between gap-1 w-full mb-1">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[8.5px] sm:text-[9.5px] font-black tracking-tight uppercase bg-gradient-to-r ${badgeGradient} text-white shadow-2xs whitespace-nowrap group-hover:scale-105 transition-transform duration-200`}>
                        {card.badge}
                      </span>
                      <span className="text-emerald-600 text-[11px] font-bold opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0">
                        →
                      </span>
                    </div>

                    {/* Category Title */}
                    <div className="flex-1 flex flex-col justify-center my-0.5 min-w-0">
                      <h4
                        className="text-emerald-950 font-display font-bold text-[11px] sm:text-xs tracking-tight group-hover:text-emerald-700 transition-colors leading-tight line-clamp-2">
                        {card.title}
                      </h4>
                    </div>

                    {/* Subcategory Images with Playful Fanning Hover Animation */}
                    <div className="flex items-center justify-center gap-1.5 pt-1 mt-auto">
                      {hasSubcategoryImages
                        ? subcategoryImages.slice(0, 2).map((imageUrl, idx) => (
                            <div
                              key={idx}
                              className={`w-9 h-9 sm:w-11 sm:h-11 bg-white/95 rounded-lg p-0.5 flex items-center justify-center overflow-hidden border border-emerald-300/70 shadow-2xs transition-all duration-300 group-hover:shadow-xs ${
                                idx === 0
                                  ? "group-hover:scale-110 group-hover:-rotate-3 group-hover:-translate-y-0.5"
                                  : "group-hover:scale-110 group-hover:rotate-3 group-hover:-translate-y-0.5"
                              }`}>
                              <img
                                src={imageUrl}
                                alt={`Item ${idx + 1}`}
                                className="w-full h-full object-cover rounded-md transition-transform duration-500 group-hover:scale-115"
                                loading="lazy"
                                decoding="async"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = categoryIcons[idx] || "📦";
                                    parent.style.fontSize = "16px";
                                    parent.style.display = "flex";
                                    parent.style.alignItems = "center";
                                    parent.style.justifyContent = "center";
                                  }
                                }}
                              />
                            </div>
                          ))
                        : categoryIcons.slice(0, 2).map((icon, idx) => (
                            <div
                              key={idx}
                              className={`w-9 h-9 sm:w-11 sm:h-11 bg-white/95 rounded-lg flex items-center justify-center border border-emerald-300/70 shadow-2xs transition-all duration-300 text-base ${
                                idx === 0
                                  ? "group-hover:scale-110 group-hover:-rotate-3"
                                  : "group-hover:scale-110 group-hover:rotate-3"
                              }`}>
                              {icon}
                            </div>
                          ))}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
