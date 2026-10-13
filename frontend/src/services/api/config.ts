import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import {
  detectModuleFromPath,
  getCurrentModuleToken,
  setModuleAuthToken,
  removeModuleAuthToken,
} from "../../utils/moduleAuth";

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _apiFailoverAttempted?: boolean;
  _networkRetried?: boolean;
};

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, "");

const withApiVersionPath = (value: string): string => {
  if (/\/api\/v\d+$/i.test(value)) return normalizeBaseUrl(value);
  if (/\/api$/i.test(value)) return `${normalizeBaseUrl(value)}/v1`;
  return `${normalizeBaseUrl(value)}/api/v1`;
};

const unique = (items: string[]): string[] => [...new Set(items.filter(Boolean))];

const buildApiBaseCandidates = (): string[] => {
  const customBase = typeof window !== "undefined" ? localStorage.getItem("CUSTOM_API_BASE_URL") : "";
  const fromCustom = customBase ? withApiVersionPath(customBase) : "";

  const fromEnvBase = import.meta.env.VITE_API_BASE_URL
    ? withApiVersionPath(import.meta.env.VITE_API_BASE_URL)
    : "";
  const fromEnvRoot = import.meta.env.VITE_API_URL
    ? withApiVersionPath(import.meta.env.VITE_API_URL)
    : "";

  if (import.meta.env.DEV) {
    return unique([fromCustom, fromEnvBase, fromEnvRoot, "/api/v1"]);
  }

  const originCandidate =
    typeof window !== "undefined" && window.location?.origin
      ? withApiVersionPath(window.location.origin)
      : "";

  // The website's own address only makes sense when the API is served from the same domain (no API
  // address configured). With an API address set (Vercel: website and backend are separate
  // projects) falling back to the website would send every later request to a host whose /api/...
  // returns the web page, so searches and lists would come back empty after one failed request.
  if (fromCustom || fromEnvBase || fromEnvRoot) {
    return unique([fromCustom, fromEnvBase, fromEnvRoot]);
  }
  return unique([originCandidate, "/api/v1"]);
};

const API_BASE_CANDIDATES = buildApiBaseCandidates();
let activeApiBaseIndex = 0;
let activeApiBaseUrl = API_BASE_CANDIDATES[activeApiBaseIndex] || "http://localhost:5001/api/v1";

const advanceApiBaseCandidate = (): string | null => {
  // In DEV mode, if VITE_API_BASE_URL is explicitly set, do not permanently corrupt the global base URL for all future requests
  if (import.meta.env.DEV && import.meta.env.VITE_API_BASE_URL) {
    console.warn("⚠️ API request failed in DEV mode. Keeping primary API_BASE_URL:", activeApiBaseUrl);
    return null;
  }
  if (activeApiBaseIndex >= API_BASE_CANDIDATES.length - 1) {
    return null;
  }
  activeApiBaseIndex += 1;
  activeApiBaseUrl = API_BASE_CANDIDATES[activeApiBaseIndex];
  console.warn("⚠️ Switching API base URL due to network failure:", activeApiBaseUrl);
  return activeApiBaseUrl;
};

export const getApiBaseURL = (): string => activeApiBaseUrl;

// Log API configuration on startup (only in development)
if (import.meta.env.DEV) {
  console.log('🔧 API Configuration:', {
    API_BASE_CANDIDATES,
    ACTIVE_API_BASE_URL: activeApiBaseUrl,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'not set (using relative path for proxy)',
    NODE_ENV: import.meta.env.MODE,
    'Note': 'Using Vite proxy. Ensure backend is running on http://localhost:5000'
  });
}

// Socket.io base URL - extract from API_BASE_URL by removing /api/v1
// Socket connections need the base server URL without the API path
export const getSocketBaseURL = (): string => {
  // Use VITE_API_URL if explicitly set (for socket connections)
  if (import.meta.env.VITE_API_URL) {
    return normalizeBaseUrl(import.meta.env.VITE_API_URL);
  }

  // In development, use localhost:5000 directly (since Vite proxy doesn't work for WebSockets)
  if (import.meta.env.DEV) {
    return "http://localhost:5001";
  }

  const apiBaseUrl = getApiBaseURL();
  const socketUrl = apiBaseUrl.replace(/\/api\/v\d+$|\/api$/, '');

  return normalizeBaseUrl(socketUrl || window.location.origin);
};

