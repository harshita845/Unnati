import { motion, useAnimationControls } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useRef, useEffect, useState } from 'react';
import { Product } from '../../../types/domain';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { useLocation } from '../../../hooks/useLocation';
import { useToast } from '../../../context/ToastContext'; // Import useToast
import { addToWishlist, removeFromWishlist, getWishlist } from '../../../services/api/customerWishlistService';
import Button from '../../../components/ui/button';
import Badge from '../../../components/ui/badge';
import StarRating from '../../../components/ui/StarRating';
import { calculateCardPrice, getApplicableUnitPrice } from '../../../utils/priceUtils';
import {
  buildProductWithPrimaryVariant,
  findCartItemForPrimaryVariant,
  getPrimaryVariant,
  getProductCardImage,
  getVariantId,
  getVariantLabel,
  getVariants,
  hasRealVariants,
} from '../../../utils/customerVariantUtils';
import { useThemeContext } from '../../../context/ThemeContext';

interface ProductCardProps {
  product: Product;
  showBadge?: boolean;
  badgeText?: string;
  showPackBadge?: boolean;
  showStockInfo?: boolean;
  showHeartIcon?: boolean;
  showRating?: boolean;
  showVegetarianIcon?: boolean;
  showOptionsText?: boolean;
  optionsCount?: number;
  compact?: boolean;
  categoryStyle?: boolean;
}

