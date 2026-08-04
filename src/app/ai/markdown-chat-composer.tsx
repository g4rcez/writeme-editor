import { css } from "@g4rcez/components";
import { PaperPlaneRightIcon, StopCircleIcon } from "@phosphor-icons/react";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import { type DragEvent, type KeyboardEvent, type SubmitEvent, useEffect, useMemo, useRef, useState } from "react";
import type { AIAdapter, AIFile } from "@/app/ai/adapters/types";
import type { Theme } from "@/store/global.store";
import { AIFileAttachment, getClipboardFiles, useAIFileAttachments } from "@/app/ai/ai-file-attachment";
import { getThemeForMode } from "@/app/elements/code-block";
import { createExtensions } from "@/app/extensions";

type MarkdownChatComposerProps = {
    theme: Theme;
    disabled: boolean;
    isStreaming: boolean;
    adapter: AIAdapter | undefined;
    onCancel: () => void;
    onSend: (markdown: string, files: AIFile[]) => Promise<boolean>;
};

function createChatComposerExtensions(theme: Theme) {
    return createExtensions(() => getThemeForMode(theme))
        .filter((extension) => extension.name !== "placeholder" && extension.name !== "fileHandler")
        .concat(Placeholder.configure({ placeholder: "Message Workspace AI..." }));
}

export function MarkdownChatComposer({
    theme,
    disabled,
    isStreaming,
    adapter,
    onCancel,
    onSend,
}: MarkdownChatComposerProps) {
    const [markdown, setMarkdown] = useState("");
    const [files, setFiles] = useState<AIFile[]>([]);
    const extensions = useMemo(() => createChatComposerExtensions(theme), [theme]);
    const attachmentController = useAIFileAttachments({
        files,
        onFilesChange: setFiles,
        adapter: adapter ?? NO_FILE_ADAPTER,
    });
    const attachmentControllerRef = useRef(attachmentController);
    const attachmentsEnabled = Boolean(adapter?.supportsFiles) && !disabled && !isStreaming;
    const attachmentsEnabledRef = useRef(attachmentsEnabled);

    useEffect(() => {
        attachmentControllerRef.current = attachmentController;
        attachmentsEnabledRef.current = attachmentsEnabled;
    }, [attachmentController, attachmentsEnabled]);

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
            handlePaste: (_view, event) => {
                const pastedFiles = getClipboardFiles(event.clipboardData);
                if (pastedFiles.length === 0) return false;
                if (attachmentsEnabledRef.current) attachmentControllerRef.current.addFiles(pastedFiles);
                return true;
            },
        },
    });

    useEffect(() => {
        editor?.setEditable(!disabled && !isStreaming);
    }, [disabled, editor, isStreaming]);

    const canSend =
        (markdown.length > 0 || files.length > 0) && !disabled && !isStreaming && !attachmentController.isPreparing;

    async function submit(): Promise<void> {
        if (!editor || !canSend) return;
        const content = editor.getMarkdown().trim();
        if (!content && files.length === 0) return;

        const sent = await onSend(content, files);
        if (sent) {
            editor.commands.setContent("", { emitUpdate: true });
            setMarkdown("");
            setFiles([]);
            attachmentController.clearErrors();
        }
    }

    function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
        event.preventDefault();
        void submit();
    }

    function handleKeyDown(event: KeyboardEvent<HTMLFormElement>): void {
        if (
            event.nativeEvent.isComposing ||
            event.key !== "Enter" ||
            event.shiftKey ||
            (event.target as HTMLElement).closest("button")
        ) {
            return;
        }
        event.preventDefault();
        void submit();
    }

    function handleDragOver(event: DragEvent<HTMLFormElement>): void {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
    }

    function handleDrop(event: DragEvent<HTMLFormElement>): void {
        const droppedFiles = Array.from(event.dataTransfer.files);
        if (!event.dataTransfer.types.includes("Files") && droppedFiles.length === 0) return;
        event.preventDefault();
        if (attachmentsEnabled && droppedFiles.length > 0) attachmentController.addFiles(droppedFiles);
    }

    return (
        <form
            onSubmit={handleSubmit}
            onKeyDown={handleKeyDown}
            onDragOverCapture={handleDragOver}
            onDropCapture={handleDrop}
            aria-label="AI message composer"
            className="rounded-2xl border border-card-border bg-card-background px-3 py-2 transition-colors focus-within:border-primary/50"
        >
            {adapter?.supportsFiles ? (
                <AIFileAttachment files={files} controller={attachmentController} disabled={disabled || isStreaming} />
            ) : null}
            <div className="flex items-end gap-2">
                <div className="max-h-48 min-h-10 flex-1 overflow-y-auto py-1">
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
                Markdown supported. Enter to send; Shift Enter for a new line.
                {adapter?.supportsFiles ? " Paste or drop supported files to attach." : ""}
            </p>
        </form>
    );
}

const NO_FILE_ADAPTER: AIAdapter = {
    id: "none",
    name: "No provider",
    supportsFiles: false,
    fileCapabilities: { kinds: [], accept: "" },
    supportsOAuth: false,
    defaultModel: "",
    async auth() {
        return {};
    },
    async refresh(credentials) {
        return credentials;
    },
    isExpired() {
        return false;
    },
    async listModels() {
        return [];
    },
    async prepareFile() {
        throw new Error("File attachments are unavailable.");
    },
    async *sendMessage() {
        yield { type: "error", message: "AI provider unavailable." };
    },
};
