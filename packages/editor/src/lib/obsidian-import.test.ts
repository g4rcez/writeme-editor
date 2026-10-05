import { describe, expect, it } from "vitest";
import {
    importFileName,
    isObsidianMarkdownFile,
    isPathWithinImportRoot,
    joinImportPath,
    normalizeImportRelativePath,
} from "./obsidian-import";

describe("Obsidian import paths", () => {
    it("recognizes Markdown notes without treating similarly named files as notes", () => {
        expect(isObsidianMarkdownFile("notes/Idea.md")).toBe(true);
        expect(isObsidianMarkdownFile("notes/Idea.MD")).toBe(true);
        expect(isObsidianMarkdownFile("notes/Idea.md.bak")).toBe(false);
    });

    it("normalizes platform separators and rejects traversal", () => {
        expect(normalizeImportRelativePath("Projects\\Idea.md")).toBe("Projects/Idea.md");
        expect(normalizeImportRelativePath("../outside.md")).toBeNull();
        expect(normalizeImportRelativePath("Projects//Idea.md")).toBeNull();
    });

    it("joins safe relative paths using the destination platform separator", () => {
        expect(joinImportPath("/workspace", "Projects/Idea.md")).toBe("/workspace/Projects/Idea.md");
        expect(joinImportPath("C:\\workspace", "Projects/Idea.md")).toBe("C:\\workspace\\Projects\\Idea.md");
        expect(joinImportPath("/workspace", "../Idea.md")).toBeNull();
    });

    it("returns the final file name from either path style", () => {
        expect(importFileName("Projects\\Idea.md")).toBe("Idea.md");
    });

    it("detects destinations inside the source vault without confusing prefixes", () => {
        expect(isPathWithinImportRoot("/workspace/vault", "/workspace/vault/imported")).toBe(true);
        expect(isPathWithinImportRoot("/workspace/vault", "/workspace/vault-backup")).toBe(false);
        expect(isPathWithinImportRoot("C:\\Vault", "c:\\vault\\imported")).toBe(true);
        expect(isPathWithinImportRoot("/workspace/vault", "/workspace/vault/../outside")).toBe(false);
    });
});
