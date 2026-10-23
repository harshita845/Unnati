/**
 * BrandingThemeContext — Centralized dynamic branding theme system.
 *
 * Separate from the existing ThemeContext (which handles category-based
 * customer header themes). This context manages the admin-controlled
 * platform branding with global + customer themes, localStorage caching,
 * and Socket.IO realtime sync.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  applyGlobalTheme,
  applyCustomerTheme,
  type GlobalTheme,
  type CustomerTheme,
} from "../utils/applyTheme";
import {
  fetchTheme,
  getCachedTheme,
  invalidateThemeCache,
  type ThemeResponse,
  type GlobalThemeData,
  type CustomerThemeData,
} from "../services/api/themeService";
import { io as socketIO, Socket } from "socket.io-client";
import { getSocketBaseURL, isRealtimeAvailable } from "../services/api/config";
import { apiCache, notifyContentSync } from "../utils/apiCache";

// ─── Context Type ───
interface BrandingThemeContextType {
  globalTheme: GlobalThemeData;
  customerTheme: CustomerThemeData;
  isLoading: boolean;
  error: string | null;
  refreshTheme: () => Promise<void>;
}

// ─── Fallback defaults (mirrors backend defaults) ───
// ─── Fallback defaults (mapped to Unnati Brand Logo Palette) ───
const FALLBACK_GLOBAL: GlobalThemeData = {
  primary: "#236B34",
  secondary: "#5FA82E",
  accent: "#F97316",
  background: "#FDF9F2",
  sidebar: "#14401F",
  navbar: "#14401F",
  text: "#1C2B20",
  success: "#5FA82E",
  warning: "#FFB020",
  danger: "#D6402F",
};

const FALLBACK_CUSTOMER: CustomerThemeData = {
  primary: "#236B34",
  secondary: "#5FA82E",
  accent: "#F97316",
  background: "#FDF9F2",
  text: "#1C2B20",
  success: "#5FA82E",
  warning: "#FFB020",
  danger: "#D6402F",
};

/**
 * If the API returns empty/old default values (e.g. #0B5D3B, #F2B134),
 * upgrade them to the official Unnati brand palette so the new logo theme takes effect.
 */
const normalizeCustomerTheme = (theme?: Partial<CustomerThemeData>): CustomerThemeData => {
  if (!theme) return FALLBACK_CUSTOMER;
  const isOldDefault =
    !theme.primary ||
    theme.primary.toLowerCase() === "#0b5d3b" ||
    theme.primary.toLowerCase() === "#ef4444" ||
    theme.primary.toLowerCase() === "#ffc94a";

  if (isOldDefault) {
    return {
      ...FALLBACK_CUSTOMER,
      ...(theme.primary && !isOldDefault ? theme : {}),
      primary: FALLBACK_CUSTOMER.primary,
      secondary: FALLBACK_CUSTOMER.secondary,
      accent: FALLBACK_CUSTOMER.accent,
      background: FALLBACK_CUSTOMER.background,
      text: FALLBACK_CUSTOMER.text,
    };
  }

  return {
    ...FALLBACK_CUSTOMER,
    ...theme,
  };
};

const normalizeGlobalTheme = (theme?: Partial<GlobalThemeData>): GlobalThemeData => {
  if (!theme) return FALLBACK_GLOBAL;
  const isOldDefault =
    !theme.primary ||
    theme.primary.toLowerCase() === "#0b5d3b" ||
    theme.primary.toLowerCase() === "#2563eb";

  if (isOldDefault) {
    return {
      ...FALLBACK_GLOBAL,
      ...(theme.primary && !isOldDefault ? theme : {}),
      primary: FALLBACK_GLOBAL.primary,
      secondary: FALLBACK_GLOBAL.secondary,
      accent: FALLBACK_GLOBAL.accent,
      background: FALLBACK_GLOBAL.background,
      sidebar: FALLBACK_GLOBAL.sidebar,
      navbar: FALLBACK_GLOBAL.navbar,
      text: FALLBACK_GLOBAL.text,
    };
  }

  return {
    ...FALLBACK_GLOBAL,
    ...theme,
  };
};

const BrandingThemeContext = createContext<BrandingThemeContextType | undefined>(
  undefined
);

