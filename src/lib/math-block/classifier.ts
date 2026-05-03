import type { MathLine } from "./types";

const HEX_RE = /^0[xX][0-9a-fA-F]/;
const BIN_RE = /^0[bB][01]/;
const OCT_RE = /^0[oO][0-7]/;

function detectBase(expr: string): "hex" | "bin" | "oct" | undefined {
  const first = expr.trim().split(/\s+/)[0] ?? "";
  if (HEX_RE.test(first)) return "hex";
  if (BIN_RE.test(first)) return "bin";
  if (OCT_RE.test(first)) return "oct";
  return undefined;
}

const HEADER_RE = /^#\s+(.+)$/;
const COMMENT_SLASH_RE = /^\s*\/\//;
const COMMENT_QUOTE_RE = /^".*"$/;
const VARIABLE_RE = /^([A-Za-z_]\w*)\s*=(?!=)\s*(.+)$/s;
const LABEL_RE = /^([A-Za-z_][A-Za-z0-9_ ]*?)\s*:\s*(.+)$/s;
const SUM_RE = /^(sum|total)$/i;
const AVG_RE = /^(avg|average)$/i;

export function classifyLine(raw: string): MathLine {
  const trimmed = raw.trim();

  if (trimmed === "") return { kind: "empty" };

  const headerMatch = trimmed.match(HEADER_RE);
  if (headerMatch) return { kind: "header", text: headerMatch[1]! };

  if (COMMENT_SLASH_RE.test(trimmed) || COMMENT_QUOTE_RE.test(trimmed)) {
    return { kind: "comment", text: trimmed };
  }

  const variableMatch = trimmed.match(VARIABLE_RE);
  if (variableMatch) {
    return {
      kind: "variable",
      name: variableMatch[1]!,
      expr: variableMatch[2]!.trim(),
      raw: trimmed,
    };
  }

  const labelMatch = trimmed.match(LABEL_RE);
  if (labelMatch) {
    return {
      kind: "label",
      label: labelMatch[1]!.trim(),
      expr: labelMatch[2]!.trim(),
      raw: trimmed,
    };
  }

  if (SUM_RE.test(trimmed)) return { kind: "sum" };
  if (AVG_RE.test(trimmed)) return { kind: "avg" };

  const base = detectBase(trimmed);
  return { kind: "bare", expr: trimmed, raw, base };
}
