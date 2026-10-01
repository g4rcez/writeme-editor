import { describe, expect, it } from "vitest";
import type { EditorMentionItem } from "@/lib/editor-storage";
import { filterMentionItems } from "./mention-search";

const candidates: EditorMentionItem[] = [
    { id: "note-1", label: "Roadmap", path: "/note/note-1", filePath: "/workspace/notes/roadmap.md", kind: "note" },
    { id: "note-2", label: "Release plan", path: "/note/note-2", filePath: "/workspace/notes/release-plan.md", kind: "note" },
    { id: "file-1", label: "Markdown file", path: "docs/roadmap.md", filePath: "/workspace/docs/roadmap.md", kind: "file" },
];

describe("filterMentionItems", () => {
    it("ranks direct title matches before fuzzy and path matches", () => {
        expect(filterMentionItems(candidates, "roadmap").map((item) => item.id)).toEqual(["note-1", "file-1"]);
    });

    it("matches out-of-order query gaps against file paths without case sensitivity", () => {
        expect(filterMentionItems(candidates, "dcs/rmd").map((item) => item.id)).toEqual(["file-1"]);
    });

    it("returns a bounded list for an empty query and no results for a non-match", () => {
        expect(filterMentionItems(candidates, "")).toEqual(candidates);
        expect(filterMentionItems(candidates, "zzzz")).toEqual([]);
        const manyItems = Array.from({ length: 45 }, (_, index) => ({
            ...candidates[0]!,
            id: `note-${index}`,
            label: `Note ${index}`,
        }));
        expect(filterMentionItems(manyItems, "")).toHaveLength(40);
    });
});
