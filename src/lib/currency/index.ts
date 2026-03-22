export { convertCurrency, convertCurrencyBatch, getRate } from "./converter";
export { parseCurrencyExpression } from "./parser";
export { formatConversionResult } from "./formatter";

// Cache management
export { clearCurrencyCache, getCachedRates, getCacheStats } from "./cache";

// API client
export { fetchExchangeRates } from "./api-client";

// Parser utilities
export {
  isValidCurrencyCode,
  normalizeCurrencyCode,
  validateCurrencyCode,
  getSupportedCurrencies,
} from "./parser";

// Types
export type {
  CurrencyCode,
  ExchangeRateData,
  CachedRates,
  ConversionResult,
  ParsedCurrency,
  ExchangeRateAPIResponse,
  FrankfurterAPIResponse,
} from "./types";

// Errors
export {
  CurrencyError,
  NetworkError,
  APIError,
  RateLimitError,
  InvalidCurrencyError,
} from "./types";
