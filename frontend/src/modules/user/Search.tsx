import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search as SearchIcon,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import ProductCard from "./components/ProductCard";
import {
  getSemanticSuggestions,
  getSmartRecommendations,
  getTrendingSearches,
  semanticSearch,
  SearchProduct,
  SearchSuggestion,
  trackSearchClick,
} from "../../services/api/searchService";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useLocation } from "../../hooks/useLocation";
import VoiceSearchModal from "../../components/VoiceSearchModal";
import QRScannerModal from "../../components/QRScannerModal";
import { openBarcodeScanner } from "../../utils/scannerPlatform";

type SortOption = "relevance" | "price_asc" | "price_desc" | "popular";

const sortLabels: Record<SortOption, string> = {
  relevance: "Relevance",
  price_asc: "Price low",
  price_desc: "Price high",
  popular: "Popular",
};

/** Second line of a dropdown row: a product's sizes (not its category), otherwise what kind of row it is */
const suggestionSubtitle = (item: SearchSuggestion): string => {
  if (item.type === "product") {
    const options = item.options || [];
    if (options.length) {
      const more = (item.optionCount || options.length) - options.length;
      return options.join(" · ") + (more > 0 ? ` +${more} more` : "");
    }
    return item.pack || "";
  }
  const labels: Record<string, string> = { category: "Category", brand: "Brand", tag: "Tag", trending: "Popular search" };
  return labels[item.type] || "";
};

