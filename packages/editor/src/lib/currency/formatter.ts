import type { ConversionResult } from "./types";

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
function formatCurrencyAmount(amount: number, currency: string): string {
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
