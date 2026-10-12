import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import {
    addTaskToStack,
    moveTaskItemBetweenStacks,
    parseEditorTasks,
    updateTaskContent,
} from "@/app/components/tasks-dialog";
import { setTaskItemChecked } from "@/app/elements/task-list-item";
import { getEditorMarkdown } from "./editor-storage";
import { buildTaskNoteContent, taskNoteExtensions } from "./task-note";
import { isTaskNoteMarkdown } from "./task-note-markdown";

const editors: Editor[] = [];
function createEditor(content = buildTaskNoteContent()): Editor {
    const editor = new Editor({ extensions: taskNoteExtensions(), content });
    editors.push(editor);
    return editor;
}
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));

describe("task notes", () => {
    it("uses the existing completion timestamp convention and removes it on reopening", () => {
        const editor = createEditor("## Todo\n\n- [ ] Finish task\n");
        const taskPos = parseEditorTasks(editor.state.doc)[0]!.cards[0]!.pos!;
        editor
            .chain()
            .command(({ tr }) =>
                setTaskItemChecked(tr, { taskPos, checked: true, finishedAt: new Date(2026, 9, 12, 10, 30) }),
            )
            .run();
        expect(getEditorMarkdown(editor)).toContain("- [x] Finish task ~2026-10-12 10:30~");
        editor
            .chain()
            .command(({ tr }) => setTaskItemChecked(tr, { taskPos, checked: false }))
            .run();
        expect(getEditorMarkdown(editor)).toContain("- [ ] Finish task");
        expect(getEditorMarkdown(editor)).not.toContain("10:30");
    });
    it("recognizes task Markdown on import without treating body text as metadata", () => {
        expect(isTaskNoteMarkdown(buildTaskNoteContent())).toBe(true);
        expect(isTaskNoteMarkdown("---\r\ntype: task\r\n---\r\n")).toBe(true);
        expect(isTaskNoteMarkdown("## Todo\n\ntype: task")).toBe(false);
        expect(isTaskNoteMarkdown("---\ntype: [\n---\n")).toBe(false);
    });
    it("moves a legacy task with a following paragraph description", () => {
        const editor = createEditor("## Todo\n\n- [ ] Legacy task\n\nLegacy description\n\n## Done\n");
        const stacks = parseEditorTasks(editor.state.doc);
        expect(stacks[0]!.cards[0]!.description).toBe("Legacy description");
        moveTaskItemBetweenStacks(editor, stacks[0]!.cards[0]!, stacks[1]!);
        const reopened = parseEditorTasks(createEditor(getEditorMarkdown(editor)).state.doc);
        expect(reopened[0]!.cards).toHaveLength(0);
        expect(reopened[1]!.cards[0]!.description).toBe("Legacy description");
    });
    it("keeps every empty column, including the first heading at position zero", () => {
        const editor = createEditor("## First\n\n## Second\n");
        expect(parseEditorTasks(editor.state.doc).map((stack) => stack.title)).toEqual(["First", "Second"]);
    });
    it("adds, edits, moves and round-trips a task description and metadata", () => {
        const editor = createEditor(buildTaskNoteContent().replace("view: kanban", "view: kanban\ncustom: keep-me"));
        addTaskToStack(editor, parseEditorTasks(editor.state.doc)[0]!, {
            title: "First task",
            description: "Task detail",
        });
        let stacks = parseEditorTasks(editor.state.doc);
        expect(stacks[0]!.cards[0]!.description).toBe("Task detail");
        addTaskToStack(editor, stacks[0]!, { title: "Second task", description: "Second detail" });
        stacks = parseEditorTasks(editor.state.doc);
        updateTaskContent(editor, stacks[0]!.cards[0]!, { title: "Edited title", description: "" });
        stacks = parseEditorTasks(editor.state.doc);
        moveTaskItemBetweenStacks(editor, stacks[0]!.cards[1]!, stacks[2]!);
        const markdown = getEditorMarkdown(editor);
        expect(markdown).toContain("custom: keep-me");
        expect(markdown).toContain("- [ ] Second task");
        const reopened = parseEditorTasks(createEditor(markdown).state.doc);
        expect(reopened[0]!.cards.map((card) => card.title)).toEqual(["Edited title"]);
        expect(reopened[2]!.cards[0]!.description).toBe("Second detail");
        expect(reopened[3]!.cards).toEqual([]);
    });
    it("moves the final card out of a column and allows adding to the emptied column", () => {
        const editor = createEditor();
        addTaskToStack(editor, parseEditorTasks(editor.state.doc)[0]!, { title: "Only card" });
        let stacks = parseEditorTasks(editor.state.doc);
        moveTaskItemBetweenStacks(editor, stacks[0]!.cards[0]!, stacks[1]!);
        stacks = parseEditorTasks(editor.state.doc);
        expect(stacks[0]!.cards).toHaveLength(0);
        addTaskToStack(editor, stacks[0]!, { title: "Replacement" });
        expect(parseEditorTasks(editor.state.doc)[0]!.cards[0]!.title).toBe("Replacement");
    });
    it("reorders cards within a column without duplicates", () => {
        const editor = createEditor();
        addTaskToStack(editor, parseEditorTasks(editor.state.doc)[0]!, { title: "First" });
        addTaskToStack(editor, parseEditorTasks(editor.state.doc)[0]!, { title: "Second" });
        const stacks = parseEditorTasks(editor.state.doc);
        moveTaskItemBetweenStacks(editor, stacks[0]!.cards[1]!, stacks[0]!, stacks[0]!.cards[0]!);
        expect(parseEditorTasks(editor.state.doc)[0]!.cards.map((card) => card.title)).toEqual(["Second", "First"]);
    });
});
