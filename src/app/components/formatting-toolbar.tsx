import type { Editor } from "@tiptap/core";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type FormattingToolbarProps = {
    editor: Editor | null;
};

type ToolbarAction = {
    label: string;
    title: string;
    active?: () => boolean;
    run: () => void;
};

export function FormattingToolbar({ editor }: FormattingToolbarProps) {
    const [, forceUpdate] = useState(0);
    const toolbarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!editor) return;
        const update = () => forceUpdate((value) => value + 1);
        editor.on("selectionUpdate", update);
        editor.on("transaction", update);
        editor.on("focus", update);
        editor.on("blur", update);
        return () => {
            editor.off("selectionUpdate", update);
            editor.off("transaction", update);
            editor.off("focus", update);
            editor.off("blur", update);
        };
    }, [editor]);

    const activeEditor = editor && !editor.isDestroyed && editor.isEditable && editor.isFocused ? editor : null;
    const selection = activeEditor?.state.selection ?? null;
    const selectedText =
        activeEditor && selection && !selection.empty
            ? activeEditor.state.doc.textBetween(selection.from, selection.to, "\n", "\n")
            : "";
    const hasSelectedText = Boolean(selection && !selection.empty && selectedText.length > 0);
    const selectionFrom = selection?.from ?? null;
    const selectionTo = selection?.to ?? null;

    useLayoutEffect(() => {
        const toolbar = toolbarRef.current;
        if (!activeEditor || !hasSelectedText || selectionFrom === null || selectionTo === null || !toolbar) {
            toolbar?.setAttribute("data-positioned", "false");
            return;
        }

        const container = activeEditor.view.dom.closest<HTMLElement>("#editor-container");
        if (!container) {
            toolbar.setAttribute("data-positioned", "false");
            return;
        }

        try {
            const start = activeEditor.view.coordsAtPos(selectionFrom);
            const end = activeEditor.view.coordsAtPos(selectionTo);
            const containerRect = container.getBoundingClientRect();
            const toolbarWidth = toolbar.offsetWidth;
            const toolbarHeight = toolbar.offsetHeight;
            const selectionLeft = Math.min(start.left, end.left);
            const selectionRight = Math.max(start.right, end.right);
            const selectionTop = Math.min(start.top, end.top);
            const selectionBottom = Math.max(start.bottom, end.bottom);
            const preferredLeft = (selectionLeft + selectionRight) / 2 - containerRect.left - toolbarWidth / 2;
            const maxLeft = Math.max(8, containerRect.width - toolbarWidth - 8);
            const left = Math.min(Math.max(8, preferredLeft), maxLeft);
            const aboveSelection = selectionTop - containerRect.top - toolbarHeight - 8;
            const belowSelection = selectionBottom - containerRect.top + 8;
            const preferredTop = aboveSelection >= 8 ? aboveSelection : belowSelection;
            const maxTop = Math.max(8, container.clientHeight - toolbarHeight - 8);
            const top = Math.min(Math.max(8, preferredTop), maxTop);

            toolbar.style.top = `${top}px`;
            toolbar.style.left = `${left}px`;
            toolbar.setAttribute("data-positioned", "true");
        } catch {
            toolbar.setAttribute("data-positioned", "false");
        }
    }, [activeEditor, hasSelectedText, selectionFrom, selectionTo, selectedText]);

    if (!activeEditor || !hasSelectedText) return null;

    const actions: ToolbarAction[] = [
        {
            label: "B",
            title: "Bold (⌘/Ctrl+B)",
            active: () => activeEditor.isActive("bold"),
            run: () => activeEditor.chain().focus().toggleBold().run(),
        },
        {
            label: "I",
            title: "Italic (⌘/Ctrl+I)",
            active: () => activeEditor.isActive("italic"),
            run: () => activeEditor.chain().focus().toggleItalic().run(),
        },
        {
            label: "S",
            title: "Strikethrough",
            active: () => activeEditor.isActive("strike"),
            run: () => activeEditor.chain().focus().toggleStrike().run(),
        },
        {
            label: "Code",
            title: "Inline code",
            active: () => activeEditor.isActive("code"),
            run: () => activeEditor.chain().focus().toggleCode().run(),
        },
        {
            label: "H1",
            title: "Heading 1",
            active: () => activeEditor.isActive("heading", { level: 1 }),
            run: () => activeEditor.chain().focus().toggleHeading({ level: 1 }).run(),
        },
        {
            label: "H2",
            title: "Heading 2",
            active: () => activeEditor.isActive("heading", { level: 2 }),
            run: () => activeEditor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
            label: "• List",
            title: "Bulleted list",
            active: () => activeEditor.isActive("bulletList"),
            run: () => activeEditor.chain().focus().toggleBulletList().run(),
        },
        {
            label: "1. List",
            title: "Numbered list",
            active: () => activeEditor.isActive("orderedList"),
            run: () => activeEditor.chain().focus().toggleOrderedList().run(),
        },
        {
            label: "Quote",
            title: "Blockquote",
            active: () => activeEditor.isActive("blockquote"),
            run: () => activeEditor.chain().focus().toggleBlockquote().run(),
        },
    ];

    return (
        <div
            ref={toolbarRef}
            aria-label="Formatting toolbar"
            className="writeme-formatting-toolbar absolute z-20 flex flex-wrap items-center gap-1 rounded-lg border border-card-border bg-background/95 p-1.5 shadow-soft backdrop-blur print:hidden"
            data-positioned="false"
            role="toolbar"
        >
            {actions.map((action) => {
                const active = action.active?.() ?? false;
                return (
                    <button
                        key={action.title}
                        type="button"
                        title={action.title}
                        aria-label={action.title}
                        aria-pressed={active}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={action.run}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                            active
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                        {action.label}
                    </button>
                );
            })}
            <span className="ml-auto hidden px-2 text-xs text-muted-foreground/70 md:inline">
                Type <kbd className="rounded border border-border px-1">/</kbd> for more
            </span>
        </div>
    );
}
