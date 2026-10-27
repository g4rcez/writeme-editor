import { expect, type Page } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
    DEFAULT_WORKSPACE,
    childShells,
    closeSecondaryWindows,
    generateWorkspace,
    inspectStartupBundle,
    ipcCounts,
    launchMeasured,
    readFileCalls,
    sleepMs,
    snapshot,
    steadySnapshot,
    waitForQuiescence,
    type Build,
    type Snapshot,
    type StartupBundle,
    type WorkspaceOptions,
    type WorkspaceStats,
} from "./memory-harness";

export type ScenarioResult = {
    label: string;
    workspace: WorkspaceStats;
    bundle: StartupBundle;
    startup: { quiescentMs: number; fsReadFile: number; fsReadDirRecursive: number; snapshot: Snapshot };
    idle: Snapshot;
    /** `fs:readFile` IPC calls caused by saving one note, in a workspace of `workspace.notes` notes. */
    saves: { createReads: number; readsPerAutosave: number[]; after: Snapshot };
    /** Files changed behind the app's back (another editor, git): reads they cause and whether the new note was indexed. */
    external: { modifyReads: number; addReads: number; addedIndexed: boolean };
    floating: { opened: number; readsPerWindow: number; whileOpen: Snapshot; afterClose: Snapshot } | { skipped: string };
    terminal: { shellsBeforeKill: number; orphanShells: number } | { skipped: string };
    execution: { stdoutChars: number } | { skipped: string };
    errors: string[];
};

const createNote = async (page: Page, title: string): Promise<void> => {
    await page
        .getByRole("main")
        .getByRole("button", { name: /^New note/ })
        .first()
        .click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await dialog.getByTitle("Note title").fill(title);
    await dialog.locator('button[type="submit"]').click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL((url) => /#\/note\/[^/]+$/.test(url.hash));
    await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toBeVisible({ timeout: 60_000 });
};

const saveEdit = async (page: Page, text: string): Promise<void> => {
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.click();
    await editor.pressSequentially(text);
    await editor.press("ControlOrMeta+s");
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 30_000 });
};