export const BrandingThemeProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  // Hydrate from cache instantly to prevent flash, ignoring old fallback configs
  const cached = useMemo(() => {
    const data = getCachedTheme();
    if (
      data?.customerTheme?.primary === "#ef4444" ||
      data?.customerTheme?.primary === "#EF4444" ||
      data?.customerTheme?.primary === "#0b5d3b" ||
      data?.customerTheme?.primary === "#0B5D3B" ||
      data?.globalTheme?.primary === "#2563eb" ||
      data?.globalTheme?.primary === "#2563EB" ||
      data?.globalTheme?.primary === "#0b5d3b" ||
      data?.globalTheme?.primary === "#0B5D3B"
    ) {
      invalidateThemeCache();
      return null;
    }
    return data;
  }, []);

  const [globalTheme, setGlobalTheme] = useState<GlobalThemeData>(
    normalizeGlobalTheme(cached?.globalTheme)
  );
  const [customerTheme, setCustomerTheme] = useState<CustomerThemeData>(
    normalizeCustomerTheme(cached?.customerTheme)
  );
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  // Apply CSS variables whenever theme changes
  useEffect(() => {
    applyGlobalTheme(globalTheme as GlobalTheme);
  }, [globalTheme]);

  useEffect(() => {
    applyCustomerTheme(customerTheme as CustomerTheme);
  }, [customerTheme]);

  // Fetch from backend (with automatic retry if backend is momentarily busy/restarting)
  const refreshTheme = useCallback(async () => {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        setError(null);
        const data = await fetchTheme();
        setGlobalTheme(normalizeGlobalTheme(data.globalTheme));
        setCustomerTheme(normalizeCustomerTheme(data.customerTheme));
        setIsLoading(false);
        return;
      } catch (err: any) {
        attempts++;
        if (attempts >= maxAttempts) {
          console.warn("[BrandingTheme] Could not refresh theme from backend, using cached/fallback values:", err?.message || err);
          setError("Failed to load theme");
        } else {
          // Wait briefly before retrying
          await new Promise((r) => setTimeout(r, 1200));
        }
      } finally {
        if (attempts >= maxAttempts) {
          setIsLoading(false);
        }
      }
    }
  }, []);

  // Initial fetch (behind cache if available) and revalidation on tab focus
  useEffect(() => {
    refreshTheme();

    const handleFocus = () => {
      refreshTheme();
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshTheme]);

  // ─── Socket.IO realtime theme sync ───
  useEffect(() => {
    if (!isRealtimeAvailable()) return;
    try {
      const socketUrl = getSocketBaseURL();
      console.log("[BrandingTheme] Attempting socket connection to:", socketUrl);

      const socket = socketIO(socketUrl, {
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionDelay: 1500,
        reconnectionAttempts: 20,
        timeout: 10000,
        // No auth needed for theme events (broadcast to all)
      });

      socket.on("connect", () => {
        console.log("[BrandingTheme] Socket connected successfully");
      });

      socket.on("themeUpdated", (data: any) => {
        console.log("[BrandingTheme] Realtime theme update received:", data.type);

        if (data.globalTheme) {
          setGlobalTheme(data.globalTheme);
        }
        if (data.customerTheme) {
          setCustomerTheme(data.customerTheme);
        }

        // Invalidate cache so next page load fetches fresh
        invalidateThemeCache();
      });

      socket.on("contentUpdated", (data: any) => {
        console.log("[BrandingTheme] Realtime content update received:", data);
        notifyContentSync(data?.type || 'all', false);
      });

      socket.on("categoriesUpdated", () => {
        console.log("[BrandingTheme] Realtime categories update received");
        notifyContentSync('categories', false);
      });

      socket.on("productUpdated", (data: any) => {
        console.log("[BrandingTheme] Realtime product update received:", data);
        notifyContentSync('products', false);
      });

      socket.on("bannersUpdated", () => {
        console.log("[BrandingTheme] Realtime banners update received");
        notifyContentSync('banners', false);
      });

      socket.on("dealsUpdated", () => {
        console.log("[BrandingTheme] Realtime deals update received");
        notifyContentSync('deals', false);
      });

      socket.on("promoUpdated", () => {
        console.log("[BrandingTheme] Realtime promo update received");
        notifyContentSync('promo', false);
      });

      socket.on("homeUpdated", () => {
        console.log("[BrandingTheme] Realtime home update received");
        notifyContentSync('home', false);
      });

      socket.on("connect_error", (err: any) => {
        console.warn("[BrandingTheme] Socket connection error:", err.message);
      });

      socket.on("disconnect", (reason) => {
        console.log("[BrandingTheme] Socket disconnected:", reason);
      });

      socketRef.current = socket;
    } catch (err) {
      console.warn("[BrandingTheme] Failed to initialize socket:", err);
      // Silently fail - the theme will still work via HTTP API
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Refresh on tab focus
  useEffect(() => {
    const handleFocus = () => refreshTheme();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshTheme]);

  const value = useMemo(
    () => ({
      globalTheme,
      customerTheme,
      isLoading,
      error,
      refreshTheme,
    }),
    [globalTheme, customerTheme, isLoading, error, refreshTheme]
  );

  return (
    <BrandingThemeContext.Provider value={value}>
      {children}
    </BrandingThemeContext.Provider>
  );
};

/**
 * Hook to access branding theme data
 */
export const useBrandingTheme = (): BrandingThemeContextType => {
  const context = useContext(BrandingThemeContext);
  if (!context) {
    throw new Error(
      "useBrandingTheme must be used within a BrandingThemeProvider"
    );
  }
  return context;
};
