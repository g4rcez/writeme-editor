import { _electron, type ElectronApplication, type Page } from "@playwright/test";
import asar from "@electron/asar";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type WorkspaceOptions = {
    /** Markdown notes spread over `folders` directories (all tracked by the app). */
    notes: number;
    folders: number;
    /** Approximate size of a regular note, in characters. */
    noteChars: number;
    /** Files under a dot-folder (like `.venv`) the app must not watch. */
    dotFiles: number;
    /** A few oversized notes, in characters. */
    bigNotes: number;
    bigNoteChars: number;
};

export type WorkspaceStats = WorkspaceOptions & { directories: number; totalChars: number };

export const DEFAULT_WORKSPACE: WorkspaceOptions = {
    notes: 1500,
    folders: 30,
    noteChars: 8_000,
    dotFiles: 4_000,
    bigNotes: 5,
    bigNoteChars: 300_000,
};

const WORDS =
    "alpha beta gamma delta epsilon zeta theta iota kappa lambda sigma omega editor workspace markdown tiptap sync query index buffer render cache channel window shortcut command palette".split(
        " ",
    );

const random = (seed: number) => {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
};

const paragraph = (rand: () => number, words: number): string =>
    Array.from({ length: words }, () => WORDS[Math.floor(rand() * WORDS.length)]).join(" ");

const noteBody = (index: number, chars: number, rand: () => number): string => {
    const parts = [`# Note ${index}`, "", `#topic-${index % 17} #project-${index % 5}`, ""];
    let size = parts.join("\n").length;
    while (size < chars) {
        const block =
            rand() < 0.12
                ? `\`\`\`ts\nexport const value${index} = ${Math.floor(rand() * 1e6)};\nconsole.log(value${index});\n\`\`\`\n`
                : `${paragraph(rand, 40 + Math.floor(rand() * 40))}.\n`;
        parts.push(block);
        size += block.length + 1;
    }
    return parts.join("\n");
};

export async function generateWorkspace(root: string, options: WorkspaceOptions = DEFAULT_WORKSPACE): Promise<WorkspaceStats> {
    const rand = random(42);
    let totalChars = 0;
    const directories = new Set<string>();
    const write = async (file: string, content: string) => {
        const dir = path.dirname(file);
        if (!directories.has(dir)) {
            await mkdir(dir, { recursive: true });
            directories.add(dir);
        }
        await writeFile(file, content);
    };
    for (let index = 0; index < options.notes; index++) {
        const body = noteBody(index, options.noteChars, rand);
        totalChars += body.length;
        await write(path.join(root, `folder-${index % options.folders}`, `note-${index}.md`), body);
    }
    for (let index = 0; index < options.bigNotes; index++) {
        const body = noteBody(10_000 + index, options.bigNoteChars, rand);
        totalChars += body.length;
        await write(path.join(root, "big", `big-${index}.md`), body);
    }
    for (let index = 0; index < options.dotFiles; index++) {
        await write(path.join(root, ".venv", "lib", `pkg-${index % 40}`, `module-${index}.py`), `value = ${index}\n`);
    }
    return { ...options, directories: directories.size, totalChars };
}

export type Build = { label: string; root: string };

const resourcesDirectory = process.platform === "darwin" ? "writeme.app/Contents/Resources" : "resources";

export const buildAsar = (build: Build): string => path.join(build.root, resourcesDirectory, "app.asar");
const buildEntry = (build: Build): string => path.join(buildAsar(build), ".vite/build/main.js");

/** Absolute path of the packaged app produced by `electron-forge package`, or the `WRITEME_MEMORY_BUILD` override. */
export const currentBuild = (): Build => ({
    label: "current",
    root: path.resolve(process.env.WRITEME_MEMORY_BUILD ?? `out/writeme-${process.platform}-${process.arch}`),
});

export type MeasuredApp = {
    app: ElectronApplication;
    page: Page;
    userData: string;
    close: () => Promise<void>;
};