export async function runScenarios(
    build: Build,
    options: WorkspaceOptions = DEFAULT_WORKSPACE,
    log: (message: string) => void = () => {},
): Promise<ScenarioResult> {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "writeme-memory-workspace-"));
    const workspace = await generateWorkspace(workspaceRoot, options);
    const errors: string[] = [];
    // The notes repository only reads the workspace from disk once the `directory` setting is saved, so seed it
    // in a throw-away first run and start the measured process cold, as a normal launch would.
    const seed = await launchMeasured(build, workspaceRoot);
    await expect(seed.page).toHaveURL(/^file:/);
    await waitForQuiescence(seed.app, 1_500, 60_000);
    await seed.page.evaluate(async (directory) => {
        await window.electronAPI.db.save("settings", {
            id: "directory",
            name: "directory",
            value: JSON.stringify(directory),
            type: "setting",
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }, workspaceRoot);
    await seed.close();
    const session = await launchMeasured(build, workspaceRoot, seed.userData);
    const { app, page } = session;
    page.on("pageerror", (error) => errors.push(error.message));
    try {
        await expect(page).toHaveURL(/^file:/);

        log("startup");
        const quiescentMs = await waitForQuiescence(app);
        const loaded = await ipcCounts(app);
        const startupSnapshot = await snapshot(app);

        log("idle");
        await sleepMs(10_000);
        const idle = await steadySnapshot(app);

        log("note + autosave");
        const beforeCreate = readFileCalls(await ipcCounts(app));
        await createNote(page, "Memory probe");
        await waitForQuiescence(app, 2_000, 60_000);
        const createReads = readFileCalls(await ipcCounts(app)) - beforeCreate;
        const readsPerAutosave: number[] = [];
        for (let index = 0; index < 5; index++) {
            const before = readFileCalls(await ipcCounts(app));
            await saveEdit(page, ` edit-${index}`);
            await waitForQuiescence(app, 2_000, 60_000);
            readsPerAutosave.push(readFileCalls(await ipcCounts(app)) - before);
        }
        const afterSaves = await steadySnapshot(app, 3);

        log("external changes");
        const settleExternal = async () => {
            await sleepMs(1_500);
            await waitForQuiescence(app, 2_000, 60_000);
        };
        const beforeModify = readFileCalls(await ipcCounts(app));
        await writeFile(path.join(workspaceRoot, "folder-0", "note-0.md"), "# Edited elsewhere\n\nchanged on disk\n");
        await settleExternal();
        const modifyReads = readFileCalls(await ipcCounts(app)) - beforeModify;
        const beforeAdd = readFileCalls(await ipcCounts(app));
        const addedPath = path.join(workspaceRoot, "folder-1", "added-elsewhere.md");
        await writeFile(addedPath, "# Added elsewhere\n\nnew file\n");
        await settleExternal();
        const addReads = readFileCalls(await ipcCounts(app)) - beforeAdd;
        const addedIndexed = await page.evaluate(
            async (suffix) =>
                (await window.electronAPI.db.getAll<{ filePath?: string }>("notes")).some((row) =>
                    row.filePath?.endsWith(suffix),
                ),
            "added-elsewhere.md",
        );

        log("floating windows");
        let floating: ScenarioResult["floating"];
        const beforeFloating = readFileCalls(await ipcCounts(app));
        const opened = 3;
        for (let index = 0; index < opened; index++) {
            await page.evaluate(() => window.electronAPI.app.openQuickNote());
            await sleepMs(1_500);
        }
        await waitForQuiescence(app, 3_000, 120_000);
        const floatingReads = readFileCalls(await ipcCounts(app)) - beforeFloating;
        const whileOpen = await steadySnapshot(app, 3);
        await closeSecondaryWindows(app);
        await sleepMs(3_000);
        floating = {
            opened,
            readsPerWindow: Math.round(floatingReads / opened),
            whileOpen,
            afterClose: await steadySnapshot(app, 3),
        };

        log("terminal");
        let terminal: ScenarioResult["terminal"];
        if (await page.evaluate(() => Boolean(window.electronAPI.terminal))) {
            const mainPid = await app.evaluate(() => process.pid);
            const before = childShells(mainPid);
            await page.evaluate(() => {
                window.electronAPI.terminal.spawn("memory-probe");
            });
            await sleepMs(800);
            await page.evaluate(() => {
                window.electronAPI.terminal.spawn("memory-probe");
            });
            await sleepMs(800);
            // proves the probe can see a live shell, otherwise "0 orphans" would mean nothing
            const shellsBeforeKill = childShells(mainPid) - before;
            await page.evaluate(() => {
                window.electronAPI.terminal.kill("memory-probe");
            });
            await sleepMs(1_500);
            terminal =
                shellsBeforeKill > 0
                    ? { shellsBeforeKill, orphanShells: childShells(mainPid) - before }
                    : { skipped: "no shell could be started in this build (node-pty spawn-helper missing from the package)" };
        } else terminal = { skipped: "terminal feature disabled in this build" };

        log("execution");
        let execution: ScenarioResult["execution"];
        if (await page.evaluate(() => Boolean(window.electronAPI.execution))) {
            const result = await page.evaluate(() =>
                window.electronAPI.execution.run("/usr/bin/head", ["-c", "5000000", "/dev/zero"], ""),
            );
            execution = { stdoutChars: result.stdout.length };
        } else execution = { skipped: "code execution disabled in this build" };

        return {
            label: build.label,
            workspace,
            bundle: inspectStartupBundle(build),
            startup: {
                quiescentMs,
                fsReadFile: readFileCalls(loaded),
                fsReadDirRecursive: loaded["fs:readDirRecursive"] ?? 0,
                snapshot: startupSnapshot,
            },
            idle,
            saves: { createReads, readsPerAutosave, after: afterSaves },
            external: { modifyReads, addReads, addedIndexed },
            floating,
            terminal,
            execution,
            errors,
        };
    } finally {
        await session.close().catch(() => undefined);
        await rm(session.userData, { recursive: true, force: true });
        await rm(workspaceRoot, { recursive: true, force: true });
    }
}
