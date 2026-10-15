import { describe, expect, it } from "vitest";
import { Note, NoteType } from "@/store/note";
import { parseOpenWorkspaceTasks } from "./workspace-tasks";

describe("parseOpenWorkspaceTasks", () => {
    it("collects unchecked Markdown tasks once with note and heading context", () => {
        const note = Note.new(
            "Planning",
            "# This week\n\n- [ ] Draft outline\n- [x] Finished item\n\n## Later\n\n* [ ] Review [the draft](https://example.test)\n\n- ordinary list\n\n```md\n- [ ] code sample\n```\n",
        );
        const meeting = Note.new(
            "Meeting",
            "---\ntype: meeting-note\n---\n\n# Decisions\n\n- [ ] Send summary\n",
            NoteType["meeting-note"],
        );

        expect(parseOpenWorkspaceTasks([note, meeting])).toMatchObject([
            { title: "Draft outline", noteId: note.id, noteTitle: "Planning", heading: "This week" },
            { title: "Review the draft", noteId: note.id, noteTitle: "Planning", heading: "Later" },
            { title: "Send summary", noteId: meeting.id, noteTitle: "Meeting", heading: "Decisions" },
        ]);
    });

    it("includes task-board Markdown, keeps distinct identical tasks, and skips deleted notes", () => {
        const board = Note.new("Board", "---\ntype: task\n---\n\n# Backlog\n\n- [ ] Ship\n- [ ] Ship\n", NoteType.task);
        const deleted = Note.new("Deleted", "- [ ] Hidden");
        deleted.deletedAt = new Date();

        const tasks = parseOpenWorkspaceTasks([board, deleted]);

        expect(tasks).toHaveLength(2);
        expect(tasks.map((task) => task.title)).toEqual(["Ship", "Ship"]);
        expect(new Set(tasks.map((task) => task.id)).size).toBe(2);
    });

    it("does not treat prose checkbox-looking lines or fenced examples as tasks", () => {
        const note = Note.new(
            "Examples",
            "A paragraph mentioning - [ ] is not a list.\n\n```\n- [ ] fenced task\n```\n\n1. ordinary ordered item\n",
        );
        expect(parseOpenWorkspaceTasks([note])).toEqual([]);
    });

    it("keeps nested tasks separate, excludes frontmatter and counts completed source positions", () => {
        const note = Note.new(
            "Nested",
            "---\ntitle: Example\n- [ ] metadata\n---\n\n## **Plan**\n\n- [x] Done\n- [ ] Parent `item`\n  - [ ] Child\n\n    continuation\n\n~~~md\n- [ ] sample\n~~~\n\n    - [ ] indented code\n",
        );
        const tasks = parseOpenWorkspaceTasks([note, note]);
        expect(tasks).toMatchObject([
            { title: "Parent item", heading: "Plan", taskIndex: 1, line: 9 },
            { title: "Child continuation", heading: "Plan", taskIndex: 2, line: 10 },
        ]);
    });

    it("excludes non-Markdown note types and templates", () => {
        const notes = [
            NoteType.template,
            NoteType.json,
            NoteType.freehand,
            NoteType.excalidraw,
            NoteType.pdf,
            NoteType.math,
        ].map((type) => Note.new("Not tasks", "- [ ] Hidden", type));
        expect(parseOpenWorkspaceTasks(notes)).toEqual([]);
    });
});
