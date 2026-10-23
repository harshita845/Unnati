import { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { getTheme, Theme } from '../utils/themes';
import { getCachedHeaderCategoriesPublic, getHeaderCategoriesPublic } from '../services/api/headerCategoryService';
import { detectModuleFromPath } from '../utils/moduleAuth';

interface ThemeContextType {
    activeCategory: string;
    setActiveCategory: (category: string) => void;
    currentTheme: Theme;
    themeKey: string;
    currentCategory: any | null;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [activeCategory, setActiveCategory] = useState('all');
    const [headerCategories, setHeaderCategories] = useState<any[]>(() => getCachedHeaderCategoriesPublic() || []);

    const fetchHeaderCategories = async (force = false) => {
        try {
            const cats = await getHeaderCategoriesPublic(true, force);
            if (cats) {
                setHeaderCategories(cats);
            }
        } catch (error) {
            console.error('Failed to fetch header categories in ThemeProvider', error);
        }
    };

    useEffect(() => {
        // Header-category themes only style the customer app; the admin, seller and delivery apps
        // never read them, so don't fetch (or re-fetch on every focus) for those.
        if (detectModuleFromPath() !== 'user') return;

        let lastFetchAt = Date.now();
        fetchHeaderCategories(true);

        const handleUpdate = () => {
            lastFetchAt = Date.now();
            fetchHeaderCategories(true);
        };
        // Coming back to the tab only needs a refresh if the list could actually be stale; real
        // changes arrive through the events below.
        const handleFocus = () => {
            if (Date.now() - lastFetchAt > 60_000) handleUpdate();
        };
        const handleContentUpdated = (e: any) => {
            const type = e?.detail?.type;
            if (!type || type === 'categories' || type === 'all') {
                fetchHeaderCategories(true);
            }
        };

        window.addEventListener('focus', handleFocus);
        window.addEventListener('header_categories_updated', handleUpdate);
        window.addEventListener('unnati_categories_updated', handleUpdate);
        window.addEventListener('unnati_content_updated', handleContentUpdated);

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('header_categories_updated', handleUpdate);
            window.removeEventListener('unnati_categories_updated', handleUpdate);
            window.removeEventListener('unnati_content_updated', handleContentUpdated);
        };
    }, []);

    const slugToThemeMap = useMemo(() => {
        const map = new Map<string, string>();
        headerCategories.forEach(cat => {
            map.set(cat.slug, cat.theme || cat.slug);
        });
        return map;
    }, [headerCategories]);

    const themeKey = useMemo(() => {
        return slugToThemeMap.get(activeCategory) || activeCategory || 'all';
    }, [activeCategory, slugToThemeMap]);

    const currentTheme = getTheme(themeKey);

    const currentCategory = useMemo(() => {
        return headerCategories.find(cat => cat.slug === activeCategory) || null;
    }, [activeCategory, headerCategories]);

    return (
        <ThemeContext.Provider value={{ activeCategory, setActiveCategory, currentTheme, themeKey, currentCategory }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useThemeContext() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useThemeContext must be used within a ThemeProvider');
    }
    return context;
}
