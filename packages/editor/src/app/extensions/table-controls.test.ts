import { Editor } from "@tiptap/core";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { TableControls } from "./table-controls";

const tableContent = `
    <table>
        <tbody>
            <tr><th><p>Task</p></th><th><p>Owner</p></th></tr>
            <tr><td><p>Draft</p></td><td><p>Ada</p></td></tr>
            <tr><td><p>Ship</p></td><td><p>Lin</p></td></tr>
        </tbody>
    </table>
`;

function createEditor(content: string): Editor {
    return new Editor({
        element: document.createElement("div"),
        extensions: [StarterKit, TableKit, TableControls],
        content,
    });
}

function selectText(editor: Editor, text: string): void {
    let position: number | null = null;
    editor.state.doc.descendants((node, nodePosition) => {
        if (node.isText && node.text?.includes(text)) {
            position = nodePosition;
            return false;
        }
        return undefined;
    });
    if (position === null) throw new Error(`Text ${text} was not found in the editor.`);
    editor.commands.setTextSelection(position);
}

function tableRows(editor: Editor): string[] {
    const rows: string[] = [];
    editor.state.doc.descendants((node) => {
        if (node.type.name === "tableRow") rows.push(node.textContent);
    });
    return rows;
}

function selectedCellText(editor: Editor): string | null {
    const { $from } = editor.state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
        const node = $from.node(depth);
        if (node.type.name === "tableCell" || node.type.name === "tableHeader") return node.textContent;
    }
    return null;
}

function dispatchControlShortcut(editor: Editor, key: string): KeyboardEvent {
    const event = new KeyboardEvent("keydown", {
        key,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
    });
    editor.view.dom.dispatchEvent(event);
    return event;
}

describe("table editing shortcuts", () => {
    it("adds a row below and deletes the active row", () => {
        const editor = createEditor(tableContent);
        try {
            selectText(editor, "Draft");
            expect(dispatchControlShortcut(editor, "Enter").defaultPrevented).toBe(true);
            expect(tableRows(editor)).toEqual(["TaskOwner", "DraftAda", "", "ShipLin"]);
            expect(editor.state.selection.empty).toBe(true);
            expect(selectedCellText(editor)).toBe("");

            selectText(editor, "Ship");
            expect(dispatchControlShortcut(editor, "Backspace").defaultPrevented).toBe(true);
            expect(tableRows(editor)).toEqual(["TaskOwner", "DraftAda", ""]);
        } finally {
            editor.destroy();
        }
    });
});
