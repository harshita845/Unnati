import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { duration, ease } from '../../lib/motion';
import { useCart } from '../../context/CartContext';
import Button from '../../components/ui/button';
import { appConfig } from '../../services/configService';
import { calculateProductPrice, getCartItemVariantSelector, getCartLineUnitPrice } from '../../utils/priceUtils';

export default function Cart() {
  const { cart, updateQuantity, removeFromCart, clearCart, freeGiftRules: activeRules, loading } = useCart();
  const navigate = useNavigate();


  const deliveryFee = (cart.total || 0) >= (appConfig.freeDeliveryThreshold || 500) ? 0 : (appConfig.deliveryFee || 40);
  const platformFee = appConfig.platformFee || 0;
  const totalAmount = (cart.total || 0) + deliveryFee + platformFee;

  const handleCheckout = () => {
    navigate('/checkout');
  };

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--brand-cream,#FDF9F2)] px-4 py-16 text-center font-sans">
        <motion.div
          className="text-5xl md:text-8xl mb-4"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
          transition={{ opacity: { duration: duration.base }, scale: { duration: duration.base }, y: { duration: 2.4, ease: 'easeInOut', repeat: Infinity } }}
        >
          🛒
        </motion.div>
        <h2 className="text-xl md:text-2xl font-display font-bold text-[var(--brand-green-deep,#14401F)] mb-2">Your cart is empty</h2>
        <p className="text-[var(--brand-ink-muted,#5B6B60)] mb-6 md:mb-8 text-sm md:text-base">Add some items to get started!</p>
        <Link to="/">
          <Button variant="default" size="lg" className="px-8 py-3 text-sm md:text-base rounded-xl bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] text-white shadow-sm font-bold">
            Start Shopping
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--brand-cream,#FDF9F2)] pb-4 md:pb-8 font-sans">
      {/* Header */}
      <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 bg-white border-b border-[var(--brand-border,#E9E2D3)] mb-4 md:mb-6 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-1.5 md:mb-2">
          <h1 className="text-lg md:text-2xl font-display font-bold text-[var(--brand-green-deep,#14401F)]">Your Basket 🛍️</h1>
          {cart.items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs md:text-sm text-[var(--brand-green,#236B34)] font-bold hover:text-red-700 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
        <p className="text-xs md:text-sm text-[var(--brand-ink-muted,#5B6B60)] font-medium">Delivered in {appConfig.estimatedDeliveryTime}</p>

        {/* Free Gift Progress Bar (Multi-Tier) */}
        {(() => {
            if (activeRules.length === 0) return null;

            const currentTotal = cart.total || 0;
            if (activeRules.length === 0) return null;
            const highestRule = activeRules[activeRules.length - 1];
            const maxTarget = highestRule.minCartValue || 1000;

            // Find next milestone
            const nextRule = activeRules.find(r => r.minCartValue > currentTotal);

            return (
              <div className="mt-4 pt-4 border-t border-dashed border-[var(--brand-border,#E9E2D3)]">
                 {nextRule ? (
                     <div className="text-center mb-4 text-xs md:text-sm text-[var(--brand-ink,#1C2B20)]">
                         Add <span className="font-bold text-[var(--brand-green,#236B34)]">₹{(nextRule.minCartValue - currentTotal).toLocaleString('en-IN')}</span> more to unlock <span className="font-bold text-[var(--brand-orange,#F97316)]">{nextRule.giftProduct?.productName || 'Gift'}</span> 🎁
                     </div>
                 ) : (
                     <div className="text-[var(--brand-green,#236B34)] font-bold text-center mb-4 flex items-center justify-center gap-2">
                         <span className="text-lg">🎉</span> All Free Gifts Unlocked!
                     </div>
                 )}

                 {/* Milestone Bar Container */}
                 <div className="relative h-12 mb-2 px-2">
                     {/* Background Line */}
                     <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-[var(--brand-cream-soft,#F6EFE2)] rounded-full -translate-y-1/2 z-0"></div>

                     {/* Progress Line */}
                     <div
                        className="absolute top-1/2 left-0 h-1.5 bg-gradient-to-r from-[var(--brand-leaf-light,#8CC63F)] to-[var(--brand-green,#236B34)] rounded-full -translate-y-1/2 z-0 transition-all duration-700 ease-out"
                        style={{ width: `${Math.min(100, (currentTotal / maxTarget) * 100)}%` }}
                     ></div>

                     {/* Milestones */}
                     {activeRules.map((rule, idx) => {
                         const isUnlocked = currentTotal >= rule.minCartValue;
                         const position = (rule.minCartValue / maxTarget) * 100;

                         return (
                             <div
                                key={rule._id || rule.id}
                                className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center group z-10"
                                style={{ left: `${position}%`, transform: `translate(-${position === 100 ? '100' : '50'}%, -50%)` }}
                             >
                                 {/* Icon Circle */}
                                 <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white transition-all duration-300 ${isUnlocked ? 'border-[var(--brand-green,#236B34)] text-[var(--brand-green,#236B34)] shadow-md scale-110' : 'border-[var(--brand-border,#E9E2D3)] text-[var(--brand-ink-muted,#5B6B60)]'}`}>
                                     {isUnlocked ? (
                                         <span className="text-sm font-bold text-[var(--brand-green,#236B34)]">✓</span>
                                     ) : (
                                         <span className="text-[10px]">🎁</span>
                                     )}
                                 </div>

                                 {/* Label */}
                                 <div className="absolute top-9 w-24 text-center">
                                     <span className={`text-[10px] font-bold block ${isUnlocked ? 'text-[var(--brand-green,#236B34)]' : 'text-[var(--brand-ink-muted,#5B6B60)]'}`}>
                                         {isUnlocked ? 'Unlocked' : `₹${rule.minCartValue}`}
                                     </span>
                                     <span className="text-[9px] text-[var(--brand-ink-muted,#5B6B60)] leading-tight block truncate mx-auto max-w-full">
                                         {rule.giftProduct?.productName?.split(' ')[0]}...
                                     </span>
                                 </div>
                             </div>
                         );
                     })}
                 </div>
              </div>
            );
        })()}
      </div>

      {/* Cart Items */}
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 space-y-4 md:space-y-6 mb-4 md:mb-6">
        {/* Lines slide out when removed; the ones below close the gap smoothly */}
        <AnimatePresence initial={false}>
        {cart.items.map((item) => {
          const prod = item.product;
          if (!prod) return null;

          const qty = item.quantity ?? 0;
          const variantSelector = getCartItemVariantSelector(item);
          const applicableUnitPrice = getCartLineUnitPrice(item);
          const { displayPrice, mrp, hasDiscount } = calculateProductPrice(prod, variantSelector);
          const isTieredApplied = applicableUnitPrice < displayPrice;
          const isFreeGift = item.isFreeGift;

          const prodId = prod.id || prod._id || '';
          const lineKey = item.id || `${prodId}-${item.variantId || item.variation || item.variant || 'default'}`;

          return (
            <motion.div
              key={lineKey}
              layout="position"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -40, transition: { duration: duration.base, ease: ease.inOut } }}
              transition={{ duration: duration.base, ease: ease.out }}
              className="bg-white rounded-2xl border border-[var(--brand-border,#E9E2D3)] p-4 md:p-6 shadow-[0_4px_16px_rgba(35,107,52,0.04)] hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4 md:gap-6">
                {/* Product Image */}
                <div className="w-20 h-20 md:w-24 md:h-24 bg-[var(--brand-cream-soft,#F6EFE2)]/60 rounded-xl flex items-center justify-center flex-shrink-0 border border-[var(--brand-border,#E9E2D3)]/40 overflow-hidden">
                  {prod.imageUrl ? (
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className="w-full h-full object-contain p-1 rounded-xl"
                    />
                  ) : (
                    <span className="text-2xl font-display font-bold text-[var(--brand-ink-muted,#5B6B60)]">
                      {(prod.name || 'P').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[var(--brand-ink,#1C2B20)] mb-1 md:mb-2 line-clamp-2 text-xs md:text-base leading-snug">
                    {prod.name}
                  </h3>
                  <div className="text-[11px] md:text-xs text-[var(--brand-ink-muted,#5B6B60)] mb-1.5 md:mb-3">
                    {item.variation || item.variant ? `Variant: ${item.variation || item.variant}` : (prod.pack || '')}
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="font-display font-price font-bold text-[var(--brand-green,#236B34)] text-sm md:text-lg">
                          ₹{applicableUnitPrice.toLocaleString('en-IN')}
                        </span>
                        {mrp > applicableUnitPrice && (
                          <span className="text-[10px] md:text-xs text-[var(--brand-ink-muted,#5B6B60)]/60 line-through font-price">
                            ₹{mrp.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      {hasDiscount && (
                        <span className="text-[10px] md:text-xs text-[var(--brand-orange,#F97316)] font-bold">
                          {Math.round(((mrp - applicableUnitPrice) / mrp) * 100)}% OFF
                        </span>
                      )}
                      {isTieredApplied && (
                         <span className="text-[9px] md:text-[10px] text-[var(--brand-green,#236B34)] font-bold bg-[var(--brand-leaf-tint,#EAF5E0)] px-1.5 py-0.5 rounded border border-[var(--brand-leaf)]/30">
                           Bulk Price Applied
                         </span>
                      )}
                    </div>

                    {!isFreeGift ? (
                    <div className="flex items-center gap-2 md:gap-3 bg-[var(--brand-leaf-tint,#EAF5E0)]/80 rounded-xl p-0.5 md:p-1 border border-[var(--brand-leaf,#5FA82E)]/30">
                      <button
                        onClick={() => {
                           const vId = item.variantId || (prod as any).variantId || (prod as any).selectedVariant?._id || item.variant;
                           const vTitle = item.variation || (prod as any).variantTitle || (prod as any).pack;
                           updateQuantity(prodId, qty - 1, vId, vTitle);
                        }}
                        className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center bg-white rounded-lg shadow-xs text-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green,#236B34)] hover:text-white disabled:opacity-50 transition-colors text-xs md:text-base font-bold"
                        disabled={loading}
                      >
                        -
                      </button>
                      <span className="w-5 md:w-8 text-center font-display font-price font-bold text-xs md:text-base text-[var(--brand-green-deep,#14401F)]">{qty}</span>
                      <button
                        onClick={() => {
                           const vId = item.variantId || (prod as any).variantId || (prod as any).selectedVariant?._id || item.variant;
                           const vTitle = item.variation || (prod as any).variantTitle || (prod as any).pack;
                           updateQuantity(prodId, qty + 1, vId, vTitle);
                        }}
                        className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center bg-white rounded-lg shadow-xs text-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green,#236B34)] hover:text-white disabled:opacity-50 transition-colors text-xs md:text-base font-bold"
                        disabled={loading}
                      >
                        +
                      </button>
                    </div>
                    ) : (
                        <div className="text-[10px] md:text-xs font-bold text-[var(--brand-green,#236B34)] bg-[var(--brand-leaf-tint,#EAF5E0)] px-2.5 py-1 rounded-full border border-[var(--brand-leaf)]/30">
                            FREE GIFT
                        </div>
                    )}
                  </div>
                </div>

                {/* Delete Button */}
                {!isFreeGift && (
                <button
                  onClick={() => removeFromCart(prodId)}
                  className="text-neutral-400 hover:text-[var(--brand-error,#D6402F)] p-1 md:p-2 transition-colors self-start"
                  disabled={loading}
                  aria-label="Remove item"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                )}
              </div>
            </motion.div>
          );
        })}
        </AnimatePresence>
      </div>

      {/* Order Summary */}
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 mb-36 md:mb-8">
        <div className="bg-white rounded-2xl border border-[var(--brand-border,#E9E2D3)] p-4 md:p-6 shadow-[0_4px_16px_rgba(35,107,52,0.05)] md:max-w-md md:ml-auto">
          <h2 className="text-base md:text-xl font-display font-bold text-[var(--brand-green-deep,#14401F)] mb-3 md:mb-6">Order Summary</h2>
          <div className="space-y-2.5 md:space-y-4 mb-3 md:mb-6">
            <div className="flex justify-between text-[var(--brand-ink,#1C2B20)] text-xs md:text-base">
              <span>Subtotal</span>
              <span className="font-price font-bold">₹{(cart.total || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-[var(--brand-ink,#1C2B20)] text-xs md:text-base">
              <span>Platform Fee</span>
              <span className="font-price font-bold">₹{(platformFee || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-[var(--brand-ink,#1C2B20)] text-xs md:text-base">
              <span>Delivery Charges</span>
              <span className={`font-price font-bold ${deliveryFee === 0 ? 'text-[var(--brand-green,#236B34)]' : ''}`}>
                {deliveryFee === 0 ? 'Free' : `₹${deliveryFee.toLocaleString('en-IN')}`}
              </span>
            </div>
            {(cart.total || 0) < (appConfig.freeDeliveryThreshold || 500) && (
              <div className="text-[11px] md:text-xs font-semibold text-[var(--brand-green,#236B34)] bg-[var(--brand-leaf-tint,#EAF5E0)] px-2.5 py-1.5 rounded-lg border border-[var(--brand-leaf)]/20">
                Add ₹{((appConfig.freeDeliveryThreshold || 500) - (cart.total || 0)).toLocaleString('en-IN')} more for free delivery
              </div>
            )}
          </div>
          <div className="border-t border-[var(--brand-border,#E9E2D3)] pt-3 md:pt-6">
            <div className="flex justify-between items-center mb-3 md:mb-6">
              <span className="text-base md:text-xl font-display font-bold text-[var(--brand-green-deep,#14401F)]">Total</span>
              <span className="text-lg md:text-2xl font-display font-price font-bold text-[var(--brand-green,#236B34)]">
                ₹{(totalAmount || 0).toLocaleString('en-IN')}
              </span>
            </div>
            {/* Desktop Proceed to Checkout Button */}
            <div className="hidden md:block">
              <Button
                variant="default"
                size="lg"
                onClick={handleCheckout}
                className="w-full py-3 text-base rounded-xl bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] text-white font-bold shadow-md"
              >
                Proceed to Checkout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Mobile Proceed to Checkout Button - Positioned right above the bottom navbar */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[var(--brand-border,#E9E2D3)] p-3 z-40 md:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="max-w-md mx-auto">
          <Button
            variant="default"
            size="lg"
            onClick={handleCheckout}
            className="w-full py-2.5 text-sm font-bold rounded-xl shadow-md bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] text-white"
          >
            Proceed to Checkout
          </Button>
        </div>
      </div>
    </div>
  );
}

