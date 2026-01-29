import type { ConversionResult } from "./types";
import {
  NetworkError,
  APIError,
  RateLimitError,
  InvalidCurrencyError,
} from "./types";

/**
 * Currencies that use 0 decimal places
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "JPY", // Japanese Yen
  "KRW", // South Korean Won
  "VND", // Vietnamese Dong
  "CLP", // Chilean Peso
  "IDR", // Indonesian Rupiah
  "ISK", // Icelandic Króna
  "PYG", // Paraguayan Guaraní
]);

/**
 * Currencies that use 3 decimal places
 */
const THREE_DECIMAL_CURRENCIES = new Set([
  "BHD", // Bahraini Dinar
  "JOD", // Jordanian Dinar
  "KWD", // Kuwaiti Dinar
  "OMR", // Omani Rial
  "TND", // Tunisian Dinar
]);

/**
 * Format conversion result for display
 * Output: "100.00 USD to EUR = 92.50 EUR"
 * With stale cache: "100.00 USD to EUR = 92.50 EUR (outdated)"
 *
 * @param result - Conversion result to format
 * @returns Formatted string for display
 */
export function formatConversionResult(result: ConversionResult): string {
  const formattedResult = formatCurrencyAmount(result.result, result.to);
  let output = ` ${formattedResult} ${result.to}`;
  if (result.source === "stale-cache") {
    output += " (outdated)";
  }
  return output;
}

/**
 * Format currency amount with proper decimal places
 * Respects currency-specific decimal conventions
 *
 * @param amount - Amount to format
 * @param currency - Currency code
 * @returns Formatted amount string
 */
export function formatCurrencyAmount(amount: number, currency: string): string {
  const decimals = getDecimalPlaces(currency);

  return amount.toFixed(decimals);
}

/**
 * Get number of decimal places for a currency
 *
 * @param currency - Currency code
 * @returns Number of decimal places (0, 2, or 3)
 */
function getDecimalPlaces(currency: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) {
    return 0;
  }
  if (THREE_DECIMAL_CURRENCIES.has(currency)) {
    return 3;
  }
  return 2; // Default for most currencies
}

/**
 * Format loading placeholder
 * Output: "100 USD to EUR = Loading..."
 *
 * @param amount - Amount being converted
 * @param from - Source currency code
 * @param to - Target currency code
 * @returns Loading placeholder string
 */
export function formatLoadingPlaceholder(
  amount: number,
  from: string,
  to: string,
): string {
  return `${amount} ${from} to ${to} = Loading...`;
}

/**
 * Format error message for display
 * Provides user-friendly error messages
 *
 * @param error - Error object
 * @param from - Source currency code
 * @param to - Target currency code
 * @returns Formatted error message
 */
export function formatErrorMessage(
  error: Error,
  from: string,
  to: string,
): string {
  const prefix = `${from} to ${to}`;

  if (error instanceof NetworkError) {
    return `${prefix} = [Network error - check connection]`;
  }

  if (error instanceof RateLimitError) {
    return `${prefix} = [Rate limit - try again later]`;
  }

  if (error instanceof InvalidCurrencyError) {
    return `${prefix} = [Invalid currency]`;
  }

  if (error instanceof APIError) {
    return `${prefix} = [API error - try again]`;
  }

  // Generic error
  return `${prefix} = [Error: ${error.message}]`;
}

/**
 * Get currency symbol for common currencies
 * Returns null if no symbol is defined
 *
 * @param currency - Currency code
 * @returns Currency symbol or null
 */
export function getCurrencySymbol(currency: string): string | null {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
    BRL: "R$",
    CAD: "C$",
    AUD: "A$",
    INR: "₹",
    MXN: "MX$",
    CHF: "CHF",
    RUB: "₽",
    KRW: "₩",
    TRY: "₺",
    ZAR: "R",
    AED: "د.إ",
    SAR: "﷼",
    THB: "฿",
    SGD: "S$",
    HKD: "HK$",
    NZD: "NZ$",
    SEK: "kr",
    NOK: "kr",
    DKK: "kr",
    PLN: "zł",
    ILS: "₪",
    PHP: "₱",
    VND: "₫",
  };

  return symbols[currency] || null;
}

/**
 * Format conversion result with currency symbols
 * Output: "$100.00 to EUR = €92.50"
 *
 * @param result - Conversion result to format
 * @returns Formatted string with symbols
 */
export function formatConversionResultWithSymbols(
  result: ConversionResult,
): string {
  const fromSymbol = getCurrencySymbol(result.from);
  const toSymbol = getCurrencySymbol(result.to);

  const formattedAmount = formatCurrencyAmount(result.amount, result.from);
  const formattedResult = formatCurrencyAmount(result.result, result.to);

  const fromDisplay = fromSymbol
    ? `${fromSymbol}${formattedAmount}`
    : `${formattedAmount} ${result.from}`;
  const toDisplay = toSymbol
    ? `${toSymbol}${formattedResult}`
    : `${formattedResult} ${result.to}`;

  let output = `${fromDisplay} to ${result.to} = ${toDisplay}`;

  if (result.source === "stale-cache") {
    output += " (outdated)";
  }

  return output;
}

/**
 * Format conversion result with rate information
 * Output: "100.00 USD to EUR = 92.50 EUR (rate: 0.9250)"
 *
 * @param result - Conversion result to format
 * @returns Formatted string with rate
 */
export function formatConversionResultWithRate(
  result: ConversionResult,
): string {
  const base = formatConversionResult(result);
  const rate = result.rate.toFixed(4);
  return `${base} (rate: ${rate})`;
}
