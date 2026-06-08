export type ExchangeRateData = {
  base: string;
  date: string;
  rates: Record<string, number>;
  timestamp: number;
};

export type MathLine =
  | { kind: "empty" }
  | { kind: "header"; text: string }
  | { kind: "comment"; text: string }
  | { kind: "variable"; name: string; expr: string; raw: string }
  | { kind: "label"; label: string; expr: string; raw: string }
  | { kind: "sum" }
  | { kind: "avg" }
  | { kind: "bare"; expr: string; raw: string; base?: "hex" | "bin" | "oct" };

export type EvaluatedResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

export type EvaluatedLine =
  | { kind: "empty" }
  | { kind: "header"; text: string }
  | { kind: "comment"; text: string }
  | { kind: "variable"; name: string; result: EvaluatedResult }
  | { kind: "label"; label: string; result: EvaluatedResult }
  | { kind: "bare"; raw: string; result: EvaluatedResult }
  | { kind: "sum"; result: EvaluatedResult }
  | { kind: "avg"; result: EvaluatedResult };

export type BlockScope = {
  vars: Record<string, unknown>;
  labeledResults: number[];
  lastBareResult: number;
};
