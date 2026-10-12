import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./pr-checks.mts", import.meta.url));
const passing = { platforms: { result: "success" }, mcp: { result: "success" } };

function runGate(results: unknown): ReturnType<typeof spawnSync> {
    return spawnSync(process.execPath, ["--experimental-strip-types", script], {
        env: { ...process.env, PR_CHECK_RESULTS: JSON.stringify(results) },
        encoding: "utf8",
    });
}

test("permits merging only with both required reusable workflow results", () => {
    const result = runGate(passing);
    assert.equal(result.status, 0, String(result.stderr));
    assert.match(String(result.stdout), /All 2 pull request checks passed/);
});

test("also requires any additional reported check to succeed", () => {
    assert.equal(runGate({ ...passing, extra: { result: "success" } }).status, 0);
    assert.notEqual(runGate({ ...passing, extra: { result: "failure" } }).status, 0);
});

for (const status of ["failure", "cancelled", "skipped", "pending", "neutral", "timed_out", "stale"]) {
    for (const check of Object.keys(passing)) {
        test(`blocks merging when ${check} is ${status}`, () => {
            const result = runGate({ ...passing, [check]: { result: status } });
            assert.notEqual(result.status, 0);
            assert.match(String(result.stderr), new RegExp(`${check}=${status}`));
        });
    }
}

test("blocks incomplete results even when every reported check succeeds", () => {
    for (const results of [{}, { platforms: passing.platforms }, { mcp: passing.mcp }, { ...passing, mcp: {} }]) {
        assert.notEqual(runGate(results).status, 0);
    }
});

test("blocks malformed results and check entries", () => {
    for (const results of [null, "success", [], 1, { ...passing, mcp: null }, { ...passing, mcp: "success" }]) {
        assert.notEqual(runGate(results).status, 0);
    }
});
