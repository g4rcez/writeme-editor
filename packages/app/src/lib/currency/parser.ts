/**
 * Currency expression parser
 * Parses user input like "100 USD to EUR" into structured data
 */

import type { ParsedCurrency } from "./types";
import { InvalidCurrencyError } from "./types";

/**
 * List of valid currency codes (ISO 4217)
 * Expanded list beyond the type-safe subset
 */
const VALID_CURRENCY_CODES = new Set([
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CNY",
  "BRL",
  "CAD",
  "AUD",
  "INR",
  "MXN",
  "CHF",
  "SEK",
  "NZD",
  "SGD",
  "HKD",
  "KRW",
  "TRY",
  "RUB",
  "ZAR",
  "AED",
  "ARS",
  "CLP",
  "COP",
  "CZK",
  "DKK",
  "HUF",
  "IDR",
  "ILS",
  "MYR",
  "NOK",
  "PHP",
  "PLN",
  "THB",
  "VND",
  "SAR",
  "QAR",
  "KWD",
  "BHD",
  "OMR",
  "JOD",
  "EGP",
  "MAD",
  "NGN",
  "KES",
  "GHS",
  "XOF",
  "XAF",
  "PKR",
  "BDT",
  "LKR",
  "NPR",
  "MMK",
  "KHR",
  "LAK",
  "TWD",
  "BGN",
  "RON",
  "HRK",
  "ISK",
  "UAH",
  "GEL",
  "AMD",
  "AZN",
  "KZT",
  "UZS",
  "TJS",
  "KGS",
  "TMT",
  "BYN",
  "MDL",
  "ALL",
  "MKD",
  "RSD",
  "BAM",
  "TND",
  "LYD",
  "DZD",
  "IQD",
  "SYP",
  "LBP",
  "YER",
  "AFN",
  "IRR",
  "ANG",
  "AWG",
  "BBD",
  "BMD",
  "BSD",
  "BZD",
  "DOP",
  "GTQ",
  "HTG",
  "JMD",
  "KYD",
  "PAB",
  "TTD",
  "UYU",
  "VES",
  "BOB",
  "PYG",
  "PEN",
  "CRC",
  "NIO",
  "HNL",
  "SVC",
]);

/**
 * Parse currency conversion expression
 * Supports formats:
 *  - "100 USD to EUR"
 *  - "50.5 BRL in USD"
 *  - "1000 JPY to EUR" (spaces flexible)
 *
 * @param expr - The expression to parse (e.g., "100 USD to EUR")
 * @returns Parsed currency data or null if invalid format
 */
export function parseCurrencyExpression(
  expr: string,
): ParsedCurrency | null {
  // Normalize: trim, collapse multiple spaces
  const normalized = expr.trim().replace(/\s+/g, " ");

  // Pattern: <number> <FROM_CURRENCY> <to|in> <TO_CURRENCY>
  // Supports decimals and optional commas in numbers
  const pattern = /^([\d,]+\.?\d*)\s+([A-Z]{3})\s+(to|in)\s+([A-Z]{3})$/i;
  const match = normalized.match(pattern);

  if (!match) {
    return null;
  }

  const [, amountStr, from, , to] = match;

  // Parse amount (remove commas, convert to number)
  const amount = parseFloat(amountStr.replace(/,/g, ""));

  if (isNaN(amount) || amount <= 0) {
    return null;
  }

  // Normalize currency codes to uppercase
  const fromCode = normalizeCurrencyCode(from);
  const toCode = normalizeCurrencyCode(to);

  // Validate currency codes
  if (!isValidCurrencyCode(fromCode) || !isValidCurrencyCode(toCode)) {
    return null;
  }

  return {
    amount,
    from: fromCode,
    to: toCode,
  };
}

/**
 * Check if a currency code is valid
 *
 * @param code - Currency code to validate
 * @returns true if valid, false otherwise
 */
export function isValidCurrencyCode(code: string): boolean {
  const normalized = normalizeCurrencyCode(code);
  return VALID_CURRENCY_CODES.has(normalized);
}

/**
 * Normalize currency code (uppercase, trim)
 *
 * @param code - Currency code to normalize
 * @returns Normalized currency code
 */
export function normalizeCurrencyCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Validate and throw if currency code is invalid
 *
 * @param code - Currency code to validate
 * @throws InvalidCurrencyError if code is invalid
 */
export function validateCurrencyCode(code: string): void {
  if (!isValidCurrencyCode(code)) {
    throw new InvalidCurrencyError(code);
  }
}

/**
 * Get a list of all supported currency codes
 *
 * @returns Array of supported currency codes
 */
export function getSupportedCurrencies(): string[] {
  return Array.from(VALID_CURRENCY_CODES).sort();
}