/**
 * Starts the compiled main process the same way the other native specs do, with two additions:
 * every `ipcMain.handle` channel is counted in `globalThis.__ipc`, and the workspace is opened through
 * `WRITEME_WORKSPACE` so no dialog has to be driven.
 */
export async function launchMeasured(build: Build, workspace: string, existingUserData?: string): Promise<MeasuredApp> {
    const userData = existingUserData ?? (await mkdtemp(path.join(tmpdir(), "writeme-memory-")));
    const bootstrap = path.join(userData, "bootstrap.cjs");
    await writeFile(
        bootstrap,
        `const { app, ipcMain } = require("electron");
app.setPath("appData", ${JSON.stringify(userData)});
app.setPath("userData", ${JSON.stringify(userData)});
globalThis.__ipc = {};
require("v8").setFlagsFromString("--expose-gc");
globalThis.__gc = require("vm").runInNewContext("gc");
const handle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, listener) =>
    handle(channel, (...args) => {
        globalThis.__ipc[channel] = (globalThis.__ipc[channel] ?? 0) + 1;
        return listener(...args);
    });
require(${JSON.stringify(buildEntry(build))});
`,
    );
    const app = await _electron.launch({
        args: [bootstrap, "--no-sandbox"],
        env: { ...process.env, NODE_ENV: "production", WRITEME_WORKSPACE: workspace },
    });
    const page = await app.firstWindow();
    return { app, page, userData, close: () => app.close() };
}

export const ipcCounts = (app: ElectronApplication): Promise<Record<string, number>> =>
    app.evaluate(() => ({ ...((globalThis as unknown as { __ipc: Record<string, number> }).__ipc ?? {}) }));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves once no `fs:*` / `db:*` IPC has happened for `idleMs`, i.e. the app finished loading its data. */
export async function waitForQuiescence(app: ElectronApplication, idleMs = 3_000, maxMs = 180_000): Promise<number> {
    const started = Date.now();
    const total = (counts: Record<string, number>) =>
        Object.entries(counts)
            .filter(([channel]) => /^(fs|db):/.test(channel))
            .reduce((sum, [, value]) => sum + value, 0);
    let last = total(await ipcCounts(app));
    let lastChange = Date.now();
    while (Date.now() - started < maxMs) {
        await sleep(500);
        const current = total(await ipcCounts(app));
        if (current !== last) {
            last = current;
            lastChange = Date.now();
        } else if (Date.now() - lastChange >= idleMs) return lastChange - started;
    }
    throw new Error(`Application never became idle within ${maxMs}ms`);
}

export type Snapshot = {
    /**
     * Physical footprint of every Electron process, in MB (`footprint`, the number Activity Monitor shows). Unlike
     * resident size it includes pages the OS compressed or swapped out, so it stays comparable between runs.
     */
    footprintMB: number;
    footprintByType: Record<string, number>;
    /** Sum of resident memory of every Electron process, in MB (from `ps`). Noisy when the OS is swapping. */
    rssMB: number;
    rssByType: Record<string, number>;
    /** Main process V8 heap + external memory after a forced GC, in MB. */
    mainHeapMB: number;
    processes: number;
    /** Renderer JS heap of every open window after a forced GC, in MB. */
    jsHeapMB: number;
    /** Open file descriptors held by the main process. */
    mainFds: number;
    windows: number;
    ipc: Record<string, number>;
};

const psTable = (pids: number[]): Map<number, number> => {
    const output = execFileSync("ps", ["-o", "pid=,rss=", "-p", pids.join(",")], { encoding: "utf8" });
    const table = new Map<number, number>();
    for (const line of output.split("\n")) {
        const [pid, rss] = line.trim().split(/\s+/).map(Number);
        if (pid !== undefined && rss !== undefined && Number.isFinite(pid) && Number.isFinite(rss)) table.set(pid, rss);
    }
    return table;
};

const UNIT_MB: Record<string, number> = { B: 1 / 1024 / 1024, KB: 1 / 1024, MB: 1, GB: 1024 };

