import type { Editor } from "@tiptap/core";
import { ArrowUUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowUUpLeft";
import { ArrowUUpRightIcon } from "@phosphor-icons/react/dist/csr/ArrowUUpRight";
import { CheckSquareIcon } from "@phosphor-icons/react/dist/csr/CheckSquare";
import { CodeBlockIcon } from "@phosphor-icons/react/dist/csr/CodeBlock";
import { KeyboardIcon } from "@phosphor-icons/react/dist/csr/Keyboard";
import { LinkIcon } from "@phosphor-icons/react/dist/csr/Link";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/csr/ListBullets";
import { ListNumbersIcon } from "@phosphor-icons/react/dist/csr/ListNumbers";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { TextBIcon } from "@phosphor-icons/react/dist/csr/TextB";
import { TextHIcon } from "@phosphor-icons/react/dist/csr/TextH";
import { TextItalicIcon } from "@phosphor-icons/react/dist/csr/TextItalic";
import { type ComponentType, useEffect, useSyncExternalStore } from "react";
import { editorGlobalRef } from "@/app/editor-global-ref";
import { uiDispatch } from "@/store/ui.store";

type IconType = ComponentType<{ size?: number; "aria-hidden"?: boolean }>;

export type PhoneToolbarAction = {
    id: string;
    label: string;
    Icon: IconType;
    active: boolean;
    disabled?: boolean;
    run: () => void;
};

const HEADING_LEVELS = [1, 2, 3] as const;

/** Heading button cycles paragraph → H1 → H2 → H3 → paragraph, so one tap target covers all levels. */
export function cycleHeading(editor: Editor): void {
    const level = HEADING_LEVELS.find((value) => editor.isActive("heading", { level: value }));
    const chain = editor.chain().focus();
    if (level === undefined) {chain.setHeading({ level: 1 }).run();}
    else if (level < 3) {chain.setHeading({ level: (level + 1) as 2 | 3 }).run();}
    else {chain.setParagraph().run();}
}

function editLink(editor: Editor): void {
    const existing = editor.getAttributes("link").href;
    uiDispatch.setPrompt({
        open: true,
        title: "Link",
        placeholder: "https://",
        initialValue: typeof existing === "string" ? existing : "",
        onConfirm: (value) => {
            const href = value.trim();
            const chain = editor.chain().focus();
            if (!href) {chain.extendMarkRange("link").unsetMark("link").run();}
            else if (editor.state.selection.empty && !editor.isActive("link"))
                {chain.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();}
            else {chain.extendMarkRange("link").setMark("link", { href }).run();}
        },
    });
}

export function buildPhoneToolbarActions(editor: Editor): Array<PhoneToolbarAction> {
    const has = (command: string): boolean => command in editor.commands;
    const toggle = (name: string, run: () => void): Pick<PhoneToolbarAction, "active" | "run"> => ({
        active: editor.isActive(name),
        run,
    });
    const actions: Array<PhoneToolbarAction> = [
        {
            id: "bold",
            label: "Bold",
            Icon: TextBIcon,
            ...toggle("bold", () => editor.chain().focus().toggleBold().run()),
        },
        {
            id: "italic",
            label: "Italic",
            Icon: TextItalicIcon,
            ...toggle("italic", () => editor.chain().focus().toggleItalic().run()),
        },
        {
            id: "heading",
            label: "Heading",
            Icon: TextHIcon,
            active: editor.isActive("heading"),
            run: () => cycleHeading(editor),
        },
        {
            id: "bullet-list",
            label: "Bulleted list",
            Icon: ListBulletsIcon,
            ...toggle("bulletList", () => editor.chain().focus().toggleBulletList().run()),
        },
        {
            id: "ordered-list",
            label: "Numbered list",
            Icon: ListNumbersIcon,
            ...toggle("orderedList", () => editor.chain().focus().toggleOrderedList().run()),
        },
        {
            id: "task-list",
            label: "Task list",
            Icon: CheckSquareIcon,
            ...toggle("taskList", () => editor.chain().focus().toggleTaskList().run()),
        },
        {
            id: "code-block",
            label: "Code block",
            Icon: CodeBlockIcon,
            ...toggle("codeBlock", () => editor.chain().focus().toggleCodeBlock().run()),
        },
        {
            id: "link",
            label: "Link",
            Icon: LinkIcon,
            ...toggle("link", () => editLink(editor)),
        },
        {
            id: "undo",
            label: "Undo",
            Icon: ArrowUUpLeftIcon,
            active: false,
            disabled: !editor.can().undo(),
            run: () => editor.chain().focus().undo().run(),
        },
        {
            id: "redo",
            label: "Redo",
            Icon: ArrowUUpRightIcon,
            active: false,
            disabled: !editor.can().redo(),
            run: () => editor.chain().focus().redo().run(),
        },
        {
            id: "insert",
            label: "Insert block",
            Icon: PlusIcon,
            active: false,
            // Typing "/" opens the same slash menu desktop uses, so every block type stays reachable.
            run: () => editor.chain().focus().insertContent("/").run(),
        },
    ];
    // Some editor modes (e.g. source mode or read-only views) register fewer node types.
    return actions.filter((action) => action.id !== "task-list" || has("toggleTaskList"));
}

const noSubscription = (): (() => void) => () => undefined;
const currentEditor = (): Editor | null => editorGlobalRef.current;

export function PhoneKeyboardToolbar() {
    const editor = useSyncExternalStore(noSubscription, currentEditor, () => null);

    // Re-render when the selection or document changes so active/disabled states stay accurate.
    const version = useSyncExternalStore(
        (notify) => {
            editor?.on("selectionUpdate", notify);
            editor?.on("transaction", notify);
            return () => {
                editor?.off("selectionUpdate", notify);
                editor?.off("transaction", notify);
            };
        },
        () => editor?.state,
        () => undefined,
    );

    // The keyboard just claimed space: keep the caret visible above the toolbar.
    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            const active = editorGlobalRef.current;
            if (active && !active.isDestroyed) {active.commands.scrollIntoView();}
        });
        return () => cancelAnimationFrame(frame);
    }, []);

    const actions = editor && !editor.isDestroyed && version ? buildPhoneToolbarActions(editor) : [];
    // Keep editor focus (and so the keyboard) when a button is pressed.
    const keepFocus = (event: { preventDefault: () => void }): void => event.preventDefault();

    return (
        <div className="writeme-phone-keytoolbar" role="toolbar" aria-label="Formatting">
            <div className="writeme-phone-keytoolbar-row">
                {actions.map(({ id, label, Icon, active, disabled, run }) => (
                    <button
                        key={id}
                        type="button"
                        className={`writeme-phone-keytool ${active ? "text-primary" : "text-foreground"}`}
                        aria-label={label}
                        aria-pressed={id === "undo" || id === "redo" || id === "insert" ? undefined : active}
                        disabled={disabled}
                        onPointerDown={keepFocus}
                        onMouseDown={keepFocus}
                        onClick={run}
                    >
                        <Icon size={22} aria-hidden />
                    </button>
                ))}
            </div>
            <button
                type="button"
                className="writeme-phone-keytool writeme-phone-keytool-done"
                aria-label="Hide keyboard"
                onClick={() => {
                    if (document.activeElement instanceof HTMLElement) {document.activeElement.blur();}
                }}
            >
                <KeyboardIcon size={22} aria-hidden />
            </button>
        </div>
    );
}
