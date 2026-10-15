import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getHeaderCategoriesPublic, HeaderCategory } from "../../services/api/headerCategoryService";
import { useThemeContext } from "../../context/ThemeContext";
import { getCategoryTabIcon } from "./components/HomeHero";

interface CategoryMeta {
  gradient: string;
  pastelBg: string;
  description: string;
}

const HEADER_CATEGORY_META: Record<string, CategoryMeta> = {
  grocery: {
    gradient: "from-emerald-500/10 via-emerald-50 to-emerald-100/40",
    pastelBg: "#F2FCE4",
    description: "Daily fresh essentials, staples, dairy & kitchen supplies",
  },
  fashion: {
    gradient: "from-purple-500/10 via-purple-50 to-purple-100/40",
    pastelBg: "#FFF3EB",
    description: "Trending clothing, apparel, footwear & lifestyle",
  },
  electronics: {
    gradient: "from-blue-500/10 via-blue-50 to-blue-100/40",
    pastelBg: "#F5F5FF",
    description: "Smart gadgets, appliances, audio, mobile & accessories",
  },
  beauty: {
    gradient: "from-pink-500/10 via-pink-50 to-pink-100/40",
    pastelBg: "#FDF2F8",
    description: "Skincare, haircare, personal care & fragrances",
  },
  household: {
    gradient: "from-amber-500/10 via-amber-50 to-amber-100/40",
    pastelBg: "#FFF8EB",
    description: "Home cleaning, dining, organizers & living utilities",
  },
  sports: {
    gradient: "from-orange-500/10 via-orange-50 to-orange-100/40",
    pastelBg: "#FFF7ED",
    description: "Fitness equipment, active wear & outdoor gear",
  },
  winter: {
    gradient: "from-sky-500/10 via-sky-50 to-sky-100/40",
    pastelBg: "#ECFFEC",
    description: "Warm wear, thermal care, heaters & cozy essentials",
  },
  wedding: {
    gradient: "from-rose-500/10 via-rose-50 to-rose-100/40",
    pastelBg: "#FEEFEA",
    description: "Bridal wear, ethnic celebration, gifts & festive decor",
  },
};

const DEFAULT_PASTELS = ["#F2FCE4", "#FFF3EB", "#ECFFEC", "#FEEFEA", "#FFF8EB", "#F5F5FF", "#F8F0FF", "#FFF0F5"];

