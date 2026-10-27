import { format, isUnit, type MathNode } from "mathjs";
import type { BlockScope, EvaluatedLine, EvaluatedResult, ExchangeRateData, MathLine } from "./types.js";
import { classifyLine } from "./classifier.js";
import { Dates } from "./dates.js";
import { getMathInstance, reconfigureEm, type MathInstance } from "./mathjs-extensions.js";
import {
    bitwiseKeywords,
    currencySymbols,
    expressionImprovements,
    largeNumberShorthands,
    normalizeCurrencyDirection,
    prevSubstitution,
    roundingUnitConversion,
} from "./preprocessors.js";
import { preprocessRule3 } from "./rule-of-three.js";

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

export function formatResult(result: unknown, base?: "hex" | "bin" | "oct"): string {
    if (base !== undefined && typeof result === "number") {
        return formatInBase(result, base);
    }
    try {
        const unitResult = isUnit(result);
        const formatted = format(result, {
            precision: unitResult ? 10 : 5,
            notation: unitResult ? "fixed" : "auto",
            fraction: "ratio",
        });
        return unitResult
            ? formatted.replace(/(\.\d*?[1-9])0+(?=\s|$)/, "$1").replace(/\.0+(?=\s|$)/, "")
            : formatted;
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
    e = roundingUnitConversion(e);
    return e;
}

type UnitConversionMarker = {
    start: number;
    keyword: string;
    targetStart: number;
};

type UnitConversionClause = UnitConversionMarker & {
    end: number;
    target: string;
};

function isWordCharacter(character: string | undefined): boolean {
    return character !== undefined && /[A-Za-z0-9_]/.test(character);
}

function conversionMarkerAt(expr: string, index: number): UnitConversionMarker | null {
    if (isWordCharacter(expr[index - 1])) return null;

    const match = /^(in|to)\b/i.exec(expr.slice(index));
    if (!match) return null;

    let targetStart = index + match[0].length;
    if (!/\s/.test(expr[targetStart] ?? "")) return null;
    while (/\s/.test(expr[targetStart] ?? "")) targetStart++;
    if (targetStart >= expr.length) return null;

    return { start: index, keyword: match[0], targetStart };
}

function isArithmeticOperatorAt(expr: string, index: number): boolean {
    const operator = expr[index];
    if (operator !== "+" && operator !== "-") return false;

    let previous = index - 1;
    while (previous >= 0 && /\s/.test(expr[previous] ?? "")) previous--;
    let next = index + 1;
    while (next < expr.length && /\s/.test(expr[next] ?? "")) next++;

    return previous >= 0 && next < expr.length &&
        /[A-Za-z0-9_)\]}%]/.test(expr[previous] ?? "") &&
        /[A-Za-z0-9_([{]/.test(expr[next] ?? "");
}

type TopLevelUnitSyntax = {
    markers: UnitConversionMarker[];
    arithmeticOperators: number[];
};

type ExpressionScanState = {
    depth: number;
    quote: string | null;
    escaped: boolean;
};

function consumeQuotedCharacter(character: string, state: ExpressionScanState): boolean {
    if (state.quote === null) {
        if (character !== "\"" && character !== "'") return false;
        state.quote = character;
        return true;
    }

    if (state.escaped) state.escaped = false;
    else if (character === "\\") state.escaped = true;
    else if (character === state.quote) state.quote = null;
    return true;
}

function consumeGroupingCharacter(character: string, state: ExpressionScanState): boolean {
    if (character === "(" || character === "[" || character === "{") {
        state.depth++;
        return true;
    }
    if (character === ")" || character === "]" || character === "}") {
        state.depth = Math.max(0, state.depth - 1);
        return true;
    }
    return false;
}

function scanTopLevelUnitSyntax(expr: string): TopLevelUnitSyntax {
    const markers: UnitConversionMarker[] = [];
    const arithmeticOperators: number[] = [];
    const state: ExpressionScanState = { depth: 0, quote: null, escaped: false };

    for (let index = 0; index < expr.length; index++) {
        const character = expr[index];
        if (character === undefined) continue;
        if (consumeQuotedCharacter(character, state) || consumeGroupingCharacter(character, state)) continue;
        if (state.depth !== 0) continue;

        const marker = conversionMarkerAt(expr, index);
        if (marker) markers.push(marker);
        if (isArithmeticOperatorAt(expr, index)) arithmeticOperators.push(index);
    }

    return { markers, arithmeticOperators };
}

function findUnitConversionClauses(expr: string): UnitConversionClause[] {
    const { markers, arithmeticOperators } = scanTopLevelUnitSyntax(expr);
    return markers.flatMap((marker, markerIndex) => {
        const nextMarker = markers[markerIndex + 1];
        const nextOperator = arithmeticOperators.find((index) => index >= marker.targetStart);
        const end = Math.min(nextMarker?.start ?? expr.length, nextOperator ?? expr.length);
        const target = expr.slice(marker.targetStart, end).trim();
        return target ? [{ ...marker, end, target }] : [];
    });
}

function followsArithmeticOperator(expr: string, index: number): boolean {
    while (index < expr.length && /\s/.test(expr[index] ?? "")) index++;
    return isArithmeticOperatorAt(expr, index);
}

function normalizeUnitConversionTarget(expr: string): string {
    // Hoist conversions only from top-level +/- terms; nested and compound units stay intact.
    const clauses = findUnitConversionClauses(expr);
    if (!clauses.some((clause) => followsArithmeticOperator(expr, clause.end))) return expr;

    const target = clauses[clauses.length - 1];
    if (!target) return expr;

    let stripped = "";
    let cursor = 0;
    for (const clause of clauses) {
        stripped += expr.slice(cursor, clause.start);
        cursor = clause.end;
    }
    stripped += expr.slice(cursor);

    return `${stripped.trimEnd()} ${target.keyword} ${target.target}`;
}

type MathExpressionResult = ReturnType<MathNode["evaluate"]>;

type ParsedOperatorNode = MathNode & {
    type: "OperatorNode";
    op: string;
    args: MathNode[];
};

type ParsedParenthesisNode = MathNode & { type: "ParenthesisNode"; content: MathNode };
type ParsedSymbolNode = MathNode & { type: "SymbolNode"; name: string };
type ParsedConstantNode = MathNode & { type: "ConstantNode"; value: unknown };

function asOperatorNode(node: MathNode | undefined): ParsedOperatorNode | null {
    return node?.type === "OperatorNode" ? (node as ParsedOperatorNode) : null;
}

function isScalarExpression(node: MathNode, scalarVariables: ReadonlySet<string>): boolean {
    if (node.type === "ConstantNode") {
        return typeof (node as ParsedConstantNode).value === "number";
    }

    if (node.type === "SymbolNode") {
        return scalarVariables.has((node as ParsedSymbolNode).name);
    }

    if (node.type === "ParenthesisNode") {
        return isScalarExpression((node as ParsedParenthesisNode).content, scalarVariables);
    }

    const operator = asOperatorNode(node);
    return operator !== null &&
        ["+", "-", "*", "/", "^"].includes(operator.op) &&
        operator.args.length > 0 &&
        operator.args.every((arg) => isScalarExpression(arg, scalarVariables));
}

function unitNameFromExpression(
    node: MathNode,
    math: MathInstance,
    scalarVariables: ReadonlySet<string>,
): string | null {
    if (node.type === "ParenthesisNode") {
        return unitNameFromExpression((node as ParsedParenthesisNode).content, math, scalarVariables);
    }

    const operator = asOperatorNode(node);
    if (!operator || operator.args.length !== 2) return null;

    if (operator.op === "+" || operator.op === "-") {
        const [left, right] = operator.args;
        if (!left || !right) return null;
        return unitNameFromExpression(left, math, scalarVariables) ??
            unitNameFromExpression(right, math, scalarVariables);
    }

    if (operator.op !== "*") return null;

    const [magnitude, unitNode] = operator.args;
    if (!magnitude || !unitNode || !isScalarExpression(magnitude, scalarVariables) || unitNode.type !== "SymbolNode") {
        return null;
    }

    const unitName = (unitNode as ParsedSymbolNode).name;
    try {
        math.unit(1, unitName);
        return unitName;
    } catch {
        return null;
    }
}

export function evaluateMathExpression(
    expr: string,
    math: MathInstance,
    scope: BlockScope = { vars: {}, labeledResults: [], lastBareResult: 0 },
): MathExpressionResult {
    const scalarVariables = new Set<string>();
    for (const [name, value] of Object.entries(scope.vars)) {
        if (typeof value === "number") scalarVariables.add(name);
    }
    const prepared = normalizeUnitConversionTarget(applyBasePreprocessors(expr));
    const parsed = math.parse(prepared);
    const normalized = parsed.transform((node, _path, parent) => {
        const operator = asOperatorNode(parent);
        if (!operator || (operator.op !== "+" && operator.op !== "-") || operator.args.length !== 2) {
            return node;
        }

        const operandIndex = operator.args.indexOf(node);
        if (operandIndex < 0 || !isScalarExpression(node, scalarVariables)) return node;

        const peer = operator.args[operandIndex === 0 ? 1 : 0];
        if (!peer) return node;

        const unitName = unitNameFromExpression(peer, math, scalarVariables);
        if (!unitName) return node;

        return new math.OperatorNode(
            "*",
            "multiply",
            [node.cloneDeep(), new math.SymbolNode(unitName)],
            true,
        );
    });

    return normalized.evaluate(scope.vars);
}

function evaluateLine(line: MathLine, scope: BlockScope, math: MathInstance): EvaluatedLine {
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
                const value = evaluateMathExpression(line.expr, math, scope);
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
                const value = evaluateMathExpression(line.expr, math, scope);
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
            const avg = count === 0 ? 0 : scope.labeledResults.reduce((a, b) => a + b, 0) / count;
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
                const expr = prevSubstitution(line.expr, scope.lastBareResult);
                const value = evaluateMathExpression(expr, math, scope);
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

export function evaluateCode(code: string, ratesData?: ExchangeRateData | null): EvaluatedLine[] {
    const lines = code.split("\n").map(classifyLine);
    return evaluateMathBlock(lines, ratesData);
}
