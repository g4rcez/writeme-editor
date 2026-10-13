import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { neovimKey } from "./state";

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
    return (
        <output className="neovim-status text-muted-foreground" aria-label="Vim mode" aria-live="polite">
            {vim.mode.toUpperCase().replaceAll("-", " ")}
            {vim.command ? ` ${vim.command}` : vim.pending.length ? ` ${vim.pending.join("")}` : ""}
            {vim.message ? ` · ${vim.message}` : ""}
        </output>
    );
}
