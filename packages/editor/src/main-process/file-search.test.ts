import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { FileSearchEntry } from "../types/tree";
import { searchWorkspaceFiles } from "./file-search";

const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
    );
});

describe("searchWorkspaceFiles", () => {
    it("streams matching files while applying root and nested gitignore rules", async () => {
        const rootPath = await mkdtemp(path.join(os.tmpdir(), "writeme-file-search-"));
        temporaryDirectories.push(rootPath);

        await mkdir(path.join(rootPath, "docs", "generated"), { recursive: true });
        await mkdir(path.join(rootPath, "ignored"), { recursive: true });
        await mkdir(path.join(rootPath, "node_modules"), { recursive: true });
        await writeFile(
            path.join(rootPath, ".gitignore"),
            "ignored/\n*.secret\n!keep.secret\nreport.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json\n",
            "utf8",
        );
        await writeFile(path.join(rootPath, "docs", ".gitignore"), "generated/\n", "utf8");
        await writeFile(path.join(rootPath, "docs", "guide.md"), "", "utf8");
        await writeFile(path.join(rootPath, "docs", "generated", "guide.md"), "", "utf8");
        await writeFile(path.join(rootPath, "ignored", "guide.md"), "", "utf8");
        await writeFile(path.join(rootPath, "node_modules", "guide.md"), "", "utf8");
        await writeFile(path.join(rootPath, "keep.secret"), "", "utf8");
        await writeFile(path.join(rootPath, "report.1.2.3.4.json"), "", "utf8");

        const entries: FileSearchEntry[] = [];
        const summary = await searchWorkspaceFiles({
            onBatch: (batch) => {
                entries.push(...batch);
            },
            query: "guide",
            rootPath,
            signal: new AbortController().signal,
        });

        expect(summary).toEqual({ cancelled: false, truncated: false });
        expect(entries.map((entry) => entry.relativePath)).toEqual(["docs/guide.md"]);

        const reportEntries: FileSearchEntry[] = [];
        const reportSummary = await searchWorkspaceFiles({
            onBatch: (batch) => {
                reportEntries.push(...batch);
            },
            query: "report",
            rootPath,
            signal: new AbortController().signal,
        });

        expect(reportSummary).toEqual({ cancelled: false, truncated: false });
        expect(reportEntries).toHaveLength(0);
    });

    it("returns matching directories", async () => {
        const rootPath = await mkdtemp(path.join(os.tmpdir(), "writeme-file-search-"));
        temporaryDirectories.push(rootPath);

        await mkdir(path.join(rootPath, "src", "split-pane"), { recursive: true });

        const entries: FileSearchEntry[] = [];
        const summary = await searchWorkspaceFiles({
            onBatch: (batch) => {
                entries.push(...batch);
            },
            query: "spli",
            rootPath,
            signal: new AbortController().signal,
        });

        expect(summary).toEqual({ cancelled: false, truncated: false });
        expect(entries).toMatchObject([
            {
                name: "split-pane",
                relativePath: "src/split-pane",
                type: "directory",
            },
        ]);
    });

    it("streams batches while traversing directories recursively", async () => {
        const rootPath = await mkdtemp(path.join(os.tmpdir(), "writeme-file-search-"));
        temporaryDirectories.push(rootPath);

        const deepDirectory = path.join(rootPath, "one", "two", "three", "four");
        await mkdir(deepDirectory, { recursive: true });
        await writeFile(path.join(rootPath, "root-match.md"), "", "utf8");
        await writeFile(path.join(deepDirectory, "deep-match.md"), "", "utf8");

        const batches: string[][] = [];
        const summary = await searchWorkspaceFiles({
            onBatch: (batch) => {
                batches.push(batch.map((entry) => entry.relativePath));
            },
            query: "match",
            rootPath,
            signal: new AbortController().signal,
        });

        expect(summary).toEqual({ cancelled: false, truncated: false });
        expect(batches).toEqual([["root-match.md"], ["one/two/three/four/deep-match.md"]]);
    });
});
