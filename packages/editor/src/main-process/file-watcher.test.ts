// @vitest-environment node
import chokidar from "chokidar";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("chokidar", async (importOriginal) => {
    const actual = await importOriginal<typeof import("chokidar")>();
    return { ...actual, default: { ...actual.default, watch: vi.fn(actual.default.watch) } };
});

import { FileWatcher } from "./file-watcher";

const send = vi.fn();
const window = { webContents: { send } } as unknown as import("electron").BrowserWindow;
const dirChanges = () => send.mock.calls.filter(([channel]) => channel === "fs:dir-changed").map(([, payload]) => payload.dirPath);
const settle = (ms = 1_200) => new Promise((resolve) => setTimeout(resolve, ms));

let root: string;

beforeEach(async () => {
    // macOS tmpdir is a symlink; chokidar reports the resolved path
    root = await mkdtemp(path.join(tmpdir(), "writeme-watcher-"));
    send.mockClear();
    vi.mocked(chokidar.watch).mockClear();
});

afterEach(async () => {
    FileWatcher.stop();
    await rm(root, { recursive: true, force: true });
});

describe("FileWatcher memory bounds", () => {
    it("does not watch dot-folders such as .venv or .cache", async () => {
        await mkdir(path.join(root, ".venv", "lib"), { recursive: true });
        await mkdir(path.join(root, "notes"));
        FileWatcher.start(root, window);
        await settle(600);

        await writeFile(path.join(root, ".venv", "lib", "module.py"), "x = 1");
        await writeFile(path.join(root, "notes", "a.md"), "# a");
        await settle();

        const changed = dirChanges();
        expect(changed.some((dir) => dir.includes(`${path.sep}notes`))).toBe(true);
        expect(changed.some((dir) => dir.includes(".venv"))).toBe(false);
    });

    it("stops descending after three levels", async () => {
        const deep = path.join(root, "a", "b", "c", "d", "e", "f");
        const shallow = path.join(root, "a", "b");
        await mkdir(deep, { recursive: true });
        FileWatcher.start(root, window);
        await settle(600);

        await writeFile(path.join(deep, "deep.md"), "# deep");
        await writeFile(path.join(shallow, "shallow.md"), "# shallow");
        await settle();

        const changed = dirChanges();
        expect(changed.some((dir) => dir.endsWith(path.join("a", "b")))).toBe(true);
        expect(changed.some((dir) => dir.endsWith(path.join("c", "d", "e", "f")))).toBe(false);
    });

    it("keeps the existing watcher when the same directory is started again", () => {
        FileWatcher.start(root, window);
        FileWatcher.start(root, window);
        FileWatcher.start(root, window);
        expect(chokidar.watch).toHaveBeenCalledTimes(1);

        const other = path.join(root, "other");
        FileWatcher.start(other, window);
        expect(chokidar.watch).toHaveBeenCalledTimes(2);
    });

    it("does not report files the app has just created itself, but reports foreign ones", async () => {
        FileWatcher.start(root, window);
        await settle(600);

        const own = path.join(root, "own.md");
        FileWatcher.suppressNext(own);
        await writeFile(own, "# own");
        await settle();
        expect(dirChanges()).toEqual([]);

        await writeFile(path.join(root, "foreign.md"), "# foreign");
        await settle();
        expect(dirChanges()).toHaveLength(1);
    });

    it("prunes expired write records so the map cannot grow for the whole session", () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        try {
            const records = (FileWatcher as unknown as { lastWrittenByApp: Map<string, number> }).lastWrittenByApp;
            for (let index = 0; index < 500; index++) FileWatcher.suppressNext(`/notes/${index}.md`);
            expect(records.size).toBe(500);

            vi.setSystemTime(Date.now() + 10_000);
            FileWatcher.suppressNext("/notes/latest.md");
            expect([...records.keys()]).toEqual(["/notes/latest.md"]);
        } finally {
            vi.useRealTimers();
        }
    });
});
