import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = fileURLToPath(new URL("./pr-checks.mts", import.meta.url));

function runGate(results: unknown): ReturnType<typeof spawnSync> {
    return spawnSync(process.execPath, ["--experimental-strip-types", script], {
        env: { ...process.env, PR_CHECK_RESULTS: JSON.stringify(results) },
        encoding: "utf8",
    });
}

test("permits merging when every reported check succeeds", () => {
    const result = runGate({ build: { result: "success" }, tests: { result: "success" } });
    assert.equal(result.status, 0);
    assert.match(String(result.stdout), /All 2 pull request checks passed/);
});

for (const status of ["failure", "cancelled", "skipped", "pending", "neutral", "timed_out"]) {
    test(`blocks merging when a check is ${status}`, () => {
        const result = runGate({ build: { result: "success" }, tests: { result: status } });
        assert.notEqual(result.status, 0);
        assert.match(String(result.stderr), new RegExp(`tests=${status}`));
    });
}

test("blocks merging when checks are missing", () => {
    assert.notEqual(runGate({}).status, 0);
    assert.notEqual(runGate({ tests: {} }).status, 0);
});

test("blocks merging when results are malformed", () => {
    assert.notEqual(runGate(null).status, 0);
    assert.notEqual(runGate("success").status, 0);
});
