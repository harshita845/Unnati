import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ShoppingBag,
  Loader2,
  Check,
} from 'lucide-react';
import { useOrders } from '../../hooks/useOrders';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { getProducts } from '../../services/api/customerProductService';
import WishlistButton from '../../components/WishlistButton';
import { calculateProductPrice, formatAmount } from '../../utils/priceUtils';
import { getProductCardImage } from '../../utils/customerVariantUtils';

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getCustomerStatusInfo = (status: string) => {
  switch (status) {
    case 'Received':
    case 'Placed':
    case 'Pending':
      return {
        label: 'Order Placed',
        className: 'bg-amber-50 text-amber-800 border border-amber-200/60',
      };
    case 'Accepted':
    case 'Processed':
      return {
        label: 'Preparing',
        className: 'bg-blue-50 text-blue-800 border border-blue-200/60',
      };
    case 'Shipped':
    case 'Picked up':
    case 'Out for Delivery':
    case 'On the way':
      return {
        label: 'Out for Delivery',
        className: 'bg-emerald-50 text-emerald-800 border border-emerald-200/60',
      };
    case 'Delivered':
      return {
        label: 'Delivered',
        className: 'bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green,#236B34)] border border-[var(--brand-leaf,#5FA82E)]/30',
      };
    case 'Cancelled':
    case 'Rejected':
      return {
        label: 'Cancelled',
        className: 'bg-red-50 text-red-700 border border-red-200/60',
      };
    case 'Returned':
    case 'Return Requested':
      return {
        label: 'Returned',
        className: 'bg-neutral-100 text-neutral-800 border border-neutral-200/60',
      };
    default:
      return {
        label: status || 'Order Placed',
        className: 'bg-neutral-100 text-neutral-800 border border-neutral-200/60',
      };
  }
};

