import {
  useParams,
  useNavigate,
  useLocation as useRouterLocation,
  Link,
} from "react-router-dom";
 import { useRef, useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
// import { products } from '../../data/products'; // REMOVED
// import { categories } from '../../data/categories'; // REMOVED
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../hooks/useLocation';
import { useLoading } from '../../context/LoadingContext';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/badge';
import { getProductById, getProducts } from '../../services/api/customerProductService';
import { getSimilarProducts as getSemanticSimilarProducts } from '../../services/api/searchService';
import WishlistButton from '../../components/WishlistButton';
import StarRating from "../../components/ui/StarRating";
import ProductCard from "./components/ProductCard";
// Unused banner imports removed
import { calculateProductPrice, getApplicableUnitPrice } from '../../utils/priceUtils';
import {
  findCartItemForPrimaryVariant,
  getVariantGallery,
  getVariantDisplayLabel,
  getVariantId,
  getVariantImage,
  getVariantLabel,
  matchesCartVariant,
  normalizeCustomerVariations,
  hasRealVariants,
} from '../../utils/customerVariantUtils';
import { resolveProductGallery } from '../../utils/productLegacyUtils';
import EnquiryModal from '../../components/EnquiryModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const { cart, addToCart, updateQuantity } = useCart();
  const { location } = useLocation();
  const { startLoading, stopLoading } = useLoading();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);
  const [isDescOpen, setIsDescOpen] = useState(true);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isReviewsOpen, setIsReviewsOpen] = useState(true);

  const searchSuggestions = ['atta', 'milk', 'dal', 'coke', 'bread', 'eggs', 'rice', 'oil'];
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSearchIndex((prev) => (prev + 1) % searchSuggestions.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);


  const [product, setProduct] = useState<any>(null);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAvailableAtLocation, setIsAvailableAtLocation] =
    useState<boolean>(true);

  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [similarProductsPage, setSimilarProductsPage] = useState(1);
  const [isSimilarLoading, setIsSimilarLoading] = useState(false);
  const [hasMoreSimilar, setHasMoreSimilar] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      startLoading();

      try {
        // Check if navigation came from store page
        const fromStore = (routerLocation.state as any)?.fromStore === true;

        // Fetch product details with location
        const response = await getProductById(
          id
          // location?.latitude,
          // location?.longitude
        );
        if (response.success && response.data) {
          const productData = response.data as any;
          const normalizedVariations = normalizeCustomerVariations(productData);

          // Set location availability flag
          setIsAvailableAtLocation(productData.isAvailableAtLocation !== false);

          setProduct({
            ...productData,
            variations: normalizedVariations,
            // Ensure all critical fields have safe defaults
            id: productData._id || productData.id,
            name: productData.productName || productData.name || "Product",
            imageUrl: productData.mainImage || productData.imageUrl || "",
            price: productData.price || 0,
            mrp: productData.mrp || productData.price || 0,
            pack:
              productData.pack ||
              productData.smallDescription ||
              getVariantLabel(normalizedVariations[0]) ||
              "Standard",
          });

          // Default to first created variant when variants exist
          setSelectedVariantIndex(normalizedVariations.length > 0 ? 0 : null);
          setSelectedImageIndex(0);
          const similar = response.data.similarProducts || [];
          setSimilarProducts(similar);
          setSimilarProductsPage(1);
          setHasMoreSimilar(similar.length >= 6);

          getSemanticSimilarProducts(id, undefined, { latitude: location?.latitude, longitude: location?.longitude })
            .then((similarResponse) => {
              if (similarResponse.success && similarResponse.data.length > 0) {
                setSimilarProducts(similarResponse.data);
                const categoryId =
                  productData.subcategory?._id ||
                  productData.subcategory?.id ||
                  (typeof productData.subcategory === "string" ? productData.subcategory : null) ||
                  productData.category?._id ||
                  productData.category?.id ||
                  (typeof productData.category === "string" ? productData.category : null);
                setHasMoreSimilar(Boolean(categoryId));
              }
            })
            .catch((err) => {
              console.error("Failed to fetch semantic similar products", err);
            });

          // Fetch reviews
          fetchReviews(id);
        } else {
          setProduct(null);
          setError(response.message || "Product not found");
        }
      } catch (error: any) {
        console.error("Failed to fetch product", error);
        setProduct(null);
        setError(
          error.response?.data?.message ||
            error.message ||
            "Something went wrong while fetching product details"
        );
      } finally {
        setLoading(false);
        stopLoading();
      }
    };

    fetchProduct();
  }, [id, location?.latitude, location?.longitude]);

  const fetchReviews = async (productId: string) => {
    setReviewsLoading(true);
    try {
      const { getProductReviews } = await import(
        "../../services/api/customerReviewService"
      );
      const res = await getProductReviews(productId);
      if (res.success) {
        setReviews(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch reviews", err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleLoadMoreSimilar = async () => {
    if (isSimilarLoading || !hasMoreSimilar || !product) return;

    setIsSimilarLoading(true);
    try {
      const nextPage = similarProductsPage + 1;
      // Use subcategory or category as fallback
      const targetCategoryId = product.subcategory?._id || product.subcategory?.id || (typeof product.subcategory === 'string' ? product.subcategory : null) || product.category?._id || product.category?.id || (typeof product.category === 'string' ? product.category : null);

      if (!targetCategoryId) {
        setHasMoreSimilar(false);
        return;
      }

      const response = await getProducts({
        category: targetCategoryId,
        page: nextPage,
        limit: 12, // Fetch more to ensure we have enough after filtering duplicates
        latitude: location?.latitude,
        longitude: location?.longitude
      });

      if (response.success && response.data) {
        const existingIds = new Set(similarProducts.map(p => p._id || p.id));
        const currentProductId = product._id || product.id;

        const newProducts = response.data.filter(
          (p: any) =>
            (p._id || p.id) !== currentProductId &&
            !existingIds.has(p._id || p.id)
        ).slice(0, 6);

        if (newProducts.length > 0) {
          setSimilarProducts(prev => [...prev, ...newProducts]);
          setSimilarProductsPage(nextPage);
        }

        // If we got fewer products than requested or it's clearly the end
        if (response.data.length < 6 || response.pagination.page >= response.pagination.pages) {
          setHasMoreSimilar(false);
        }
      } else {
        setHasMoreSimilar(false);
      }
    } catch (err) {
      console.error("Failed to load more similar products", err);
    } finally {
      setIsSimilarLoading(false);
    }
  };

  const hasVariations = hasRealVariants(product);
  const customerVariations = useMemo(
    () => (product ? normalizeCustomerVariations(product) : []),
    [product]
  );
  const effectiveVariantIndex = hasVariations ? (selectedVariantIndex ?? 0) : null;

  const allMedia = useMemo(() => {
    const media: { type: "image" | "video"; url: string }[] = [];
    if (!product) return media;

    let images: string[] = [];
    if (customerVariations.length > 0 && effectiveVariantIndex !== null) {
      const variant = customerVariations[effectiveVariantIndex];
      const gallery = getVariantGallery(variant);
      if (gallery.length > 0) {
        images = gallery;
      }
    }
    if (images.length === 0) {
      images = resolveProductGallery(product);
    }

    images.forEach((img) => {
      if (img) media.push({ type: "image", url: img });
    });

    if (product.video) {
      media.push({ type: "video", url: product.video });
    }

    return media;
  }, [product, customerVariations, effectiveVariantIndex]);

  // Reset gallery position when variant changes
  useEffect(() => {
    setSelectedImageIndex(0);
  }, [effectiveVariantIndex]);

  // Get selected variant
  const selectedVariant =
    hasVariations && effectiveVariantIndex !== null
      ? customerVariations[effectiveVariantIndex] || null
      : null;
  const activeVariationSelector =
    hasVariations && effectiveVariantIndex !== null ? effectiveVariantIndex : undefined;
  const variantTitle = selectedVariant
    ? getVariantDisplayLabel(selectedVariant, product) || product?.pack || "Standard"
    : product?.pack || "Standard";

  const cartItem = useMemo(() => {
    if (!product) return null;
    const productId = String(product.id || product._id);

    if (!hasVariations) {
      return findCartItemForPrimaryVariant(cart.items, product) ?? null;
    }

    return (
      cart.items.find((item) => {
        if (!item?.product) return false;
        const itemProductId = String(item.product.id || item.product._id);
        if (itemProductId !== productId) return false;
        if (!selectedVariant) return false;
        return matchesCartVariant(
          item.product,
          getVariantId(selectedVariant),
          variantTitle
        );
      }) ?? null
    );
  }, [cart.items, product, hasVariations, selectedVariant, variantTitle]);

  // Recommendations: not this product, not the same item from another store, not already in the cart
  const visibleSimilarProducts = useMemo(() => {
    const normalize = (value: unknown) => String(value || '').trim().toLowerCase();
    const currentId = String(product?._id || product?.id || id || '');
    const currentName = normalize(product?.productName || product?.name);
    const inCartIds = new Set(
      cart.items.map((item: any) => String(item?.product?.id || item?.product?._id || '')).filter(Boolean)
    );
    const seenNames = new Set<string>();
    return similarProducts.filter((p: any) => {
      const pid = String(p?._id || p?.id || '');
      const name = normalize(p?.productName || p?.name);
      if (!pid || pid === currentId || inCartIds.has(pid)) return false;
      if (name && (name === currentName || seenNames.has(name))) return false;
      if (name) seenNames.add(name);
      return true;
    });
  }, [similarProducts, cart.items, product, id]);

  const { displayPrice: baseVariantPrice, mrp: variantMrp, discount: baseDiscount, hasDiscount: baseHasDiscount } = calculateProductPrice(product, activeVariationSelector);

  // Calculate dynamic price based on cart quantity
  const inCartQtyForCalc = Math.max(1, cartItem?.quantity || 0);

  const variantPrice = getApplicableUnitPrice(product, activeVariationSelector, inCartQtyForCalc);

  // Recalculate discount based on dynamic price
  const hasDiscount = variantMrp > variantPrice;
  const discount = hasDiscount ? Math.round(((variantMrp - variantPrice) / variantMrp) * 100) : 0;

  const variantStock = selectedVariant?.stock !== undefined ? selectedVariant.stock : (product?.stock || 0);
  const isVariantAvailable = selectedVariant?.status !== "Sold out" && (variantStock > 0 || variantStock === 0); // 0 means unlimited

  const variantCardOptions = useMemo(() => {
    if (!product || !customerVariations.length) return [];
    return customerVariations.map((variant: any, index: number) => {
      const { displayPrice, mrp } = calculateProductPrice(product, index);
      const stock = variant.stock !== undefined ? Number(variant.stock) : undefined;
      const isSoldOut = variant.status === "Sold out";
      const isOutOfStock = isSoldOut || (stock !== undefined && stock < 0);
      const inStock = !isSoldOut && (stock === undefined || stock > 0 || stock === 0);
      return {
        key: variant._id || variant.id || `variant-${index}`,
        index,
        title: getVariantDisplayLabel(variant, product) || getVariantLabel(variant) || `Variant ${index + 1}`,
        image: getVariantImage(variant),
        displayPrice,
        mrp,
        stock,
        isOutOfStock: !inStock,
        inStock,
      };
    });
  }, [customerVariations, product]);

  const formatVariantPriceParts = (amount: number) => {
    const safe = Number.isFinite(amount) ? amount : 0;
    const [whole, fraction = "00"] = safe.toFixed(2).split(".");
    return {
      whole: Number(whole).toLocaleString("en-IN"),
      fraction,
    };
  };

  const currentMedia = allMedia[selectedImageIndex] || null;
  const currentImage = currentMedia?.type === "image" ? currentMedia.url : (allMedia.find(m => m.type === "image")?.url || product?.imageUrl || "");

  const variationImageMatches = useMemo(() => {
    const map = new Map<string, number[]>();
    for (let i = 0; i < customerVariations.length; i += 1) {
      for (const img of getVariantGallery(customerVariations[i])) {
        const existing = map.get(img) || [];
        existing.push(i);
        map.set(img, existing);
      }
    }
    return map;
  }, [customerVariations]);

  // If user changes the main image gallery (click/swipe), sync selected variant when the image uniquely matches a variant image.
  useEffect(() => {
    if (!currentImage) return;
    if (!product?.variations || !hasRealVariants(product)) return;
    const matches = variationImageMatches.get(currentImage);
    if (!matches || matches.length !== 1) return;
    const matchIndex = matches[0];
    if (matchIndex !== effectiveVariantIndex) {
      setSelectedVariantIndex(matchIndex);
    }
  }, [currentImage, product?.variations, effectiveVariantIndex, variationImageMatches]);

  // Minimum swipe distance (in pixels)
  const minSwipeDistance = 50;

  // Handle touch start
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  // Handle touch move
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  // Handle touch end - perform swipe
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && selectedImageIndex < allMedia.length - 1) {
      setIsTransitioning(true);
      setSelectedImageIndex(selectedImageIndex + 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }

    if (isRightSwipe && selectedImageIndex > 0) {
      setIsTransitioning(true);
      setSelectedImageIndex(selectedImageIndex - 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  const inCartQty = cartItem?.quantity || 0;

  const [detailQty, setDetailQty] = useState(inCartQty);
  useEffect(() => {
    setDetailQty(inCartQty);
  }, [inCartQty]);

  const handleDetailQtyChange = async (val: string) => {
    if (val === '') {
      setDetailQty(0);
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      if (variantStock > 0 && num > variantStock) {
        setDetailQty(variantStock);
        const productId = product.id || product._id;
        const variantId = selectedVariant?._id;
        await updateQuantity(productId, variantStock, variantId, variantTitle);
        showToast(`Only ${variantStock} items available in stock.`, "error");
        return;
      }
      setDetailQty(num);
      const productId = product.id || product._id;
      const variantId = selectedVariant?._id;
      await updateQuantity(productId, num, variantId, variantTitle);
    }
  };

  const handleDetailQtyBlurOrSubmit = async (newQty: number) => {
    const productId = product.id || product._id;
    const variantId = selectedVariant?._id;
    if (variantStock > 0 && newQty > variantStock) {
      await updateQuantity(productId, variantStock, variantId, variantTitle);
      showToast(`Only ${variantStock} items available in stock.`, "error");
      return;
    }
    if (newQty <= 0) {
      await updateQuantity(productId, 0, variantId, variantTitle);
      showToast("Product removed from cart", "info");
    } else if (newQty !== inCartQty) {
      await updateQuantity(productId, newQty, variantId, variantTitle);
      showToast("Cart updated", "success");
    }
  };

  if (loading && !product) {
    return null; // Let the global IconLoader handle this
  }

  if (error && !product) {
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

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4 md:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-lg md:text-xl font-semibold text-neutral-900 mb-4">
            Product not found
          </p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  // Get category info - safe access
  const category =
    product.category && product.category.name
      ? { name: product.category.name, id: product.category._id }
      : null;

  const handleAddToCart = () => {
    if (!isAvailableAtLocation) {
      // Show alert if trying to add item outside delivery area
      alert("This product is not available for delivery at your location.");
      return;
    }
    if (!isVariantAvailable && variantStock !== 0) {
      alert("This variant is currently out of stock.");
      return;
    }
    // Create product with selected variant info
    const productWithVariant = {
      ...product,
      price: variantPrice,
      mrp: variantMrp,
      pack: variantTitle,
      selectedVariant: selectedVariant,
      variantId: getVariantId(selectedVariant),
      variantTitle: variantTitle,
    };
    addToCart(productWithVariant, addButtonRef.current);
    showToast("Product added to cart", "success");
  };

  const handleBuyNow = () => {
    if (!isAvailableAtLocation) {
      alert("This product is not available for delivery at your location.");
      return;
    }
    if (!isVariantAvailable && variantStock !== 0) {
      alert("This variant is currently out of stock.");
      return;
    }
    const productWithVariant = {
      ...product,
      price: variantPrice,
      mrp: variantMrp,
      pack: variantTitle,
      selectedVariant: selectedVariant,
      variantId: getVariantId(selectedVariant),
      variantTitle: variantTitle,
    };
    if (inCartQty === 0) {
      addToCart(productWithVariant);
    }
    navigate('/checkout');
  };

  const formatDeliveryTime = (raw: unknown, fallback: string) => {
    const text = raw === undefined || raw === null ? "" : String(raw).trim();
    if (!text) return fallback;
    if (/^\d+(\.\d+)?$/.test(text)) return `${text} MINS`;
    return text;
  };

  return (
    <div className="min-h-screen bg-neutral-50/50 pb-24 lg:pb-12 font-sans">
      {/* Mobile Top Header (hidden on desktop) */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm lg:hidden">
        <div className="flex items-center justify-between px-4 py-3 gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 transition-colors"
            aria-label="Go back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="flex-1 min-w-0" onClick={() => navigate('/search')}>
            <div className="relative">
              <div className="w-full h-10 pl-10 pr-4 rounded-full bg-neutral-100 flex items-center text-sm text-neutral-500 cursor-pointer overflow-hidden">
                <div className="relative h-4 w-full overflow-hidden">
                  {searchSuggestions.map((suggestion, index) => {
                    const isActive = index === currentSearchIndex;
                    const prevIndex = (currentSearchIndex - 1 + searchSuggestions.length) % searchSuggestions.length;
                    const isPrev = index === prevIndex;
                    return (
                      <div
                        key={suggestion}
                        className={`absolute inset-0 flex items-center transition-all duration-500 ${isActive ? 'translate-y-0 opacity-100' : isPrev ? '-translate-y-full opacity-0' : 'translate-y-full opacity-0'}`}
                      >
                        <span className="text-xs text-neutral-500">Search &apos;{suggestion}&apos;</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {product?.id && (
              <WishlistButton
                productId={product.id}
                size="md"
                position="relative"
                className="!bg-transparent !shadow-none !rounded-full text-neutral-600 hover:bg-neutral-100 p-2"
              />
            )}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="pt-16 lg:pt-4 max-w-7xl mx-auto px-4 md:px-6">
        {/* Back Button - Desktop Only */}
        <div className="hidden lg:flex items-center mb-3 mt-1">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg md:rounded-xl text-sm font-bold text-[#0c5236] bg-[#eef6f3] border border-[#0c5236] hover:bg-[#e2f0eb] transition-all shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#0c5236]">
              <path d="M19 12H5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="tracking-wide">Back</span>
          </button>
        </div>

        {/* Location Availability Banner */}
        {!isAvailableAtLocation && (
          <div className="bg-[var(--customer-primary-alpha-10)] border-l-4 border-[var(--customer-primary)] px-4 py-3 mb-6 rounded-r-lg">
            <div className="flex items-start gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#f59e0b" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--customer-primary-dark)]">Not available at your location</p>
                <p className="text-xs text-[var(--customer-primary-dark)] mt-1">This product cannot be delivered to your current location. You can browse but cannot add to cart.</p>
              </div>
            </div>
          </div>
        )}

        {/* 3-Column Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">

          {/* COLUMN 1: Image Gallery (md:col-span-5) */}
          <div className="md:col-span-5 flex flex-col justify-between h-full">
            {/* Gallery Wrapper */}
            <div className="flex flex-col md:flex-row-reverse gap-4">

              {/* Main Image Container */}
              <div className="w-full flex-1 aspect-square bg-white border border-neutral-200 rounded-2xl flex items-center justify-center p-2 md:p-6 relative group overflow-hidden shadow-sm">

                {/* Mobile carousel */}
                <div
                  className="absolute inset-0 flex transition-transform duration-300 ease-out md:hidden overflow-hidden"
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  style={{
                    transform: `translateX(-${selectedImageIndex * 100}%)`,
                    touchAction: allMedia.length > 1 ? 'pan-x' : 'pan-y pinch-zoom',
                  }}
                >
                  {allMedia.map((item, index: number) => (
                    <div key={index} className="w-full h-full flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ minWidth: '100%', width: '100%' }}>
                      {item.type === "video" ? (
                        <video src={item.url} controls className="w-full h-full object-cover" playsInline />
                      ) : item.url ? (
                        <img src={item.url} alt={`${product.name} - Media ${index + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-400 text-6xl font-bold">
                          {(product.name || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop static main image/video */}
                <div className="hidden md:flex w-full h-full items-center justify-center">
                  {currentMedia ? (
                    currentMedia.type === "video" ? (
                      <video src={currentMedia.url} controls className="max-w-full max-h-full object-contain rounded-xl" playsInline />
                    ) : (
                      <img src={currentMedia.url} alt={product.name} className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-105" referrerPolicy="no-referrer" />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400 text-6xl font-bold">
                      {(product.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Left/Right carousel navigation arrows (Desktop only) */}
                {allMedia.length > 1 && (
                  <>
                    {selectedImageIndex > 0 && (
                      <button
                        onClick={() => setSelectedImageIndex(selectedImageIndex - 1)}
                        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full items-center justify-center shadow hover:bg-white transition-colors z-10"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                      </button>
                    )}
                    {selectedImageIndex < allMedia.length - 1 && (
                      <button
                        onClick={() => setSelectedImageIndex(selectedImageIndex + 1)}
                        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full items-center justify-center shadow hover:bg-white transition-colors z-10"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                      </button>
                    )}
                  </>
                )}

                {/* Mobile indicators */}
                {allMedia.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 md:hidden">
                    {allMedia.map((_, index) => (
                      <div key={index} className={`w-1.5 h-1.5 rounded-full transition-all ${index === selectedImageIndex ? "bg-neutral-800 w-3.5" : "bg-neutral-300"}`} />
                    ))}
                  </div>
                )}
              </div>

              {/* Thumbnail Strip (vertical on desktop, horizontal on mobile) */}
              {allMedia.length > 1 && (
                <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto scrollbar-hide pb-2 md:pb-0 md:max-h-[500px] w-full md:w-20 flex-shrink-0 justify-center md:justify-start">
                  {allMedia.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden border-2 bg-white flex-shrink-0 flex items-center justify-center p-1 transition-all ${
                        index === selectedImageIndex ? 'border-[var(--customer-primary-dark)] ring-2 ring-green-100' : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      {item.type === "video" ? (
                        <div className="relative w-full h-full flex items-center justify-center bg-black rounded-lg">
                          <video src={item.url} className="w-full h-full object-cover opacity-60" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <svg className="w-6.5 h-6.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <img src={item.url} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>


          </div>

          {/* COLUMN 2: Details & Specification Sheet (md:col-span-4) */}
          <div className="md:col-span-4 space-y-6 flex flex-col justify-between h-full">

            {/* Header info */}
            <div>
              <div className="flex items-center gap-1.5 text-sm md:text-base text-[var(--customer-primary-dark)] font-semibold mb-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                <span>{formatDeliveryTime((product as any)?.deliveryTime, "17 MINS")} DELIVERY</span>
              </div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-neutral-900 tracking-tight leading-tight mb-2">
                {product.name}
              </h1>
              {product.brand && (
                <p className="text-base text-neutral-500">
                  Brand: <span className="font-semibold text-neutral-800">{typeof product.brand === 'object' ? product.brand.name : product.brand}</span>
                </p>
              )}
            </div>

            {/* Variations Card list */}
            {hasVariations && (
              <div>
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-2">Select Pack Size</h3>
                <div className="flex flex-wrap gap-2">
                  {variantCardOptions.map((variantOption) => {
                    const isSelected = variantOption.index === effectiveVariantIndex;
                    const priceParts = formatVariantPriceParts(variantOption.displayPrice);
                    return (
                      <button
                        key={variantOption.key}
                        onClick={() => {
                          setSelectedVariantIndex(variantOption.index);
                          setSelectedImageIndex(0);
                        }}
                        disabled={variantOption.isOutOfStock}
                        className={`flex-shrink-0 w-28 rounded-xl border bg-white p-2.5 text-left transition-all ${
                          isSelected ? "border-[var(--customer-primary-dark)] ring-2 ring-green-100 shadow-sm" : "border-neutral-200 hover:border-neutral-300"
                        } ${variantOption.isOutOfStock ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <p className="text-xs font-bold text-neutral-900 truncate mb-1">{variantOption.title}</p>
                        {!product.isEnquiryOnly && (
                          <div className="leading-none mb-1">
                            <span className="text-[10px] text-neutral-900">₹</span>
                            <span className="text-base font-bold text-neutral-900">{priceParts.whole}</span>
                            <span className="text-[9px] align-super text-neutral-700">{priceParts.fraction}</span>
                          </div>
                        )}
                        <p className={`text-[10px] font-semibold ${variantOption.inStock ? "text-green-600" : "text-red-500"}`}>
                          {variantOption.inStock ? "In stock" : "Out of stock"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mobile-only Pricing block (hidden on desktop) */}
            <div className="lg:hidden bg-neutral-50 rounded-xl p-4 border border-neutral-100">
              {product.isEnquiryOnly ? (
                <span className="text-lg font-bold text-neutral-600 bg-neutral-100 px-3 py-1 rounded-full inline-block">Price on Enquiry</span>
              ) : (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-neutral-900">₹{variantPrice.toLocaleString('en-IN')}</span>
                  </div>
                  {hasDiscount && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-base text-neutral-400 line-through">MRP ₹{variantMrp.toLocaleString('en-IN')}</span>
                      <Badge className="!bg-[var(--customer-primary)] !text-white text-sm px-2 py-0.5 rounded-full font-semibold">{discount}% OFFER</Badge>
                    </div>
                  )}
                  {product.taxPreference === "excluded" ? (
                    <p className="text-sm text-neutral-500 mt-1.5">Exclusive of all taxes</p>
                  ) : product.taxPreference === "hidden" ? null : (
                    <p className="text-sm text-neutral-500 mt-1.5">Inclusive of all taxes</p>
                  )}
                </>
              )}
            </div>

            {/* Collapsible Accordion Sections */}
            <div className="space-y-2">
              {/* Section 1: Product Description */}
              <div className="bg-white rounded-xl border border-neutral-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setIsDescOpen(!isDescOpen)}
                  className="w-full flex items-center justify-between py-2 px-3 text-left font-bold text-neutral-800 text-xs md:text-sm tracking-wider"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isDescOpen ? 'bg-green-50 text-green-600' : 'bg-neutral-50 text-neutral-500'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-[11px] md:text-xs font-bold text-neutral-700 tracking-wider">PRODUCT DESCRIPTION</span>
                  </div>
                  <svg className={`w-3.5 h-3.5 transition-transform ${isDescOpen ? 'rotate-180 text-green-600' : 'text-neutral-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isDescOpen && (
                  <div className="px-3 pb-3 pt-0.5 border-t border-neutral-50">
                    {product.description ? (
                      <p className="text-neutral-600 leading-relaxed text-xs whitespace-pre-line">
                        {product.description}
                      </p>
                    ) : (
                      <p className="text-neutral-600 leading-relaxed text-xs">
                        This premium quality {product.name || 'product'} is selected carefully to ensure freshness and high nutritional value. Sourced from certified suppliers and packed under strict hygiene conditions, it provides natural taste and essential nutrients for a healthy lifestyle. Store in a cool, dry place to maintain shelf-life.
                      </p>
                    )}
                    {product.tags && product.tags.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {product.tags.map((tag: string, index: number) => (
                          <span key={index} className="bg-neutral-100 text-neutral-800 text-[9px] md:text-[10px] px-2 py-0.5 rounded font-semibold">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 2: Product Details */}
              <div className="bg-white rounded-xl border border-neutral-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                  className="w-full flex items-center justify-between py-2 px-3 text-left font-bold text-neutral-800 text-xs md:text-sm tracking-wider"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isDetailsOpen ? 'bg-green-50 text-green-600' : 'bg-neutral-50 text-neutral-500'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <span className="text-[11px] md:text-xs font-bold text-neutral-700 tracking-wider">PRODUCT DETAILS</span>
                  </div>
                  <svg className={`w-3.5 h-3.5 transition-transform ${isDetailsOpen ? 'rotate-180 text-green-600' : 'text-neutral-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isDetailsOpen && (
                  <div className="px-3 pb-3 pt-2 border-t border-neutral-50">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Shelf Life */}
                      <div className="bg-neutral-50 border border-neutral-100 py-1.5 px-2.5 rounded-lg">
                        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">Shelf Life</p>
                        <p className="text-xs font-bold text-neutral-800">{product.shelfLife || "7 Days"}</p>
                      </div>

                      {/* Country of Origin */}
                      <div className="bg-neutral-50 border border-neutral-100 py-1.5 px-2.5 rounded-lg">
                        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">Country of Origin</p>
                        <p className="text-xs font-bold text-neutral-800">{product.madeIn || "India"}</p>
                      </div>

                      {/* FSSAI */}
                      <div className="bg-neutral-50 border border-neutral-100 py-1.5 px-2.5 rounded-lg">
                        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">FSSAI License</p>
                        <p className="text-xs font-bold text-neutral-800 font-mono">{product.fssaiLicNo || "1001234567890"}</p>
                      </div>

                      {/* Customer Care / Marketer */}
                      <div className="bg-neutral-50 border border-neutral-100 py-1.5 px-2.5 rounded-lg">
                        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">Customer Care</p>
                        <p className="text-xs font-bold text-neutral-800 truncate" title={product.marketer || "care@unnatimegamart.com"}>
                          {product.marketer || "care@unnatimegamart.com"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Customer Reviews */}
              <div className="bg-white rounded-xl border border-neutral-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setIsReviewsOpen(!isReviewsOpen)}
                  className="w-full flex items-center justify-between py-2 px-3 text-left font-bold text-neutral-800 text-xs md:text-sm tracking-wider"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isReviewsOpen ? 'bg-green-50 text-green-600' : 'bg-neutral-50 text-neutral-500'}`}>
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </div>
                    <span className="text-[11px] md:text-xs font-bold text-neutral-700 tracking-wider">CUSTOMER REVIEWS {reviews.length > 0 ? `(${reviews.length})` : ''}</span>
                  </div>
                  <svg className={`w-3.5 h-3.5 transition-transform ${isReviewsOpen ? 'rotate-180 text-green-600' : 'text-neutral-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isReviewsOpen && (
                  <div className="px-3 pb-3 pt-2 border-t border-neutral-50">
                    {reviews.length > 0 && (
                      <div className="mb-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded font-semibold">
                          ★ {(() => {
                            const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
                            return (sum / reviews.length).toFixed(1);
                          })()}
                        </span>
                      </div>
                    )}
                    {reviews.length > 0 ? (
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {reviews.map((review) => (
                          <div key={review._id} className="border-b border-neutral-50 pb-2 last:border-0">
                            <div className="flex items-center justify-between mb-0.5 text-xs">
                              <span className="font-semibold text-neutral-850">{review.customer?.name || "Customer"}</span>
                              <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1 py-0.2 rounded">★ {review.rating}</span>
                            </div>
                            <p className="text-xs text-neutral-600">{review.comment}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-400 text-center py-2">No reviews yet.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Service Guarantees */}
            <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
              <div className="grid grid-cols-3 gap-2 py-3 text-center bg-neutral-50 rounded-xl">
                <div className="flex flex-col items-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-neutral-500 mb-1"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3M20.49 15a9 9 0 0 1-14.85 3" /></svg><span className="text-xs font-bold text-neutral-950">48 Hours</span><span className="text-[10px] font-medium text-neutral-500">Replacement</span></div>
                <div className="flex flex-col items-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-neutral-500 mb-1"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM13 8H7M17 12H7" /></svg><span className="text-xs font-bold text-neutral-950">24/7 Support</span><span className="text-[10px] font-medium text-neutral-500">Helpdesk</span></div>
                <div className="flex flex-col items-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" className="text-neutral-500 mb-1"><rect x="1" y="3" width="15" height="13" rx="2" ry="2" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg><span className="text-xs font-bold text-neutral-950">Super Fast</span><span className="text-[10px] font-medium text-neutral-500">Delivery</span></div>
              </div>
            </div>



          </div>

          {/* COLUMN 3: Desktop Sticky Buy Box (md:col-span-3, hidden on mobile) */}
          <div className="hidden md:block md:col-span-3 sticky top-24 h-full">
            <div className="flex flex-col justify-between bg-white border border-neutral-200 rounded-2xl p-6 shadow-md h-full">
            
            {/* Top Info Group */}
            <div className="space-y-4">
              {/* Price block */}
              <div>
                {product.isEnquiryOnly ? (
                  <div className="bg-neutral-50 rounded-xl px-4 py-3 border border-neutral-100 mb-1">
                    <span className="text-xl font-bold text-neutral-600">Price on Enquiry</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black text-neutral-900">₹{variantPrice.toLocaleString('en-IN')}</span>
                    </div>
                    {hasDiscount && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-neutral-400 line-through">MRP ₹{variantMrp.toLocaleString('en-IN')}</span>
                        <Badge className="!bg-[var(--customer-primary)] !text-white text-xs px-2 py-0.5 rounded-full font-semibold">{discount}% OFFER</Badge>
                      </div>
                    )}
                    {product.taxPreference === "excluded" ? (
                      <p className="text-xs text-neutral-500 mt-1.5">Exclusive of all taxes</p>
                    ) : product.taxPreference === "hidden" ? null : (
                      <p className="text-xs text-neutral-500 mt-1.5">Inclusive of all taxes</p>
                    )}
                  </>
                )}
              </div>

              {/* Delivery address info */}
              <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2.5 text-sm">
                <div className="flex items-center gap-2 text-neutral-800">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  <span className="font-bold truncate">Deliver to: {location?.address || "Indore"}</span>
                </div>
                <p className="text-neutral-500 leading-normal text-xs md:text-sm">Fastest delivery by today evening within 17-30 minutes.</p>
              </div>

              {/* Stock indicator */}
              <div>
                {variantStock !== undefined && variantStock !== null && (
                  <p className={`text-base font-bold ${isVariantAvailable ? 'text-green-600' : 'text-red-500'}`}>
                    {isVariantAvailable ? '✓ In Stock' : '✗ Out of Stock'}
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Actions Group */}
            <div className="space-y-3">
              {/* Buy Box Action Buttons */}
              <div>
                {product.isEnquiryOnly ? (
                  <button
                    onClick={() => setIsEnquiryModalOpen(true)}
                    className="w-full h-11 bg-[var(--customer-primary-dark)] text-white hover:bg-[var(--customer-primary-darker)] font-bold rounded-xl transition-all flex items-center justify-center text-sm shadow-md cursor-pointer"
                  >
                    Enquiry Now
                  </button>
                ) : (
                  <AnimatePresence mode="wait">
                    {inCartQty === 0 ? (
                      <button
                        ref={addButtonRef}
                        onClick={handleAddToCart}
                        disabled={!isAvailableAtLocation || (!isVariantAvailable && variantStock !== 0)}
                        className="w-full h-11 bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-dark)] text-white font-bold rounded-xl transition-all flex items-center justify-center text-sm shadow-sm"
                      >
                        {!isAvailableAtLocation ? "Unavailable" : !isVariantAvailable && variantStock !== 0 ? "Out of Stock" : "Add to Cart"}
                      </button>
                    ) : (
                      <div className="flex items-center justify-between border border-neutral-200 rounded-xl px-2 py-1.5 h-12 bg-neutral-50 shadow-sm">
                        <button
                          onClick={() => {
                            const productId = product.id || product._id;
                            const variantId = selectedVariant?._id;
                            updateQuantity(productId, inCartQty - 1, variantId, variantTitle);
                          }}
                          className="w-9 h-9 p-0 bg-white hover:bg-[var(--customer-primary)] hover:text-white rounded-full shadow-md text-[var(--customer-primary-dark)] border border-neutral-200 transition-all duration-200 active:scale-90 flex-shrink-0 flex items-center justify-center"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                        </button>
                        <input
                          type="number"
                          value={detailQty === 0 ? '' : detailQty}
                          onChange={(e) => handleDetailQtyChange(e.target.value)}
                          onBlur={() => handleDetailQtyBlurOrSubmit(detailQty)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleDetailQtyBlurOrSubmit(detailQty);
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-14 h-9 text-center font-bold text-base bg-transparent text-neutral-800 border-0 outline-none focus:outline-none focus:ring-0 focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
                          title="Click to type quantity manually (e.g. 50)"
                        />


                        <button
                          onClick={() => {
                            if (variantStock > 0 && inCartQty >= variantStock) {
                              showToast(`Only ${variantStock} items available in stock.`, "error");
                              return;
                            }
                            const productId = product.id || product._id;
                            const variantId = selectedVariant?._id;
                            updateQuantity(productId, inCartQty + 1, variantId, variantTitle);
                          }}
                          className="w-9 h-9 p-0 bg-white hover:bg-[var(--customer-primary)] hover:text-white rounded-full shadow-md text-[var(--customer-primary-dark)] border border-neutral-200 transition-all duration-200 active:scale-90 flex-shrink-0 flex items-center justify-center"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                        </button>
                      </div>
                    )}
                  </AnimatePresence>
                )}
              </div>

              {/* Wishlist Action */}
              {product?.id && (
                <div className="flex justify-center border-t border-neutral-100 pt-3">
                  <WishlistButton
                    productId={product.id}
                    size="md"
                    position="relative"
                    className="!bg-transparent !shadow-none !rounded-xl text-neutral-600 hover:bg-neutral-55 px-4 py-2 border border-neutral-200 w-full flex items-center justify-center gap-1.5 text-sm font-semibold"
                  />
                </div>
              )}
            </div>

          </div>
        </div>
      </div>


      {/* Explore Brand Section */}
      {product?.brand && (
        <div className="mt-12 py-6 flex justify-center">
          <div
            onClick={() => {
              const brandId = typeof product.brand === 'object' ? (product.brand._id || product.brand.id) : product.brand;
              navigate(`/brand/${brandId}`);
            }}
            className="cursor-pointer flex items-center gap-3 bg-neutral-50 hover:bg-neutral-100 px-6 py-3 rounded-2xl border border-neutral-200 transition-all"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Explore more from</span>
            <span className="text-sm font-black uppercase text-[var(--customer-primary-dark)]">{typeof product.brand === 'object' ? product.brand.name : 'this brand'}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </div>
        </div>
      )}

      {/* Recommended Products Section */}
      {visibleSimilarProducts.length > 0 && (
        <div className="mt-12 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-neutral-900 font-sans tracking-tight">
              Recommended Products
            </h2>
            {hasMoreSimilar && (
              <button
                onClick={handleLoadMoreSimilar}
                disabled={isSimilarLoading}
                className="text-sm font-bold text-[var(--customer-primary-dark)] hover:text-[var(--customer-primary-darker)] transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {isSimilarLoading ? "Loading..." : (
                  <>
                    Show More
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {visibleSimilarProducts.map((simProduct) => (
              <ProductCard
                key={simProduct._id || simProduct.id}
                product={simProduct}
                showStockInfo={true}
                showVegetarianIcon={false}
                showRating={true}
                categoryStyle={true}
              />
            ))}
          </div>
        </div>
      )}

      </div>

      {/* Sticky Bottom Footer - Mobile Only (hidden on desktop) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-200 shadow-lg md:hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs text-neutral-500 truncate">{variantTitle}</p>
            {product.isEnquiryOnly ? (
              <span className="text-sm font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full">Price on Enquiry</span>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black text-neutral-900">₹{variantPrice.toLocaleString('en-IN')}</span>
                {hasDiscount && <span className="text-xs text-neutral-400 line-through">₹{variantMrp.toLocaleString('en-IN')}</span>}
              </div>
            )}
          </div>

          <div className="ml-3 flex items-center">
            {product.isEnquiryOnly ? (
              <button
                onClick={() => setIsEnquiryModalOpen(true)}
                className="px-6 py-2.5 bg-[var(--customer-primary-dark)] text-white font-bold rounded-xl text-sm shadow-md cursor-pointer"
              >
                Enquiry Now
              </button>
            ) : (
              <AnimatePresence mode="wait">
                {inCartQty === 0 ? (
                  <button
                    onClick={handleAddToCart}
                    disabled={!isAvailableAtLocation || (!isVariantAvailable && variantStock !== 0)}
                    className="px-6 py-2.5 bg-[var(--customer-primary-dark)] text-white font-bold rounded-xl text-sm shadow-sm"
                  >
                    {!isAvailableAtLocation ? "Unavailable" : !isVariantAvailable && variantStock !== 0 ? "Out of Stock" : "Add to Cart"}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 bg-white border-2 border-[var(--customer-primary-dark)] rounded-xl px-2 py-1 h-[38px]">
                    <button
                      onClick={() => {
                        const productId = product.id || product._id;
                        const variantId = selectedVariant?._id;
                        updateQuantity(productId, inCartQty - 1, variantId, variantTitle);
                      }}
                      className="w-6 h-6 flex items-center justify-center text-[var(--customer-primary-dark)] font-bold rounded-full border border-[var(--customer-primary-dark)]"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={detailQty === 0 ? '' : detailQty}
                      onChange={(e) => handleDetailQtyChange(e.target.value)}
                      onBlur={() => handleDetailQtyBlurOrSubmit(detailQty)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleDetailQtyBlurOrSubmit(detailQty);
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="w-10 h-6 text-center font-bold text-xs bg-transparent text-[var(--customer-primary-dark)] border-0 outline-none focus:outline-none focus:ring-0 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
                    />

                    <button
                      onClick={() => {
                        if (variantStock > 0 && inCartQty >= variantStock) {
                          showToast(`Only ${variantStock} items available in stock.`, "error");
                          return;
                        }
                        const productId = product.id || product._id;
                        const variantId = selectedVariant?._id;
                        updateQuantity(productId, inCartQty + 1, variantId, variantTitle);
                      }}
                      className="w-6 h-6 flex items-center justify-center text-[var(--customer-primary-dark)] font-bold rounded-full border border-[var(--customer-primary-dark)]"
                    >
                      +
                    </button>
                  </div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* Enquiry Modal */}
      {product && (
        <EnquiryModal
          isOpen={isEnquiryModalOpen}
          onClose={() => setIsEnquiryModalOpen(false)}
          productId={product.id || product._id}
          productName={product.name || product.productName || ""}
          initialName={user?.name || ""}
          initialPhone={user?.phone || ""}
          initialEmail={user?.email || ""}
        />
      )}
    </div>
  );
}
