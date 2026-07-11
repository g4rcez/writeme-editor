import { css } from "@g4rcez/components";
import { PaperPlaneRightIcon, StopCircleIcon } from "@phosphor-icons/react";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import { type KeyboardEvent, type SubmitEvent, useEffect, useMemo, useState } from "react";
import type { Theme } from "@/store/global.store";
import { getThemeForMode } from "@/app/elements/code-block";
import { createExtensions } from "@/app/extensions";

type MarkdownChatComposerProps = {
    theme: Theme;
    disabled: boolean;
    isStreaming: boolean;
    onCancel: () => void;
    onSend: (markdown: string) => Promise<boolean>;
};

function createChatComposerExtensions(theme: Theme) {
    return createExtensions(() => getThemeForMode(theme))
        .filter((extension) => extension.name !== "placeholder")
        .concat(Placeholder.configure({ placeholder: "Message Workspace AI..." }));
}

export function MarkdownChatComposer({ theme, disabled, isStreaming, onCancel, onSend }: MarkdownChatComposerProps) {
    const [markdown, setMarkdown] = useState("");
    const extensions = useMemo(() => createChatComposerExtensions(theme), [theme]);

    const editor = useEditor({
        extensions,
        content: "",
        editable: !disabled && !isStreaming,
        immediatelyRender: true,
        shouldRerenderOnTransaction: false,
        parseOptions: { preserveWhitespace: "full" },
        onUpdate: ({ editor: currentEditor }) => {
            setMarkdown(currentEditor.getMarkdown().trim());
        },
        editorProps: {
            attributes: {
                role: "textbox",
                "aria-multiline": "true",
                "aria-label": "Message Workspace AI",
                class: "writeme-chat-composer-content",
            },
        },
    });

    useEffect(() => {
        editor?.setEditable(!disabled && !isStreaming);
    }, [disabled, editor, isStreaming]);

    const canSend = markdown.length > 0 && !disabled && !isStreaming;

    async function submit(): Promise<void> {
        if (!editor || !canSend) return;
        const content = editor.getMarkdown().trim();
        if (!content) return;

        const sent = await onSend(content);
        if (sent) {
            editor.commands.setContent("", { emitUpdate: true });
            setMarkdown("");
        }
    }

    function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
        event.preventDefault();
        void submit();
    }

    function handleKeyDown(event: KeyboardEvent<HTMLFormElement>): void {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void submit();
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            onKeyDown={handleKeyDown}
            className="rounded-2xl border border-card-border bg-card-background px-3 py-2 transition-colors focus-within:border-primary/50"
        >
            <div className="flex items-end gap-2">
                <div className="min-h-10 max-h-48 flex-1 overflow-y-auto py-1">
                    <EditorContent editor={editor} />
                </div>
                <button
                    type={isStreaming ? "button" : "submit"}
                    onClick={isStreaming ? onCancel : undefined}
                    disabled={isStreaming ? false : !canSend}
                    className={css(
                        "mb-1 inline-flex size-8 shrink-0 items-center justify-center rounded-xl transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
                        isStreaming
                            ? "bg-danger text-button-primary-text"
                            : "bg-button-primary-bg text-button-primary-text",
                    )}
                    aria-label={isStreaming ? "Stop generation" : "Send message"}
                >
                    {isStreaming ? (
                        <StopCircleIcon size={18} aria-hidden="true" />
                    ) : (
                        <PaperPlaneRightIcon size={18} aria-hidden="true" />
                    )}
                </button>
            </div>
            <p className="px-0 pb-0.5 text-[11px] leading-4 text-muted-foreground">
                Markdown supported. Cmd/Ctrl Enter to send.
            </p>
        </form>
    );
}