// Socket.IO needs a long-running server. A backend on Vercel serverless can't host it, so skip
// connecting there (otherwise every page keeps polling and logging 404s).
// Set VITE_ENABLE_SOCKETS=true to force it on, e.g. after moving the backend to Render.
export const isRealtimeAvailable = (): boolean => {
  if (import.meta.env.VITE_ENABLE_SOCKETS === 'true') return true;
  if (import.meta.env.VITE_ENABLE_SOCKETS === 'false') return false;
  try {
    return !new URL(getSocketBaseURL(), window.location.origin).hostname.endsWith('.vercel.app');
  } catch {
    return true;
  }
};

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: activeApiBaseUrl,
  timeout: 20000, // 20 seconds timeout to prevent hanging UI indefinitely
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - Add token to requests
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getCurrentModuleToken();
    const typedConfig = config as RetriableRequestConfig;
    typedConfig.baseURL = activeApiBaseUrl;

    // Ensure URL doesn't start with a slash when using baseURL with a path
    // This prevents axios from replacing the path part of baseURL (like /api/v1)
    if (typedConfig.url?.startsWith('/')) {
      typedConfig.url = typedConfig.url.substring(1);
    }

    console.log('🌐 API Request:', {
      url: typedConfig.url,
      fullUrl: typedConfig.baseURL ? `${typedConfig.baseURL}/${typedConfig.url}` : typedConfig.url,
      method: typedConfig.method,
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + '...' : null,
      currentPath: window.location.pathname
    });

    if (token && typedConfig.headers) {
      typedConfig.headers.Authorization = `Bearer ${token}`;
      console.log('✅ Token attached to request');
    } else {
      console.warn('⚠️ No token available for request');
    }
    return typedConfig;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

const LOGIN_PATHS: Record<string, string> = {
  admin: "/admin/login",
  seller: "/seller/login",
  delivery: "/delivery/login",
};
let redirectingToLogin = false;

/** Saved login no longer valid: clear it; panels go to their login page, customers become guests */
const handleDeadSession = () => {
  const module = detectModuleFromPath();
  if (!getCurrentModuleToken()) return;
  removeModuleAuthToken(module);
  const loginPath = LOGIN_PATHS[module];
  if (loginPath && !redirectingToLogin && !window.location.pathname.startsWith(loginPath)) {
    redirectingToLogin = true;
    console.warn("⚠️ Your login has expired. Please sign in again.");
    window.location.assign(`${loginPath}?expired=1`);
  }
};

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: any) => {
    const originalConfig = error.config as RetriableRequestConfig | undefined;
    const hasNetworkError = !error.response;
    if (hasNetworkError && originalConfig && !originalConfig._apiFailoverAttempted) {
      const nextBase = advanceApiBaseCandidate();
      if (nextBase) {
        originalConfig._apiFailoverAttempted = true;
        originalConfig.baseURL = nextBase;
        return api.request(originalConfig);
      }
    }

    // A dropped connection on a read: try once more shortly (not after a timeout, which would double
    // the wait). Writes are never repeated.
    if (
      hasNetworkError &&
      originalConfig &&
      !originalConfig._networkRetried &&
      error.code !== "ECONNABORTED" &&
      /^get$/i.test(originalConfig.method || "get")
    ) {
      originalConfig._networkRetried = true;
      return new Promise((resolve) => setTimeout(resolve, 600)).then(() => api.request(originalConfig));
    }

    // Keep session persistent across refreshes and transient API failures.
    // Only a login the server says can never work again (expired / signed with another secret)
    // is cleared: otherwise every request keeps failing with 401 while the panel looks signed in.
    if (error.response?.status === 401) {
      const message = String(error.response?.data?.message || "");
      if (message === "Token has expired" || message === "Invalid token") {
        handleDeadSession();
      } else {
        console.warn("⚠️ Received 401 response. Keeping session intact (manual logout only).");
      }
    }
    return Promise.reject(error);
  }
);

// Token management helpers
export const setAuthToken = (token: string) => {
  const module = detectModuleFromPath();
  console.log(`📍 setAuthToken called - Current path: ${window.location.pathname}, Detected module: ${module}`);
  setModuleAuthToken(token, module);
};

export const getAuthToken = (): string | null => {
  return getCurrentModuleToken();
};

export const removeAuthToken = () => {
  const module = detectModuleFromPath();
  removeModuleAuthToken(module);
};

export default api;
