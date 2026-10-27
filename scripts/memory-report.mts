import { readFile } from "node:fs/promises";
import type { ScenarioResult } from "../tests/helpers/memory-scenarios.ts";

/** Turns the JSON written by `measure-memory.mts` into a markdown comparison (median of the runs per build). */
const [file, baselineLabel = "baseline", currentLabel = "current"] = process.argv.slice(2);
if (!file) throw new Error("Usage: memory-report.mts <results.json> [baselineLabel] [currentLabel]");

const { results, runs } = JSON.parse(await readFile(file, "utf8")) as { results: ScenarioResult[]; runs: number };
const pick = (label: string) => results.filter((result) => result.label === label);
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
const read = <T,>(label: string, get: (result: ScenarioResult) => T | undefined): T[] =>
    pick(label).flatMap((result) => {
        const value = get(result);
        return value === undefined ? [] : [value];
    });
const med = (label: string, get: (result: ScenarioResult) => number | undefined): number => {
    const values = read(label, get);
    return values.length ? median(values) : Number.NaN;
};

const fmt = (value: number, digits = 0) => (Number.isNaN(value) ? "n/a" : value.toFixed(digits));
const delta = (before: number, after: number) => {
    if (Number.isNaN(before) || Number.isNaN(after)) return "n/a";
    if (before === 0) return after === 0 ? "0%" : "n/a";
    const change = ((after - before) / before) * 100;
    return `${change > 0 ? "+" : ""}${change.toFixed(0)}%`;
};

type Row = [metric: string, unit: string, get: (result: ScenarioResult) => number | undefined, digits?: number];
const floating = (get: (value: Extract<ScenarioResult["floating"], { opened: number }>) => number) => (result: ScenarioResult) =>
    "opened" in result.floating ? get(result.floating) : undefined;

const sections: Array<[title: string, rows: Row[]]> = [
    [
        "Memory: physical footprint of all Electron processes (what Activity Monitor shows)",
        [
            ["Idle total, 10 s after startup", "MB", (r) => r.idle.footprintMB],
            ["  main process", "MB", (r) => r.idle.footprintByType.Browser],
            ["  renderer", "MB", (r) => r.idle.footprintByType.Tab],
            ["  GPU + utility", "MB", (r) => (r.idle.footprintByType.GPU ?? 0) + (r.idle.footprintByType.Utility ?? 0)],
            ["After creating a note and saving 5 times", "MB", (r) => r.saves.after.footprintMB],
            ["With 3 quick-note windows open", "MB", floating((f) => f.whileOpen.footprintMB)],
            ["After closing them", "MB", floating((f) => f.afterClose.footprintMB)],
        ],
    ],
    [
        "Memory: retained after a forced garbage collection",
        [
            ["Renderer JS heap, idle", "MB", (r) => r.idle.jsHeapMB],
            ["Main process heap, idle", "MB", (r) => r.idle.mainHeapMB],
            ["Renderer JS heap, 3 quick-note windows open (all windows)", "MB", floating((f) => f.whileOpen.jsHeapMB)],
            ["Renderer JS heap, after closing them", "MB", floating((f) => f.afterClose.jsHeapMB)],
        ],
    ],
    [
        "Memory: resident set size (noisy while the OS swaps, kept for reference)",
        [["Idle total", "MB", (r) => r.idle.rssMB]],
    ],
    [
        "Workspace reads (IPC `fs:readFile` calls)",
        [
            ["Startup", "calls", (r) => r.startup.fsReadFile],
            ["Creating one note", "calls", (r) => r.saves.createReads],
            ["One autosave (median of 5)", "calls", (r) => median(r.saves.readsPerAutosave)],
            ["Modifying one file on disk", "calls", (r) => r.external?.modifyReads],
            ["Adding one file on disk", "calls", (r) => r.external?.addReads],
            ["Opening one quick-note window", "calls", floating((f) => f.readsPerWindow)],
            ["Time until the app is idle after launch", "ms", (r) => r.startup.quiescentMs],
        ],
    ],
    [
        "Bundle loaded at startup",
        [
            ["JS loaded eagerly", "KB", (r) => r.bundle.startupJsKB],
            ["Heavy libraries loaded eagerly (shiki, excalidraw, mermaid, graphviz, mathjs)", "chunks", (r) => r.bundle.heavyChunksAtStartup.length],
        ],
    ],
    [
        "File handles and processes",
        [
            ["Open file descriptors in main", "fds", (r) => r.idle.mainFds],
            ["Electron processes, idle", "procs", (r) => r.idle.processes],
            ["Orphaned shells after respawn + kill", "shells", (r) => ("orphanShells" in r.terminal ? r.terminal.orphanShells : undefined)],
            ["Captured stdout of a 5 MB command", "chars", (r) => ("stdoutChars" in r.execution ? r.execution.stdoutChars : undefined)],
        ],
    ],
];

const range = (label: string, get: (result: ScenarioResult) => number | undefined, digits: number): string => {
    const values = read(label, get);
    if (values.length < 2 || Number.isNaN(med(label, get))) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min === max ? "" : ` (${fmt(min, digits)}–${fmt(max, digits)})`;
};

const first = pick(baselineLabel)[0] ?? pick(currentLabel)[0];
const lines = [
    `Workspace: ${first?.workspace.notes} notes (~${Math.round((first?.workspace.noteChars ?? 0) / 1000)} KB each), ` +
        `${first?.workspace.bigNotes} large notes (~${Math.round((first?.workspace.bigNoteChars ?? 0) / 1000)} KB), ` +
        `${first?.workspace.dotFiles} files under a dot-folder. Median of ${runs} run(s) per build, min–max in brackets.`,
    "",
];
for (const [title, rows] of sections) {
    lines.push(`### ${title}`, "", `| Metric | ${baselineLabel} | ${currentLabel} | Change |`, "| --- | ---: | ---: | ---: |");
    for (const [metric, unit, get, digits = 0] of rows) {
        const before = med(baselineLabel, get);
        const after = med(currentLabel, get);
        lines.push(
            `| ${metric} | ${fmt(before, digits)}${range(baselineLabel, get, digits)} ${unit} | ` +
                `${fmt(after, digits)}${range(currentLabel, get, digits)} ${unit} | ${delta(before, after)} |`,
        );
    }
    lines.push("");
}
const spread = (label: string) => read(label, (r) => r.idle.footprintMB).map((value) => value.toFixed(0)).join(", ");
lines.push(`Idle footprint per run (MB): ${baselineLabel} [${spread(baselineLabel)}], ${currentLabel} [${spread(currentLabel)}]`);
console.log(lines.join("\n"));
