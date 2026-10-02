import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import HomeHero from './components/HomeHero';
import { useOrders } from '../../hooks/useOrders';
import { useCart } from '../../context/CartContext';
import { getProducts } from '../../services/api/customerProductService';
import WishlistButton from '../../components/WishlistButton';
import { calculateProductPrice } from '../../utils/priceUtils';

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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Delivered':
      return 'bg-[var(--customer-primary-alpha-20)] text-[var(--customer-primary-dark)]';
    case 'On the way':
      return 'bg-[var(--customer-primary-alpha-20)] text-blue-700';
    case 'Accepted':
      return 'bg-yellow-100 text-yellow-700';
    case 'Placed':
      return 'bg-neutral-100 text-neutral-700';
    default:
      return 'bg-neutral-100 text-neutral-700';
  }
};

export default function OrderAgain() {
  const { orders } = useOrders();
  const { cart, addToCart, updateQuantity } = useCart();
  const navigate = useNavigate();
  const [addedOrders, setAddedOrders] = useState<Set<string>>(new Set());

  // Handle "Order Again" - Add all items from an order to cart
  const handleOrderAgain = (order: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Mark this order as added
    setAddedOrders(prev => new Set(prev).add(order.id));

    // Add each item from the order to the cart
    order.items
      .filter((item: any) => item?.product) // Filter out items with null/undefined products
      .forEach((item: any) => {
        const prod = item.product;
        if (!prod) return;
        const qty = item.quantity ?? 0;
        // Use optional chaining carefully - extract ID immediately
        const productId = prod?.id || prod?._id;

        if (!productId) return;

        // Check if product is already in cart
        const existingCartItem = cart.items.find(cartItem => {
          const cartProd = cartItem?.product;
          const cartProdId = (cartProd as any)?.id || (cartProd as any)?._id;
          return cartProdId === productId;
        });

        if (existingCartItem) {
          // If already in cart, add the order quantity to existing quantity
          updateQuantity(productId, existingCartItem.quantity + qty);
        } else {
          // If not in cart, add it first (adds 1)
          addToCart(prod);
          // Then update to the correct quantity if needed
          if (qty > 1) {
            // Use setTimeout to ensure the item is added first
            setTimeout(() => {
              updateQuantity(productId, qty);
            }, 10);
          }
        }
      });
  };

  // Get bestseller products
  const [bestsellerProducts, setBestsellerProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchBestsellers = async () => {
      try {
        const response = await getProducts({ sort: 'popular', limit: 6 });
        if (response.success && response.data) {
        const mapped = (response.data as any[]).map(p => {
          // Clean product name - remove description suffixes
          let productName = p.productName || p.name || '';
          productName = productName.replace(/\s*-\s*(Fresh|Quality|Assured|Premium|Best|Top|Hygienic|Carefully|Selected).*$/i, '').trim();

          return {
            ...p,
            id: p._id || p.id,
            name: productName,
            imageUrl: p.mainImage || p.imageUrl,
            mrp: p.mrp || p.price,
            pack: p.variations?.[0]?.title || p.smallDescription || 'Standard'
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

  return (
    <div className="pb-12 bg-neutral-50/50 min-h-screen">
      {/* Header - Hidden */}

      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-6">
        {/* Page Title for Desktop */}
        <div className="hidden md:block mb-8 bg-gradient-to-r from-white to-neutral-50/50 rounded-2xl border border-neutral-200/60 p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3 mb-2.5">
            <span className="text-[10px] uppercase font-bold tracking-widest bg-[var(--customer-primary-alpha-10)] text-[var(--customer-primary-dark)] px-2.5 py-1 rounded-full border border-[var(--customer-primary-alpha-20)]">
              ⚡ Quick Buy
            </span>
          </div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight">
            Order <span className="bg-gradient-to-r from-[var(--customer-primary)] to-[var(--customer-primary-dark)] bg-clip-text text-transparent">Again</span>
          </h1>
          <p className="text-sm text-neutral-500 mt-1.5 font-medium leading-relaxed">
            Reorder your favorite items and bestsellers in just one tap.
          </p>
        </div>

        {/* Orders Section - Show when orders exist */}
        {hasOrders && (
          <div className="mb-8">
            <h2 className="text-sm md:text-lg font-bold text-neutral-900 mb-3 capitalize tracking-tight">Your Previous Orders</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orders.map((order) => {
                const shortId = order.orderNumber || order.id.split('-').slice(-1)[0];
                const previewItems = order.items.slice(0, 3);

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-xl border border-neutral-200/80 p-3 hover:shadow-md hover:border-neutral-300/80 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-sm font-bold text-neutral-900">
                            Order #{shortId}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${getStatusColor(
                              order.status
                            )}`}
                          >
                            {order.status}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-400 mb-2">{formatDate(order.createdAt)}</div>

                        {/* Product Images Preview - Compact */}
                        <div className="flex items-center gap-1.5">
                          {previewItems
                            .map((item: any, idx) => {
                              const prod = item?.product;
                              if (!prod) return null;
                              const prodId = prod.id || prod._id || `unknown-${idx}`;
                              const productName = prod.name || (prod as any).productName || '?';
                              const imageUrl = prod.imageUrl;
                              const firstChar = productName.charAt(0).toUpperCase();

                              return (
                                <div
                                  key={prodId}
                                  className="w-8 h-8 bg-neutral-50 rounded-lg border border-neutral-100 flex items-center justify-center flex-shrink-0 overflow-hidden"
                                  style={{ marginLeft: idx > 0 ? '-6px' : '0' }}
                                >
                                  {imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt={productName}
                                      className="w-full h-full object-contain"
                                    />
                                  ) : (
                                    <span className="text-[10px] font-bold text-neutral-400">
                                      {firstChar}
                                    </span>
                                  )}
                                </div>
                              );
                            }).filter(Boolean)}
                          {order.items.length > 3 && (
                            <div className="w-8 h-8 bg-neutral-100 border border-neutral-200/50 rounded-lg flex items-center justify-center text-[10px] font-bold text-neutral-600">
                              +{order.items.length - 3}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <div className="text-sm font-black text-neutral-900">
                          ₹{order.totalAmount.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-medium">
                          {order.totalItems} {order.totalItems === 1 ? 'item' : 'items'}
                        </div>
                        {/* Order Again Button */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleOrderAgain(order, e)}
                            disabled={addedOrders.has(order.id)}
                            className={`mt-1 text-[11px] font-bold px-3.5 py-1.5 rounded-lg transition-all shadow-sm active:scale-95 ${addedOrders.has(order.id)
                              ? 'bg-[var(--customer-primary-alpha-10)] text-neutral-400 border border-neutral-200/60 cursor-not-allowed'
                              : 'bg-[var(--customer-primary-dark)] text-white hover:bg-[var(--customer-primary-darker)] cursor-pointer'
                              }`}
                          >
                            {addedOrders.has(order.id) ? '✓ Added' : 'Order Again'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bestsellers Section */}
        <div className="mt-8">
          <h2 className="text-sm md:text-lg font-bold text-neutral-900 mb-3 capitalize tracking-tight">Bestsellers</h2>
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
                  <div className="bg-white rounded-xl overflow-hidden flex flex-col relative h-full border border-neutral-200/80 hover:shadow-md hover:border-neutral-300 transition-all duration-300">
                    {/* Product Image Area */}
                    <div
                      onClick={() => navigate(`/product/${prodId}`)}
                      className="relative block cursor-pointer"
                    >
                      <div className="w-full h-28 md:h-36 bg-neutral-50 flex items-center justify-center overflow-hidden relative">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={name}
                            className="w-full h-full object-contain p-2"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl font-black">
                            {firstChar}
                          </div>
                        )}

                        {/* Red Discount Badge - Top Left */}
                        {discount > 0 && (
                          <div className="absolute top-1.5 left-1.5 z-10 bg-[var(--customer-primary-dark)] text-white text-[11px] font-extrabold px-2.5 py-1 rounded-md shadow-sm">
                            {discount}% OFFER
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
                                className="bg-white/95 backdrop-blur-sm text-[var(--customer-primary)] border-2 border-[var(--customer-primary)] text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm hover:bg-white active:scale-95 transition-all"
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
                                className="flex items-center gap-1.5 bg-[var(--customer-primary)] rounded-lg px-2 py-1 shadow-sm"
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
                        <h3 className="text-xs md:text-sm font-bold text-neutral-800 line-clamp-2 leading-snug hover:text-[var(--customer-primary-dark)] transition-colors">
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
                              fill={i < 4 ? '#fbbf24' : '#e5e7eb'}
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-xs font-semibold text-neutral-450">(85)</span>
                      </div>

                      {/* Delivery Time */}
                      <div className="text-xs font-bold text-neutral-550 mb-1.5 flex items-center gap-1 leading-none">
                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                           <circle cx="12" cy="12" r="10" />
                           <path d="M12 6v6l4 2" />
                         </svg>
                         <span>20 MINS</span>
                      </div>

                      {/* Price */}
                      <div className="mb-2.5 mt-auto">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-black text-neutral-900">
                            ₹{displayPrice.toLocaleString('en-IN')}
                          </span>
                          {hasDiscount && (
                            <span className="text-xs md:text-sm text-neutral-400 line-through">
                              ₹{mrp.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom Link */}
                      <div
                        onClick={() => navigate(`/category/${product.categoryId || 'all'}`)}
                        className="w-full bg-neutral-50 text-neutral-600 border border-neutral-100 text-xs font-semibold py-1.5 rounded-lg flex items-center justify-between px-2 hover:bg-neutral-100 hover:text-neutral-950 transition-all cursor-pointer"
                      >
                        <span>See more like this</span>
                        <div className="flex items-center gap-1">
                          <div className="w-px h-3 bg-neutral-200"></div>
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
          <div className="bg-white rounded-2xl border border-neutral-200/80 py-16 px-6 shadow-sm my-4">
            <div className="flex flex-col items-center justify-center max-w-md mx-auto">
              {/* Grocery Illustration */}
              <div className="relative w-full max-w-xs mb-6">
                <div className="relative flex items-center justify-center">
                  {/* Yellow Shopping Bag */}
                  <div className="relative w-40 h-48 bg-gradient-to-b from-yellow-400 via-yellow-300 to-yellow-500 rounded-b-2xl rounded-t-lg shadow-xl border-2 border-yellow-500/30 flex items-center justify-center">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-8 bg-gradient-to-b from-yellow-500 to-yellow-400 rounded-t-lg shadow-inner"></div>
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-7 border-[4px] border-yellow-600 rounded-full border-b-transparent shadow-lg">
                      <div className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-4 border-[2px] border-yellow-500/50 rounded-full border-b-transparent"></div>
                    </div>
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 w-32 h-0.5 bg-yellow-600/30"></div>
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 w-28 h-0.5 bg-yellow-600/20"></div>

                    {/* Ecommerce text inside basket */}
                    <div className="relative z-10 text-center px-4">
                      <span className="text-2xl font-extrabold text-neutral-900 tracking-tight drop-shadow-sm">Ecommerce</span>
                      <span className="inline-block w-2.5 h-2.5 bg-[var(--customer-primary)] rounded-full ml-1.5 shadow-sm"></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reordering Message */}
              <h2 className="text-2xl font-black text-neutral-900 mb-2 text-center tracking-tight">
                Reordering will be easy
              </h2>
              <p className="text-sm text-neutral-500 text-center max-w-xs leading-relaxed">
                Items you order will show up here so you can buy them again easily
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
