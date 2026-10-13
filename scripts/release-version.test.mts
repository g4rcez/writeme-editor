import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyReleaseBump, nextReleaseVersion } from "./release-version.mjs";

for (const [title, expected] of [
    ["feat: add task boards", "minor"],
    ["feat(editor): improve editing", "minor"],
    ["fix: restore Cmd+Q", "patch"],
    ["fix(editor): restore Cmd+Q", "patch"],
    ["feat!: replace the document format", "major"],
    ["fix!: remove legacy storage", "major"],
    ["feat(editor)!: replace the document format", "major"],
    ["Add full-page Markdown task boards", "minor"],
    ["Fix Excalidraw freezes on mobile", "patch"],
    ["perf(ci): unify platform verification", "patch"],
    ["chore: update release workflow", "patch"],
    ["Improve editor spacing", "patch"],
] as const) {
    test(`classifies ${title}`, () => {
        assert.equal(classifyReleaseBump(title), expected);
    });
}

for (const [version, bump, expected] of [
    ["2.0.3", "patch", "2.0.4"],
    ["2.0.3", "minor", "2.1.0"],
    ["2.0.3", "major", "3.0.0"],
    ["0.9.9", "minor", "0.10.0"],
] as const) {
    test(`bumps ${version} with ${bump}`, () => {
        assert.equal(nextReleaseVersion(version, bump), expected);
    });
}

test("rejects invalid versions and bump levels", () => {
    assert.throws(() => nextReleaseVersion("2.0", "patch"), /Invalid stable semantic version/);
    assert.throws(() => nextReleaseVersion("2.0.3", "none"), /Invalid release bump/);
    assert.throws(() => nextReleaseVersion("0.0.9007199254740991", "patch"), /safe integer range/);
});