const footprintTable = (pids: number[]): Map<number, number> => {
    const table = new Map<number, number>();
    try {
        const output = execFileSync("footprint", pids.flatMap((pid) => ["-p", String(pid)]), {
            encoding: "utf8",
            maxBuffer: 64 * 1024 * 1024,
        });
        for (const match of output.matchAll(/\[(\d+)\]:[^\n]*?Footprint:\s+([\d.]+)\s+(B|KB|MB|GB)\b/g)) {
            table.set(Number(match[1]), Number(match[2]) * (UNIT_MB[match[3]!] ?? 0));
        }
    } catch {
        // `footprint` is macOS only; callers fall back to resident size
    }
    return table;
};

/** Runs a full GC in the main process and in every window so the numbers show retained memory, not garbage. */
export async function collectGarbage(app: ElectronApplication): Promise<void> {
    await app.evaluate(() => (globalThis as unknown as { __gc?: () => void }).__gc?.());
    for (const page of app.windows()) {
        try {
            const session = await page.context().newCDPSession(page);
            await session.send("HeapProfiler.collectGarbage");
            await session.detach();
        } catch {
            // a window that is closing cannot be sampled
        }
    }
}

const openDescriptors = (pid: number): number => {
    try {
        return execFileSync("lsof", ["-n", "-P", "-p", String(pid)], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
            .split("\n")
            .filter(Boolean).length;
    } catch {
        return -1;
    }
};

export async function snapshot(app: ElectronApplication, options: { gc?: boolean } = {}): Promise<Snapshot> {
    if (options.gc) await collectGarbage(app);
    const { mainPid, mainHeapBytes, processes } = await app.evaluate(({ app: electron }) => {
        const usage = process.memoryUsage();
        return {
            mainPid: process.pid,
            mainHeapBytes: usage.heapUsed + usage.external,
            processes: electron.getAppMetrics().map(({ pid, type }) => ({ pid, type })),
        };
    });
    const pids = [...new Set([mainPid, ...processes.map(({ pid }) => pid)])];
    const rss = psTable(pids);
    const footprint = footprintTable(pids);
    const rssByType: Record<string, number> = {};
    const footprintByType: Record<string, number> = {};
    for (const { pid, type } of processes) {
        rssByType[type] = (rssByType[type] ?? 0) + (rss.get(pid) ?? 0) / 1024;
        footprintByType[type] = (footprintByType[type] ?? 0) + (footprint.get(pid) ?? 0);
    }
    const pages = app.windows();
    let jsHeap = 0;
    for (const page of pages) {
        jsHeap += await page
            .evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0)
            .catch(() => 0);
    }
    return {
        footprintMB: [...footprint.values()].reduce((sum, value) => sum + value, 0),
        footprintByType,
        mainHeapMB: mainHeapBytes / 1024 / 1024,
        rssMB: [...rss.values()].reduce((sum, value) => sum + value, 0) / 1024,
        rssByType,
        processes: pids.length,
        jsHeapMB: jsHeap / 1024 / 1024,
        mainFds: openDescriptors(mainPid),
        windows: pages.length,
        ipc: await ipcCounts(app),
    };
}

/** Median of several snapshots taken `gapMs` apart, which smooths allocator and GC noise. */
export async function steadySnapshot(app: ElectronApplication, samples = 5, gapMs = 2_000): Promise<Snapshot> {
    const taken: Snapshot[] = [];
    for (let index = 0; index < samples; index++) {
        taken.push(await snapshot(app, { gc: true }));
        if (index < samples - 1) await sleep(gapMs);
    }
    const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
    const last = taken[taken.length - 1]!;
    return {
        ...last,
        footprintMB: median(taken.map((item) => item.footprintMB)),
        rssMB: median(taken.map((item) => item.rssMB)),
        mainHeapMB: median(taken.map((item) => item.mainHeapMB)),
        jsHeapMB: median(taken.map((item) => item.jsHeapMB)),
    };
}

