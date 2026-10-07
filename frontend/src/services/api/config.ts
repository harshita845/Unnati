import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import {
  detectModuleFromPath,
  getCurrentModuleToken,
  setModuleAuthToken,
  removeModuleAuthToken,
} from "../../utils/moduleAuth";

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _apiFailoverAttempted?: boolean;
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

  return unique([
    fromCustom,
    fromEnvBase,
    fromEnvRoot,
    originCandidate,
    "/api/v1",
  ]);
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

    // Keep session persistent across refreshes and transient API failures.
    // Do not auto-clear token or force-redirect on 401; only explicit logout should clear auth.
    if (error.response?.status === 401) {
      console.warn("⚠️ Received 401 response. Keeping session intact (manual logout only).");
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
