import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dates } from "@/lib/dates";
import { createExtensions } from "../extensions";

const editors: Editor[] = [];
beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-02T12:00:00Z"));
});
afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
    vi.useRealTimers();
});

const typeText = (editor: Editor, input: string): void => {
    for (const text of input) {
        const { from, to } = editor.state.selection;
        const handled = editor.view.someProp("handleTextInput", (handler) =>
            handler(editor.view, from, to, text, () => editor.state.tr.insertText(text, from, to)),
        );
        if (!handled) editor.view.dispatch(editor.state.tr.insertText(text, from, to));
    }
};

describe("commands with the production editor extensions", () => {
    for (const type of ["heading", "paragraph"]) {
        it.each([
            [">>math 1 + 1=", (): string => "1 + 1 = 2"],
            [">>date ", (): string => Dates.yearMonthDay(new Date())],
        ] as const)(`replaces %s inside ${type} text`, (command, expected) => {
            const editor = new Editor({
                extensions: createExtensions(() => "nord"),
                content: {
                    type: "doc",
                    content: [
                        {
                            type,
                            attrs: type === "heading" ? { level: 1 } : {},
                            content: [{ type: "text", text: "Existing text " }],
                        },
                    ],
                },
            });
            editors.push(editor);
            editor.commands.setTextSelection(editor.state.doc.content.size - 1);
            typeText(editor, command);
            expect(editor.state.doc.textContent).toBe("Existing text " + expected());
        });
    }
});
