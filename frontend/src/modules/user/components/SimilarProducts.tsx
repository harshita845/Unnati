import { Product } from '../../../types/domain';
import { useNavigate } from 'react-router-dom';
import { calculateProductPrice } from '../../../utils/priceUtils';

interface SimilarProductsProps {
  products: Product[];
  currentProductId: string;
}

export default function SimilarProducts({ products, currentProductId }: SimilarProductsProps) {
  const navigate = useNavigate();

  // Filter out current product and limit to 6
  const similarProducts = products
    .filter((p) => p.id !== currentProductId)
    .slice(0, 6);

  if (similarProducts.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-display font-bold text-[var(--brand-green-deep,#14401F)] mb-4 px-4">Similar products</h3>
      <div className="px-4">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 scroll-smooth">
          {similarProducts.map((product) => {
            const { displayPrice, mrp, hasDiscount } = calculateProductPrice(product);
            return (
              <div
                key={product.id}
                onClick={() => navigate(`/product/${product.id}`)}
                className="flex-shrink-0 w-32 bg-white rounded-2xl shadow-[0_4px_16px_rgba(35,107,52,0.06)] border border-[var(--brand-border,#E9E2D3)] overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              >
                {/* Image */}
                <div className="w-full h-24 bg-[var(--brand-cream-soft,#F6EFE2)] flex items-center justify-center overflow-hidden">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[var(--brand-cream-soft,#F6EFE2)] text-[var(--brand-green,#236B34)] text-2xl font-display font-bold">
                      {product.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-2.5">
                  <p className="text-[11px] text-[var(--brand-ink-muted,#5B6B60)] mb-1">
                      {product.variations?.[0]?.value || product.pack}
                  </p>
                  <h4 className="text-xs font-semibold text-[var(--brand-ink,#1C2B20)] line-clamp-2 mb-1 min-h-[2rem]">
                    {product.name}
                  </h4>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-price font-bold text-[var(--brand-green-deep,#14401F)]">₹{displayPrice.toLocaleString('en-IN')}</span>
                    {hasDiscount && (
                      <span className="text-[11px] text-[var(--brand-ink-muted,#5B6B60)] line-through">₹{mrp.toLocaleString('en-IN')}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


