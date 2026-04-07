import type {
  ExchangeRateData,
  ExchangeRateAPIResponse,
  FrankfurterAPIResponse,
} from "./types";
import { NetworkError, APIError, RateLimitError } from "./types";

/**
 * API timeout in milliseconds
 */
const API_TIMEOUT = 5000;

/**
 * Primary API: Frankfurter (frankfurter.dev)
 * Free, no rate limits, European Central Bank data
 */
const FRANKFURTER_API_BASE = "https://api.frankfurter.dev/v1/latest";

/**
 * Fallback API: ExchangeRate-API (open.er-api.com)
 */
const EXCHANGERATE_API_BASE = "https://open.er-api.com/v6/latest";

/**
 * Fetch exchange rates for a base currency
 * Tries primary API first, falls back to secondary on failure
 *
 * @param baseCurrency - The base currency code (e.g., "USD")
 * @returns Exchange rate data
 * @throws NetworkError if both APIs fail
 * @throws APIError if API returns invalid data
 * @throws RateLimitError if rate limit is exceeded
 */
export async function fetchExchangeRates(
  baseCurrency: string,
): Promise<ExchangeRateData> {
  try {
    return await fetchFromFrankfurter(baseCurrency);
  } catch (primaryError) {
    console.warn(
      "Primary API (Frankfurter) failed, trying fallback:",
      primaryError,
    );
    try {
      return await fetchFromExchangeRateAPI(baseCurrency);
    } catch (fallbackError) {
      console.error("Both APIs failed:", { primaryError, fallbackError });
      throw primaryError; // Throw original error
    }
  }
}

/**
 * Fetch from fallback API (ExchangeRate-API)
 * https://www.exchangerate-api.com/docs/free
 *
 * @param baseCurrency - The base currency code
 * @returns Exchange rate data
 */
async function fetchFromExchangeRateAPI(
  baseCurrency: string,
): Promise<ExchangeRateData> {
  const url = `${EXCHANGERATE_API_BASE}/${baseCurrency}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        throw new RateLimitError();
      }
      throw new APIError(`API returned status ${response.status}`);
    }

    const data: ExchangeRateAPIResponse = await response.json();

    if (data.result !== "success") {
      if (data["error-type"] === "unsupported-code") {
        throw new APIError(`Unsupported currency: ${baseCurrency}`);
      }
      throw new APIError(data["error-type"] || "Unknown API error");
    }

    return transformExchangeRateAPIResponse(data);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new NetworkError("Request timeout - check your connection");
    }
    if (
      error instanceof NetworkError ||
      error instanceof APIError ||
      error instanceof RateLimitError
    ) {
      throw error;
    }
    throw new NetworkError("Failed to fetch exchange rates");
  }
}

/**
 * Fetch from primary API (Frankfurter)
 * https://www.frankfurter.dev/docs/
 *
 * @param baseCurrency - The base currency code
 * @returns Exchange rate data
 */
async function fetchFromFrankfurter(
  baseCurrency: string,
): Promise<ExchangeRateData> {
  const url = `${FRANKFURTER_API_BASE}?from=${baseCurrency}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        throw new RateLimitError();
      }
      throw new APIError(`API returned status ${response.status}`);
    }

    const data: FrankfurterAPIResponse = await response.json();

    return transformFrankfurterResponse(data);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new NetworkError("Request timeout - check your connection");
    }
    if (
      error instanceof NetworkError ||
      error instanceof APIError ||
      error instanceof RateLimitError
    ) {
      throw error;
    }
    throw new NetworkError("Failed to fetch exchange rates");
  }
}

/**
 * Transform ExchangeRate-API response to common format
 *
 * @param response - Raw API response
 * @returns Normalized exchange rate data
 */
function transformExchangeRateAPIResponse(
  response: ExchangeRateAPIResponse,
): ExchangeRateData {
  return {
    base: response.base_code,
    date: new Date(response.time_last_update_unix * 1000)
      .toISOString()
      .split("T")[0],
    rates: response.rates,
    timestamp: response.time_last_update_unix,
  };
}

/**
 * Transform Frankfurter API response to common format
 *
 * @param response - Raw API response
 * @returns Normalized exchange rate data
 */
function transformFrankfurterResponse(
  response: FrankfurterAPIResponse,
): ExchangeRateData {
  return {
    base: response.base,
    date: response.date,
    rates: response.rates,
    timestamp: Math.floor(new Date(response.date).getTime() / 1000),
  };
}
