import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_WORKSPACE, type Build, type WorkspaceOptions } from "../tests/helpers/memory-harness.ts";
import { runScenarios, type ScenarioResult } from "../tests/helpers/memory-scenarios.ts";

/**
 * A/B memory measurement of packaged builds, e.g.
 *   node --import tsx scripts/measure-memory.mts --out report.json \
 *     --build baseline=/path/to/baseline --build current=/path/to/current [--runs 2] [--notes 1500]
 * Each `--build` is a directory that contains `writeme.app` (macOS) or `resources` (Windows/Linux).
 */
const args = process.argv.slice(2);
const values = (flag: string): string[] =>
    args.flatMap((arg, index) => (arg === flag && args[index + 1] ? [args[index + 1]!] : []));
const builds: Build[] = values("--build").map((entry) => {
    const [label, root] = entry.split("=");
    if (!label || !root) throw new Error(`--build expects label=path, got "${entry}"`);
    return { label, root: path.resolve(root) };
});
const runs = Number(values("--runs")[0] ?? 1);
const out = values("--out")[0];
const workspace: WorkspaceOptions = {
    ...DEFAULT_WORKSPACE,
    notes: Number(values("--notes")[0] ?? DEFAULT_WORKSPACE.notes),
    dotFiles: Number(values("--dot-files")[0] ?? DEFAULT_WORKSPACE.dotFiles),
};
if (builds.length === 0) throw new Error("Pass at least one --build label=path");

const results: ScenarioResult[] = [];
// alternate builds on every run so slow drift (thermal, background load) hits both equally
for (let run = 1; run <= runs; run++) {
    for (const build of builds) {
        const started = Date.now();
        const result = await runScenarios(build, workspace, (step) => console.error(`[${build.label} #${run}] ${step}`));
        results.push(result);
        console.error(`[${build.label} #${run}] done in ${Math.round((Date.now() - started) / 1000)}s`);
    }
}
const json = JSON.stringify({ measuredAt: new Date().toISOString(), runs, results }, null, 2);
if (out) {
    await mkdir(path.dirname(path.resolve(out)), { recursive: true });
    await writeFile(out, json);
} else console.log(json);
