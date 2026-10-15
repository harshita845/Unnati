import { useNavigate, useParams, Link, useLocation as useRouterLocation } from 'react-router-dom';
import { Product } from '../../types/domain';
import { useEffect, useState } from 'react';
import { getStoreProducts } from '../../services/api/customerHomeService';
import { useLocation } from '../../hooks/useLocation';
import ProductCard from './components/ProductCard';

const isMongoId = (val?: string | null): boolean => {
    if (!val) return false;
    return /^[0-9a-fA-F]{24}$/.test(val.trim());
};

export default function StorePage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const routerLocation = useRouterLocation();
    const locationState = (routerLocation.state as any) || {};
    const { location } = useLocation();
    const [products, setProducts] = useState<Product[]>([]);
    const [shopData, setShopData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 1000;

    useEffect(() => {
        const fetchData = async () => {
            if (!slug) return;
            try {
                setLoading(true);

                // Fetch shop data and products using the shop API endpoint
                const response = await getStoreProducts(
                    slug,
                    location?.latitude,
                    location?.longitude,
                    currentPage,
                    limit
                );
                console.log(`[StorePage] Response for slug "${slug}":`, {
                    success: response.success,
                    productsCount: response.data?.length || 0,
                    shop: response.shop ? { name: response.shop.name, image: response.shop.image } : null,
                    message: response.message
                });
                if (response.success) {
                    setProducts(response.data || []);
                    setShopData(response.shop || null);
                    if (response.pagination) {
                        setTotalPages(response.pagination.pages);
                    }
                } else {
                    setProducts([]);
                    setShopData(null);
                }
            } catch (error: any) {
                console.error('Failed to fetch store data:', error);
                console.error('Error details:', error.response?.data || error.message);
                setProducts([]);
                setShopData(null);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [slug, location, currentPage]);

    useEffect(() => {
        setCurrentPage(1); // Reset page when store changes
    }, [slug]);

    // Sanitize store name: never display raw 24-character hexadecimal Mongo IDs
    const rawName = shopData?.name || shopData?.storeName || locationState.storeName;
    const hasValidName = rawName && !isMongoId(rawName);
    const formattedSlug = slug && !isMongoId(slug)
        ? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/[-_]/g, ' ')
        : null;
    const storeName = hasValidName ? rawName : (formattedSlug || '');

    const [bannerImage, setBannerImage] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);

    // Determine banner image source
    useEffect(() => {
        const banner = shopData?.storeBanner || shopData?.banner || shopData?.image || locationState.storeImage;
        if (banner) {
            setBannerImage(banner);
            setImageError(false);
        } else if (slug && !isMongoId(slug)) {
            // Try multiple possible image paths
            const possiblePaths = [
                `/assets/shopbystore/${slug}/${slug}header.png`,
                `/assets/shopbystore/${slug}/header.png`,
                `/assets/shopbystore/${slug}.png`,
                `/assets/shopbystore/${slug}.jpg`,
            ];
            setBannerImage(possiblePaths[0]);
            setImageError(false);
        } else {
            setBannerImage(null);
            setImageError(true);
        }
    }, [shopData, slug, locationState.storeImage]);

    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const target = e.target as HTMLImageElement;
        const currentSrc = target.src;

        // Try fallback paths if current one fails
        if (slug && !isMongoId(slug) && currentSrc.includes('/assets/shopbystore/')) {
            const fallbackPaths = [
                `/assets/shopbystore/${slug}/header.png`,
                `/assets/shopbystore/${slug}.png`,
                `/assets/shopbystore/${slug}.jpg`,
            ];
            const currentIndex = fallbackPaths.findIndex(path => currentSrc.includes(path));

            if (currentIndex < fallbackPaths.length - 1) {
                target.src = fallbackPaths[currentIndex + 1];
                return;
            }
        }

        // If all paths failed, show fallback
        setImageError(true);
        target.style.display = 'none';
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Store Banner: Full-width coverage */}
            <div className="relative w-full h-44 sm:h-56 md:h-64 bg-neutral-100 overflow-hidden">
                {bannerImage && !imageError ? (
                    <img
                        src={bannerImage}
                        alt={storeName || 'Store Banner'}
                        className="w-full h-full object-cover object-center"
                        onError={handleImageError}
                        loading="eager"
                    />
                ) : (
                    <div className="banner-fallback w-full h-full bg-gradient-to-br from-emerald-50 via-teal-100 to-cyan-100 flex items-center justify-center">
                        {storeName && !isMongoId(storeName) ? (
                            <div className="text-3xl sm:text-4xl font-extrabold text-teal-800">
                                {storeName.charAt(0).toUpperCase()}
                            </div>
                        ) : (
                            <div className="w-14 h-14 rounded-full bg-white/80 shadow-sm flex items-center justify-center text-teal-800">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                    <polyline points="9 22 9 12 15 12 15 22" />
                                </svg>
                            </div>
                        )}
                    </div>
                )}

                {/* Header Overlay */}
                <header className="absolute top-0 left-0 right-0 z-10">
                    <div className="px-3 py-2 flex items-center justify-between gap-2">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-lg bg-white/70 shadow-sm hover:bg-white/80 transition-colors flex-shrink-0 border border-white/20"
                            aria-label="Back"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M15 18L9 12L15 6" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>

                        <div className="flex-1 min-w-0 px-2">
                            {loading && !storeName ? (
                                <div className="h-4 w-32 bg-white/70 rounded animate-pulse" />
                            ) : (
                                <h1 className="text-sm font-bold text-neutral-900 drop-shadow-sm truncate">
                                    {storeName || 'Store'}
                                </h1>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                                onClick={() => navigate('/search')}
                                className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-lg bg-white/70 shadow-sm hover:bg-white/80 transition-colors border border-white/20"
                                aria-label="Search"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <circle cx="11" cy="11" r="8" stroke="#000000" strokeWidth="2" />
                                    <path d="m21 21-4.35-4.35" stroke="#000000" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </header>

                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white via-white/40 to-transparent pointer-events-none" />
            </div>

            {/* Products Section */}
            <div className="px-4 py-4">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 min-h-[28px] flex items-center">
                    {loading && !storeName ? (
                        <span className="h-5 w-44 bg-neutral-200 rounded animate-pulse inline-block" />
                    ) : (
                        `Top buys in ${storeName || 'store'}`
                    )}
                </h3>

                {loading ? (
                    <div className="flex justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--customer-primary-dark)]"></div>
                    </div>
                ) : products.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
                        {products.map((product) => (
                            <ProductCard
                                key={product._id || product.id}
                                product={product}
                                categoryStyle={true}
                                showBadge={true}
                                showPackBadge={false}
                                showStockInfo={false}
                            />
                        ))}
                    </div>


                  </>
                ) : (
                    <div className="text-center py-20 text-neutral-500">
                        <p>No products found in this store yet.</p>
                        <Link to="/" className="text-[var(--customer-primary-dark)] font-medium mt-2 inline-block">Explore other categories</Link>
                    </div>
                )}
            </div>
        </div>
    );
}