export default function ProductCard({
  product,
  showBadge = false,
  badgeText,
  showPackBadge = false,
  showStockInfo = false,
  showHeartIcon = false,
  showRating = false,
  showVegetarianIcon = false,
  showOptionsText = false,
  optionsCount = 2,
  compact = false,
  categoryStyle = false,
}: ProductCardProps) {
  const navigate = useNavigate();
  const { cart, addToCart, updateQuantity } = useCart();
  const { isAuthenticated } = useAuth();
  const { location } = useLocation();
  const { showToast } = useToast(); // Get toast function
  const imageRef = useRef<HTMLImageElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [isWishlisted, setIsWishlisted] = useState(false);
  // Single ref to track any cart operation in progress for this product
  const isOperationPendingRef = useRef(false);

  useEffect(() => {
    if (!showHeartIcon) return;
    // Only check wishlist if user is authenticated
    if (!isAuthenticated) {
      setIsWishlisted(false);
      return;
    }

    const checkWishlist = async () => {
      try {
        const res = await getWishlist({
          latitude: location?.latitude,
          longitude: location?.longitude
        });
        if (res.success && res.data && res.data.products) {
          const targetId = String((product as any).id || product._id);
          const exists = res.data.products.some(p => String(p._id || (p as any).id) === targetId);
          setIsWishlisted(exists);
        }
      } catch (e) {
        // Silently fail if not logged in
        setIsWishlisted(false);
      }
    };
    checkWishlist();
  }, [product.id, product._id, isAuthenticated, location?.latitude, location?.longitude, showHeartIcon]);

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const targetId = String((product as any).id || product._id);
    const previousState = isWishlisted;

    try {
      if (isWishlisted) {
        // Optimistic update
        setIsWishlisted(false);
        await removeFromWishlist(targetId);
        showToast('Removed from wishlist');
      } else {
        if (!location?.latitude || !location?.longitude) {
           showToast('Location is required to add items to wishlist', 'error');
           return;
        }
        // Optimistic update
        setIsWishlisted(true);
        await addToWishlist(
          targetId,
          location?.latitude,
          location?.longitude
        );
        showToast('Added to wishlist');
      }
    } catch (e: any) {
      console.error('Failed to toggle wishlist:', e);
      setIsWishlisted(previousState);
      const errorMessage = e.response?.data?.message || e.message || 'Failed to update wishlist';
      showToast(errorMessage, 'error');
    }
  };

  const primaryVariant = getPrimaryVariant(product);
  const primaryVariantId = getVariantId(primaryVariant);
  const primaryVariantLabel = getVariantLabel(primaryVariant) || product.pack;
  const variantCount = getVariants(product).length;
  const cardImageUrl = getProductCardImage(product);

  const cartItem = findCartItemForPrimaryVariant(cart.items, product);
  const inCartQty = cartItem?.quantity || 0;

  const [localQty, setLocalQty] = useState<string | number>(inCartQty);

  // Picture fades in once loaded (shimmer until then)
  const [imgLoaded, setImgLoaded] = useState(false);
  useEffect(() => {
    if (imageRef.current?.complete) setImgLoaded(true);
  }, []);

  // The quantity number gives a small pop each time it changes
  const qtyControls = useAnimationControls();
  const prevQtyRef = useRef(inCartQty);
  useEffect(() => {
    if (prevQtyRef.current > 0 && inCartQty > 0 && prevQtyRef.current !== inCartQty) {
      qtyControls.start({ scale: [1, 1.22, 1], transition: { duration: 0.28 } });
    }
    prevQtyRef.current = inCartQty;
  }, [inCartQty, qtyControls]);
  useEffect(() => {
    setLocalQty(inCartQty);
  }, [inCartQty]);

  const handleQuantityInputChange = async (val: string) => {
    if (val === '' || val === '0') {
      setLocalQty('');
      await updateQuantity(
        ((product as any).id || product._id) as string,
        0,
        primaryVariantId,
        primaryVariantLabel
      );
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      setLocalQty(num);
      await updateQuantity(
        ((product as any).id || product._id) as string,
        num,
        primaryVariantId,
        primaryVariantLabel
      );
    }
  };

  const handleQuantityInputBlurOrSubmit = async (val: string | number) => {
    const num = val === '' ? 0 : typeof val === 'string' ? parseInt(val, 10) : val;
    const targetQty = isNaN(num) || num < 0 ? 0 : num;

    if (targetQty === inCartQty) {
      setLocalQty(inCartQty);
      return;
    }

    await updateQuantity(
      ((product as any).id || product._id) as string,
      targetQty,
      primaryVariantId,
      primaryVariantLabel
    );
  };

  // Get Price and MRP using primary variant (first created) with legacy fallbacks
  const { displayPrice, mrp, discount } = calculateCardPrice(product);

  // Get real tiered pricing from root or first variation, ignoring zero-priced default tiers
  const tieredPrices = (((product as any).unitPricing && (product as any).unitPricing.length > 0)
      ? (product as any).unitPricing
      : (primaryVariant?.tieredPrices || [])
  ).filter((t: any) => t && Number(t.price) > 0);

  const variationSelector = hasRealVariants(product) ? 0 : undefined;
  // Calculate dynamic unit price based on cart quantity
  const currentUnitPrice = getApplicableUnitPrice(product, variationSelector, Math.max(1, inCartQty));

  const deliveryTimeText = (() => {
    const raw = (product as any)?.deliveryTime;
    const text = raw === undefined || raw === null ? '' : String(raw).trim();
    if (!text) return '14 MINS';
    if (/^\d+(\.\d+)?$/.test(text)) return `${text} MINS`;
    return text;
  })();

  const handleCardClick = () => {
    const mainElement = document.querySelector('main');
    const currentHistoryState = window.history.state || {};
    const existingUserState = currentHistoryState.usr || {};
    const pageKey = `${window.location.pathname}${window.location.search}`;

    window.history.replaceState(
      {
        ...currentHistoryState,
        usr: {
          ...existingUserState,
          scrollRestore: {
            source: 'product-card',
            pageKey,
            productId: (product as any).id || product._id,
            mainTop: mainElement instanceof HTMLElement ? mainElement.scrollTop : 0,
            windowTop: window.scrollY || window.pageYOffset || 0,
            preferredTarget:
              (window.scrollY || window.pageYOffset || 0) >
              (mainElement instanceof HTMLElement ? mainElement.scrollTop : 0)
                ? 'window'
                : 'main',
          },
        },
      },
      '',
      window.location.href
    );

    navigate(`/product/${((product as any).id || product._id) as string}`);
  };

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Check if product is available in user's location
    if (product.isAvailable === false) {
      return;
    }

    // Prevent any operation while another is in progress
    if (isOperationPendingRef.current) {
      return;
    }

    isOperationPendingRef.current = true;

    try {
      await addToCart(buildProductWithPrimaryVariant(product), addButtonRef.current);
    } finally {
      // Reset the flag after the operation truly completes
      isOperationPendingRef.current = false;
    }
  };

  const handleDecrease = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Prevent any operation while another is in progress
    if (isOperationPendingRef.current || inCartQty <= 0) {
      return;
    }

    isOperationPendingRef.current = true;

    try {
      await updateQuantity(
        ((product as any).id || product._id) as string,
        inCartQty - 1,
        primaryVariantId,
        primaryVariantLabel
      );
    } finally {
      // Reset the flag after the operation truly completes
      isOperationPendingRef.current = false;
    }
  };

  const handleIncrease = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Check if product is available in user's location
    if (product.isAvailable === false) {
      return;
    }

    // Prevent any operation while another is in progress
    if (isOperationPendingRef.current) {
      return;
    }

    isOperationPendingRef.current = true;

    try {
      if (inCartQty > 0) {
        await updateQuantity(
          ((product as any).id || product._id) as string,
          inCartQty + 1,
          primaryVariantId,
          primaryVariantLabel
        );
      } else {
        await addToCart(buildProductWithPrimaryVariant(product), addButtonRef.current);
      }
    } finally {
      // Reset the flag after the operation truly completes
      isOperationPendingRef.current = false;
    }
  };

  const { currentTheme: theme, currentCategory } = useThemeContext();

  return (
    <motion.div
      id={`product-${(product as any).id || product._id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className={`h-full ${categoryStyle ? '' : 'bg-white'} rounded-2xl shadow-[0_4px_16px_rgba(35,107,52,0.06)] overflow-hidden flex flex-col relative border border-[var(--brand-border,#E9E2D3)] hover:shadow-[0_8px_24px_rgba(35,107,52,0.12)] transition-all`}
      style={{ backgroundColor: '#ffffff' }}
    >
      <div
        onClick={handleCardClick}
        className="cursor-pointer flex-1 flex flex-col"
      >
        <div className={`w-full ${compact ? 'h-32 md:h-56' : categoryStyle ? 'h-36 md:h-64' : 'h-40 md:h-80'} bg-neutral-100 flex items-center justify-center overflow-hidden relative ${cardImageUrl && !imgLoaded ? 'skeleton-shimmer' : ''}`}>
          {cardImageUrl ? (
            <img
              ref={imageRef}
              src={cardImageUrl}
              alt={product.name || product.productName || 'Product'}
              className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              referrerPolicy="no-referrer"
              onLoad={() => setImgLoaded(true)}
              onError={(e) => {
                setImgLoaded(true);
                // Hide broken image and show fallback
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.fallback-icon')) {
                  const fallback = document.createElement('div');
                  fallback.className = 'w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl fallback-icon';
                  fallback.textContent = (product.name || product.productName || '?').charAt(0).toUpperCase();
                  parent.appendChild(fallback);
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl">
              {(product.name || product.productName || '?').charAt(0).toUpperCase()}
            </div>
          )}

          {categoryStyle && showBadge && discount > 0 && (
            <div
                className="absolute top-0 left-0 z-10 text-white text-[10px] md:text-sm font-bold px-2 py-0.5 md:px-4 md:py-2 rounded-br-xl flex items-center gap-1 shadow-sm transition-transform hover:scale-105"
                style={{ background: 'var(--gradient-signature, linear-gradient(135deg, #FFB020 0%, #F97316 60%, #E8590C 100%))' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
              <span>{discount}% OFFER</span>
            </div>
          )}

          {!categoryStyle && showBadge && (badgeText || discount > 0) && (
            <div
              className="absolute top-0 left-0 z-10 text-white text-[10px] md:text-sm px-2 py-0.5 md:px-4 md:py-2 font-bold rounded-br-xl shadow-md flex items-center gap-1"
              style={{ background: 'var(--gradient-signature, linear-gradient(135deg, #FFB020 0%, #F97316 60%, #E8590C 100%))' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
              <span>{badgeText || `${discount}% OFFER`}</span>
            </div>
          )}

          {showPackBadge && (
            <Badge
              variant="outline"
              className="absolute top-2 right-2 z-10 text-xs px-2 py-1 font-medium"
            >
              {primaryVariantLabel || product.pack}
            </Badge>
          )}

          {showHeartIcon && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleWishlist(e);
              }}
              className="absolute top-2 right-2 z-30 w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-all shadow-md group/heart"
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill={isWishlisted ? "var(--customer-primary)" : "none"}
                xmlns="http://www.w3.org/2000/svg"
                className={`transition-colors ${isWishlisted ? "text-[var(--customer-primary)]" : "text-neutral-400 group-hover/heart:text-red-400"}`}
              >
                <path
                  d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}

          {variantCount >= 2 && (
            <div className="absolute bottom-2 left-2 z-10">
              <span className="text-[10px] font-bold text-neutral-700 bg-white/95 backdrop-blur-sm px-2 py-1 rounded shadow-sm border border-neutral-200">
                {variantCount} Options
              </span>
            </div>
          )}
        </div>

        <div className={`${compact ? 'p-2 md:p-4' : categoryStyle ? 'px-2 pt-1 pb-2 md:px-3 md:pt-2 md:pb-3.5' : 'p-2 md:p-5'} flex-1 flex flex-col`}>
          {categoryStyle ? (
            // Category Style Layout: Quantity, Name, Time, % offer, Price
            <>
              {/* 1. Quantity */}
              {!showPackBadge && (product.pack || primaryVariantLabel) && (
                <p className="text-[10px] md:text-xs text-neutral-500 mb-0.5 leading-tight font-medium">
                  {primaryVariantLabel || product.pack}
                </p>
              )}

              {/* 2. Name */}
              <h3 className="text-xs md:text-sm font-bold text-neutral-900 mb-0.5 line-clamp-3 leading-tight overflow-hidden h-[42px] md:h-[48px] flex items-center">
                {product.name || product.productName || ''}
              </h3>

              {/* 3. Combined Time & Rating row */}
              <div className="flex items-center justify-between text-[10px] md:text-xs text-neutral-500 mb-1 leading-tight">
                {/* Delivery Time */}
                <span className="flex items-center gap-0.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 text-neutral-400">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
                    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                  <span>{deliveryTimeText}</span>
                </span>
                {/* Rating Badge */}
                {((product.rating || (product as any).rating) || 0) > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-green-600 bg-green-50 px-1 py-0.2 rounded">
                    ★ {Number((product.rating || (product as any).rating) || 0).toFixed(1)}
                  </span>
                )}
              </div>

              {/* 4. Tiered Pricing Static Display (Multi-Row) */}
              {product.isEnquiryOnly ? (
                <div className="mt-auto pt-0.5">
                  <span className="text-[11px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">Enquiry Only</span>
                </div>
              ) : (
                <>
                  {tieredPrices.length > 0 && (
                     <div className="flex flex-col gap-0 mb-1 mt-auto w-full border-t border-gray-100 pt-1">
                        {/* Line 1: Base Price */}
                        <div className="flex justify-between items-center text-[10px] leading-none py-0.5">
                           <span className="text-gray-500 font-medium">1 unit</span>
                           <div className="flex items-center gap-1">
                             <span className="font-semibold text-[var(--customer-primary-dark)]">₹{displayPrice}</span>
                           </div>
                        </div>
                        {/* Additional Tiers */}
                        {tieredPrices.slice().sort((a: any, b: any) => a.minQty - b.minQty).map((tier: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-[10px] leading-none py-0.5">
                               <span className="text-[var(--customer-primary)] font-bold">{tier.minQty}+ units</span>
                               <div className="flex items-center gap-1">
                                 <span className="font-bold text-[var(--customer-primary-dark)]">₹{tier.price}</span>
                                  <span className="text-[var(--customer-primary)] font-bold bg-[var(--customer-primary-alpha-10)] px-1 rounded-sm">
                                    {Math.round(((mrp - tier.price) / mrp) * 100)}% OFFER
                                  </span>
                                </div>
                            </div>
                        ))}
                     </div>
                  )}

                  {/* 5. Price with discount & Inline Offer */}
                  <div className="mt-auto pt-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-display font-price text-sm md:text-base font-bold text-[var(--brand-green,#236B34)] leading-tight">
                        ₹{currentUnitPrice.toLocaleString('en-IN')}
                      </span>
                      {mrp && mrp > displayPrice && (
                        <span className="text-[10px] text-neutral-400 line-through leading-tight">
                          ₹{mrp.toLocaleString('en-IN')}
                        </span>
                      )}
                      {discount > 0 && tieredPrices.length === 0 && (
                        <span className="text-[9px] font-black text-red-700 bg-red-50 border border-red-100 px-1 rounded-sm">
                          {discount}% OFF
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 6. Action Button / Quantity Selector fixed at bottom */}
                  <div className="pt-2 w-full">
                    {product.isEnquiryOnly ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardClick();
                        }}
                        className="w-full rounded-lg font-bold text-[11px] h-8 px-4 flex items-center justify-center gap-1.5 uppercase tracking-wider transition-all duration-300 border bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-dark)] text-white hover:shadow-md cursor-pointer border-transparent"
                      >
                        Enquiry Now
                      </Button>
                    ) : inCartQty === 0 ? (
                      <div className="flex flex-col items-center w-full">
                        <div className="flex justify-center w-full">
                          <Button
                            ref={addButtonRef}
                            variant="default"
                            size="sm"
                            disabled={product.isAvailable === false}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAdd(e);
                            }}
                            className={`w-full rounded-lg font-black ${
                              compact ? 'text-[11px] h-8 md:text-xs md:h-9 px-2 gap-1' : 'text-xs h-8 md:text-base md:h-11 px-2 md:px-4 gap-1 md:gap-2.5'
                            } flex items-center justify-center uppercase tracking-wider transition-all duration-300 border shadow-sm ${
                              product.isAvailable === false
                              ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed'
                              : 'hover:bg-[var(--customer-primary-dark)] hover:text-white hover:border-[var(--customer-primary-dark)] hover:shadow-md active:scale-95'
                            }`}
                            style={product.isAvailable !== false ? {
                                backgroundColor: 'var(--customer-primary-alpha-10)',
                                borderColor: 'var(--customer-primary)',
                                color: 'var(--customer-primary)'
                            } : {}}
                          >
                            {product.isAvailable === false ? (
                               'Out of Stock'
                            ) : (
                              <>
                                <svg width={compact ? "11" : "13"} height={compact ? "11" : "13"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="12" y1="5" x2="12" y2="19"></line>
                                  <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                <span>ADD</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`pop-in flex items-center justify-between bg-white rounded-lg ${
                          compact ? 'h-8 md:h-9' : 'h-8 md:h-11'
                        } w-full border border-[var(--customer-primary)] overflow-hidden shadow-sm`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDecrease(e);
                          }}
                          className={`${
                            compact ? 'w-8' : 'w-11'
                          } h-full flex items-center justify-center bg-[var(--customer-primary-alpha-10)] text-[var(--customer-primary-dark)] hover:bg-[var(--customer-primary-alpha-20)] transition-colors active:scale-95 flex-shrink-0`}
                          aria-label="Decrease quantity"
                        >
                          <span className={`${compact ? 'text-sm' : 'text-lg'} font-black select-none`}>−</span>
                        </button>
                        <motion.input
                          animate={qtyControls}
                          type="number"
                          value={localQty === 0 ? '' : localQty}
                          onChange={(e) => handleQuantityInputChange(e.target.value)}
                          onBlur={() => handleQuantityInputBlurOrSubmit(localQty)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleQuantityInputBlurOrSubmit(localQty);
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          title="Click to type quantity manually (e.g. 50)"
                          className={`${
                            compact ? 'w-9 text-xs py-0.5' : 'w-12 text-sm py-1'
                          } text-center font-black bg-transparent border-0 focus:bg-transparent focus:ring-0 focus:outline-none text-neutral-900 outline-none transition-all cursor-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                        />

                        <button
                          type="button"
                          disabled={product.isAvailable === false}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleIncrease(e);
                          }}
                          className={`${
                            compact ? 'w-8' : 'w-11'
                          } h-full flex items-center justify-center bg-[var(--customer-primary-alpha-10)] text-[var(--customer-primary-dark)] hover:bg-[var(--customer-primary-alpha-20)] transition-colors active:scale-95 flex-shrink-0`}
                          aria-label="Increase quantity"
                        >
                          <span className={`${compact ? 'text-sm' : 'text-lg'} font-black select-none`}>+</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            // Non-category style layout (original)
            <>
              {!showPackBadge && (
                <p className={`${compact ? 'text-[10px] md:text-xs' : 'text-xs md:text-sm'} text-neutral-500 mb-1`}>
                    {primaryVariantLabel || product.pack}
                </p>
              )}

              <h3 className={`${compact ? 'text-[11px] md:text-xs' : 'text-xs md:text-sm'} font-semibold text-neutral-900 ${compact ? 'mb-1' : 'mb-2'} line-clamp-3 leading-tight overflow-hidden ${compact ? 'h-[36px] md:h-[42px]' : 'h-[42px] md:h-[48px]'} flex items-center`}>
                {product.name || product.productName || ''}
              </h3>

              {/* Always show rating */}
              <div className={`${compact ? 'mb-1' : 'mb-2'}`}>
                <StarRating
                  rating={(product.rating || (product as any).rating) || 0}
                  reviewCount={(product.reviews || (product as any).reviewsCount) || 0}
                  size={compact ? 'sm' : 'md'}
                  showCount={true}
                />
              </div>

              {/* Tiered Pricing Display */}
              {product.isEnquiryOnly ? (
                <div className="mt-auto mb-2">
                  <span className="text-xs font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">Enquiry Only</span>
                </div>
              ) : (
                <>
                  {tieredPrices.length > 0 && (
                      <div className="mb-2 space-y-1">
                          {/* Base Price Tier */}
                          <div className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded text-[10px]">
                              <span className="font-medium text-gray-600">Buy 1</span>
                              <div className="flex items-center gap-1">
                                  <span className="font-bold text-[var(--customer-primary-dark)]">₹{displayPrice}</span>
                              </div>
                          </div>
                          {/* Additional Tiers */}
                          {tieredPrices.map((tier: any, idx: number) => {
                              const tierDiscount = mrp ? Math.round(((mrp - tier.price) / mrp) * 100) : 0;
                              return (
                                   <div key={idx} className="flex justify-between items-center bg-[var(--customer-primary-alpha-10)] px-2 py-1 rounded text-[10px] border border-[var(--customer-primary-alpha-20)]">
                                      <span className="font-bold text-red-800">Buy {tier.minQty}+</span>
                                      <div className="flex items-center gap-1">
                                          <span className="font-bold text-red-700">₹{tier.price}</span>
                                          {tierDiscount > 0 && <span className="text-[9px] text-[var(--customer-primary)] font-bold">({tierDiscount}% OFFER)</span>}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  )}

                  {showStockInfo && (
                    <p className="text-xs text-[var(--customer-primary)] mb-2 font-medium">
                      Fast delivery
                    </p>
                  )}

                  {showVegetarianIcon && (
                    <div className="flex items-center gap-1 mb-2">
                      <div className="w-4 h-4 bg-[var(--customer-primary)] rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                      <span className="text-xs text-neutral-600">Vegetarian</span>
                    </div>
                  )}

                  <div className="mt-auto mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-display font-price text-base font-bold text-[var(--brand-green,#236B34)]">
                        ₹{displayPrice}
                      </span>
                      {mrp && mrp > displayPrice && (
                        <span className="text-xs text-neutral-500 line-through">
                          ₹{mrp}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {!categoryStyle && (
        <div className={`${compact ? 'px-3 pb-3' : 'px-4 pb-4'}`}>
          <div className="mt-auto">
            {product.isEnquiryOnly ? (
              <Button
                variant="default"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardClick();
                }}
                className={`w-full border ${
                  compact ? 'h-9 text-xs' : 'h-11 text-sm'
                } rounded-lg font-bold uppercase tracking-wider bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-dark)] text-white hover:shadow-md transition-all active:scale-95 cursor-pointer border-transparent`}
              >
                Enquiry Now
              </Button>
            ) : inCartQty === 0 ? (
              <div>
                <Button
                  ref={addButtonRef}
                  variant="default"
                  size="sm"
                  disabled={product.isAvailable === false}
                  onClick={handleAdd}
                  className={`w-full border ${
                    compact ? 'text-[11px] h-8 md:text-xs md:h-9' : 'text-xs h-8 md:text-base md:h-11'
                  } font-black uppercase tracking-wider transition-all duration-300 shadow-sm ${
                    product.isAvailable === false
                    ? 'border-neutral-200 text-neutral-400 bg-neutral-50 cursor-not-allowed'
                    : 'hover:bg-[var(--brand-green-dark,#1B5128)] hover:text-white hover:border-[var(--brand-green-dark,#1B5128)] hover:shadow-md active:scale-95'
                  }`}
                  style={product.isAvailable !== false ? {
                      backgroundColor: 'var(--brand-leaf-tint, #EAF5E0)',
                      borderColor: 'var(--brand-green, #236B34)',
                      color: 'var(--brand-green, #236B34)'
                  } : {}}
                >
                  {product.isAvailable === false ? (
                    'Out of Range'
                  ) : (
                    <div className={`flex items-center justify-center ${compact ? 'gap-1' : 'gap-1.5 md:gap-2.5'}`}>
                       <svg width={compact ? "11" : "13"} height={compact ? "11" : "13"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      <span>ADD</span>
                    </div>
                  )}
                </Button>
                <div className="h-4 mt-1">
                </div>
              </div>
            ) : (
              <div
                className={`pop-in flex items-center justify-between bg-white rounded-lg ${
                  compact ? 'h-8 md:h-9' : 'h-8 md:h-11'
                } w-full border-2 border-[var(--brand-green,#236B34)] overflow-hidden shadow-sm`}
              >
                <button
                  type="button"
                  onClick={handleDecrease}
                  className={`${
                    compact ? 'w-7 md:w-8' : 'w-8 md:w-11'
                  } h-full flex items-center justify-center bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green,#236B34)] hover:bg-[var(--brand-leaf-light,#8CC63F)]/30 transition-colors active:scale-95 flex-shrink-0`}
                  aria-label="Decrease quantity"
                >
                  <span className={`${compact ? 'text-xs md:text-sm' : 'text-xs md:text-lg'} font-black select-none`}>−</span>
                </button>
                <motion.input
                  animate={qtyControls}
                  type="number"
                  value={localQty === 0 ? '' : localQty}
                  onChange={(e) => handleQuantityInputChange(e.target.value)}
                  onBlur={() => handleQuantityInputBlurOrSubmit(localQty)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleQuantityInputBlurOrSubmit(localQty);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  title="Click to type quantity manually (e.g. 50)"
                  className={`${
                    compact ? 'w-8 text-[11px] md:w-9 md:text-xs py-0.5' : 'w-9 text-xs md:w-12 md:text-sm py-1'
                  } text-center font-black bg-transparent border-0 focus:bg-transparent focus:ring-0 focus:outline-none text-neutral-900 outline-none transition-all cursor-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                />

                <button
                  type="button"
                  disabled={product.isAvailable === false}
                  onClick={handleIncrease}
                  className={`${
                    compact ? 'w-7 md:w-8' : 'w-8 md:w-11'
                  } h-full flex items-center justify-center bg-[var(--customer-primary-alpha-10)] text-[var(--customer-primary-dark)] hover:bg-[var(--customer-primary-alpha-20)] transition-colors active:scale-95 flex-shrink-0`}
                  aria-label="Increase quantity"
                >
                  <span className={`${compact ? 'text-xs md:text-sm' : 'text-xs md:text-lg'} font-black select-none`}>+</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
