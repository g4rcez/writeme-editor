import type { ExchangeRateData, CachedRates } from "./types";
import { SettingsService } from "../../store/settings";

const CACHE_KEY_PREFIX = "WRITEME_CURRENCY_RATES_";

const DEFAULT_CACHE_DURATION = 60 * 60 * 1000;

export function getCachedRates(baseCurrency: string): CachedRates | null {
    const cacheKey = buildCacheKey(baseCurrency);

    try {
        const cached = localStorage.getItem(cacheKey);
        if (!cached) {
            return null;
        }
        const parsedCache: CachedRates = JSON.parse(cached);
        if (isCacheValid(parsedCache)) {
            return parsedCache;
        }
        localStorage.removeItem(cacheKey);
        return null;
    } catch (error) {
        console.error("Error reading currency cache:", error);
        try {
            localStorage.removeItem(cacheKey);
        } catch (removeError) {
            console.error("Error removing invalid currency cache:", removeError);
        }
        return null;
    }
}

/**
 * Save exchange rates to cache
 *
 * @param baseCurrency - The base currency code
 * @param data - Exchange rate data to cache
 */
export function setCachedRates(baseCurrency: string, data: ExchangeRateData): void {
    const cacheKey = buildCacheKey(baseCurrency);
    const cacheDuration = getCacheDuration();
    const now = Date.now();

    const cachedData: CachedRates = {
        data,
        fetchedAt: now,
        expiresAt: now + cacheDuration,
    };

    try {
        localStorage.setItem(cacheKey, JSON.stringify(cachedData));
    } catch (error) {
        console.error("Error saving currency cache:", error);

        // If quota exceeded, try to clear old cache entries
        if (error instanceof Error && error.name === "QuotaExceededError") {
            clearOldCacheEntries();
            // Try again after cleanup
            try {
                localStorage.setItem(cacheKey, JSON.stringify(cachedData));
            } catch {
                console.error("Failed to save cache even after cleanup");
            }
        }
    }
}

/**
 * Check if cached rates are still valid (not expired)
 *
 * @param cached - Cached rates to validate
 * @returns true if cache is still valid, false if expired
 */
function isCacheValid(cached: CachedRates): boolean {
    const now = Date.now();
    return now < cached.expiresAt;
}

/**
 * Get stale cache (expired but available for fallback)
 * Use this when API is unavailable to provide offline support
 *
 * @param baseCurrency - The base currency code
 * @returns Stale cached rates or null if not found
 */
export function getStaleCachedRates(baseCurrency: string): CachedRates | null {
    const cacheKey = buildCacheKey(baseCurrency);

    try {
        const cached = localStorage.getItem(cacheKey);
        if (!cached) {
            return null;
        }

        const parsedCache: CachedRates = JSON.parse(cached);
        return parsedCache; // Return even if expired
    } catch (error) {
        console.error("Error reading stale currency cache:", error);
        return null;
    }
}

/**
 * Clear old cache entries (older than 7 days)
 * Called when localStorage quota is exceeded
 */
function clearOldCacheEntries(): void {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    try {
        const keysToRemove: string[] = [];

        // Find all old currency cache keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(CACHE_KEY_PREFIX)) {
                try {
                    const cached = localStorage.getItem(key);
                    if (cached) {
                        const parsedCache: CachedRates = JSON.parse(cached);
                        if (parsedCache.fetchedAt < sevenDaysAgo) {
                            keysToRemove.push(key);
                        }
                    }
                } catch {
                    // If can't parse, remove it
                    keysToRemove.push(key);
                }
            }
        }

        // Remove old entries
        keysToRemove.forEach((key) => {
            localStorage.removeItem(key);
        });

        console.log(`Cleared ${keysToRemove.length} old currency cache entries`);
    } catch (error) {
        console.error("Error clearing old cache entries:", error);
    }
}

/**
 * Build cache key for a base currency
 * Format: WRITEME_CURRENCY_RATES_{BASE}_{DATE}
 *
 * @param baseCurrency - The base currency code
 * @returns Cache key for localStorage
 */
function buildCacheKey(baseCurrency: string): string {
    return `${CACHE_KEY_PREFIX}${baseCurrency}`;
}

/**
 * Get cache duration from settings
 * Falls back to default if not configured
 *
 * @returns Cache duration in milliseconds
 */
function getCacheDuration(): number {
    try {
        const settings = SettingsService.load();
        return settings.currency?.cacheDuration || DEFAULT_CACHE_DURATION;
    } catch {
        return DEFAULT_CACHE_DURATION;
    }
}
