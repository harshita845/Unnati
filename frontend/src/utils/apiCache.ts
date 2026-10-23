/**
 * Simple in-memory cache for API responses
 * Helps prevent duplicate requests and speeds up repeated calls
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class APICache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default
  private pendingRequests: Map<string, Promise<any>> = new Map();

  /**
   * Get cached data or fetch if not cached/expired
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    // Check if there's a pending request for this key
    const pendingRequest = this.pendingRequests.get(key);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Check cache
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data as T;
    }

    // Fetch new data
    const requestPromise = fetchFn().then((data) => {
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttl,
      });
      this.pendingRequests.delete(key);
      return data;
    }).catch((error) => {
      this.pendingRequests.delete(key);
      throw error;
    });

    this.pendingRequests.set(key, requestPromise);
    return requestPromise;
  }

  private isDispatching = false;

  /**
   * Delete a key from cache locally without firing invalidation events
   */
  delete(key: string): void {
    this.cache.delete(key);
    this.pendingRequests.delete(key);
  }

  /**
   * Invalidate cache for a specific key (and broadcast to other tabs)
   */
  invalidate(key: string, broadcast: boolean = true): void {
    this.cache.delete(key);
    this.pendingRequests.delete(key);
    if (typeof window !== 'undefined' && !this.isDispatching) {
      this.isDispatching = true;
      try {
        window.dispatchEvent(new CustomEvent('unnati_cache_invalidated', { detail: { key } }));
      } finally {
        this.isDispatching = false;
      }
      if (broadcast) {
        broadcastCacheEvent({ type: 'invalidate_key', key });
      }
    }
  }

  /**
   * Invalidate cache matching a pattern (and broadcast to other tabs)
   */
  invalidatePattern(pattern: string | RegExp, broadcast: boolean = true): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        this.pendingRequests.delete(key);
      }
    }
    if (typeof window !== 'undefined' && !this.isDispatching) {
      this.isDispatching = true;
      try {
        window.dispatchEvent(new CustomEvent('unnati_cache_invalidated', { detail: { pattern: regex.source } }));
      } finally {
        this.isDispatching = false;
      }
      if (broadcast) {
        broadcastCacheEvent({ type: 'invalidate_pattern', pattern: regex.source });
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(broadcast: boolean = true): void {
    this.cache.clear();
    this.pendingRequests.clear();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('unnati_cache_invalidated', { detail: { type: 'clear' } }));
      if (broadcast) {
        broadcastCacheEvent({ type: 'clear' });
      }
    }
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Check if data is cached and not expired (synchronous)
   */
  has(key: string): boolean {
    const cached = this.cache.get(key);
    return cached !== undefined && Date.now() < cached.expiresAt;
  }

  /**
   * Get cached data synchronously (returns null if not cached or expired)
   */
  getSync<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data as T;
    }
    return null;
  }
}

// Singleton instance
export const apiCache = new APICache();

// Cross-tab broadcast channel
const cacheChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('unnati_api_cache_channel')
    : null;

