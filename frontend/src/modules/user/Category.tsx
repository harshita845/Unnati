import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useState, useMemo, useEffect, useRef } from "react";
import ProductCard from "./components/ProductCard";
import { motion, AnimatePresence } from "framer-motion";
import {
  getProducts,
  getCategoryById,
  Category as ApiCategory,
} from "../../services/api/customerProductService";
import { useLocation as useLocationContext } from "../../hooks/useLocation";
import { calculateCardPrice } from "../../utils/priceUtils";

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { location: userLocation } = useLocationContext();
  const location = useLocation();

  const [category, setCategory] = useState<ApiCategory | null>(null);
  const [subcategories, setSubcategories] = useState<ApiCategory[]>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState("all");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>("default");

  // Dynamic filter state
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedPrices, setSelectedPrices] = useState<string[]>([]);
  const [selectedDiscounts, setSelectedDiscounts] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [filterSearchQuery, setFilterSearchQuery] = useState("");
  const [selectedFilterCategory, setSelectedFilterCategory] = useState("Type");

  const [products, setProducts] = useState<any[]>([]);

  const sortOptions = [
    { id: "default", label: "Relevance" },
    { id: "price-asc", label: "Price: Low to High" },
    { id: "price-desc", label: "Price: High to Low" },
    { id: "name-asc", label: "Name: A to Z" },
    { id: "name-desc", label: "Name: Z to A" },
    { id: "discount-desc", label: "Discount: High to Low" },
  ];

  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 1000;
  const productsContainerRef = useRef<HTMLDivElement>(null);

  // Fetch Category Details
  useEffect(() => {
    const fetchCategoryDetails = async (forceRefresh: boolean = false) => {
      setCategoryLoading(true);
      setError(null);
      try {
        const response = await getCategoryById(id!, forceRefresh);
        if (response.success && response.data) {
          const {
            category: cat,
            subcategories: subs,
            currentSubcategory,
          } = response.data;

          setCategory(cat);
          setSubcategories([
            {
              _id: "all",
              id: "all",
              name: "All",
              icon: "📦",
              isActive: true,
            } as any,
            ...(subs || []),
          ]);

          // Check URL query params first, then API response
          const subcategoryFromUrl = searchParams.get("subcategory");
          if (subcategoryFromUrl) {
            setSelectedSubcategory(subcategoryFromUrl);
          } else if (currentSubcategory) {
            const subId = String(currentSubcategory._id || currentSubcategory.id || "");
            if (subId) setSelectedSubcategory(subId);
          } else {
            setSelectedSubcategory("all");
          }
        } else {
          setError("Category not found or failed to load details.");
        }
      } catch (error) {
        console.error("Error fetching category details:", error);
        setError("Failed to load category information.");
      } finally {
        setCategoryLoading(false);
      }
    };

    if (id) {
      fetchCategoryDetails(false);
      setCurrentPage(1); // Reset to page 1 when category changes
    }

    const handleCategoriesUpdated = (e?: any) => {
      if (!e || !e.detail || e.detail.type === 'categories' || e.detail.type === 'all') {
        if (id) fetchCategoryDetails(true);
      }
    };
    window.addEventListener("unnati_categories_updated", handleCategoriesUpdated);
    window.addEventListener("unnati_content_updated", handleCategoriesUpdated);
    window.addEventListener("focus", handleCategoriesUpdated);

    return () => {
      window.removeEventListener("unnati_categories_updated", handleCategoriesUpdated);
      window.removeEventListener("unnati_content_updated", handleCategoriesUpdated);
      window.removeEventListener("focus", handleCategoriesUpdated);
    };
  }, [id]);

  // Sync selected subcategory if URL search params change
  useEffect(() => {
    const subcategoryFromUrl = searchParams.get("subcategory");
    if (subcategoryFromUrl && subcategoryFromUrl !== selectedSubcategory) {
      setSelectedSubcategory(subcategoryFromUrl);
    } else if (!subcategoryFromUrl && selectedSubcategory !== "all") {
      setSelectedSubcategory("all");
    }
  }, [searchParams]);

  // Fetch Products when category or subcategory changes
  useEffect(() => {
    const fetchProducts = async (forceRefresh: boolean = false) => {
      setLoading(true);
      setError(null);
      try {
        const params: any = { 
          category: category?._id || id,
          page: currentPage,
          limit: limit
        };
        if (selectedSubcategory !== "all") {
          params.subcategory = selectedSubcategory;
        }
        // Include user location for seller service filtering
        if (userLocation?.latitude && userLocation?.longitude) {
          params.latitude = userLocation.latitude;
          params.longitude = userLocation.longitude;
        }
        if (userLocation?.city) {
          params.city = userLocation.city;
        }

        const response = await getProducts(params, forceRefresh);
        if (response.success) {
          const safeProducts = response.data.map((p: any) => {
            const name = p.name || p.productName || "";
            return {
              ...p,
              tags: Array.isArray(p.tags) ? p.tags : [],
              nameParts: name ? name.toLowerCase().split(" ") : [],
            };
          });
          setProducts(safeProducts);
          if (response.pagination) {
            setTotalPages(response.pagination.pages);
          }
        } else {
          setError("Failed to fetch products for this category.");
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        setError("Network error while loading products.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProducts(false);
    }

    const handleProductsUpdated = (e?: any) => {
      if (!e || !e.detail || e.detail.type === 'products' || e.detail.type === 'all') {
        if (id) fetchProducts(true);
      }
    };

    window.addEventListener("productUpdated", handleProductsUpdated);
    window.addEventListener("unnati_content_updated", handleProductsUpdated);

    return () => {
      window.removeEventListener("productUpdated", handleProductsUpdated);
      window.removeEventListener("unnati_content_updated", handleProductsUpdated);
    };
  }, [id, selectedSubcategory, category?._id, userLocation, currentPage]);

  // Scroll to last product on back or when coming from "View All"
  const lastProductScrolledRef = useRef(false);
  useEffect(() => {
    if (loading || products.length === 0 || lastProductScrolledRef.current) return;

    const state = window.history.state?.usr;
    const scrollToProductId = location.state?.scrollToProduct || 
                             (state?.scrollRestore?.source === 'product-card' ? 
                              state?.scrollRestore?.productId : null);

    if (scrollToProductId) {
      const timer = setTimeout(() => {
        const productElement = document.getElementById(`product-${scrollToProductId}`);
        if (productElement) {
          productElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          productElement.classList.add('ring-2', 'ring-[var(--customer-primary)]', 'ring-offset-2', 'transition-all');
          setTimeout(() => {
            productElement.classList.remove('ring-2', 'ring-[var(--customer-primary)]', 'ring-offset-2');
          }, 2000);

          lastProductScrolledRef.current = true;
          
          if (location.state?.scrollToProduct) {
            navigate(location.pathname + location.search, { 
              replace: true, 
              state: { ...location.state, scrollToProduct: undefined } 
            });
          }
        } else if (state?.scrollRestore) {
          const mainElement = document.querySelector('main');
          if (state.scrollRestore.preferredTarget === 'main' && mainElement) {
             mainElement.scrollTop = state.scrollRestore.mainTop;
          } else {
             window.scrollTo(0, state.scrollRestore.windowTop);
          }
          lastProductScrolledRef.current = true;
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, products.length, location.state, navigate, location.pathname, location.search]);

  // Dynamic filter options generated from the current category's products
  const filterData = useMemo(() => {
    const typeMap = new Map<string, number>();
    const brandMap = new Map<string, number>();
    let under500 = 0;
    let p500to1000 = 0;
    let p1000to2500 = 0;
    let p2500to5000 = 0;
    let above5000 = 0;
    let d50 = 0;
    let d30 = 0;
    let d20 = 0;
    let d10 = 0;
    let inStockCount = 0;

    products.forEach((p) => {
      const priceInfo = calculateCardPrice(p);
      const price = priceInfo.displayPrice;
      if (price < 500) under500++;
      else if (price <= 1000) p500to1000++;
      else if (price <= 2500) p1000to2500++;
      else if (price <= 5000) p2500to5000++;
      else above5000++;

      if (priceInfo.discount >= 50) d50++;
      if (priceInfo.discount >= 30) d30++;
      if (priceInfo.discount >= 20) d20++;
      if (priceInfo.discount >= 10) d10++;

      if (p.listing?.inStock || (p.stock && p.stock > 0)) inStockCount++;

      const bName =
        typeof p.brand === "object" && p.brand?.name
          ? p.brand.name
          : typeof p.brand === "string" && p.brand.trim()
          ? p.brand.trim()
          : null;
      if (bName) {
        brandMap.set(bName, (brandMap.get(bName) || 0) + 1);
      }

      if (Array.isArray(p.tags)) {
        p.tags.forEach((tag: string) => {
          if (tag && tag.trim()) {
            const formatted = tag.trim();
            typeMap.set(formatted, (typeMap.get(formatted) || 0) + 1);
          }
        });
      }

      const subName =
        typeof p.subcategory === "object" && p.subcategory?.name
          ? p.subcategory.name
          : null;
      if (subName) {
        typeMap.set(subName, (typeMap.get(subName) || 0) + 1);
      }
    });

    return {
      types: Array.from(typeMap.entries()).map(([name, count]) => ({
        id: name,
        name,
        count,
      })),
      brands: Array.from(brandMap.entries()).map(([name, count]) => ({
        id: name,
        name,
        count,
      })),
      prices: [
        { id: "under-500", name: "Under ₹500", count: under500 },
        { id: "500-1000", name: "₹500 - ₹1,000", count: p500to1000 },
        { id: "1000-2500", name: "₹1,000 - ₹2,500", count: p1000to2500 },
        { id: "2500-5000", name: "₹2,500 - ₹5,000", count: p2500to5000 },
        { id: "above-5000", name: "Above ₹5,000", count: above5000 },
      ].filter((p) => p.count > 0 || products.length === 0),
      discounts: [
        { id: "disc-50", name: "50% or more", count: d50 },
        { id: "disc-30", name: "30% or more", count: d30 },
        { id: "disc-20", name: "20% or more", count: d20 },
        { id: "disc-10", name: "10% or more", count: d10 },
      ].filter((d) => d.count > 0 || products.length === 0),
      availability: [
        { id: "in-stock", name: "In Stock Only", count: inStockCount },
      ],
    };
  }, [products]);

  const availableFilterCategories = useMemo(() => {
    const cats: { id: string; label: string; count: number }[] = [];
    if (filterData.types.length > 0) {
      cats.push({
        id: "Type",
        label: "Category & Type",
        count: filterData.types.length,
      });
    }
    if (filterData.brands.length > 0) {
      cats.push({ id: "Brand", label: "Brand", count: filterData.brands.length });
    }
    cats.push({ id: "Price", label: "Price Range", count: filterData.prices.length });
    cats.push({
      id: "Discount",
      label: "Discount",
      count: filterData.discounts.length,
    });
    cats.push({ id: "Availability", label: "Availability", count: 1 });
    return cats;
  }, [filterData]);

  // Ensure selectedFilterCategory is valid
  useEffect(() => {
    if (
      availableFilterCategories.length > 0 &&
      !availableFilterCategories.some((c) => c.id === selectedFilterCategory)
    ) {
      setSelectedFilterCategory(availableFilterCategories[0].id);
    }
  }, [availableFilterCategories, selectedFilterCategory]);

  const currentCategoryOptions = useMemo(() => {
    let options: { id: string; name: string; count: number }[] = [];
    if (selectedFilterCategory === "Type") options = filterData.types;
    else if (selectedFilterCategory === "Brand") options = filterData.brands;
    else if (selectedFilterCategory === "Price") options = filterData.prices;
    else if (selectedFilterCategory === "Discount") options = filterData.discounts;
    else if (selectedFilterCategory === "Availability")
      options = filterData.availability;

    if (!filterSearchQuery.trim()) return options;
    return options.filter((opt) =>
      opt.name.toLowerCase().includes(filterSearchQuery.toLowerCase())
    );
  }, [selectedFilterCategory, filterData, filterSearchQuery]);

  const totalActiveFilters = useMemo(() => {
    return (
      selectedTypes.length +
      selectedBrands.length +
      selectedPrices.length +
      selectedDiscounts.length +
      (inStockOnly ? 1 : 0)
    );
  }, [selectedTypes, selectedBrands, selectedPrices, selectedDiscounts, inStockOnly]);

  const handleToggleOption = (categoryKey: string, id: string) => {
    if (categoryKey === "Type") {
      setSelectedTypes((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else if (categoryKey === "Brand") {
      setSelectedBrands((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else if (categoryKey === "Price") {
      setSelectedPrices((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else if (categoryKey === "Discount") {
      setSelectedDiscounts((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else if (categoryKey === "Availability") {
      setInStockOnly((prev) => !prev);
    }
  };

  const isOptionChecked = (categoryKey: string, id: string): boolean => {
    if (categoryKey === "Type") return selectedTypes.includes(id);
    if (categoryKey === "Brand") return selectedBrands.includes(id);
    if (categoryKey === "Price") return selectedPrices.includes(id);
    if (categoryKey === "Discount") return selectedDiscounts.includes(id);
    if (categoryKey === "Availability") return inStockOnly;
    return false;
  };

  const hasCategorySelectedFilters = (categoryKey: string): boolean => {
    if (categoryKey === "Type") return selectedTypes.length > 0;
    if (categoryKey === "Brand") return selectedBrands.length > 0;
    if (categoryKey === "Price") return selectedPrices.length > 0;
    if (categoryKey === "Discount") return selectedDiscounts.length > 0;
    if (categoryKey === "Availability") return inStockOnly;
    return false;
  };

  const handleClearAllFilters = () => {
    setSelectedTypes([]);
    setSelectedBrands([]);
    setSelectedPrices([]);
    setSelectedDiscounts([]);
    setInStockOnly(false);
    setFilterSearchQuery("");
  };

  const formatSubcatName = (name: string) => {
    if (!name) return "";
    const match = name.match(/subcategory\s*\d+/i);
    if (match && name.length > 18) {
      return match[0];
    }
    return name;
  };

  // Filter products by all active filter dimensions
  const categoryProducts = useMemo(() => {
    let result = [...products];

    // Filter by Types / Tags / Name / Subcategory
    if (selectedTypes.length > 0) {
      result = result.filter((product) => {
        const name = (product.name || product.productName || "").toLowerCase();
        const pTags = Array.isArray(product.tags)
          ? product.tags.map((t: string) => t.toLowerCase())
          : [];
        const subName = (
          typeof product.subcategory === "object" && product.subcategory?.name
            ? product.subcategory.name
            : ""
        ).toLowerCase();
        return selectedTypes.some((t) => {
          const lowerT = t.toLowerCase();
          return name.includes(lowerT) || pTags.includes(lowerT) || subName === lowerT;
        });
      });
    }

    // Filter by Brands
    if (selectedBrands.length > 0) {
      result = result.filter((product) => {
        const bName =
          typeof product.brand === "object" && product.brand?.name
            ? product.brand.name
            : typeof product.brand === "string"
            ? product.brand
            : "";
        return selectedBrands.some((b) => b.toLowerCase() === bName.toLowerCase());
      });
    }

    // Filter by Price Ranges
    if (selectedPrices.length > 0) {
      result = result.filter((product) => {
        const price = calculateCardPrice(product).displayPrice;
        return selectedPrices.some((priceId) => {
          if (priceId === "under-500") return price < 500;
          if (priceId === "500-1000") return price >= 500 && price <= 1000;
          if (priceId === "1000-2500") return price >= 1000 && price <= 2500;
          if (priceId === "2500-5000") return price >= 2500 && price <= 5000;
          if (priceId === "above-5000") return price > 5000;
          return true;
        });
      });
    }

    // Filter by Discounts
    if (selectedDiscounts.length > 0) {
      result = result.filter((product) => {
        const discount = calculateCardPrice(product).discount;
        return selectedDiscounts.some((discId) => {
          if (discId === "disc-50") return discount >= 50;
          if (discId === "disc-30") return discount >= 30;
          if (discId === "disc-20") return discount >= 20;
          if (discId === "disc-10") return discount >= 10;
          return true;
        });
      });
    }

    // Filter by inStockOnly
    if (inStockOnly) {
      result = result.filter(
        (product) => product.listing?.inStock || (product.stock && product.stock > 0)
      );
    }

    // Sort products
    if (sortBy === "price-asc") {
      result.sort(
        (a, b) =>
          calculateCardPrice(a).displayPrice - calculateCardPrice(b).displayPrice
      );
    } else if (sortBy === "price-desc") {
      result.sort(
        (a, b) =>
          calculateCardPrice(b).displayPrice - calculateCardPrice(a).displayPrice
      );
    } else if (sortBy === "name-asc") {
      result.sort((a, b) =>
        (a.name || a.productName || "").localeCompare(b.name || b.productName || "")
      );
    } else if (sortBy === "name-desc") {
      result.sort((a, b) =>
        (b.name || b.productName || "").localeCompare(a.name || a.productName || "")
      );
    } else if (sortBy === "discount-desc") {
      result.sort(
        (a, b) => calculateCardPrice(b).discount - calculateCardPrice(a).discount
      );
    }

    return result;
  }, [
    products,
    selectedTypes,
    selectedBrands,
    selectedPrices,
    selectedDiscounts,
    inStockOnly,
    sortBy,
  ]);

  if ((categoryLoading || loading) && !products.length && !category) {
    return null; // Let global IconLoader handle it
  }

  if (error && !products.length && !category) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center bg-white">
        <div className="w-20 h-20 bg-[var(--customer-primary-alpha-10)] rounded-full flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-[var(--customer-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Oops! Something went wrong</h3>
        <p className="text-gray-600 mb-6 max-w-xs">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-[var(--customer-primary-dark)] text-white rounded-full font-medium hover:bg-[var(--customer-primary-darker)] transition-colors"
        >
          Try Refreshing
        </button>
      </div>
    );
  }

  if (!category && !categoryLoading) {
    return (
      <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-4">
          Category not found
        </h1>
        <p className="text-neutral-600 md:text-lg">
          The category you're looking for doesn't exist.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white h-screen overflow-hidden font-sans">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-[var(--brand-border,#E9E2D3)] flex-shrink-0 shadow-xs">
        <div className="px-4 md:px-6 lg:px-8 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-1 -ml-1 text-neutral-600 hover:text-neutral-900 rounded-full hover:bg-neutral-100 transition-colors"
                aria-label="Go back">
                <svg
                  className="w-5 h-5 md:w-6 md:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <h1 className="text-base md:text-xl font-display font-bold text-[var(--brand-green-deep,#14401F)]">
                {category?.name}
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-20 bg-white border-r border-[var(--brand-border,#E9E2D3)] overflow-y-auto scrollbar-hide flex-shrink-0 py-2">
          <div className="space-y-1">
            {subcategories.map((subcat) => {
              const isSelected =
                selectedSubcategory === String(subcat.id || subcat._id);
              return (
                <button
                  key={subcat.id || subcat._id}
                  type="button"
                  title={subcat.name}
                  onClick={() => {
                    const subId = String(subcat.id || subcat._id);
                    setSelectedSubcategory(subId);
                    const newParams = new URLSearchParams(searchParams);
                    if (subId === "all") {
                      newParams.delete("subcategory");
                    } else {
                      newParams.set("subcategory", subId);
                    }
                    navigate({ search: newParams.toString() }, { replace: true });
                  }}
                  className={`w-full flex flex-col items-center justify-center py-2 relative transition-all duration-200 group ${
                    isSelected ? "bg-[var(--brand-leaf-tint,#EAF5E0)]/70" : "hover:bg-[var(--brand-cream-soft,#F6EFE2)]/40"
                  }`}
                  style={{
                    minHeight: "72px",
                  }}>
                  {/* Active Indicator */}
                  {isSelected && (
                    <>
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-[var(--brand-green,#236B34)] rounded-r-full"></div>
                      <div className="absolute right-1.5 top-1.5 w-1.5 h-1.5 rounded-full bg-[var(--brand-orange,#F97316)] shadow-xs"></div>
                    </>
                  )}

                  {/* Image / Icon Container */}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg mb-1 flex-shrink-0 overflow-hidden transition-all duration-200 shadow-sm ${
                      isSelected
                        ? "ring-2 ring-[var(--brand-green,#236B34)] ring-offset-2 bg-white"
                        : "bg-neutral-50 border border-neutral-100 group-hover:shadow-md"
                    }`}>
                    {subcat.image && !subcat.image.includes("placehold.co") ? (
                      <img
                        key={subcat.image}
                        src={subcat.image}
                        alt={subcat.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          const parent = target.parentElement;
                          if (parent) {
                            parent.textContent =
                              subcat.icon || subcat.name?.charAt(0) || "📦";
                          }
                        }}
                      />
                    ) : (
                      <span className="text-xl">{subcat.icon || "📦"}</span>
                    )}
                  </div>

                  {/* Text Label */}
                  <span
                    className={`text-[10px] text-center leading-tight px-1 transition-colors ${
                      isSelected
                        ? "font-bold text-[var(--brand-green-deep,#14401F)]"
                        : "text-[var(--brand-ink-muted,#5B6B60)] group-hover:text-[var(--brand-ink,#1C2B20)]"
                    }`}
                    style={{
                      wordBreak: "break-word",
                      maxWidth: "100%",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    }}>
                    {formatSubcatName(subcat.name)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--brand-cream,#FDF9F2)]/40">
          {/* Filter/Sort Bar */}
          <div className="px-3 md:px-6 lg:px-8 py-2 bg-white border-b border-neutral-200 flex-shrink-0 relative z-20">
            <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto scrollbar-hide -mx-3 md:-mx-6 lg:-mx-8 px-3 md:px-6 lg:px-8 scroll-smooth">
              {/* Filters Button */}
              <button
                onClick={() => {
                  setIsFiltersOpen(!isFiltersOpen);
                  setIsSortOpen(false);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
                  isFiltersOpen || totalActiveFilters > 0
                    ? "bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green-deep,#14401F)] border border-[var(--brand-green,#236B34)] font-semibold shadow-xs"
                    : "bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50"
                }`}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="flex-shrink-0">
                  <circle cx="6" cy="8" r="1.5" fill="currentColor" />
                  <circle cx="6" cy="16" r="1.5" fill="currentColor" />
                  <path
                    d="M3 8h6M3 16h6M10 8h11M10 16h11"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Filters</span>
                {totalActiveFilters > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[var(--brand-green,#236B34)] text-white text-[10px] flex items-center justify-center font-bold">
                    {totalActiveFilters}
                  </span>
                )}
                <span className="text-neutral-500 text-[10px]">
                  {isFiltersOpen ? "▴" : "▾"}
                </span>
              </button>

              {/* Sort Button */}
              <button
                onClick={() => {
                  setIsSortOpen(!isSortOpen);
                  setIsFiltersOpen(false);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
                  isSortOpen || sortBy !== "default"
                    ? "bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green-deep,#14401F)] border border-[var(--brand-green,#236B34)] font-semibold shadow-xs"
                    : "bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50"
                }`}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="flex-shrink-0">
                  <path
                    d="M7 8l5-5 5 5M7 16l5 5 5-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>
                  {sortBy === "default"
                    ? "Sort"
                    : sortOptions.find((o) => o.id === sortBy)?.label || "Sort"}
                </span>
                <span className="text-neutral-500 text-[10px]">
                  {isSortOpen ? "▴" : "▾"}
                </span>
              </button>

              {/* Subcategory Pills */}
              {subcategories
                .filter((subcat) => (subcat.id || subcat._id) !== "all")
                .map((subcat) => {
                  const subId = subcat.id || subcat._id;
                  const isSelected = selectedSubcategory === subId;
                  return (
                    <button
                      key={subId}
                      onClick={() => {
                        setSelectedSubcategory(subId);
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set("subcategory", subId);
                        navigate({ search: newParams.toString() }, { replace: true });
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-colors flex-shrink-0 whitespace-nowrap ${
                        isSelected
                          ? "bg-[var(--brand-leaf-tint,#EAF5E0)] border border-[var(--brand-green,#236B34)] text-[var(--brand-green-deep,#14401F)] font-semibold"
                          : "bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                      }`}>
                      <span className="text-sm flex-shrink-0">
                        {subcat.image && !subcat.image.includes("placehold.co") ? (
                          <img
                            src={subcat.image}
                            alt=""
                            className="w-3.5 h-3.5 object-cover rounded-full"
                          />
                        ) : (
                          subcat.icon || "📦"
                        )}
                      </span>
                      <span>{formatSubcatName(subcat.name)}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Scrollable Products Grid / Empty state */}
          <div ref={productsContainerRef} className="flex-1 overflow-y-auto scrollbar-hide bg-white">
            {loading ? (
              <div className="px-3 md:px-6 lg:px-8 py-4 md:py-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-neutral-200 bg-white p-3 animate-pulse"
                    >
                      <div className="aspect-square w-full rounded-lg bg-neutral-100" />
                      <div className="mt-3 h-3 w-4/5 rounded bg-neutral-100" />
                      <div className="mt-2 h-3 w-2/3 rounded bg-neutral-100" />
                      <div className="mt-3 h-8 w-full rounded-lg bg-neutral-100" />
                    </div>
                  ))}
                </div>
              </div>
            ) : categoryProducts.length > 0 ? (
              <div className="px-3 md:px-6 lg:px-8 py-4 md:py-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
                  {categoryProducts.map((product) => (
                    <ProductCard
                      key={product.id || product._id}
                      product={product}
                      showHeartIcon={false}
                      showStockInfo={false}
                      showBadge={true}
                      showOptionsText={true}
                      categoryStyle={true}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-4 py-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center text-3xl mb-3 shadow-xs">
                  🛍️
                </div>
                <h3 className="text-sm md:text-base font-bold text-neutral-800 mb-1">
                  {totalActiveFilters > 0 ? "No Matching Products" : "No Products Found"}
                </h3>
                <p className="text-xs text-neutral-500 max-w-xs mb-4">
                  {totalActiveFilters > 0
                    ? "Try adjusting or clearing your filters to see more products."
                    : selectedSubcategory !== "all"
                    ? "We couldn't find any products in this specific subcategory right now."
                    : "No products currently available in this category."}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {totalActiveFilters > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllFilters}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-[var(--brand-green,#236B34)] text-white rounded-lg shadow-xs hover:opacity-90 transition-opacity"
                    >
                      Clear Filters
                    </button>
                  )}
                  {selectedSubcategory !== "all" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubcategory("all");
                        const newParams = new URLSearchParams(searchParams);
                        newParams.delete("subcategory");
                        navigate({ search: newParams.toString() }, { replace: true });
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-neutral-300 text-neutral-700 rounded-lg shadow-xs hover:bg-neutral-50 transition-colors"
                    >
                      View All {category?.name || "Category"} Products
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Responsive Filters Modal / Bottom Sheet */}
      <AnimatePresence>
        {isFiltersOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setIsFiltersOpen(false)}
            />

            {/* Content Drawer / Dialog */}
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-50 w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden max-h-[85vh] sm:max-h-[560px]"
            >
              {/* Mobile Drag Indicator */}
              <div className="w-12 h-1.5 bg-neutral-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden flex-shrink-0" />

              {/* Modal Header */}
              <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between bg-white flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-neutral-800">Filters</h3>
                  {totalActiveFilters > 0 && (
                    <span className="text-[11px] font-semibold bg-[var(--brand-green,#236B34)] text-white px-2 py-0.5 rounded-full">
                      {totalActiveFilters} active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {totalActiveFilters > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllFilters}
                      className="text-xs font-semibold text-neutral-500 hover:text-red-600 transition-colors"
                    >
                      Reset All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsFiltersOpen(false)}
                    className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition-colors"
                    aria-label="Close filters"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Search across current options */}
              <div className="p-2.5 border-b border-neutral-100 bg-neutral-50/70 flex-shrink-0">
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search across filters..."
                    value={filterSearchQuery}
                    onChange={(e) => setFilterSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-green,#236B34)] text-xs text-neutral-700 placeholder:text-neutral-400"
                  />
                </div>
              </div>

              {/* 2-Column Filter Body */}
              <div className="flex flex-1 overflow-hidden min-h-[220px] max-h-[360px]">
                {/* Left Column: Filter Categories */}
                <div className="w-32 sm:w-40 border-r border-neutral-200 flex-shrink-0 bg-neutral-50 py-1 overflow-y-auto">
                  {availableFilterCategories.map((cat) => {
                    const isCatActive = selectedFilterCategory === cat.id;
                    const hasSelected = hasCategorySelectedFilters(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedFilterCategory(cat.id);
                          setFilterSearchQuery("");
                        }}
                        className={`w-full px-3 py-2.5 text-left text-xs transition-colors flex items-center justify-between ${
                          isCatActive
                            ? "bg-white text-[var(--brand-green,#236B34)] font-bold border-l-4 border-[var(--brand-green,#236B34)] shadow-xs"
                            : "text-neutral-600 hover:bg-neutral-100 font-medium"
                        }`}
                      >
                        <span className="truncate">{cat.label}</span>
                        {hasSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-green,#236B34)] flex-shrink-0 ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Right Column: Filter Options */}
                <div className="flex-1 overflow-y-auto p-2 bg-white">
                  {currentCategoryOptions.length > 0 ? (
                    <div className="space-y-1">
                      {currentCategoryOptions.map((opt) => {
                        const checked = isOptionChecked(selectedFilterCategory, opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleToggleOption(selectedFilterCategory, opt.id)}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-neutral-50 rounded-lg transition-colors text-left"
                          >
                            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                              {checked ? (
                                <div className="w-4 h-4 rounded bg-[var(--brand-green,#236B34)] flex items-center justify-center text-white">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-4 h-4 border border-neutral-300 rounded bg-white" />
                              )}
                            </div>
                            <span className="flex-1 text-xs font-medium text-neutral-700 truncate">
                              {opt.name}
                            </span>
                            {opt.count !== undefined && (
                              <span className="text-[11px] text-neutral-400 font-normal">
                                ({opt.count})
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-neutral-400">
                      No matching options found
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Action Footer */}
              <div className="p-3 border-t border-neutral-200 flex gap-2.5 bg-neutral-50/80 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="flex-1 py-2.5 border border-neutral-300 text-neutral-700 rounded-xl font-medium text-xs hover:bg-white transition-colors bg-white shadow-xs"
                >
                  Clear Filter
                </button>
                <button
                  type="button"
                  onClick={() => setIsFiltersOpen(false)}
                  className="flex-1 py-2.5 bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-deep,#14401F)] text-white rounded-xl font-semibold text-xs transition-colors shadow-sm"
                >
                  {totalActiveFilters > 0 ? `Apply (${totalActiveFilters})` : "Apply Filters"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Responsive Sort Modal / Dropdown */}
      <AnimatePresence>
        {isSortOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-start justify-center sm:justify-start">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs sm:bg-transparent"
              onClick={() => setIsSortOpen(false)}
            />

            {/* Sort Sheet / Popover */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-50 w-full sm:w-56 bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border border-neutral-200 overflow-hidden sm:absolute sm:left-[170px] sm:top-[105px]"
            >
              <div className="p-3 border-b border-neutral-100 flex items-center justify-between sm:hidden">
                <span className="font-bold text-sm text-neutral-800">Sort Products</span>
                <button
                  onClick={() => setIsSortOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 text-sm font-semibold"
                >
                  ✕
                </button>
              </div>
              <div className="py-1">
                {sortOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setSortBy(option.id);
                      setIsSortOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-xs text-left transition-colors ${
                      sortBy === option.id
                        ? "bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green-deep,#14401F)] font-bold"
                        : "text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    <span>{option.label}</span>
                    {sortBy === option.id && (
                      <svg className="w-4 h-4 text-[var(--brand-green,#236B34)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
