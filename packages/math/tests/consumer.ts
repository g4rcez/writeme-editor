import {
    classifyLine,
    evaluateCode,
    evaluateInlineMath,
    solveRule3,
    type EvaluatedLine,
    type EvaluatedResult,
    type ExchangeRateData,
    type MathLine,
} from "@writeme.dev/math";
import { Dates } from "@writeme.dev/math/dates";
import { createMathInstance, reconfigureEm, type MathInstance } from "@writeme.dev/math/mathjs-extensions";

const rates: ExchangeRateData = { base: "EUR", date: "2026-01-01", timestamp: 1, rates: { USD: 2 } };
const line: MathLine = classifyLine("price: 10");
const block: EvaluatedLine[] = evaluateCode("price: 10\nsum", rates);
const result: EvaluatedResult = evaluateInlineMath("1 EUR to USD", rates);
if (result.ok) {
    const value: string = result.value;
    void value;
} else {
    const message: string = result.message;
    void message;
}
const epoch: string | null = Dates.evaluateEpoch("epoch 0");
const math: MathInstance = reconfigureEm(createMathInstance({ emCss: 16 }), 20);
const proportion = solveRule3("1/2, x/10");
if (proportion.ok) {
    const value: number = proportion.value;
    void value;
}

// @ts-expect-error The expression API requires a string.
evaluateInlineMath(42);
// @ts-expect-error CSS unit configuration requires a number.
createMathInstance({ emCss: "16" });

void [line, block, epoch, math];