export default function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { location } = useLocation();
  const initialQuery = searchParams.get("q") || "";
  const [inputValue, setInputValue] = useState(initialQuery);
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [popularSearches, setPopularSearches] = useState<string[]>([]);
  const [zeroResultSearches, setZeroResultSearches] = useState<string[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [sort, setSort] = useState<SortOption>((searchParams.get("sort") as SortOption) || "relevance");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [selectedQuery, setSelectedQuery] = useState(initialQuery);
  const debouncedQuery = useDebouncedValue(inputValue, 300);
  const debouncedMinPrice = useDebouncedValue(minPrice, 300);
  const debouncedMaxPrice = useDebouncedValue(maxPrice, 300);
  const activeQuery = selectedQuery || debouncedQuery;
  const suggestionBoxRef = useRef<HTMLDivElement>(null);
  const inputValueRef = useRef(inputValue);
  const limit = 20;

  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    const query = searchParams.get("q") || "";
    if (query !== inputValue.trim()) {
      setInputValue(query);
      setSelectedQuery(query);
    }
    setPage(Number(searchParams.get("page") || 1));
    setSort((searchParams.get("sort") as SortOption) || "relevance");
    setMinPrice(searchParams.get("minPrice") || "");
    setMaxPrice(searchParams.get("maxPrice") || "");
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();

    getTrendingSearches(10, controller.signal)
      .then((response) => {
        if (!response.success) return;
        setPopularSearches(response.data.popular.map((item) => item.query));
        setZeroResultSearches(response.data.zeroResults.map((item) => item.query));
      })
      .catch((err) => {
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          console.error("Failed to load trending searches", err);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getSmartRecommendations(
      {
        limit: 10,
        latitude: location?.latitude,
        longitude: location?.longitude,
      },
      controller.signal
    )
      .then((response) => {
        if (response.success) setRecommendedProducts(response.data || []);
      })
      .catch((err) => {
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          console.error("Failed to load recommendations", err);
        }
      });

    return () => controller.abort();
  }, [location?.latitude, location?.longitude]);

  useEffect(() => {
    const query = debouncedQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    setSuggestionsLoading(true);

    getSemanticSuggestions(query, controller.signal, { latitude: location?.latitude, longitude: location?.longitude })
      .then((response) => {
        if (response.success) {
          setSuggestions(response.data);
          setShowSuggestions(true);
          setActiveSuggestionIndex(-1);
        }
      })
      .catch((err) => {
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          console.error("Failed to load suggestions", err);
        }
      })
      .finally(() => setSuggestionsLoading(false));

    return () => controller.abort();
  }, [debouncedQuery, location?.latitude, location?.longitude]);

  useEffect(() => {
    const query = activeQuery.trim();

    if (!query || !inputValueRef.current.trim()) {
      setResults([]);
      setTotalPages(0);
      setTotalResults(0);
      setError(null);
      setSearchParams(prev => {
        if (prev.has("q")) {
          const next = new URLSearchParams(prev);
          next.delete("q");
          return next;
        }
        return prev;
      }, { replace: true });
      return;
    }

    // Only sync to searchParams if the user is not actively typing a space at the end
    if (!inputValueRef.current.endsWith(" ")) {
      const params: Record<string, string> = { q: query };
      if (page > 1) params.page = String(page);
      if (sort !== "relevance") params.sort = sort;
      if (debouncedMinPrice) params.minPrice = debouncedMinPrice;
      if (debouncedMaxPrice) params.maxPrice = debouncedMaxPrice;
      setSearchParams(params, { replace: true });
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    semanticSearch(
      {
        q: query,
        page,
        limit,
        sort,
        minPrice: debouncedMinPrice ? Number(debouncedMinPrice) : undefined,
        maxPrice: debouncedMaxPrice ? Number(debouncedMaxPrice) : undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
      },
      controller.signal
    )
      .then((response) => {
        setResults(response.data || []);
        setTotalPages(response.pagination?.pages || 0);
        setTotalResults(response.pagination?.total || 0);
      })
      .catch((err) => {
        if (err.name === "CanceledError" || err.name === "AbortError") return;
        console.error("Search failed", err);
        setResults([]);
        setTotalPages(0);
        setTotalResults(0);
        setError("Search failed. Please try again.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [
    activeQuery,
    page,
    sort,
    debouncedMinPrice,
    debouncedMaxPrice,
    location?.latitude,
    location?.longitude,
    setSearchParams,
  ]);

  useEffect(() => {
    setPage(1);
  }, [activeQuery, sort, debouncedMinPrice, debouncedMaxPrice]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionBoxRef.current && !suggestionBoxRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // The dropdown lists products first, then categories / brands / popular searches. The typed text
  // itself isn't a row (Enter or the search button searches it).
  const visibleSuggestions = useMemo(() => {
    const order: Record<string, number> = { product: 0, category: 1, brand: 2, tag: 3, trending: 4 };
    return suggestions
      .filter((item) => item.type !== "search")
      .sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));
  }, [suggestions]);

  const chips = useMemo(() => {
    const fallback = ["atta", "milk", "dal", "rice", "oil", "snacks", "bread", "eggs"];
    return popularSearches.length ? popularSearches.slice(0, 10) : fallback;
  }, [popularSearches]);

  const applySearch = (query: string) => {
    const nextQuery = query.trim();
    setInputValue(nextQuery);
    setSelectedQuery(nextQuery);
    setPage(1);
    setShowSuggestions(false);
    setSearchParams(nextQuery ? { q: nextQuery } : {}, { replace: false });
  };

  const handleSuggestionClick = (item: SearchSuggestion) => {
    setShowSuggestions(false);
    if (item.type === "product") {
      if (inputValue.trim()) {
        trackSearchClick(inputValue.trim(), String(item.id)).catch(() => undefined);
      }
      navigate(`/product/${item.id}`);
      return;
    }
    if (item.type === "category") {
      navigate(`/category/${item.id}`);
      return;
    }
    applySearch(item.name);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || visibleSuggestions.length === 0) {
      if (event.key === "Enter") applySearch(inputValue);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index + 1) % visibleSuggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index <= 0 ? visibleSuggestions.length - 1 : index - 1));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selected = visibleSuggestions[activeSuggestionIndex];
      selected ? handleSuggestionClick(selected) : applySearch(inputValue);
      return;
    }

    if (event.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const clearSearch = () => {
    setInputValue("");
    setSelectedQuery("");
    setResults([]);
    setSuggestions([]);
    setPage(1);
    setSearchParams({});
  };

  return (
    <div className="min-h-screen bg-[var(--brand-cream,#FDF9F2)] pb-24 md:pb-8">
      <div className="sticky top-0 z-40 border-b border-[var(--brand-border,#E9E2D3)] bg-[var(--brand-cream,#FDF9F2)]/95 backdrop-blur md:hidden">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-6">
          <div ref={suggestionBoxRef} className="relative">
            <div className="flex h-12 items-center gap-2 rounded-xl border border-[var(--brand-border,#E9E2D3)] bg-white px-3 shadow-sm focus-within:border-[var(--brand-leaf,#5FA82E)] focus-within:ring-2 focus-within:ring-[var(--brand-leaf,#5FA82E)]/20 transition-all">
              <SearchIcon className="h-5 w-5 text-[var(--brand-green,#236B34)]" aria-hidden="true" />
              <input
                value={inputValue}
                onChange={(event) => {
                  setInputValue(event.target.value);
                  setSelectedQuery("");
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
                placeholder="Search for atta, dal, coke and more"
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--brand-ink,#1C2B20)] outline-none placeholder:text-neutral-400 md:text-base"
                aria-label="Search products"
              />
              {suggestionsLoading && <Loader2 className="h-4 w-4 animate-spin text-[var(--brand-green,#236B34)]" />}
              {inputValue && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {/* Mic Icon Button */}
              <button
                type="button"
                onClick={() => setShowVoiceModal(true)}
                className="p-1.5 text-neutral-500 hover:text-[var(--brand-green,#236B34)] active:scale-90 transition-all flex items-center justify-center cursor-pointer rounded-full"
                title="Voice Search"
                aria-label="Voice Search"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
              {/* Scanner Barcode Icon Button (Brand Green) */}
              <button
                type="button"
                onClick={() => openBarcodeScanner(() => setShowScannerModal(true))}
                className="p-1.5 text-[var(--brand-green,#236B34)] hover:text-[var(--brand-green-dark,#1B5128)] active:scale-90 transition-all flex items-center justify-center cursor-pointer rounded-full flex-shrink-0"
                title="Scan Barcode / QR Code"
                aria-label="Scan Barcode / QR Code"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                  <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                  <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                  <rect x="7" y="7" width="10" height="10" rx="1" />
                </svg>
              </button>
            </div>

            {showSuggestions && visibleSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-14 z-50 overflow-hidden rounded-2xl border border-[var(--brand-border,#E9E2D3)] bg-white shadow-xl">
                {visibleSuggestions.map((item, index) => (
                  <button
                    key={`${item.type}-${item.id}-${item.name}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSuggestionClick(item)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                      activeSuggestionIndex === index ? "bg-[var(--brand-cream-soft,#F6EFE2)]" : "hover:bg-[var(--brand-cream-soft,#F6EFE2)]/50"
                    }`}
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green,#236B34)]">
                      {item.image ? (
                        <img src={item.image} alt="" className="h-full w-full rounded-xl object-contain" />
                      ) : item.type === "trending" ? (
                        <TrendingUp className="h-4 w-4 text-[var(--brand-orange,#F97316)]" />
                      ) : (
                        <SearchIcon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--brand-ink,#1C2B20)]">{item.name}</p>
                      {suggestionSubtitle(item) && <p className="truncate text-xs text-[var(--brand-ink-muted,#5B6B60)]">{suggestionSubtitle(item)}</p>}
                    </div>
                    {item.type === "product" && Number(item.price) > 0 && (
                      <span className="flex-shrink-0 text-right">
                        <span className="font-price block text-sm font-bold text-[var(--brand-green-deep,#14401F)]">
                          Rs {Number(item.price).toLocaleString("en-IN")}
                        </span>
                        {Number(item.mrp) > Number(item.price) && (
                          <span className="font-price block text-[10px] text-neutral-400 line-through">Rs {Number(item.mrp).toLocaleString("en-IN")}</span>
                        )}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => applySearch(chip)}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-[var(--brand-border,#E9E2D3)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--brand-ink,#1C2B20)] shadow-sm hover:border-[var(--brand-leaf,#5FA82E)] hover:text-[var(--brand-green,#236B34)] hover:bg-[var(--brand-leaf-tint,#EAF5E0)] transition-colors"
            >
              <TrendingUp className="h-3.5 w-3.5 text-[var(--brand-orange,#F97316)]" />
              {chip}
            </button>
          ))}
        </div>

        <div className="mb-4 rounded-2xl border border-[var(--brand-border,#E9E2D3)] bg-white p-3 shadow-[0_4px_16px_rgba(35,107,52,0.04)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--brand-ink,#1C2B20)]">
              <Sparkles className="h-4 w-4 text-[var(--brand-orange,#F97316)]" />
              {activeQuery.trim()
                ? `${totalResults.toLocaleString("en-IN")} results for "${activeQuery.trim()}"`
                : "Trending searches"}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-[var(--brand-border,#E9E2D3)] px-2.5 py-1.5 bg-neutral-50/50">
                <SlidersHorizontal className="h-4 w-4 text-neutral-500" />
                <input
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Min"
                  className="w-16 text-xs outline-none bg-transparent"
                  inputMode="numeric"
                  aria-label="Minimum price"
                />
                <span className="text-neutral-300">-</span>
                <input
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Max"
                  className="w-16 text-xs outline-none bg-transparent"
                  inputMode="numeric"
                  aria-label="Maximum price"
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--brand-border,#E9E2D3)] px-2.5 py-1.5 bg-neutral-50/50">
                <ArrowDownUp className="h-4 w-4 text-neutral-500" />
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortOption)}
                  className="bg-transparent text-xs font-semibold text-[var(--brand-ink,#1C2B20)] outline-none"
                  aria-label="Sort results"
                >
                  {Object.entries(sortLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-9 w-9 animate-spin text-[var(--brand-green,#236B34)]" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-100 bg-white px-4 py-12 text-center text-sm font-medium text-red-600 shadow-sm">
            {error}
          </div>
        ) : debouncedQuery.trim() && results.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {results.map((product) => (
                <div key={product.id || product._id} className="relative">
                  {product.searchScore && (
                    <div className="absolute right-2 top-2 z-20 rounded-full bg-white/95 px-2 py-1 text-[10px] font-black text-[var(--brand-green,#236B34)] border border-[var(--brand-border,#E9E2D3)] shadow-sm">
                      {Math.round(product.searchScore.finalScore * 100)}%
                    </div>
                  )}
                  <ProductCard product={product} categoryStyle showBadge showPackBadge={false} showStockInfo />
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page <= 1}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--brand-border,#E9E2D3)] bg-white text-[var(--brand-ink,#1C2B20)] disabled:opacity-40 hover:bg-[var(--brand-leaf-tint,#EAF5E0)] transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-price text-sm font-semibold text-[var(--brand-ink,#1C2B20)]">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={page >= totalPages}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--brand-border,#E9E2D3)] bg-white text-[var(--brand-ink,#1C2B20)] disabled:opacity-40 hover:bg-[var(--brand-leaf-tint,#EAF5E0)] transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        ) : debouncedQuery.trim() ? (
          <div className="rounded-2xl border border-[var(--brand-border,#E9E2D3)] bg-white px-4 py-14 text-center shadow-sm">
            <p className="font-display text-base font-bold text-[var(--brand-ink,#1C2B20)]">No products found</p>
            <p className="mt-1 text-sm text-[var(--brand-ink-muted,#5B6B60)]">Try another search term.</p>
            {zeroResultSearches.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {zeroResultSearches.slice(0, 5).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => applySearch(item)}
                    className="rounded-full bg-[var(--brand-cream-soft,#F6EFE2)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-ink,#1C2B20)] hover:bg-[var(--brand-leaf-tint,#EAF5E0)] transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
              {chips.slice(0, 10).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => applySearch(item)}
                  className="rounded-lg border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-[var(--customer-primary)]"
                >
                  <TrendingUp className="mb-3 h-5 w-5 text-[var(--customer-primary)]" />
                  <span className="text-sm font-bold text-neutral-900">{item}</span>
                </button>
              ))}
            </div>

            {recommendedProducts.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-800">
                  <Sparkles className="h-4 w-4 text-[var(--customer-primary)]" />
                  Recommended For You
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {recommendedProducts.map((product) => (
                    <ProductCard
                      key={product.id || product._id}
                      product={product}
                      categoryStyle
                      showBadge
                      showPackBadge={false}
                      showStockInfo
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
      {/* Voice Search Modal */}
      <VoiceSearchModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSearchResult={(query) => {
          applySearch(query);
        }}
      />

      {/* Barcode Scanner Modal */}
      {showScannerModal && (
        <QRScannerModal
          title="Scan Product Barcode"
          manualPlaceholder="Enter barcode number to search"
          onScanSuccess={(decodedText) => {
            setShowScannerModal(false);
            if (decodedText) {
              applySearch(decodedText);
            }
          }}
          onClose={() => setShowScannerModal(false)}
        />
      )}
    </div>
  );
}
