import api from './config';
import { apiCache } from '../../utils/apiCache';

export interface HeaderCategory {
    _id: string; // MongoDB ID
    id?: string; // For backward compatibility if needed
    name: string;
    iconLibrary: string; // 'IonIcons' | 'MaterialIcons' | 'FontAwesome' | 'Feather'
    iconName: string;
    image?: string; // Optional image URL
    slug: string; // Internal identifier/URL slug
    theme: string; // Maps to theme key in themes.ts
    addButtonColor?: string; // Custom color for ADD button
    offerTagColor?: string; // Custom color for offer badge
    relatedCategory?: string;
    status: 'Published' | 'Unpublished';
    order?: number;
    /** Does any main category under this header need a paid seller plan? */
    subscriptionRequired?: boolean;
    /** Cheapest active plan price covering it, when subscriptionRequired is true */
    subscriptionFromPrice?: number | null;
    /** Admin list only: the subscription rule set on this header (covers all its categories and subcategories) */
    subscription?: HeaderSubscriptionRule & { categoryCount: number };
}

export interface HeaderSubscriptionRule {
    subscriptionEnabled: boolean;
    /** Days products stay visible after a plan expires; null = store default, 0 = hide at once */
    subscriptionGraceDays: number | null;
    /** null = store default */
    subscriptionBillType: 'gst' | 'receipt' | null;
}

const HEADER_CATEGORIES_CACHE_KEY = 'header-categories-public';

export const getCachedHeaderCategoriesPublic = (): HeaderCategory[] | null =>
    apiCache.getSync<HeaderCategory[]>(HEADER_CATEGORIES_CACHE_KEY);

export const getHeaderCategoriesPublic = async (skipLoader = false, forceRefresh = false): Promise<HeaderCategory[]> => {
    if (forceRefresh) {
        apiCache.invalidate(HEADER_CATEGORIES_CACHE_KEY);
    }
    return apiCache.getOrFetch(
        HEADER_CATEGORIES_CACHE_KEY,
        async () => {
            const response = await api.get<HeaderCategory[]>('/header-categories', {
                skipLoader
            } as any);
            return response.data;
        },
        5 * 60 * 1000
    );
};

export const getHeaderCategoriesAdmin = async (): Promise<HeaderCategory[]> => {
    const response = await api.get<HeaderCategory[]>('/header-categories/admin');
    return response.data;
};

export const createHeaderCategory = async (data: Partial<HeaderCategory>): Promise<HeaderCategory> => {
    apiCache.invalidate(HEADER_CATEGORIES_CACHE_KEY);
    const response = await api.post<HeaderCategory>('/header-categories', data);
    apiCache.invalidate(HEADER_CATEGORIES_CACHE_KEY);
    return response.data;
};

export const updateHeaderCategory = async (id: string, data: Partial<HeaderCategory>): Promise<HeaderCategory> => {
    apiCache.invalidate(HEADER_CATEGORIES_CACHE_KEY);
    const response = await api.put<HeaderCategory>(`/header-categories/${id}`, data);
    apiCache.invalidate(HEADER_CATEGORIES_CACHE_KEY);
    return response.data;
};

/**
 * Subscription rule for a whole header category (e.g. Winter): it applies to every category and
 * subcategory under it. existingSellers decides what sellers already selling there get when switched on.
 */
export const updateHeaderSubscription = async (
    id: string,
    data: HeaderSubscriptionRule & {
        existingSellers?: { mode: 'trial'; trialStartDate?: string; trialEndDate?: string } | { mode: 'buy' };
    }
): Promise<{ success: boolean; message: string; data: HeaderSubscriptionRule & { categoryCount: number } }> => {
    const response = await api.put(`/header-categories/${id}/subscription`, data);
    apiCache.invalidate(HEADER_CATEGORIES_CACHE_KEY);
    return response.data;
};

export const deleteHeaderCategory = async (id: string): Promise<{ message: string }> => {
    apiCache.invalidate(HEADER_CATEGORIES_CACHE_KEY);
    const response = await api.delete<{ message: string }>(`/header-categories/${id}`);
    apiCache.invalidate(HEADER_CATEGORIES_CACHE_KEY);
    return response.data;
};