export default function Categories() {
  const navigate = useNavigate();
  const { setActiveCategory } = useThemeContext();
  const [categories, setCategories] = useState<HeaderCategory[]>([]);
  const [sellerCategories, setSellerCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);

        const list = await getHeaderCategoriesPublic(true, true);
        if (!isMounted) return;

        // Filter out 'all' tab and ensure only Published categories are shown
        const filtered = (list || [])
          .filter((cat) => cat.slug !== "all" && cat.status === "Published")
          .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

        setCategories(filtered);

        // Check for local seller custom categories
        const sellerCatsStorage = localStorage.getItem("seller_own_categories");
        if (sellerCatsStorage) {
          try {
            const parsed = JSON.parse(sellerCatsStorage);
            if (Array.isArray(parsed)) {
              setSellerCategories(parsed.filter((c: any) => c && (c.status === undefined || c.status === "Active")));
            }
          } catch (e) {
            console.error("Error parsing seller categories", e);
          }
        }
      } catch (err: any) {
        console.error("Failed to load header categories:", err);
        if (isMounted) {
          setError("Failed to load categories. Please check your connection.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCategorySelect = (cat: HeaderCategory | string) => {
    const slugOrId = typeof cat === "string" ? cat : (cat.slug || cat._id);
    if (!slugOrId) return;
    setActiveCategory(slugOrId);
    navigate(`/category/${slugOrId}`);
  };

  const getCategoryMeta = (cat: HeaderCategory, idx: number) => {
    return HEADER_CATEGORY_META[cat.slug] || {
      gradient: "from-neutral-100 to-neutral-200/50",
      pastelBg: DEFAULT_PASTELS[idx % DEFAULT_PASTELS.length],
      description: "Explore top products and deals in this department",
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50/50 pb-20">
        {/* Header Skeleton */}
        <div className="bg-white border-b border-neutral-200 px-4 py-4 md:px-8 md:py-6 sticky top-0 z-20">
          <div className="h-7 w-36 bg-neutral-200 rounded animate-pulse mb-1"></div>
          <div className="h-4 w-48 bg-neutral-100 rounded animate-pulse"></div>
        </div>

        {/* Content Skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="flex flex-col items-center p-3 animate-pulse">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-neutral-200 mb-2"></div>
                <div className="h-3 w-14 bg-neutral-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center bg-white">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-neutral-900 mb-1">Unable to Load Categories</h3>
        <p className="text-neutral-500 text-sm mb-6 max-w-xs">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-[var(--customer-primary-dark)] text-white text-sm font-semibold rounded-full hover:bg-[var(--customer-primary-darker)] transition-colors shadow-sm"
        >
          Try Refreshing
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50/60 pb-24 overflow-x-hidden">
      {/* Top Header */}
      <div className="bg-white border-b border-neutral-200/80 px-4 py-4 md:px-8 md:py-6 sticky top-0 z-20 shadow-sm backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-neutral-900 tracking-tight">
              All Categories
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
              Explore by main shopping departments
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-xs font-semibold text-[var(--customer-primary-dark)] hover:underline flex items-center gap-1 shrink-0"
          >
            <span>Back to Home</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* MOBILE VIEW: Clean 4-column circular grid matching user's design */}
        <div className="block md:hidden">
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-neutral-100">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3 px-1">
              Main Departments
            </h2>
            <div className="grid grid-cols-4 gap-x-2 gap-y-4">
              {categories.map((cat, idx) => {
                const meta = getCategoryMeta(cat, idx);

                return (
                  <button
                    key={cat._id || cat.slug}
                    onClick={() => handleCategorySelect(cat)}
                    className="flex flex-col items-center text-center group focus:outline-none active:scale-95 transition-transform"
                  >
                    {/* Outer Circular Container with soft pastel tint */}
                    <div
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center p-3 sm:p-3.5 shadow-sm border border-neutral-100/80 group-hover:shadow-md group-hover:scale-105 transition-all duration-200 text-neutral-700 group-hover:text-[var(--customer-primary-dark)]"
                      style={{ backgroundColor: meta.pastelBg }}
                    >
                      <div className="w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center flex-shrink-0 [&>svg]:w-full [&>svg]:h-full [&>img]:w-full [&>img]:h-full [&>img]:object-contain transition-transform duration-200 group-hover:scale-110">
                        {getCategoryTabIcon(cat)}
                      </div>
                    </div>

                    {/* Category Label */}
                    <span className="text-[11px] sm:text-xs font-bold text-neutral-800 leading-tight mt-1.5 w-full line-clamp-2 px-0.5">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* DESKTOP VIEW: Rich, modern department cards with micro-animations */}
        <div className="hidden md:block">
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-5">
            {categories.map((cat, idx) => {
              const meta = getCategoryMeta(cat, idx);

              return (
                <div
                  key={cat._id || cat.slug}
                  onClick={() => handleCategorySelect(cat)}
                  className="group bg-white rounded-2xl p-5 shadow-sm border border-neutral-200/80 hover:border-[var(--customer-primary)] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden relative"
                >
                  {/* Subtle top background accent */}
                  <div
                    className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${meta.gradient}`}
                  />

                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      {/* Department Icon/Image Circle */}
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center p-2.5 border border-neutral-100 shadow-sm group-hover:scale-110 transition-transform duration-300 text-neutral-700 group-hover:text-[var(--customer-primary-dark)]"
                        style={{ backgroundColor: meta.pastelBg }}
                      >
                        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 [&>svg]:w-full [&>svg]:h-full [&>img]:w-full [&>img]:h-full [&>img]:object-contain">
                          {getCategoryTabIcon(cat)}
                        </div>
                      </div>

                      {/* Icon tag */}
                      <span className="text-neutral-400 group-hover:text-[var(--customer-primary-dark)] group-hover:translate-x-1 transition-all duration-300 pt-1">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-neutral-900 group-hover:text-[var(--customer-primary-dark)] transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                      {meta.description}
                    </p>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--customer-primary-dark)] group-hover:underline">
                      Shop Department &rarr;
                    </span>
                    {cat.subscriptionRequired && (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200">
                        Special
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Optional Seller Categories Section if available */}
        {sellerCategories.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-neutral-200/80">
            <h2 className="text-base sm:text-lg font-bold text-neutral-900 mb-4">
              Partner & Local Stores
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {sellerCategories.map((sc: any) => (
                <div
                  key={sc._id || sc.name}
                  onClick={() => {
                    if (sc.slug) navigate(`/category/${sc.slug}`);
                    else if (sc._id) navigate(`/category/${sc._id}`);
                  }}
                  className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 hover:border-neutral-300 transition-all cursor-pointer flex flex-col items-center text-center group"
                >
                  <div className="w-12 h-12 rounded-full bg-white shadow-xs flex items-center justify-center p-2 mb-2 overflow-hidden">
                    {sc.image ? (
                      <img src={sc.image} alt={sc.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-neutral-500 font-bold text-sm">
                        {sc.name?.charAt(0) || "S"}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-neutral-800 line-clamp-1 group-hover:text-[var(--customer-primary-dark)]">
                    {sc.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

