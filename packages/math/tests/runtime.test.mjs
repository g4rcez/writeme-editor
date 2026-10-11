import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const file = fileURLToPath(new URL("./runtime.mjs", import.meta.url));
for (const [runtime, flags] of [
    ["node", []],
    ["bun", []],
    ["deno", ["run", "--node-modules-dir=manual", "-A"]],
]) {
    test(`${runtime}: math, dates, and mathjs extension exports`, () => {
        const result = spawnSync(runtime, [...flags, file], { encoding: "utf8", timeout: 30000 });
        assert.ifError(result.error);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout.trim(), "math runtime passed");
    });
}
