import { evaluateCode, evaluateInlineMath, solveRule3 } from "@writeme.dev/math";
import { Dates } from "@writeme.dev/math/dates";
import { createMathInstance } from "@writeme.dev/math/mathjs-extensions";
import assert from "node:assert/strict";

assert.deepEqual(evaluateInlineMath("1 + 1"), { ok: true, value: "2" });
assert.deepEqual(solveRule3("2/4, x/10"), { ok: true, variable: "x", value: 5 });
assert.equal(evaluateInlineMath("totally bogus &&&").ok, false);
assert.deepEqual(evaluateCode("price: 10\nquantity: 20\nsum").at(-1), {
    kind: "sum",
    result: { ok: true, value: "30" },
});
assert.equal(Dates.evaluateEpoch("epoch 0"), "1970-01-01 00:00:00 UTC");
assert.match(Dates.evaluateTimezone("12:00 UTC in Rio de Janeiro"), /09:00/);
const math = createMathInstance({ emCss: 16 });
assert.equal(math.evaluate("2 + 3"), 5);
assert.equal(math.evaluate("32 px to em").toNumber("em"), 2);
console.log("math runtime passed");
