import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { createFrameTask } from "@/lib/animation-frame";
import { Button } from "@g4rcez/components";
import { ColumnsPlusLeftIcon } from "@phosphor-icons/react/dist/csr/ColumnsPlusLeft";
import { ColumnsPlusRightIcon } from "@phosphor-icons/react/dist/csr/ColumnsPlusRight";
import { RowsPlusBottomIcon } from "@phosphor-icons/react/dist/csr/RowsPlusBottom";
import { RowsPlusTopIcon } from "@phosphor-icons/react/dist/csr/RowsPlusTop";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { insertTableAction, type TableInsertionAction } from "../extensions/table-controls";
import { NoteToolTooltip } from "./note-tool-tooltip";

type ControlPosition = {
    cell: HTMLTableCellElement;
    left: number;
    top: number;
};

type EditorTableControlsProps = {
    editor: Editor | null;
    disabled?: boolean;
};

const controlButtonClassName =
    "size-8 min-h-8 shrink-0 p-0 max-sm:size-11 max-sm:min-h-11 pointer-coarse:size-11 pointer-coarse:min-h-11";

function getControlWidth(): number {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return 164;
    return window.matchMedia("(pointer: coarse), (max-width: 640px)").matches ? 208 : 164;
}

function findTableCell(target: EventTarget | null): HTMLTableCellElement | null {
    if (!(target instanceof Element)) return null;
    const cell = target.closest("td, th");
    return cell instanceof HTMLTableCellElement ? cell : null;
}

function findSelectedCell(editor: Editor): HTMLTableCellElement | null {
    try {
        const { node } = editor.view.domAtPos(editor.state.selection.from);
        const element = node instanceof Element ? node : node.parentElement;
        return findTableCell(element);
    } catch {
        return null;
    }
}

function measureCell(editor: Editor, cell: HTMLTableCellElement): ControlPosition | null {
    const container = editor.view.dom.closest<HTMLElement>(".writeme-editor");
    if (!container || !cell.isConnected) return null;

    const containerRect = container.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const maxLeft = Math.max(0, container.clientWidth - getControlWidth());

    return {
        cell,
        left: Math.min(maxLeft, Math.max(0, cellRect.left - containerRect.left)),
        top: Math.max(0, cellRect.top - containerRect.top - 38),
    };
}