function broadcastCacheEvent(data: any) {
  try {
    cacheChannel?.postMessage(data);
    localStorage.setItem('unnati_cache_bust', JSON.stringify({ ...data, _ts: Date.now() }));
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

/**
 * Universal helper to invalidate caches and broadcast updates across components and tabs
 */
export const notifyContentSync = (
  type: 'categories' | 'products' | 'banners' | 'promo' | 'home' | 'deals' | 'all' = 'all',
  broadcastCrossTab: boolean = true
) => {
  if (typeof window === 'undefined') return;

  // 1. Invalidate in-memory caches
  if (type === 'categories' || type === 'all') {
    apiCache.delete('customer-categories-list');
    apiCache.delete('customer-categories-tree');
    apiCache.delete('customer-categories-list-false');
    apiCache.delete('customer-categories-list-true');
    apiCache.delete('header-categories-public');
    apiCache.invalidatePattern(/categor/, false);
    apiCache.invalidatePattern(/header-categor/, false);
    apiCache.invalidatePattern(/home-content/, false);
  }
  if (type === 'products' || type === 'all') {
    apiCache.invalidatePattern(/product/, false);
    apiCache.invalidatePattern(/search/, false);
    apiCache.invalidatePattern(/home-content/, false);
  }
  if (type === 'banners' || type === 'promo' || type === 'deals' || type === 'home' || type === 'all') {
    apiCache.invalidatePattern(/home-content/, false);
    apiCache.invalidatePattern(/promo/, false);
  }

  // 2. Dispatch custom events locally in current window
  const detail = { type, timestamp: Date.now() };
  window.dispatchEvent(new CustomEvent('unnati_content_updated', { detail }));
  if (type === 'categories' || type === 'all') {
    window.dispatchEvent(new CustomEvent('unnati_categories_updated', { detail }));
    window.dispatchEvent(new CustomEvent('header_categories_updated', { detail }));
    window.dispatchEvent(new CustomEvent('unnati_cache_invalidated', { detail: { type: 'clear', pattern: 'categor' } }));
  }
  if (type === 'products' || type === 'all') {
    window.dispatchEvent(new CustomEvent('productUpdated', { detail }));
  }
  if (type === 'banners' || type === 'all') {
    window.dispatchEvent(new CustomEvent('unnati_banners_updated', { detail }));
  }
  if (type === 'deals' || type === 'all') {
    window.dispatchEvent(new CustomEvent('unnati_deals_updated', { detail }));
  }
  if (type === 'promo' || type === 'all') {
    window.dispatchEvent(new CustomEvent('unnati_promo_updated', { detail }));
  }
  if (type === 'home' || type === 'all') {
    window.dispatchEvent(new CustomEvent('unnati_home_updated', { detail }));
  }

  // 3. Post to BroadcastChannel and localStorage for other tabs
  if (broadcastCrossTab) {
    try {
      cacheChannel?.postMessage({ type: 'content_updated', contentType: type, timestamp: Date.now() });
    } catch {}

    try {
      localStorage.setItem('unnati_content_bust', JSON.stringify({ type, _ts: Date.now() }));
    } catch {}
  }
};

if (typeof window !== 'undefined') {
  if (cacheChannel) {
    cacheChannel.onmessage = (event) => {
      const data = event.data;
      if (data?.type === 'invalidate_key' && data.key) {
        apiCache.invalidate(data.key, false);
      } else if (data?.type === 'invalidate_pattern' && data.pattern) {
        apiCache.invalidatePattern(new RegExp(data.pattern), false);
      } else if (data?.type === 'clear') {
        apiCache.clear(false);
      } else if (data?.type === 'content_updated') {
        notifyContentSync(data.contentType || 'all', false);
      } else if (data?.type === 'categories_updated' || data?.type === 'header_categories_updated') {
        notifyContentSync('categories', false);
      } else if (data?.type === 'banners_updated') {
        notifyContentSync('banners', false);
      } else if (data?.type === 'product_updated') {
        notifyContentSync('products', false);
      } else if (data?.type === 'deals_updated') {
        notifyContentSync('deals', false);
      } else if (data?.type === 'promo_updated') {
        notifyContentSync('promo', false);
      } else if (data?.type === 'home_updated') {
        notifyContentSync('home', false);
      }
    };
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'unnati_cache_bust' && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        if (data?.type === 'invalidate_pattern' && data.pattern) {
          apiCache.invalidatePattern(new RegExp(data.pattern), false);
        } else if (data?.type === 'invalidate_key' && data.key) {
          apiCache.invalidate(data.key, false);
        }
      } catch {
        // ignore
      }
    } else if (e.key === 'unnati_category_bust') {
      notifyContentSync('categories', false);
    } else if (e.key === 'unnati_content_bust' && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        notifyContentSync(data?.type || 'all', false);
      } catch {
        notifyContentSync('all', false);
      }
    }
  });

  // Clean expired entries every minute
  setInterval(() => {
    apiCache.cleanExpired();
  }, 60 * 1000);
}