export const readFileCalls = (counts: Record<string, number>): number => counts["fs:readFile"] ?? 0;

const HEAVY_CHUNK = /(?:^|\/)(shiki|excalidraw|mermaid|graphviz|mathjs)-[\w-]+\.js$/;

export type StartupBundle = {
    /** Heavy libraries the renderer entry loads (statically or via modulepreload) before any note is opened. */
    heavyChunksAtStartup: string[];
    /** Total bytes of the JS that the HTML preloads plus the entry chunk. */
    startupJsKB: number;
    /** Files shipped in the renderer bundle. */
    chunkCount: number;
};

/** Reads the renderer's `index.html` out of the asar and lists what is loaded eagerly. */
export function inspectStartupBundle(build: Build): StartupBundle {
    const archive = buildAsar(build);
    const files = asar.listPackage(archive, { isPack: false }).map((file) => file.replaceAll("\\", "/").replace(/^\//, ""));
    const htmlPath = files.find((file) => /\.vite\/renderer\/[^/]+\/index\.html$/.test(file));
    if (!htmlPath) throw new Error("Renderer index.html not found inside app.asar");
    const html = asar.extractFile(archive, htmlPath).toString("utf8");
    const base = path.posix.dirname(htmlPath);
    const eager = new Set<string>();
    const queue: string[] = [];
    const add = (reference: string) => {
        const resolved = path.posix.normalize(path.posix.join(base, reference.replace(/^\.?\//, "")));
        if (!eager.has(resolved) && files.includes(resolved)) {
            eager.add(resolved);
            queue.push(resolved);
        }
    };
    for (const match of html.matchAll(/(?:src|href)="([^"]+\.js)"/g)) add(match[1]!);
    // static `import ... from "./x.js"` edges of every eagerly loaded chunk (dynamic `import()` is lazy and skipped)
    while (queue.length) {
        const current = queue.pop()!;
        const source = asar.extractFile(archive, current).toString("utf8");
        for (const match of source.matchAll(/(?:^|[;}\n])\s*(?:import|export)\s*(?:[^'"()]*?from\s*)?["'](\.[^"']+\.js)["']/g)) {
            const next = path.posix.normalize(path.posix.join(path.posix.dirname(current), match[1]!));
            if (files.includes(next) && !eager.has(next)) {
                eager.add(next);
                queue.push(next);
            }
        }
    }
    const sizeOf = (file: string) => asar.extractFile(archive, file).length;
    return {
        heavyChunksAtStartup: [...eager].filter((file) => HEAVY_CHUNK.test(file)).map((file) => path.posix.basename(file)),
        startupJsKB: Math.round([...eager].reduce((sum, file) => sum + sizeOf(file), 0) / 1024),
        chunkCount: files.filter((file) => /\.vite\/renderer\/.*\.js$/.test(file)).length,
    };
}

/** Immediate children of `parent` that look like interactive shells (what node-pty starts). */
export function childShells(parent: number): number {
    const output = execFileSync("ps", ["-A", "-o", "pid=,ppid=,comm="], { encoding: "utf8" });
    return output
        .split("\n")
        .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/))
        .filter((match): match is RegExpMatchArray => match !== null)
        .filter(([, , ppid, command]) => Number(ppid) === parent && /(?:^|[/-])(zsh|bash|sh|fish)$/.test(command!)).length;
}

export const sleepMs = sleep;

/** Destroys every floating window and waits until Electron really reports a single window again. */
export async function closeSecondaryWindows(app: ElectronApplication, timeoutMs = 20_000): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const remaining = await app.evaluate(({ BrowserWindow }) => {
            const floating = BrowserWindow.getAllWindows().filter(
                (window) => !window.isDestroyed() && /quicknote|mathnote|floating-editor/.test(window.webContents.getURL()),
            );
            for (const window of floating) window.destroy();
            return floating.length;
        });
        if (remaining === 0 && app.windows().length <= 1) return;
        await sleep(500);
    }
    throw new Error("Floating windows did not close");
}
