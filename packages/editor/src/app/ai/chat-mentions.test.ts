import { describe, expect, it } from "vitest";
import { createWorkspaceMentionItems } from "./chat-mentions";

describe("createWorkspaceMentionItems", () => {
    it("combines directory notes and files without duplicating imported note files", () => {
        const items = createWorkspaceMentionItems(
            [
                { id: "note-1", title: "Roadmap", filePath: "/workspace/docs/roadmap.md" },
                { id: "note-2", title: "Scratch", filePath: null },
            ],
            [
                { name: "roadmap.md", path: "/workspace/docs/roadmap.md", relativePath: "docs/roadmap.md" },
                { name: "diagram.png", path: "/workspace/assets/diagram.png", relativePath: "assets\\diagram.png" },
            ],
            "/workspace",
        );

        expect(items).toEqual([
            {
                id: "note-1",
                label: "Roadmap",
                path: "/workspace/docs/roadmap.md",
                filePath: "/workspace/docs/roadmap.md",
                searchText: "docs/roadmap.md",
                kind: "note",
            },
            {
                id: "note-2",
                label: "Scratch",
                path: expect.stringContaining("/note/note-2"),
                filePath: null,
                searchText: undefined,
                kind: "note",
            },
            {
                id: "file:assets/diagram.png",
                label: "diagram.png",
                path: "assets/diagram.png",
                filePath: "/workspace/assets/diagram.png",
                searchText: "assets/diagram.png",
                kind: "file",
            },
        ]);
    });
});