export default function OrderAgain() {
  const { orders } = useOrders();
  const { cart, addToCart, updateQuantity } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [addedOrders, setAddedOrders] = useState<Set<string>>(new Set());
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  // Handle "Order Again" - Add all items from an order to cart with feedback
  const handleOrderAgain = async (order: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (reorderingId === order.id) return;
    setReorderingId(order.id);

    try {
      const items = order.items || [];
      let totalAddedQty = 0;

      items.forEach((item: any) => {
        const prod = item.product || {
          id: item.id || item._id,
          name: item.productName || 'Product',
          price: item.price || item.unitPrice || 0,
          imageUrl: item.productImage,
          mainImage: item.productImage,
        };
        if (!prod) return;
        const qty = item.quantity ?? 1;
        const productId = prod?.id || prod?._id;

        if (!productId) return;

        // Check if product is already in cart
        const existingCartItem = cart.items.find((cartItem) => {
          const cartProd = cartItem?.product;
          const cartProdId = (cartProd as any)?.id || (cartProd as any)?._id;
          return cartProdId === productId;
        });

        if (existingCartItem) {
          updateQuantity(productId, existingCartItem.quantity + qty);
        } else {
          addToCart(prod);
          if (qty > 1) {
            setTimeout(() => {
              updateQuantity(productId, qty);
            }, 10);
          }
        }
        totalAddedQty += qty;
      });

      // Mark this order as added
      setAddedOrders((prev) => new Set(prev).add(order.id));

      if (showToast) {
        showToast(
          `Added ${totalAddedQty} ${totalAddedQty === 1 ? 'item' : 'items'} to your cart!`,
          'success'
        );
      }
    } catch (err) {
      console.error('Failed to reorder items:', err);
    } finally {
      setTimeout(() => {
        setReorderingId(null);
      }, 350);
    }
  };

  // Get bestseller products
  const [bestsellerProducts, setBestsellerProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchBestsellers = async () => {
      try {
        const response = await getProducts({ sort: 'popular', limit: 6 });
        if (response.success && response.data) {
          const mapped = (response.data as any[]).map((p) => {
            let productName = p.productName || p.name || '';
            productName = productName
              .replace(
                /\s*-\s*(Fresh|Quality|Assured|Premium|Best|Top|Hygienic|Carefully|Selected).*$/i,
                ''
              )
              .trim();

            return {
              ...p,
              id: p._id || p.id,
              name: productName,
              imageUrl: p.mainImage || p.imageUrl || getProductCardImage(p),
              mrp: p.mrp || p.price,
              pack: p.variations?.[0]?.title || p.smallDescription || 'Standard',
            };
          });
          setBestsellerProducts(mapped);
        }
      } catch (error) {
        console.error('Failed to fetch bestsellers:', error);
      }
    };
    fetchBestsellers();
  }, []);

  const hasOrders = orders && orders.length > 0;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.05,
        delayChildren: 0.05,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 320,
        damping: 26,
      },
    },
  };

  return (
    <div className="pb-44 sm:pb-36 bg-[var(--brand-cream,#FDF9F2)] min-h-screen">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-6">
        {/* Page Title for Desktop */}
        <div className="hidden md:block mb-8 bg-white rounded-2xl border border-[var(--brand-border,#E9E2D3)] p-6 shadow-[0_4px_16px_rgba(35,107,52,0.04)]">
          <div className="flex items-center gap-3 mb-2.5">
            <span className="text-[10px] uppercase font-bold tracking-widest bg-[var(--brand-leaf-tint)] text-[var(--brand-green)] px-2.5 py-1 rounded-full border border-[var(--brand-leaf)]/30">
              ⚡ Quick Buy
            </span>
          </div>
          <h1 className="text-3xl font-display font-extrabold text-[var(--brand-green-deep,#14401F)] tracking-tight">
            Order{' '}
            <span className="bg-gradient-to-r from-[var(--brand-orange,#F97316)] to-[var(--brand-amber,#FFB020)] bg-clip-text text-transparent">
              Again
            </span>
          </h1>
          <p className="text-sm text-[var(--brand-ink-muted,#5B6B60)] mt-1.5 font-medium leading-relaxed">
            Reorder your favorite items and bestsellers in just one tap.
          </p>
        </div>

        {/* Orders Section - Show when orders exist */}
        {hasOrders && (
          <div className="mb-8">
            <h2 className="text-xl md:text-2xl font-display font-bold text-[var(--brand-green-deep,#14401F)] mb-4 tracking-tight">
              Your Previous Orders
            </h2>

            {/* Cards Grid */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {orders.map((order) => {
                const shortId = order.orderNumber
                  ? order.orderNumber.startsWith('#')
                    ? order.orderNumber.slice(1)
                    : order.orderNumber
                  : order.id.split('-').slice(-1)[0];

                const statusInfo = getCustomerStatusInfo(order.status);
                const itemCount = order.totalItems || order.items?.length || 1;

                return (
                  <motion.div
                    key={order.id}
                    variants={cardVariants}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
                    whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                    transition={{ duration: 0.2 }}
                    className="block bg-white rounded-2xl border border-[var(--brand-border,#E9E2D3)] p-4 shadow-[0_4px_16px_rgba(35,107,52,0.05)] hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    {/* Top Row: Order ID & Date on left, Status on right */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--brand-ink,#1C2B20)] mb-1">
                          Order #{shortId}
                        </div>
                        <div className="text-xs text-[var(--brand-ink-muted,#5B6B60)]">
                          {formatDate(order.createdAt)}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Bottom Row: Item count on left, Price & Order Again button on right */}
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-[var(--brand-ink-muted,#5B6B60)]">
                        {itemCount} {itemCount === 1 ? 'item' : 'items'}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-display font-price font-bold text-[var(--brand-green,#236B34)]">
                          ₹{formatAmount(order.totalAmount || order.subtotal || 0)}
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleOrderAgain(order, e)}
                            disabled={addedOrders.has(order.id) || reorderingId === order.id}
                            className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5 whitespace-nowrap ${
                              addedOrders.has(order.id)
                                ? 'bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green,#236B34)] border border-[var(--brand-leaf,#5FA82E)]/40 cursor-default'
                                : 'bg-[var(--brand-green,#236B34)] text-white hover:bg-[var(--brand-green-dark,#1B5128)] cursor-pointer'
                            }`}
                          >
                            {reorderingId === order.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Adding...</span>
                              </>
                            ) : addedOrders.has(order.id) ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[var(--brand-green,#236B34)]" />
                                <span>Added</span>
                              </>
                            ) : (
                              <span>Order Again</span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        )}

        {/* Bestsellers Section */}
        <div className="mt-8">
          <h2 className="text-base md:text-xl font-display font-bold text-[var(--brand-green-deep,#14401F)] mb-3 tracking-tight">Bestsellers</h2>
          <div className="flex gap-3 overflow-x-auto md:grid md:grid-cols-4 lg:grid-cols-6 md:overflow-x-visible pb-4 scrollbar-hide" style={{ scrollSnapType: 'x mandatory' }}>
            {bestsellerProducts.map((product) => {
              // Get Price and MRP using utility
              const { displayPrice, mrp, discount, hasDiscount } = calculateProductPrice(product);

              // Get quantity in cart
              const prodId = (product as any).id || (product as any)._id;
              const cartItem = cart.items.find(item => {
                const cartProd = item?.product;
                if (!cartProd) return false;
                const cartProdId = (cartProd as any).id || (cartProd as any)._id;
                return cartProdId === prodId;
              });
              const inCartQty = cartItem?.quantity || 0;

              const name = (product as any).name || (product as any).productName;
              const imageUrl = (product as any).imageUrl;
              const firstChar = name?.charAt(0).toUpperCase();

              return (
                <div
                  key={prodId}
                  className="flex-shrink-0 w-[140px] md:w-auto"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <div className="bg-white rounded-2xl overflow-hidden flex flex-col relative h-full border border-[var(--brand-border,#E9E2D3)] shadow-[0_4px_16px_rgba(35,107,52,0.05)] hover:shadow-md transition-all duration-300">
                    {/* Product Image Area */}
                    <div
                      onClick={() => navigate(`/product/${prodId}`)}
                      className="relative block cursor-pointer"
                    >
                      <div className="w-full h-28 md:h-36 bg-[var(--brand-cream,#FDF9F2)]/60 flex items-center justify-center overflow-hidden relative">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={name}
                            className="w-full h-full object-contain p-2"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[var(--brand-cream-soft,#F6EFE2)] text-[var(--brand-ink-muted,#5B6B60)] text-4xl font-display font-black">
                            {firstChar}
                          </div>
                        )}

                        {/* Orange Discount Badge - Top Left */}
                        {discount > 0 && (
                          <div className="absolute top-1.5 left-1.5 z-10 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm" style={{ background: 'var(--gradient-signature)' }}>
                            {discount}% OFF
                          </div>
                        )}

                        {/* Heart Icon - Top Right */}
                        <WishlistButton
                          productId={product.id}
                          size="sm"
                          className="top-1.5 right-1.5 shadow-sm"
                        />

                        {/* ADD Button or Quantity Stepper */}
                        <div className="absolute bottom-2 right-2 z-10">
                          <AnimatePresence mode="wait">
                            {inCartQty === 0 ? (
                              <motion.button
                                key="add-button"
                                type="button"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.2 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  addToCart(product, e.currentTarget);
                                }}
                                className="bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green,#236B34)] border-2 border-[var(--brand-green,#236B34)] text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm hover:bg-[var(--brand-green,#236B34)] hover:text-white active:scale-95 transition-all"
                              >
                                ADD
                              </motion.button>
                            ) : (
                              <motion.div
                                key="stepper"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center gap-1.5 bg-[var(--brand-green,#236B34)] rounded-lg px-2 py-1 shadow-sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    updateQuantity(product.id, inCartQty - 1);
                                  }}
                                  className="w-4 h-4 flex items-center justify-center text-white font-bold hover:opacity-80 rounded transition-opacity p-0 leading-none"
                                  style={{ lineHeight: 1, fontSize: '14px' }}
                                >
                                  <span className="relative top-[-1px]">−</span>
                                </motion.button>
                                <motion.span
                                  key={inCartQty}
                                  initial={{ scale: 1.2, y: -2 }}
                                  animate={{ scale: 1, y: 0 }}
                                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                                  className="text-white font-black min-w-[0.75rem] text-center text-xs"
                                >
                                  {inCartQty}
                                </motion.span>
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    updateQuantity(product.id, inCartQty + 1);
                                  }}
                                  className="w-4 h-4 flex items-center justify-center text-white font-bold hover:opacity-80 rounded transition-opacity p-0 leading-none"
                                  style={{ lineHeight: 1, fontSize: '14px' }}
                                >
                                  <span className="relative top-[-1px]">+</span>
                                </motion.button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    {/* Product Details */}
                    <div className="p-2.5 md:p-4 flex-1 flex flex-col bg-white">
                      {/* Product Name */}
                      <div
                        onClick={() => navigate(`/product/${product.id}`)}
                        className="mb-1.5 cursor-pointer"
                      >
                        <h3 className="text-xs md:text-sm font-bold text-[var(--brand-ink,#1C2B20)] line-clamp-2 leading-snug hover:text-[var(--brand-green,#236B34)] transition-colors">
                          {(() => {
                            const productName = product.name || product.productName || '';
                            return productName.replace(/\s*-\s*(Fresh|Quality|Assured|Premium|Best|Top|Hygienic|Carefully|Selected).*$/i, '').trim();
                          })()}
                        </h3>
                      </div>

                      {/* Rating and Reviews */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill={i < 4 ? 'var(--brand-amber, #FFB020)' : '#e5e7eb'}
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-xs font-semibold text-[var(--brand-ink-muted,#5B6B60)]">(85)</span>
                      </div>

                      {/* Delivery Time */}
                      <div className="text-xs font-bold text-[var(--brand-green,#236B34)] mb-1.5 flex items-center gap-1 leading-none">
                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                           <circle cx="12" cy="12" r="10" />
                           <path d="M12 6v6l4 2" />
                         </svg>
                         <span>20 MINS</span>
                      </div>

                      {/* Price */}
                      <div className="mb-2.5 mt-auto">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-display font-price font-bold text-[var(--brand-green,#236B34)]">
                            ₹{displayPrice.toLocaleString('en-IN')}
                          </span>
                          {hasDiscount && (
                            <span className="text-xs md:text-sm text-[var(--brand-ink-muted,#5B6B60)]/60 line-through font-price">
                              ₹{mrp.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom Link */}
                      <div
                        onClick={() => navigate(`/category/${product.categoryId || 'all'}`)}
                        className="w-full bg-[var(--brand-cream-soft,#F6EFE2)]/60 text-[var(--brand-ink-muted,#5B6B60)] border border-[var(--brand-border,#E9E2D3)] text-xs font-semibold py-1.5 rounded-lg flex items-center justify-between px-2 hover:bg-[var(--brand-cream-soft,#F6EFE2)] hover:text-[var(--brand-green-deep,#14401F)] transition-all cursor-pointer"
                      >
                        <span>See more like this</span>
                        <div className="flex items-center gap-1">
                          <div className="w-px h-3 bg-[var(--brand-border,#E9E2D3)]"></div>
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-0.5">
                            <path d="M0 0L8 4L0 8Z" fill="currentColor" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Empty State Illustration - Show when no orders */}
        {!hasOrders && (
          <div className="bg-white rounded-3xl border border-[var(--brand-border,#E9E2D3)] py-16 px-6 shadow-sm my-4">
            <div className="flex flex-col items-center justify-center max-w-md mx-auto text-center">
              {/* Animated Floating Bag Icon */}
              <motion.div
                animate={shouldReduceMotion ? undefined : { y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-3xl bg-[var(--brand-leaf-tint,#EAF5E0)] border border-[var(--brand-leaf,#5FA82E)]/30 flex items-center justify-center mb-6 shadow-sm"
              >
                <ShoppingBag className="w-10 h-10 text-[var(--brand-green,#236B34)]" />
              </motion.div>

              <h2 className="text-xl sm:text-2xl font-display font-extrabold text-[var(--brand-green-deep,#14401F)] mb-2 tracking-tight">
                Reordering will be easy
              </h2>
              <p className="text-sm text-[var(--brand-ink-muted,#5B6B60)] max-w-xs leading-relaxed mb-6">
                Items you order will show up here so you can buy them again easily
              </p>
              <motion.button
                whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                onClick={() => navigate('/')}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[var(--brand-green,#236B34)] text-white shadow-sm hover:bg-[var(--brand-green-dark,#1B5128)] transition-colors cursor-pointer"
              >
                Start Shopping
              </motion.button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
