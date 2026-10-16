import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../../context/CartContext';
import { Product } from '../../../types/domain';
import ProductCard from './ProductCard';
import { useThemeContext } from '../../../context/ThemeContext';

interface LowestPricesEverProps {
  activeTab?: string;
  products?: Product[]; // Admin-selected products from home data
}

export default function LowestPricesEver({ activeTab = 'all', products: adminProducts }: LowestPricesEverProps) {
  const { currentTheme: theme } = useThemeContext();
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { cart } = useCart();
  const [fontLoaded, setFontLoaded] = useState(false);

  // Preload and wait for font to load to prevent FOUT
  useEffect(() => {
    if (document.fonts && document.fonts.check) {
      if (document.fonts.check('1em "Poppins"')) {
        setFontLoaded(true);
        return;
      }

      const checkFont = async () => {
        try {
          await document.fonts.load('1em "Poppins"');
          setFontLoaded(true);
        } catch (e) {
          setTimeout(() => setFontLoaded(true), 300);
        }
      };

      checkFont();
    } else {
      setTimeout(() => setFontLoaded(true), 300);
    }
  }, []);

  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!adminProducts || adminProducts.length === 0) {
      setProducts([]);
      return;
    }

    const mappedProducts = adminProducts.map((p: any) => {
      let productName = p.productName || p.name || '';
      productName = productName
        .replace(/\s*-\s*(Fresh|Quality|Assured|Premium|Best|Top|Hygienic|Carefully|Selected).*$/i, '')
        .trim();

      let packValue = p.variations?.[0]?.title || p.pack || 'Standard';
      if (packValue && packValue.includes(' - ')) {
        packValue = packValue.split(' - ')[0].trim();
      }

      return {
        ...p,
        id: p._id || p.id,
        name: productName,
        imageUrl: p.mainImage || p.imageUrl,
        mrp: p.mrp || p.price,
        pack: packValue,
        isAvailable: p.isAvailable !== false,
      };
    });

    setProducts(mappedProducts);
  }, [adminProducts]);

  const discountedProducts = products.slice(0, 20);

  if (!discountedProducts || discountedProducts.length === 0) {
    return null;
  }

  return (
    <div
      className="relative"
      style={{
        backgroundColor: 'var(--brand-cream, #FDF9F2)',
        marginTop: '0px',
        paddingTop: '12px',
        paddingBottom: '16px',
      }}
    >
      {/* Scalloped Divider at Top */}
      <div className="absolute top-0 left-0 right-0" style={{ height: '30px', zIndex: 10, opacity: 0.95 }}>
        <svg
          viewBox="0 0 1200 30"
          preserveAspectRatio="none"
          className="w-full h-full"
          style={{ display: 'block' }}
        >
          <path
            d="M0,30 L0,15
               Q25,0 50,15
               T100,15
               T150,15
               T200,15
               T250,15
               T300,15
               T350,15
               T400,15
               T450,15
               T500,15
               T550,15
               T600,15
               T650,15
               T700,15
               T750,15
               T800,15
               T850,15
               T900,15
               T950,15
               T1000,15
               T1050,15
               T1100,15
               T1150,15
               L1200,15
               L1200,30 Z"
            fill="var(--brand-cream, #FDF9F2)"
            stroke="var(--brand-cream, #FDF9F2)"
            strokeWidth="0"
          />
        </svg>
      </div>

      {/* LOWEST PRICES EVER Banner */}
      <div className="px-4 relative z-10" style={{ marginTop: '30px', marginBottom: '12px' }} data-section="lowest-prices">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="flex-1 h-px bg-[var(--brand-border,#E9E2D3)]"></div>

          <h2
            className="font-display font-bold text-center whitespace-nowrap text-xl md:text-2xl lg:text-[32px] tracking-tight text-[var(--brand-green-deep,#14401F)]"
          >
            <span>Lowest Prices </span>
            <span className="text-[var(--brand-orange,#F97316)]">Ever</span>
          </h2>

          <div className="flex-1 h-px bg-[var(--brand-border,#E9E2D3)]"></div>
        </div>
      </div>

      {/* Horizontal Scrollable Product Cards */}
      <div
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide px-[22px] md:px-4"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {discountedProducts.map((product) => (
          <div
            key={product.id}
            className="flex-shrink-0 w-[170px] md:w-[220px]"
            style={{ scrollSnapAlign: 'start' }}
          >
            <ProductCard
              product={product}
              showStockInfo={true}
              showVegetarianIcon={false}
              showRating={true}
              categoryStyle={true}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-center px-4 pt-3">
        <button
          type="button"
          onClick={() => navigate('/lowest-prices-ever')}
          className="text-xs font-bold flex items-center gap-1 transition-colors bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl border border-[var(--brand-border,#E9E2D3)] text-[var(--brand-green,#236B34)] hover:bg-white shadow-sm"
        >
          View All
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
