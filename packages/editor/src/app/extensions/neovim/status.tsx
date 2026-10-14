import type { Editor } from "@tiptap/core";
import { Tag, type TagProps } from "@g4rcez/components";
import { useEditorState } from "@tiptap/react";
import type { NeovimMode } from "./types";
import { neovimKey } from "./state";

const modeThemes = {
    normal: "primary",
    insert: "success",
    visual: "info",
    "visual-line": "info",
    "operator-pending": "warn",
    replace: "danger",
    command: "secondary",
} satisfies Record<NeovimMode, NonNullable<TagProps["theme"]>>;

export function NeovimStatus({ editor }: { readonly editor: Editor | null }): React.JSX.Element | null {
    const vim = useEditorState({
        editor,
        selector: ({ editor: current }) => {
            const vim = current ? neovimKey.getState(current.state) : undefined;
            return vim?.enabled
                ? { mode: vim.mode, pending: vim.pending, command: vim.command, message: vim.message }
                : undefined;
        },
    });
    if (!vim) return null;
    const theme = modeThemes[vim.mode];
    return (
        <output aria-label="Vim mode" aria-live="polite">
            --
            <Tag size="tiny" theme="neutral" indicator={theme} className="font-mono uppercase tracking-wide">
                {vim.mode.toUpperCase().replaceAll("-", " ")}
            </Tag>
            {vim.command ? ` ${vim.command}` : vim.pending.length ? ` ${vim.pending.join("")}` : ""}
            {vim.message ? ` · ${vim.message}` : ""}
            --
        </output>
    );
}