export function EditorTableControls({ editor, disabled = false }: EditorTableControlsProps) {
    const [position, setPosition] = useState<ControlPosition | null>(null);
    const currentCellRef = useRef<HTMLTableCellElement | null>(null);

    const updateCell = useCallback(
        (cell: HTMLTableCellElement | null): void => {
            if (!editor || editor.isDestroyed || disabled || !editor.isEditable || !cell) {
                currentCellRef.current = null;
                setPosition(null);
                return;
            }

            const next = measureCell(editor, cell);
            if (!next) {
                currentCellRef.current = null;
                setPosition(null);
                return;
            }

            currentCellRef.current = cell;
            setPosition((previous) =>
                previous?.cell === next.cell && previous.left === next.left && previous.top === next.top
                    ? previous
                    : next,
            );
        },
        [disabled, editor],
    );

    const updateFromSelection = useCallback((): void => {
        if (!editor || editor.isDestroyed || disabled || !editor.isEditable) {
            updateCell(null);
            return;
        }
        updateCell(findSelectedCell(editor));
    }, [disabled, editor, updateCell]);

    useEffect(() => {
        if (!editor || editor.isDestroyed) return;
        const container = editor.view.dom.closest<HTMLElement>(".writeme-editor");
        if (!container) return;

        let target: HTMLTableCellElement | null | "selection" = "selection";
        const frame = createFrameTask(() => {
            if (target === "selection") updateFromSelection();
            else updateCell(target);
        });
        const schedule = (next: typeof target): void => {
            target = next;
            frame.schedule();
        };
        const handlePointerOver = (event: PointerEvent): void => {
            if (event.target instanceof Element && event.target.closest("[data-table-controls]")) return;
            schedule(findTableCell(event.target));
        };
        const handlePointerLeave = (): void => schedule(null);
        const handleLayoutChange = (): void => frame.schedule();
        const handleSelection = (): void => schedule("selection");
        const handleTransaction = ({ transaction }: { transaction: Transaction }): void => {
            if (transaction.docChanged) handleSelection();
        };

        container.addEventListener("pointerover", handlePointerOver);
        container.addEventListener("pointerleave", handlePointerLeave);
        container.addEventListener("scroll", handleLayoutChange, true);
        window.addEventListener("resize", handleLayoutChange);
        editor.on("selectionUpdate", handleSelection);
        editor.on("transaction", handleTransaction);

        return () => {
            frame.cancel();
            container.removeEventListener("pointerover", handlePointerOver);
            container.removeEventListener("pointerleave", handlePointerLeave);
            container.removeEventListener("scroll", handleLayoutChange, true);
            window.removeEventListener("resize", handleLayoutChange);
            editor.off("selectionUpdate", handleSelection);
            editor.off("transaction", handleTransaction);
        };
    }, [editor, updateCell, updateFromSelection]);

    const runAction = (action: TableInsertionAction): void => {
        if (!editor || editor.isDestroyed || disabled || !editor.isEditable) return;
        const cell = currentCellRef.current;
        if (!cell) return;

        insertTableAction(editor, action, cell);
    };

    const handleInsertRowAbove = (): void => runAction("addRowBefore");
    const handleInsertRowBelow = (): void => runAction("addRowAfter");
    const handleInsertColumnLeft = (): void => runAction("addColumnBefore");
    const handleInsertColumnRight = (): void => runAction("addColumnAfter");

    if (!editor || !position || disabled || !editor.isEditable) return null;

    const keepEditorFocus = (event: MouseEvent<HTMLButtonElement>): void => event.preventDefault();

    return (
        <fieldset
            data-table-controls="true"
            className="absolute z-40 m-0 flex min-w-0 items-center gap-0.5 rounded-md border border-card-border bg-floating-background p-1 text-foreground shadow-medium"
            style={{ left: position.left, top: position.top }}
        >
            <legend className="sr-only">Table cell controls</legend>
            <NoteToolTooltip title="Insert row above" description="Add a blank row above this row.">
                <Button
                    type="button"
                    size="icon"
                    theme="ghost-muted"
                    className={controlButtonClassName}
                    aria-label="Insert row above"
                    onMouseDown={keepEditorFocus}
                    onClick={handleInsertRowAbove}
                >
                    <RowsPlusTopIcon aria-hidden="true" size={18} />
                </Button>
            </NoteToolTooltip>
            <NoteToolTooltip
                title="Insert row below"
                description="Add a blank row below this row. Ctrl+Enter adds below; Ctrl+Backspace deletes this row."
            >
                <Button
                    type="button"
                    size="icon"
                    theme="ghost-muted"
                    className={controlButtonClassName}
                    aria-label="Insert row below"
                    onMouseDown={keepEditorFocus}
                    onClick={handleInsertRowBelow}
                >
                    <RowsPlusBottomIcon aria-hidden="true" size={18} />
                </Button>
            </NoteToolTooltip>
            <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
            <NoteToolTooltip title="Insert column left" description="Add a blank column to the left of this column.">
                <Button
                    type="button"
                    size="icon"
                    theme="ghost-muted"
                    className={controlButtonClassName}
                    aria-label="Insert column left"
                    onMouseDown={keepEditorFocus}
                    onClick={handleInsertColumnLeft}
                >
                    <ColumnsPlusLeftIcon aria-hidden="true" size={18} />
                </Button>
            </NoteToolTooltip>
            <NoteToolTooltip title="Insert column right" description="Add a blank column to the right of this column.">
                <Button
                    type="button"
                    size="icon"
                    theme="ghost-muted"
                    className={controlButtonClassName}
                    aria-label="Insert column right"
                    onMouseDown={keepEditorFocus}
                    onClick={handleInsertColumnRight}
                >
                    <ColumnsPlusRightIcon aria-hidden="true" size={18} />
                </Button>
            </NoteToolTooltip>
        </fieldset>
    );
}
