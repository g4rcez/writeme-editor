/**
 * Core currency conversion logic
 * Orchestrates caching, API calls, and conversion calculations
 */

import type { ConversionResult } from "./types";
import { fetchExchangeRates } from "./api-client";
import {
  getCachedRates,
  setCachedRates,
  getStaleCachedRates,
} from "./cache";
import { validateCurrencyCode } from "./parser";

/**
 * Convert amount from one currency to another
 * Uses caching and falls back to stale cache on API failure
 *
 * Algorithm:
 * 1. Check if same currency (short-circuit)
 * 2. Check cache for base currency rates
 * 3. If cache valid: use cached rate
 * 4. If cache miss: fetch from API, cache result
 * 5. If API fails: try stale cache
 * 6. Calculate: result = amount * rate
 *
 * @param amount - Amount to convert
 * @param from - Source currency code
 * @param to - Target currency code
 * @returns Conversion result with rate and source
 * @throws InvalidCurrencyError if currency codes are invalid
 * @throws NetworkError if API fails and no stale cache available
 */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string,
): Promise<ConversionResult> {
  // Validate currency codes
  validateCurrencyCode(from);
  validateCurrencyCode(to);

  // Short-circuit: same currency conversion
  if (from === to) {
    return {
      from,
      to,
      amount,
      rate: 1.0,
      result: amount,
      timestamp: Date.now(),
      source: "cache", // Consider same-currency as cached
    };
  }

  // Try to get exchange rate
  const { rate, source } = await getExchangeRate(from, to);

  // Calculate result
  const result = amount * rate;

  return {
    from,
    to,
    amount,
    rate,
    result,
    timestamp: Date.now(),
    source,
  };
}

/**
 * Get exchange rate between two currencies
 * Handles caching and API fallback logic
 *
 * @param from - Source currency code
 * @param to - Target currency code
 * @returns Exchange rate and source (cache/api/stale-cache)
 */
async function getExchangeRate(
  from: string,
  to: string,
): Promise<{ rate: number; source: "cache" | "api" | "stale-cache" }> {
  // Step 1: Check valid cache
  const cached = getCachedRates(from);
  if (cached) {
    const rate = cached.data.rates[to];
    if (rate !== undefined) {
      console.log(`Using cached rate for ${from} to ${to}: ${rate}`);
      return { rate, source: "cache" };
    }
  }

  // Step 2: Fetch from API
  try {
    const data = await fetchExchangeRates(from);

    // Cache the fresh data
    setCachedRates(from, data);

    const rate = data.rates[to];
    if (rate === undefined) {
      throw new Error(`Rate not found for ${to} in API response`);
    }

    console.log(`Fetched fresh rate for ${from} to ${to}: ${rate}`);
    return { rate, source: "api" };
  } catch (apiError) {
    console.warn("API fetch failed, trying stale cache:", apiError);

    // Step 3: Try stale cache as fallback
    const staleCache = getStaleCachedRates(from);
    if (staleCache) {
      const rate = staleCache.data.rates[to];
      if (rate !== undefined) {
        console.log(
          `Using stale cached rate for ${from} to ${to}: ${rate}`,
        );
        return { rate, source: "stale-cache" };
      }
    }

    // No fallback available, re-throw API error
    throw apiError;
  }
}

/**
 * Batch convert multiple amounts
 * Useful for converting multiple values with the same currency pair
 *
 * @param amounts - Array of amounts to convert
 * @param from - Source currency code
 * @param to - Target currency code
 * @returns Array of conversion results
 */
export async function convertCurrencyBatch(
  amounts: number[],
  from: string,
  to: string,
): Promise<ConversionResult[]> {
  // Get rate once for all conversions
  const { rate, source } = await getExchangeRate(from, to);

  return amounts.map((amount) => ({
    from,
    to,
    amount,
    rate,
    result: amount * rate,
    timestamp: Date.now(),
    source,
  }));
}

/**
 * Get current exchange rate without conversion
 * Useful for displaying rate information
 *
 * @param from - Source currency code
 * @param to - Target currency code
 * @returns Exchange rate and metadata
 */
export async function getRate(
  from: string,
  to: string,
): Promise<{
  rate: number;
  source: "cache" | "api" | "stale-cache";
  timestamp: number;
}> {
  validateCurrencyCode(from);
  validateCurrencyCode(to);

  if (from === to) {
    return {
      rate: 1.0,
      source: "cache",
      timestamp: Date.now(),
    };
  }

  const { rate, source } = await getExchangeRate(from, to);

  return {
    rate,
    source,
    timestamp: Date.now(),
  };
}
