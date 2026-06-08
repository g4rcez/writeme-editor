import { Dates } from "./dates";
import {
  applyBasePreprocessors,
  errorMessage,
  formatResult,
} from "./evaluator";
import { getMathInstance } from "./mathjs-extensions";
import type { EvaluatedResult, ExchangeRateData } from "./types";

export const INLINE_MATH_PATTERN = />>math [^=]+ ?=$/;

const stripInlineSyntax = (raw: string): string =>
  raw
    .replace(/>>math/, "")
    .trim()
    .replace(/\*\*/g, "^")
    .replace(/=$/g, "")
    .trim();

export function evaluateInlineMath(
  expr: string,
  ratesData?: ExchangeRateData | null,
): EvaluatedResult {
  try {
    const natural = Dates.evaluateNatural(expr);
    if (natural !== null) return { ok: true, value: natural };
    const math = getMathInstance(16, ratesData ?? null);
    const cleaned = applyBasePreprocessors(expr);
    const value = math.evaluate(cleaned) as unknown;
    return { ok: true, value: formatResult(value) };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
}

export function runInlineMath(
  captured: string,
  ratesData?: ExchangeRateData | null,
): string {
  const expr = stripInlineSyntax(captured.trim());
  if (expr === "") return "";
  const result = evaluateInlineMath(expr, ratesData);
  return result.ok
    ? `${expr} = ${result.value}`
    : `${expr} = ${result.message}`;
}
