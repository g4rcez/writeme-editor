import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
    userData: "",
    workspace: "",
    dialogResult: { canceled: true, filePaths: [] as string[] },
}));
const handlers = vi.hoisted(() => new Map<string, (...args: any[]) => unknown>());

vi.mock("electron", () => {
    class MockMenu {
        append() {}
        popup() {}
    }
    class MockMenuItem {
        constructor(public readonly options: unknown) {}
    }
    return {
        BrowserWindow: { fromWebContents: vi.fn() },
        Menu: MockMenu,
        MenuItem: MockMenuItem,
        app: { getPath: () => runtime.userData },
        clipboard: { readText: vi.fn(), read: vi.fn(), writeText: vi.fn() },
        dialog: { showOpenDialog: vi.fn(async () => runtime.dialogResult) },
        ipcMain: {
            handle: vi.fn((channel: string, handler: (...args: any[]) => unknown) => {
                handlers.set(channel, handler);
            }),
        },
        shell: { openExternal: vi.fn() },
    };
});

vi.mock("../main-process/database", () => ({
    dbManager: () => ({
        getAll: () => [{ name: "directory", value: JSON.stringify(runtime.workspace) }],
    }),
}));
vi.mock("../main-process/file-search", () => ({ searchWorkspaceFiles: vi.fn() }));
vi.mock("../main-process/file-watcher", () => ({ FileWatcher: { suppressNext: vi.fn() } }));

import { notesIpcHandler } from "./notes.ipc";

const invoke = async (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`Missing IPC handler: ${channel}`);
    return handler({}, ...args);
};

let root: string;
let vault: string;
let workspace: string;
let outside: string;

beforeEach(async () => {
    handlers.clear();
    root = await mkdtemp(path.join(tmpdir(), "writeme-ipc-"));
    vault = path.join(root, "vault");
    workspace = path.join(root, "workspace");
    outside = path.join(root, "outside");
    await Promise.all([mkdir(path.join(vault, "Projects"), { recursive: true }), mkdir(workspace), mkdir(outside)]);
    runtime.userData = path.join(root, "user-data");
    runtime.workspace = workspace;
    runtime.dialogResult = { canceled: false, filePaths: [vault] };
    await notesIpcHandler();
});

afterEach(async () => {
    await rm(root, { recursive: true, force: true });
});

describe("Obsidian filesystem IPC", () => {
    it("grants the selected vault and scans notes and assets recursively", async () => {
        await writeFile(path.join(vault, "Projects", "Idea.md"), "# Idea");
        await writeFile(path.join(vault, "Projects", "diagram.png"), "asset");
        await mkdir(path.join(vault, ".obsidian"));
        await writeFile(path.join(vault, ".obsidian", "app.json"), "{}");

        expect(await invoke("fs:chooseObsidianVault")).toBe(vault);
        const result = (await invoke("fs:readDirRecursive", vault, 32, true)) as {
            success: boolean;
            files: Array<{ relativePath: string }>;
        };

        expect(result.success).toBe(true);
        expect(result.files.map((file) => file.relativePath).sort()).toEqual([
            "Projects/Idea.md",
            "Projects/diagram.png",
        ]);
    });

    it("rejects traversal outside the selected or workspace roots", async () => {
        expect(await invoke("fs:chooseObsidianVault")).toBe(vault);

        const outsideScan = await invoke("fs:readDirRecursive", path.join(vault, "..", "outside"), 32, true);
        expect(outsideScan).toMatchObject({ success: false, error: "Path is outside the allowed workspace" });

        await writeFile(path.join(vault, "source.bin"), "source");
        const rejectedCopy = await invoke(
            "fs:copyFile",
            path.join(vault, "source.bin"),
            path.join(outside, "escape.bin"),
        );
        expect(rejectedCopy).toMatchObject({ success: false, error: "Path is outside the allowed workspace" });

        const rejectedVaultCopy = await invoke(
            "fs:copyFile",
            path.join(vault, "source.bin"),
            path.join(vault, "imported", "source.bin"),
        );
        expect(rejectedVaultCopy).toMatchObject({
            success: false,
            error: "Destination cannot be inside the selected vault",
        });
    });

    it("copies a selected-vault file only into the configured workspace", async () => {
        await invoke("fs:chooseObsidianVault");
        const source = path.join(vault, "Projects", "Idea.md");
        const target = path.join(workspace, "Projects", "Idea.md");
        await writeFile(source, "# Idea");

        const copied = await invoke("fs:copyFile", source, target);

        expect(copied).toMatchObject({ success: true, filePath: target });
        await expect(readFile(target, "utf8")).resolves.toBe("# Idea");
    });

    it("rejects symlink traversal for vault sources and workspace destinations", async () => {
        await invoke("fs:chooseObsidianVault");
        const outsideSourceDirectory = path.join(outside, "source");
        const outsideDestinationDirectory = path.join(outside, "destination");
        await mkdir(outsideSourceDirectory);
        await mkdir(outsideDestinationDirectory);
        await writeFile(path.join(outsideSourceDirectory, "source.md"), "# Outside");
        await symlink(outsideSourceDirectory, path.join(vault, "linked-source"), "dir");
        await symlink(outsideDestinationDirectory, path.join(workspace, "linked-destination"), "dir");

        const rejectedSource = await invoke(
            "fs:copyFile",
            path.join(vault, "linked-source", "source.md"),
            path.join(workspace, "source.md"),
        );
        expect(rejectedSource).toMatchObject({ success: false, error: "Path is outside the allowed workspace" });

        const rejectedDestination = await invoke(
            "fs:writeFile",
            path.join(workspace, "linked-destination", "escaped.md"),
            "must not write outside",
        );
        expect(rejectedDestination).toMatchObject({
            success: false,
            error: "Path is outside the allowed workspace",
        });
        await expect(readFile(path.join(outsideDestinationDirectory, "escaped.md"), "utf8")).rejects.toThrow();
    });
});
