const CURRENCY_CODES = new Set([
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
  "PLN",
  "CZK",
  "HUF",
  "DKK",
  "NOK",
  "ZAR",
  "AED",
  "THB",
  "PHP",
  "IDR",
  "MYR",
  "VND",
  "CLP",
  "COP",
  "PEN",
  "PKR",
  "EGP",
  "ILS",
  "SAR",
  "QAR",
  "KWD",
  "BHD",
  "OMR",
  "JOD",
  "BGN",
  "RON",
  "ISK",
  "UAH",
  "BTC",
  "ETH",
]);

export function currencySymbols(expr: string): string {
  return expr
    .replace(/NZ\$\s*([\d.,]+)/g, "$1 NZD")
    .replace(/HK\$\s*([\d.,]+)/g, "$1 HKD")
    .replace(/S\$\s*([\d.,]+)/g, "$1 SGD")
    .replace(/A\$\s*([\d.,]+)/g, "$1 AUD")
    .replace(/C\$\s*([\d.,]+)/g, "$1 CAD")
    .replace(/R\$\s*([\d.,]+)/g, "$1 BRL")
    .replace(/\$\s*([\d.,]+)/g, "$1 USD")
    .replace(/€\s*([\d.,]+)/g, "$1 EUR")
    .replace(/£\s*([\d.,]+)/g, "$1 GBP")
    .replace(/¥\s*([\d.,]+)/g, "$1 JPY")
    .replace(/₩\s*([\d.,]+)/g, "$1 KRW")
    .replace(/₹\s*([\d.,]+)/g, "$1 INR")
    .replace(/₽\s*([\d.,]+)/g, "$1 RUB")
    .replace(/₺\s*([\d.,]+)/g, "$1 TRY")
    .replace(/฿\s*([\d.,]+)/g, "$1 THB")
    .replace(/₱\s*([\d.,]+)/g, "$1 PHP")
    .replace(/₫\s*([\d.,]+)/g, "$1 VND");
}

export function normalizeCurrencyDirection(expr: string): string {
  return expr.replace(/\b(?:in|to)\s+([A-Za-z]{2,4})\b/gi, (_, code) => {
    const upper = code.toUpperCase();
    return CURRENCY_CODES.has(upper) ? `to ${upper}` : `in ${code}`;
  });
}

const LARGE_SHORT_RE = /(\d+(?:\.\d+)?)(k|K|M)\b(?!\w)/g;
const LARGE_WORD_RE =
  /(\d+(?:\.\d+)?)\s+(billion|trillion|million|thousand)\b/gi;

const LARGE_SHORT_MAP: Record<string, number> = {
  k: 1e3,
  K: 1e3,
  M: 1e6,
};

const LARGE_WORD_MAP: Record<string, number> = {
  thousand: 1e3,
  million: 1e6,
  billion: 1e9,
  trillion: 1e12,
};

export function expressionImprovements(expr: string): string {
  return expr
    .replace(/^\/\/.*/, "")
    .replace(/\*\*/g, "^")
    .replace(/(fatorial)/g, "! ")
    .replace(/([\d., ]+)" /g, "$1inches ")
    .replace(/([\d., ]+)(C|°C|°c) /g, "$1celsius ")
    .replace(/([\d., ]+)(F|°F|°f) /g, "$1fahrenheit ")
    .replace(/([\d., ]+)(K|°K|°k) /g, "$1kelvin ")
    .replace(
      /([\d.,]+)\s*%\s+of\s+([\d.,]+)\s+(?:in|to)\s+([A-Za-z]{2,4})\b/gi,
      (_, pct, amount, code) => `${pct}% * ${amount} ${code.toUpperCase()}`,
    )
    .replace(/([\d.,]+)\s*%\s+of\s+/g, "$1% * ")
    .replace(/([\d.,]+) ?percent of /g, "$1% ")
    .replace(/to (F|°F|°f)/g, "to fahrenheit ")
    .replace(/to (K|°K|°k)/g, "to kelvin ")
    .replace(/to (C|°C|°c)/g, "to celsius ");
}

export function bitwiseKeywords(expr: string): string {
  return expr
    .replace(/\bAND\b/g, "&")
    .replace(/\bOR\b/g, "|")
    .replace(/\b(\S+)\s+XOR\s+(\S+)\b/g, "bitXor($1, $2)");
}

export function largeNumberShorthands(expr: string): string {
  return expr
    .replace(LARGE_SHORT_RE, (_m, num, suffix) =>
      String(Number(num) * (LARGE_SHORT_MAP[suffix] ?? 1)),
    )
    .replace(LARGE_WORD_RE, (_m, num, word) =>
      String(Number(num) * (LARGE_WORD_MAP[word.toLowerCase()] ?? 1)),
    );
}

export function prevSubstitution(expr: string, lastBareResult: number): string {
  return expr.replace(/\bprev\b/g, String(lastBareResult));
}

const ROUNDING_FN_RE =
  /\b(round|floor|ceil|trunc)\(([^()]+?)\s+(?:in|to)\s+(\w+)\)/gi;

export function roundingUnitConversion(expr: string): string {
  return expr.replace(
    ROUNDING_FN_RE,
    (_, fn, inner, unit) => `${fn}(number(${inner.trim()}, '${unit}'))`,
  );
}
