import { useLayoutEffect, useRef, useState, useEffect, useMemo } from "react";
import { gsap } from "gsap";
import { Link, useNavigate } from "react-router-dom";
import { getTheme } from "../../../utils/themes";
import { getCachedHomeContent, getHomeContent } from "../../../services/api/customerHomeService";
import { getSubcategories } from "../../../services/api/categoryService";
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
  subcategoryImages?: string[]; // Array of subcategory image URLs
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

const getDummyCategoryImages = (title: string, categoryId?: string): string[] => {
  const t = (title || "").toLowerCase();
  const cid = (categoryId || "").toLowerCase();

  if (t.includes("wedding") || t.includes("bridal") || cid.includes("wedding") || cid.includes("bridal")) {
    return [
      "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=200&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=200&auto=format&fit=crop&q=80",
    ];
  }
  if (t.includes("cricket") || t.includes("sport") || t.includes("bat") || cid.includes("cricket") || cid.includes("sport")) {
    return [
      "https://images.unsplash.com/photo-1531415074868-036b107e775a?w=200&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&auto=format&fit=crop&q=80",
    ];
  }
  if (t.includes("wool") || t.includes("thermal") || t.includes("winter") || cid.includes("wool") || cid.includes("thermal")) {
    return [
      "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=200&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=200&auto=format&fit=crop&q=80",
    ];
  }
  if (t.includes("clean") || t.includes("detergent") || cid.includes("clean") || cid.includes("detergent")) {
    return [
      "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=200&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80",
    ];
  }
  if (t.includes("home") || t.includes("decor") || cid.includes("home")) {
    return [
      "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=200&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=200&auto=format&fit=crop&q=80",
    ];
  }
  if (t.includes("net") || t.includes("mosquito") || t.includes("machhar")) {
    return [
      "https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=200&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=200&auto=format&fit=crop&q=80",
    ];
  }
  if (t.includes("water") || t.includes("bottle") || t.includes("can")) {
    return [
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=200&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1556817411-31ae72fa3ea0?w=200&auto=format&fit=crop&q=80",
    ];
  }
  if (t.includes("towel") || t.includes("bath") || t.includes("cloth")) {
    return [
      "https://images.unsplash.com/photo-1616627547584-bf28cee262db?w=200&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=200&auto=format&fit=crop&q=80",
    ];
  }
  return [];
};


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
  const [crazyDealsTitle, setCrazyDealsTitle] = useState("CRAZY DEALS");
  const [subcategoryImagesMap, setSubcategoryImagesMap] = useState<Record<string, string[]>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const snowflakesRef = useRef<HTMLDivElement>(null);
  const housefullRef = useRef<HTMLDivElement>(null);
  const saleRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const priceContainerRef = useRef<HTMLDivElement>(null);
  const productNameRef = useRef<HTMLDivElement>(null);
  const productImageRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  const visibleCategoryCards = useMemo(
    () => categoryCards.slice(0, VISIBLE_PROMO_CARD_LIMIT),
    [categoryCards]
  );

  const subcategoryFetchKey = useMemo(
    () =>
      visibleCategoryCards
        .map((card) => `${card.id}:${card.categoryId ?? ""}`)
        .join("|"),
    [visibleCategoryCards]
  );

  // Fetch subcategory images only for visible promo cards, with cancellation on re-run/unmount
  useEffect(() => {
    if (!subcategoryFetchKey) {
      setSubcategoryImagesMap({});
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      const imagesMap: Record<string, string[]> = {};
      const batchSize = 2;

      for (let i = 0; i < visibleCategoryCards.length; i += batchSize) {
        if (cancelled) return;

        const batch = visibleCategoryCards.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (card) => {
            const categoryId = card.categoryId;
            if (!categoryId || cancelled) return;

            try {
              const response = await getSubcategories(categoryId, { limit: 4 });
              if (cancelled) return;

              if (response.success && response.data) {
                const images = response.data
                  .filter((subcat) => subcat.subcategoryImage)
                  .map((subcat) => subcat.subcategoryImage!)
                  .slice(0, 4);

                if (images.length > 0) {
                  imagesMap[card.id] = images;
                }
              }
            } catch (error) {
              if (!cancelled) {
                console.error(
                  `Error fetching subcategories for category ${categoryId}:`,
                  error
                );
              }
            }
          })
        );

        if (i + batchSize < visibleCategoryCards.length && !cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      if (!cancelled) {
        setSubcategoryImagesMap(imagesMap);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [subcategoryFetchKey, visibleCategoryCards]);

  useEffect(() => {
    const fetchData = async () => {
      if (!cachedHomeResponse) {
        setLoading(true);
      }

      try {
        // Pass activeTab (header category slug) and location to filter categories
        // Use cache with 5 minute TTL for faster loading
        const response = await getHomeContent(
          activeTab,
          location?.latitude,
          location?.longitude,
          true,
          5 * 60 * 1000
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
              const originalPrice = mrp > 0 ? mrp : (price > 0 ? Math.round(price * 1.2) : 999);
              const discountedPrice = price > 0 ? price : 499;

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
                id: product?._id || p,
                _id: product?._id || p,
                name: productName,
                productName: productName,
                price: price,
                mrp: mrp,
                originalPrice: isNaN(originalPrice) ? 999 : originalPrice,
                discountedPrice: isNaN(discountedPrice) ? 499 : discountedPrice,
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

  }, [activeTab]);

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
    if (featuredProducts.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentProductIndex((prev) => (prev + 1) % featuredProducts.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [featuredProducts.length]);

  // Reset product index when featuredProducts change
  useEffect(() => {
    if (featuredProducts.length > 0 && currentProductIndex >= featuredProducts.length) {
      setCurrentProductIndex(0);
    }
  }, [featuredProducts.length, currentProductIndex]);

  // Animate product change
  useEffect(() => {
    const elements = [
      priceContainerRef.current,
      productNameRef.current,
      productImageRef.current,
    ];
    if (elements.some((el) => !el)) return;

    const tween = gsap.to(elements, {
      opacity: 0,
      x: -30,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => {
        const currentElements = [
          priceContainerRef.current,
          productNameRef.current,
          productImageRef.current,
        ];
        if (currentElements.some((el) => !el)) return;

        gsap.set(currentElements, {
          x: 30,
          opacity: 0,
        });

        gsap.to(currentElements, {
          opacity: 1,
          x: 0,
          duration: 0.4,
          ease: "power2.out",
        });
      },
    });

    return () => {
      tween.kill();
    };
  }, [currentProductIndex]);

  const currentProduct = featuredProducts.length > 0 ? featuredProducts[currentProductIndex] : null;

  // Strictly hide from user app if loading, or if broken/expired (missing products or category cards)
  if (loading || !hasData || !currentProduct || featuredProducts.length === 0 || categoryCards.length === 0) {
    return null;
  }

  const displayProduct = currentProduct;

  // Calculate prices from actual product data using utility
  const { displayPrice, mrp } = calculateProductPrice(displayProduct);

  // Fallback prices if product data is incomplete
  const finalDiscountedPrice = displayPrice > 0 ? displayPrice : (Number.isFinite(displayProduct.discountedPrice) ? displayProduct.discountedPrice : 499);
  const finalOriginalPrice = mrp > 0 ? mrp : (Number.isFinite(displayProduct.originalPrice) ? displayProduct.originalPrice : 999);

  // Ensure prices are valid numbers
  const safeOriginalPrice = Number.isFinite(finalOriginalPrice) ? Math.round(finalOriginalPrice) : 999;
  const safeDiscountedPrice = Number.isFinite(finalDiscountedPrice) ? Math.round(finalDiscountedPrice) : 499;

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
      className="relative animate-fade-in"
      style={{
        backgroundColor: "transparent",
        paddingTop: "0px",
        paddingBottom: "0px",
        marginTop: "8px",
      }}>
      {/* Top Promotional Header Banner */}
      {(headingText || saleTextValue) && (
        <div ref={housefullRef} className="px-4 mb-2">
          <div
            className="rounded-2xl overflow-hidden shadow-sm border border-[var(--brand-border,#E9E2D3)] px-3.5 py-2.5 text-white relative flex flex-col gap-1"
            style={{
              background: "linear-gradient(135deg, #14401F 0%, #1B5128 50%, #236B34 100%)",
            }}>
            {/* Row 1: Sale Heading + Date Badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-amber-300 animate-pulse text-xs flex-shrink-0">⚡</span>
                <span className="font-extrabold uppercase tracking-wider text-xs sm:text-sm font-display text-white whitespace-nowrap">
                  {headingText}
                </span>
              </div>
              {dateRange && (
                <span
                  ref={dateRef}
                  className="text-[9px] sm:text-[10px] text-amber-100 font-semibold bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15 whitespace-nowrap flex-shrink-0">
                  {dateRange}
                </span>
              )}
            </div>
            {/* Row 2: Sale Text / Subtitle */}
            {saleTextValue && (
              <div
                ref={saleRef}
                className="text-amber-200/90 text-[11px] sm:text-xs font-medium leading-tight pl-4">
                {saleTextValue}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content: Crazy Deals + Category Cards */}
      <div className="px-4 mt-2">
        <div ref={containerRef} className="flex gap-2">
          {/* Crazy Deals Section - Left */}
          <div className="flex-shrink-0 w-[100px] promo-card transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
            <div
              className="h-full rounded-2xl p-1.5 flex flex-col items-center justify-between relative overflow-hidden border border-[var(--brand-border,#E9E2D3)] shadow-md"
              style={{
                background: "linear-gradient(135deg, #14401F 0%, #1B5128 50%, #236B34 100%)",
                minHeight: "122px",
              }}>
              {/* CRAZY DEALS - Two lines, bigger, premium gold text */}
              <div className="text-center mb-1" style={{ marginTop: "4px" }}>
                <div
                  className="font-extrabold leading-tight tracking-wider uppercase bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-100 bg-clip-text text-transparent font-display"
                  style={{
                    fontSize: "14px",
                    fontFamily: "var(--font-display, 'Fraunces', serif)",
                    textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  }}>
                  {crazyDealsTitle.split(" ").map((word, idx) => (
                    <div key={idx}>{word}</div>
                  ))}
                </div>
              </div>

              {/* Price Banners - Compact */}
              <div
                ref={priceContainerRef}
                className="flex flex-col items-center mb-1 relative">
                {/* Original Price - Darker Banner */}
                <div
                  className="bg-black/40 rounded-sm px-1.5 inline-block relative z-10 border border-white/10"
                  style={{
                    height: "fit-content",
                    lineHeight: "1",
                    paddingTop: "2px",
                    paddingBottom: "2px",
                  }}>
                  <span className="text-white/60 text-[9px] font-medium line-through leading-none font-price">
                    ₹{safeOriginalPrice}
                  </span>
                </div>
                {/* Discounted Price - Signature Gradient Banner */}
                <div
                  className="bg-gradient-to-r from-[var(--brand-amber,#FFB020)] via-[var(--brand-orange,#F97316)] to-[var(--brand-orange-deep,#E8590C)] rounded-full px-2 inline-block relative -mt-0.5 z-20 shadow-sm"
                  style={{
                    height: "fit-content",
                    lineHeight: "1",
                    paddingTop: "2.5px",
                    paddingBottom: "2.5px",
                  }}>
                  <span className="text-white text-[11px] font-extrabold leading-none tracking-wide font-price">
                    ₹{safeDiscountedPrice}
                  </span>
                </div>
              </div>

              {/* Product Name - Compact - Clickable - White/Gray for dark background */}
              <div
                ref={productNameRef}
                onClick={handleProductClick}
                className="text-white/90 font-medium text-[10px] text-center mb-1 cursor-pointer hover:text-white hover:underline line-clamp-1 w-full px-0.5 transition-colors"
                title={displayProduct.productName || displayProduct.name}>
                {displayProduct.productName || displayProduct.name}
              </div>

              {/* Product Thumbnail - Bottom Center, sized to container */}
              <div
                ref={productImageRef}
                className="flex-1 flex items-end justify-center w-full"
                style={{ minHeight: "55px", maxHeight: "75px" }}>
                <div
                  onClick={handleProductClick}
                  className="w-16 h-18 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border border-white/10"
                  style={{ background: "transparent" }}>
                  {displayProduct.imageUrl ? (
                    <img
                      src={displayProduct.imageUrl}
                      alt={displayProduct.name}
                      className="w-full h-full object-contain filter drop-shadow-sm transition-transform duration-300 hover:scale-105"
                      loading="lazy"
                      decoding="async"
                      style={{
                        mixBlendMode: "normal",
                        backgroundColor: "transparent",
                      }}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        // Hide broken image and show fallback
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.product-fallback')) {
                          const fallback = document.createElement('div');
                          fallback.className = 'product-fallback w-full h-full bg-gradient-to-b from-yellow-100 to-yellow-50 flex items-center justify-center rounded';
                          const icon = document.createElement('div');
                          icon.className = 'w-7 h-9 bg-yellow-200 rounded-sm relative';
                          icon.innerHTML = `
                            <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-2.5 h-2.5 bg-blue-400 rounded-full"></div>
                            <div class="absolute bottom-0 left-0 right-0 h-1.5 bg-white/80"></div>
                          `;
                          fallback.appendChild(icon);
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-b from-yellow-100 to-yellow-50 flex items-center justify-center rounded">
                      <div className="w-7 h-9 bg-yellow-200 rounded-sm relative">
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-2.5 h-2.5 bg-blue-400 rounded-full"></div>
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/80"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Category Cards Grid - Right */}
          {/* Cap visible category cards at 4 so the strip stays compact even when
              the PromoStrip admin config has more than 4 entries. */}
          <div className="flex-1 grid grid-cols-2 gap-2">
            {visibleCategoryCards.map((card) => {
              // Use subcategory images from the map if available (filtering out placeholder text)
              const rawSubImages = (subcategoryImagesMap[card.id] || card.subcategoryImages || []).filter(
                (img) => img && !img.includes("placehold.co")
              );
              const subcategoryImages = rawSubImages.length > 0
                ? rawSubImages
                : getDummyCategoryImages(card.title, card.categoryId || card.slug).filter(
                    (img) => img && !img.includes("placehold.co")
                  );
              const hasSubcategoryImages = subcategoryImages.length > 0;
              const categoryIcons = getCategoryIcons(card.categoryId || card.slug || card.title || "");

              return (
                <div key={card.id} className="promo-card">
                  <Link
                    to={card.slug || card.categoryId ? `/category/${card.slug || card.categoryId}` : "#"}
                    className="group rounded-2xl transition-all duration-300 hover:shadow-md hover:border-[var(--brand-green,#236B34)] hover:-translate-y-0.5 active:scale-[0.98] h-full flex flex-col overflow-hidden relative border border-[var(--brand-border,#E9E2D3)] bg-white"
                    style={{
                      minHeight: "122px",
                      background: "linear-gradient(135deg, #ffffff 0%, var(--brand-leaf-tint,#EAF5E0) 100%)",
                    }}>
                    {/* Gradient Discount Banner - Premium styled pill centered at top */}
                    <div
                      className="w-full flex justify-center"
                      style={{ paddingTop: "0", paddingBottom: "2px" }}>
                      <div className="bg-gradient-to-r from-[var(--brand-green-dark,#1B5128)] to-[var(--brand-green,#236B34)] text-white text-[11px] font-extrabold px-3 py-0.5 rounded-b-lg tracking-wider text-center inline-block uppercase shadow-sm font-sans">
                        {card.badge}
                      </div>
                    </div>

                    <div
                      className="px-1.5 pb-1.5 flex flex-col flex-1 justify-between"
                      style={{ paddingTop: "2px" }}>
                      {/* Category Title - with hover color transition */}
                      <div
                        className="text-[var(--brand-ink,#1C2B20)] font-display font-bold text-center tracking-tight group-hover:text-[var(--brand-green,#236B34)] transition-colors"
                        style={{
                          fontSize: "13px",
                          lineHeight: "1.2",
                          marginBottom: "4px",
                        }}>
                        {card.title}
                      </div>

                      {/* Subcategory Images or Emoji Icons - Sized properly for mobile card */}
                      <div
                        className="flex items-center justify-center gap-1.5 overflow-hidden py-1"
                        style={{ marginTop: "auto" }}>
                        {hasSubcategoryImages
                          ? // Display up to 2 subcategory images so they fit without overflowing
                            subcategoryImages.slice(0, 2).map((imageUrl, idx) => (
                                <div
                                  key={idx}
                                  className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-[var(--brand-border-light,#F2ECE0)] shadow-xs transition-all duration-300 group-hover:scale-[1.05]">
                                  <img
                                    src={imageUrl}
                                    alt={`Subcategory ${idx + 1}`}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    loading="lazy"
                                    decoding="async"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = "none";
                                      const parent = target.parentElement;
                                      if (parent) {
                                        parent.innerHTML = categoryIcons[idx] || "📦";
                                        parent.style.fontSize = "20px";
                                        parent.style.display = "flex";
                                        parent.style.alignItems = "center";
                                        parent.style.justifyContent = "center";
                                      }
                                    }}
                                  />
                                </div>
                              ))
                          : // Fallback to icons in sleek badges
                            categoryIcons.slice(0, 2).map((icon, idx) => (
                              <div
                                key={idx}
                                className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center border border-[var(--brand-border-light,#F2ECE0)] shadow-xs transition-all duration-300 group-hover:scale-105"
                                style={{
                                  fontSize: "20px",
                                }}>
                                {icon}
                              </div>
                            ))}
                      </div>
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
