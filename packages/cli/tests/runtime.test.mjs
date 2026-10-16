import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const sqlite = fileURLToPath(new URL("./sqlite-runtime.mjs", import.meta.url));
for (const [runtime, flags] of [
    ["node", []],
    ["bun", []],
    ["deno", ["run", "--node-modules-dir=manual", "-A"]],
]) {
    test(`${runtime}: expression, failure, and read-only SQLite queries`, () => {
        for (const [file, args, status, output] of [
            [cli, ["expr", "1 + 1"], 0, "2"],
            [cli, ["expr", "totally bogus &&&"], 1, null],
            [sqlite, [], 0, "CLI SQLite runtime passed"],
        ]) {
            const result = spawnSync(runtime, [...flags, file, ...args], { encoding: "utf8", timeout: 30000 });
            assert.ifError(result.error);
            assert.equal(result.status, status, result.stderr);
            if (output !== null) assert.equal(result.stdout.trim(), output);
            else assert.notEqual(result.stderr.trim(), "");
        }
    });
    test(`${runtime}: help documents folder opening and external editor setup`, () => {
        const result = spawnSync(runtime, [...flags, cli, "--help"], { encoding: "utf8", timeout: 30000 });
        assert.ifError(result.error);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /writeme \[--wait\|-w\] \[path\]/);
        assert.match(result.stdout, /writeme \./);
        assert.match(result.stdout, /EDITOR="writeme --wait"/);
        assert.match(result.stdout, /npm install --global @writeme\.dev\/cli/);
    });
}
