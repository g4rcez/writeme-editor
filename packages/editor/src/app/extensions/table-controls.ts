import type { Editor } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";
import { Extension } from "@tiptap/core";
import { Plugin, TextSelection } from "@tiptap/pm/state";
import { TableMap } from "@tiptap/pm/tables";

export type TableInsertionAction = "addRowBefore" | "addRowAfter" | "addColumnBefore" | "addColumnAfter";

type CellPosition = {
    cursor: number;
    tableStart: number;
    row: number;
    column: number;
    rowAfter: number;
    columnAfter: number;
};

function getCellPosition(editor: Editor, cell?: HTMLTableCellElement): CellPosition | null {
    try {
        const resolved = cell ? editor.state.doc.resolve(editor.view.posAtDOM(cell, 0)) : editor.state.selection.$from;
        let cellDepth: number | null = null;
        let tableDepth: number | null = null;

        for (let depth = resolved.depth; depth > 0; depth--) {
            const nodeName = resolved.node(depth).type.name;
            if (cellDepth === null && (nodeName === "tableCell" || nodeName === "tableHeader")) {
                cellDepth = depth;
                continue;
            }
            if (cellDepth !== null && nodeName === "table") {
                tableDepth = depth;
                break;
            }
        }

        if (cellDepth === null || tableDepth === null) return null;

        const table = resolved.node(tableDepth);
        const tableStart = resolved.start(tableDepth);
        const rect = TableMap.get(table).findCell(resolved.before(cellDepth) - tableStart);

        return {
            cursor: resolved.start(cellDepth) + 1,
            tableStart,
            row: rect.top,
            column: rect.left,
            rowAfter: rect.bottom,
            columnAfter: rect.right,
        };
    } catch {
        return null;
    }
}

function runTableInsertionCommand(editor: Editor, action: TableInsertionAction): boolean {
    switch (action) {
        case "addRowBefore":
            return editor.commands.addRowBefore();
        case "addRowAfter":
            return editor.commands.addRowAfter();
        case "addColumnBefore":
            return editor.commands.addColumnBefore();
        case "addColumnAfter":
            return editor.commands.addColumnAfter();
        default:
            return false;
    }
}

export function insertTableAction(editor: Editor, action: TableInsertionAction, cell?: HTMLTableCellElement): boolean {
    if (editor.isDestroyed || !editor.isEditable || (cell && !cell.isConnected)) return false;

    const position = getCellPosition(editor, cell);
    if (!position) return false;

    const sourceSelection = TextSelection.create(editor.state.doc, position.cursor);
    editor.view.dispatch(editor.state.tr.setSelection(sourceSelection));
    editor.view.focus();

    if (!runTableInsertionCommand(editor, action)) return false;

    const table = editor.state.doc.nodeAt(position.tableStart - 1);
    if (!table || table.type.name !== "table") throw new Error("The inserted table could not be located.");

    let row = position.row;
    let column = position.column;
    if (action === "addRowAfter") row = position.rowAfter;
    if (action === "addColumnAfter") column = position.columnAfter;

    const cellPosition = TableMap.get(table).positionAt(row, column, table);
    const cursor = position.tableStart + cellPosition + 2;
    if (!editor.state.doc.resolve(cursor).parent.isTextblock) {
        throw new Error("The inserted table cell does not contain a text cursor position.");
    }

    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, cursor)));
    editor.view.focus();

    return true;
}

function selectionIsInTable(view: EditorView): boolean {
    const { $from } = view.state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
        if ($from.node(depth).type.name === "table") return true;
    }
    return false;
}

export const TableControls = Extension.create({
    name: "tableControls",

    // Ctrl is Mod on Linux/Windows, so Tiptap's Mod-Enter hard break would otherwise win
    priority: 1000,

    addProseMirrorPlugins() {
        const editor = this.editor;
        return [
            new Plugin({
                props: {
                    handleKeyDown(view, event) {
                        if (
                            !event.ctrlKey ||
                            event.metaKey ||
                            event.altKey ||
                            event.shiftKey ||
                            event.isComposing ||
                            view.composing ||
                            !editor.isEditable ||
                            !selectionIsInTable(view)
                        ) {
                            return false;
                        }

                        if (event.key === "Enter") {
                            if (!insertTableAction(editor, "addRowAfter")) return false;
                            event.preventDefault();
                            return true;
                        }

                        if (event.key === "Backspace") {
                            event.preventDefault();
                            editor.commands.deleteRow();
                            return true;
                        }

                        return false;
                    },
                },
            }),
        ];
    },
});
