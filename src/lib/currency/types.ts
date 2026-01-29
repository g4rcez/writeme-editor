/**
 * Type definitions for currency conversion system
 */

/**
 * ISO 4217 currency codes
 * Subset of commonly used currencies for type safety
 */
export type CurrencyCode =
  | "USD" // US Dollar
  | "EUR" // Euro
  | "GBP" // British Pound
  | "JPY" // Japanese Yen
  | "CNY" // Chinese Yuan
  | "BRL" // Brazilian Real
  | "CAD" // Canadian Dollar
  | "AUD" // Australian Dollar
  | "INR" // Indian Rupee
  | "MXN" // Mexican Peso
  | "CHF" // Swiss Franc
  | "SEK" // Swedish Krona
  | "NZD" // New Zealand Dollar
  | "SGD" // Singapore Dollar
  | "HKD" // Hong Kong Dollar
  | "KRW" // South Korean Won
  | "TRY" // Turkish Lira
  | "RUB" // Russian Ruble
  | "ZAR" // South African Rand
  | "AED" // UAE Dirham
  | "ARS" // Argentine Peso
  | "CLP" // Chilean Peso
  | "COP" // Colombian Peso
  | "CZK" // Czech Koruna
  | "DKK" // Danish Krone
  | "HUF" // Hungarian Forint
  | "IDR" // Indonesian Rupiah
  | "ILS" // Israeli Shekel
  | "MYR" // Malaysian Ringgit
  | "NOK" // Norwegian Krone
  | "PHP" // Philippine Peso
  | "PLN" // Polish Zloty
  | "THB" // Thai Baht
  | "VND"; // Vietnamese Dong

/**
 * Exchange rate data from API
 */
export interface ExchangeRateData {
  /** Base currency code */
  base: string;
  /** Date of the rates (YYYY-MM-DD format) */
  date: string;
  /** Map of currency codes to exchange rates */
  rates: Record<string, number>;
  /** Unix timestamp when fetched */
  timestamp: number;
}

/**
 * Cached exchange rate entry in localStorage
 */
export interface CachedRates {
  /** Exchange rate data */
  data: ExchangeRateData;
  /** Date.now() when cached */
  fetchedAt: number;
  /** Date.now() + cacheDuration when cache expires */
  expiresAt: number;
}

/**
 * Currency conversion result
 */
export interface ConversionResult {
  /** Source currency code */
  from: string;
  /** Target currency code */
  to: string;
  /** Original amount */
  amount: number;
  /** Exchange rate used */
  rate: number;
  /** Converted result (amount * rate) */
  result: number;
  /** Unix timestamp of conversion */
  timestamp: number;
  /** Where the rate came from */
  source: "cache" | "api" | "stale-cache";
}

/**
 * API response structure (ExchangeRate-API)
 */
export interface ExchangeRateAPIResponse {
  /** Success or error */
  result: "success" | "error";
  /** Base currency code */
  base_code: string;
  /** Map of currency codes to exchange rates */
  rates: Record<string, number>;
  /** Unix timestamp of last update */
  time_last_update_unix: number;
  /** Optional error type if result is error */
  "error-type"?: string;
}

/**
 * Frankfurter API response structure
 */
export interface FrankfurterAPIResponse {
  /** Amount (always 1 for our use case) */
  amount: number;
  /** Base currency code */
  base: string;
  /** Date of the rates */
  date: string;
  /** Map of currency codes to exchange rates */
  rates: Record<string, number>;
}

/**
 * Parsed currency expression
 */
export interface ParsedCurrency {
  /** Amount to convert */
  amount: number;
  /** Source currency code */
  from: string;
  /** Target currency code */
  to: string;
}

/**
 * Custom error types for better error handling
 */
export class CurrencyError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "CurrencyError";
  }
}

export class NetworkError extends CurrencyError {
  constructor(message = "Network error - check your connection") {
    super(message, "NETWORK_ERROR");
    this.name = "NetworkError";
  }
}

export class APIError extends CurrencyError {
  constructor(message = "API error - try again later") {
    super(message, "API_ERROR");
    this.name = "APIError";
  }
}

export class RateLimitError extends CurrencyError {
  constructor(message = "Rate limit exceeded - try again later") {
    super(message, "RATE_LIMIT_ERROR");
    this.name = "RateLimitError";
  }
}

export class InvalidCurrencyError extends CurrencyError {
  constructor(currency: string) {
    super(`Invalid currency code: ${currency}`, "INVALID_CURRENCY");
    this.name = "InvalidCurrencyError";
  }
}
