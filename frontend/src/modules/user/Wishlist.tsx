import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getWishlist, removeFromWishlist } from '../../services/api/customerWishlistService';
import { Product } from '../../types/domain';
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../hooks/useLocation';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/ui/button';
import { motion } from 'framer-motion';
import { calculateProductPrice } from '../../utils/priceUtils';

export default function Wishlist() {
  const navigate = useNavigate();
  const { location } = useLocation();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      const res = await getWishlist({
        latitude: location?.latitude,
        longitude: location?.longitude
      });
      if (res.success && res.data && Array.isArray(res.data.products)) {
        const rawProducts = res.data.products.filter((p: any) => p != null && (p._id || p.id));
        setProducts(rawProducts.map((p: any) => ({
          ...p,
          id: p._id || p.id,
          name: p.productName || p.name || 'Product',
          imageUrl: p.mainImageUrl || p.mainImage || p.imageUrl || '',
          price: p.price || p.variations?.[0]?.price || 0,
          pack: p.pack || p.variations?.[0]?.name || 'Standard'
        })) as any);
      } else {
        setProducts([]);
      }
    } catch (error: any) {
      console.error('Failed to fetch wishlist:', error);
      showToast(error.message || 'Failed to fetch wishlist', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, [location?.latitude, location?.longitude]);

  const handleRemove = async (productId: string) => {
    try {
      await removeFromWishlist(productId);
      setProducts(products.filter(p => (p.id !== productId && p._id !== productId)));
    } catch (error) {
      console.error('Failed to remove from wishlist:', error);
    }
  };

  return (
    <div className="pb-24 md:pb-8 bg-[var(--brand-cream,#FDF9F2)] min-h-screen">
      <div className="px-4 py-4 bg-white/90 backdrop-blur-md border-b border-[var(--brand-border,#E9E2D3)] mb-4 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 text-[var(--brand-ink,#1C2B20)]" aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <h1 className="font-display text-xl font-bold text-[var(--brand-ink,#1C2B20)]">My Wishlist</h1>
      </div>

      <div className="px-4">
        {loading ? (
          <div className="flex justify-center pt-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-green,#236B34)]"></div>
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {products.map((product) => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-2xl border border-[var(--brand-border,#E9E2D3)] shadow-[0_4px_16px_rgba(35,107,52,0.04)] overflow-hidden flex flex-col relative"
              >
                <button
                  onClick={() => handleRemove(product.id)}
                  className="absolute top-2 right-2 z-10 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-[var(--brand-orange,#F97316)] shadow-sm hover:scale-105 transition-transform"
                  aria-label="Remove from wishlist"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                </button>

                <Link to={`/product/${product.id}`} className="aspect-square bg-[var(--brand-cream-soft,#F6EFE2)]/40 flex items-center justify-center p-4">
                  {product.imageUrl || product.mainImage ? (
                    <img src={product.imageUrl || product.mainImage} alt={product.name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-4xl">📦</span>
                  )}
                </Link>

                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="text-sm font-semibold text-[var(--brand-ink,#1C2B20)] line-clamp-2 mb-1">{product.name}</h3>
                  <div className="text-[10px] text-[var(--brand-ink-muted,#5B6B60)] mb-2">{product.pack}</div>
                  <div className="mt-auto flex flex-col gap-2">
                    {(() => {
                      const { displayPrice, mrp, hasDiscount } = calculateProductPrice(product);
                      return (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-price text-sm font-bold text-[var(--brand-green-deep,#14401F)]">₹{displayPrice.toLocaleString('en-IN')}</span>
                          {hasDiscount && (
                            <span className="font-price text-xs text-neutral-400 line-through">₹{mrp.toLocaleString('en-IN')}</span>
                          )}
                        </div>
                      );
                    })()}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addToCart(product)}
                      className="w-full border-[var(--brand-green,#236B34)] text-[var(--brand-green,#236B34)] bg-[var(--brand-leaf-tint,#EAF5E0)] hover:bg-[var(--brand-green,#236B34)] hover:text-white rounded-xl h-8 text-xs font-bold transition-all"
                    >
                      ADD TO CART
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-[var(--brand-ink-muted,#5B6B60)]">
            <div className="text-6xl mb-4">💚</div>
            <h2 className="font-display text-lg font-bold text-[var(--brand-ink,#1C2B20)] mb-2">Your wishlist is empty</h2>
            <p className="text-sm mb-6 text-[var(--brand-ink-muted,#5B6B60)]">Explore more and shortlist some items</p>
            <Button onClick={() => navigate('/')} className="bg-[var(--brand-green,#236B34)] text-white hover:bg-[var(--brand-green-dark,#1B5128)] rounded-full px-8 shadow-md shadow-[var(--brand-green,#236B34)]/20">
              Start Shopping
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
