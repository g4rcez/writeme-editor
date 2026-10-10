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
 * Check if a currency code is valid
 *
 * @param code - Currency code to validate
 * @returns true if valid, false otherwise
 */
function isValidCurrencyCode(code: string): boolean {
    const normalized = normalizeCurrencyCode(code);
    return VALID_CURRENCY_CODES.has(normalized);
}

/**
 * Normalize currency code (uppercase, trim)
 *
 * @param code - Currency code to normalize
 * @returns Normalized currency code
 */
function normalizeCurrencyCode(code: string): string {
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
