import { expect, test } from "@playwright/test";
import { currentBuild } from "../helpers/memory-harness";
import { runScenarios, type ScenarioResult } from "../helpers/memory-scenarios";

/**
 * Asserts the memory work against a packaged build (`npm run package:app`, or WRITEME_MEMORY_BUILD=<dir with writeme.app>).
 * The budgets for bundle, reads, file handles, heap, captured output and the terminal are chosen so the pre-fix build
 * fails them (checked against the baseline build). "Closing windows" and "no renderer errors" are harness guards.
 * Counts are used instead of raw MB wherever possible, because resident memory on a swapping machine varies more
 * between runs than between builds.
 * `scripts/measure-memory.mts` produces the A/B numbers behind these limits.
 */
test("stays inside the memory budget", async () => {
    test.setTimeout(10 * 60_000);
    const result: ScenarioResult = await runScenarios(currentBuild());
    const files = result.workspace.notes + result.workspace.bigNotes;
    const skip = (reason: string) => test.info().annotations.push({ type: "skipped", description: reason });

    // soft expectations: every budget is evaluated and reported, even when an earlier one fails
    await test.step("does not load the heavy editor libraries at startup", () => {
        expect.soft(result.bundle.heavyChunksAtStartup).toEqual([]);
        expect.soft(result.bundle.startupJsKB).toBeLessThan(12_000);
    });

    await test.step("reads each workspace file once on startup, not twice", () => {
        expect.soft(result.startup.fsReadFile).toBeLessThanOrEqual(Math.ceil(files * 1.25));
    });

    await test.step("autosaving a note does not re-read the workspace", () => {
        expect.soft(result.saves.readsPerAutosave).toHaveLength(5);
        for (const reads of result.saves.readsPerAutosave) expect.soft(reads).toBeLessThanOrEqual(10);
    });

    await test.step("creating a note or saving it does not re-read the workspace", () => {
        expect.soft(result.saves.createReads).toBeLessThanOrEqual(10);
    });

    await test.step("a file changed or added on disk reloads only that file", () => {
        expect.soft(result.external.modifyReads).toBeLessThanOrEqual(5);
        expect.soft(result.external.addReads).toBeLessThanOrEqual(5);
        expect.soft(result.external.addedIndexed).toBe(true);
    });

    await test.step("watches the notes only: no dot-folders, bounded depth", () => {
        // one handle per note and folder is expected; 4000 files under .venv must not add to it
        expect.soft(result.idle.mainFds).toBeGreaterThan(0);
        expect.soft(result.idle.mainFds).toBeLessThan(files + 600);
    });

    await test.step("keeps the renderer heap small once garbage is collected", () => {
        expect.soft(result.idle.jsHeapMB).toBeLessThan(100);
    });

    await test.step("quick-note windows do not load the workspace", () => {
        if ("skipped" in result.floating) {
            skip(result.floating.skipped);
            return;
        }
        expect.soft(result.floating.readsPerWindow).toBeLessThanOrEqual(20);
        // each window is its own process and heap; without the notes it should stay far below the main window's
        const perWindowHeap = (result.floating.whileOpen.jsHeapMB - result.idle.jsHeapMB) / result.floating.opened;
        expect.soft(perWindowHeap).toBeLessThan(60);
    });

    await test.step("closing quick-note windows really closes them", () => {
        if ("skipped" in result.floating) {
            skip(result.floating.skipped);
            return;
        }
        expect.soft(result.floating.whileOpen.windows).toBeGreaterThan(result.floating.opened);
        expect.soft(result.floating.afterClose.windows).toBe(1);
    });

    await test.step("caps the output captured from a code block run", () => {
        if ("skipped" in result.execution) {
            skip(result.execution.skipped);
            return;
        }
        expect.soft(result.execution.stdoutChars).toBeLessThanOrEqual(1_000_000);
    });

    await test.step("starts shells in the packaged app and leaves none orphaned after a respawn", () => {
        if ("skipped" in result.terminal) {
            // a build without the terminal feature may skip; a build that has it but cannot spawn is the packaging bug
            expect.soft(result.terminal.skipped).toMatch(/feature disabled/);
            skip(result.terminal.skipped);
            return;
        }
        expect.soft(result.terminal.shellsBeforeKill).toBeGreaterThan(0);
        expect.soft(result.terminal.orphanShells).toBe(0);
    });

    await test.step("raises no renderer errors during the scenarios", () => {
        expect.soft(result.errors).toEqual([]);
    });
});
