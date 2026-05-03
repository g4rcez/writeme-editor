import { format } from "mathjs";
import type { ExchangeRateData } from "@/lib/currency";
import { Dates } from "@/lib/dates";
import { preprocessRule3 } from "@/lib/rule-of-three";
import { classifyLine } from "./classifier";
import {
  getMathInstance,
  reconfigureEm,
  type MathInstance,
} from "./mathjs-extensions";
import {
  bitwiseKeywords,
  currencySymbols,
  expressionImprovements,
  largeNumberShorthands,
  normalizeCurrencyDirection,
  prevSubstitution,
} from "./preprocessors";
import type {
  BlockScope,
  EvaluatedLine,
  EvaluatedResult,
  MathLine,
} from "./types";

function toNumericValue(result: unknown): number | null {
  if (typeof result === "number" && Number.isFinite(result)) return result;
  const n = Number(result);
  return Number.isFinite(n) && !Number.isNaN(n) ? n : null;
}

function formatInBase(value: number, base: "hex" | "bin" | "oct"): string {
  const n = Math.round(value);
  switch (base) {
    case "hex":
      return "0x" + n.toString(16).toUpperCase();
    case "bin":
      return "0b" + n.toString(2);
    case "oct":
      return "0o" + n.toString(8);
    default:
      return n.toString(10);
  }
}

export function formatResult(
  result: unknown,
  base?: "hex" | "bin" | "oct",
): string {
  if (base !== undefined && typeof result === "number") {
    return formatInBase(result, base);
  }
  try {
    return format(result, {
      precision: 5,
      notation: "auto",
      fraction: "ratio",
    });
  } catch {
    return String(result);
  }
}

function formatNumber(n: number): string {
  return format(n, { precision: 5, notation: "auto" });
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function applyBasePreprocessors(expr: string): string {
  let e = currencySymbols(expr);
  e = preprocessRule3(e);
  e = expressionImprovements(e);
  e = bitwiseKeywords(e);
  e = largeNumberShorthands(e);
  e = normalizeCurrencyDirection(e);
  return e;
}

function evaluateLine(
  line: MathLine,
  scope: BlockScope,
  math: MathInstance,
): EvaluatedLine {
  switch (line.kind) {
    case "empty":
      return { kind: "empty" };

    case "header":
      return { kind: "header", text: line.text };

    case "comment":
      return { kind: "comment", text: line.text };

    case "variable": {
      let result: EvaluatedResult;
      try {
        const expr = applyBasePreprocessors(line.expr);
        const value = math.evaluate(expr, scope.vars) as unknown;
        if (line.name === "em") {
          const emPx = toNumericValue(value);
          if (emPx !== null) reconfigureEm(math, emPx);
        } else {
          scope.vars[line.name] = value;
          const numVal = toNumericValue(value);
          if (numVal !== null) scope.labeledResults.push(numVal);
        }
        result = { ok: true, value: formatResult(value) };
      } catch (e) {
        result = { ok: false, message: errorMessage(e) };
      }
      return { kind: "variable", name: line.name, result };
    }

    case "label": {
      let result: EvaluatedResult;
      try {
        const expr = applyBasePreprocessors(line.expr);
        const value = math.evaluate(expr, scope.vars) as unknown;
        const numVal = toNumericValue(value);
        if (numVal !== null) scope.labeledResults.push(numVal);
        if (/^[A-Za-z_]\w*$/.test(line.label)) scope.vars[line.label] = value;
        result = { ok: true, value: formatResult(value) };
      } catch (e) {
        result = { ok: false, message: errorMessage(e) };
      }
      return { kind: "label", label: line.label, result };
    }

    case "sum": {
      const total = scope.labeledResults.reduce((a, b) => a + b, 0);
      return { kind: "sum", result: { ok: true, value: formatNumber(total) } };
    }

    case "avg": {
      const count = scope.labeledResults.length;
      const avg =
        count === 0
          ? 0
          : scope.labeledResults.reduce((a, b) => a + b, 0) / count;
      return { kind: "avg", result: { ok: true, value: formatNumber(avg) } };
    }

    case "bare": {
      let result: EvaluatedResult;
      try {
        const natural = Dates.evaluateNatural(line.expr);
        if (natural !== null) {
          return {
            kind: "bare",
            raw: line.raw,
            result: { ok: true, value: natural },
          };
        }
        let expr = applyBasePreprocessors(line.expr);
        expr = prevSubstitution(expr, scope.lastBareResult);
        const value = math.evaluate(expr, scope.vars) as unknown;
        const numVal = toNumericValue(value);
        if (numVal !== null) scope.lastBareResult = numVal;
        result = { ok: true, value: formatResult(value, line.base) };
      } catch (e) {
        result = { ok: false, message: errorMessage(e) };
      }
      return { kind: "bare", raw: line.raw, result };
    }
  }
}

export function evaluateMathBlock(
  lines: MathLine[],
  ratesData?: ExchangeRateData | null,
  initialEmPx = 16,
): EvaluatedLine[] {
  const math = getMathInstance(initialEmPx, ratesData ?? null);

  const scope: BlockScope = {
    vars: {},
    labeledResults: [],
    lastBareResult: 0,
  };

  return lines.map((line) => evaluateLine(line, scope, math));
}

export function evaluateCode(
  code: string,
  ratesData?: ExchangeRateData | null,
): EvaluatedLine[] {
  const lines = code.split("\n").map(classifyLine);
  return evaluateMathBlock(lines, ratesData);
}
