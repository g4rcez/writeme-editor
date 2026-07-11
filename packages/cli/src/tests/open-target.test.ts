import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveOpenTarget } from "../lib/open-target.ts";

describe("resolveOpenTarget", () => {
    test("opens an existing directory as a folder target", async () => {
        const dir = await mkdtemp(path.join(tmpdir(), "writeme-open-dir-"));

        try {
            const target = await resolveOpenTarget(dir, false);

            expect(target).toEqual({
                type: "folder",
                folderPath: dir,
            });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    test("opens an existing file as a file target", async () => {
        const dir = await mkdtemp(path.join(tmpdir(), "writeme-open-file-"));
        const filePath = path.join(dir, "note.md");

        try {
            await writeFile(filePath, "# Note\n");

            const target = await resolveOpenTarget(filePath, true);

            expect(target).toEqual({
                type: "file",
                filePath,
                wait: true,
            });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    test("preserves file target behavior for missing paths", async () => {
        const missingPath = path.join(tmpdir(), "writeme-missing-note.md");

        const target = await resolveOpenTarget(missingPath, false);

        expect(target).toEqual({
            type: "file",
            filePath: missingPath,
            wait: false,
        });
    });
});
