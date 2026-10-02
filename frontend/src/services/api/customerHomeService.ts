import api from "./config";
import { apiCache } from "../../utils/apiCache";

export interface HomeContentResponse {
  success: boolean;
  data: {
    bestsellers: any[];
    lowestPrices?: any[];
    categories: any[];
    shops: any[];
    promoBanners: any[];
    trending: any[];
    cookingIdeas: any[];
    promoCards?: any[];
    promoStrip?: any; // PromoStrip data from backend
    homeSections?: any[];
  };
}

export const buildHomeContentCacheKey = (
  headerCategorySlug?: string,
  latitude?: number,
  longitude?: number,
  city?: string
) => `home-content-${headerCategorySlug || 'all'}-${latitude || 0}-${longitude || 0}-${city || ''}`;

export const getCachedHomeContent = (
  headerCategorySlug?: string,
  latitude?: number,
  longitude?: number,
  city?: string
): HomeContentResponse | null => {
  return apiCache.getSync<HomeContentResponse>(
    buildHomeContentCacheKey(headerCategorySlug, latitude, longitude, city)
  );
};

/**
 * Get home page content with caching
 * @param headerCategorySlug - Optional header category slug to filter categories (e.g., 'winter', 'wedding')
 * @param useCache - Whether to use cache (default: true)
 * @param cacheTTL - Cache TTL in milliseconds (default: 5 minutes)
 */
export const getHomeContent = async (
  headerCategorySlug?: string,
  latitude?: number,
  longitude?: number,
  useCache: boolean = true,
  cacheTTL: number = 5 * 60 * 1000, // 5 minutes
  skipLoader: boolean = false,
  city?: string
): Promise<HomeContentResponse> => {
  const cacheKey = buildHomeContentCacheKey(
    headerCategorySlug,
    latitude,
    longitude,
    city
  );

  const fetchFn = async () => {
    const params: any = headerCategorySlug ? { headerCategorySlug } : {};
    if (latitude !== undefined && longitude !== undefined) {
      params.latitude = latitude;
      params.longitude = longitude;
    }
    if (city) {
      params.city = city;
    }
    const response = await api.get<HomeContentResponse>("/customer/home", {
      params,
      skipLoader
    } as any);
    return response.data;
  };

  if (useCache) {
    return apiCache.getOrFetch(cacheKey, fetchFn, cacheTTL);
  }

  return fetchFn();
};

export const getLowestPricesProducts = async (
  latitude?: number,
  longitude?: number
): Promise<{ success: boolean; data: any[] }> => {
  const params: Record<string, number> = {};
  if (latitude !== undefined && longitude !== undefined) {
    params.latitude = latitude;
    params.longitude = longitude;
  }
  const response = await api.get("/customer/home/lowest-prices", { params });
  return response.data;
};

/**
 * Get products for a specific "shop" (e.g. Spiritual Store)
 */
export const getStoreProducts = async (
  storeId: string,
  latitude?: number,
  longitude?: number,
  page?: number,
  limit?: number
): Promise<any> => {
  const params: any = { page, limit };
  if (latitude !== undefined && longitude !== undefined) {
    params.latitude = latitude;
    params.longitude = longitude;
  }
  const response = await api.get(`/customer/home/store/${storeId}`, { params });
  return response.data;
};
