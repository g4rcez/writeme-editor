import { Button, Modal, Textarea, css } from "@g4rcez/components";
import {
    PlusIcon,
    TrashIcon,
    NoteIcon,
    StopCircleIcon,
    PaperPlaneRightIcon,
    ArrowsCounterClockwiseIcon,
} from "@phosphor-icons/react";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
    type ChangeEvent,
    type ClipboardEvent,
    type DragEvent,
    type KeyboardEvent,
    useEffect,
    useRef,
    useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { getEditorMarkdown } from "@/lib/editor-storage";
import { globalDispatch, useGlobalStore } from "@/store/global.store";
import type { AIFile } from "./adapters/types";
import { editorGlobalRef } from "../editor-global-ref";
import { adapterRegistry } from "./adapters/registry";
import { AIFileAttachment, getClipboardFiles, useAIFileAttachments } from "./ai-file-attachment";
import { AIChatMessageItem, AI_CHAT_LOADING_MESSAGES } from "./ai-message-item";
import { useAIChat } from "./use-ai-chat";

export const AIDrawer = () => {
    const navigate = useNavigate();
    const [state] = useGlobalStore();
    const { note, aiDrawer, aiContext } = state;
    const { messages, isStreaming, isLoading, send, cancel, config, newChat, clearChat } = useAIChat(note?.id);
    const [input, setInput] = useState("");
    const [pendingFiles, setPendingFiles] = useState<AIFile[]>([]);
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
    const parentRef = useRef<HTMLDivElement>(null);
    const adapter = config ? adapterRegistry.get(config.adapterId ?? "cli") : undefined;
    const attachmentController = useAIFileAttachments({ files: pendingFiles, onFilesChange: setPendingFiles, adapter });
    const attachmentsEnabled = Boolean(adapter?.supportsFiles) && !isStreaming && !isLoading;

    const virtualizer = useVirtualizer({
        count: messages.length,
        estimateSize: () => 100,
        getScrollElement: () => parentRef.current,
    });

    useEffect(() => {
        if (aiContext && aiDrawer.isOpen && !isStreaming) {
            send(aiContext.selection, {
                context: aiContext.context,
                selection: aiContext.selection,
                selectionSlice: aiContext.selectionSlice || undefined,
            });
            globalDispatch.setAiContext(null);
        }
    }, [aiContext, aiDrawer.isOpen, isStreaming, send]);

    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                virtualizer.scrollToIndex(messages.length - 1);
            }, 100);
        }
    }, [messages.length, isStreaming]);

    useEffect(() => {
        if (!isStreaming) {
            setLoadingMessageIndex(0);
            return;
        }

        const intervalId = window.setInterval(() => {
            setLoadingMessageIndex((current) => (current + 1) % AI_CHAT_LOADING_MESSAGES.length);
        }, 4000);

        return () => window.clearInterval(intervalId);
    }, [isStreaming]);

    const onSend = async (): Promise<void> => {
        if ((!input.trim() && pendingFiles.length === 0) || isStreaming || attachmentController.isPreparing) return;
        const editor = editorGlobalRef.current;
        const selection = editor
            ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ")
            : "";
        const context = editor ? getEditorMarkdown(editor) : (note?.content ?? "");
        const selectionSlice = editor
            ? { from: editor.state.selection.from, to: editor.state.selection.to }
            : undefined;
        const sent = await send(input.trim(), { selection, context, selectionSlice }, pendingFiles);
        if (sent) {
            setInput("");
            setPendingFiles([]);
            attachmentController.clearErrors();
        }
    };

    const handlePaste = (event: ClipboardEvent<HTMLDivElement>): void => {
        const pastedFiles = getClipboardFiles(event.clipboardData);
        if (pastedFiles.length === 0) return;
        event.preventDefault();
        if (attachmentsEnabled) attachmentController.addFiles(pastedFiles);
    };

    const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
        const droppedFiles = Array.from(event.dataTransfer.files);
        if (!event.dataTransfer.types.includes("Files") && droppedFiles.length === 0) return;
        event.preventDefault();
        if (attachmentsEnabled && droppedFiles.length > 0) attachmentController.addFiles(droppedFiles);
    };

    const modelLabel = config
        ? `${adapter?.name ?? config.adapterId} · ${config.model || adapter?.defaultModel || ""}`
        : null;

    return (
        <Modal
            resizer
            type="drawer"
            position="right"
            title="AI Assistant"
            open={aiDrawer.isOpen}
            onChange={(open) => !open && globalDispatch.setAiDrawer({ isOpen: false, chatId: null })}
        >
            <div className="flex h-full min-w-[400px] flex-col overflow-hidden">
                {/* Info bar: context note + provider badge + action buttons */}
                <div className="flex items-center justify-between border-b border-floating-border px-4 py-2">
                    <div className="flex flex-col gap-0.5">
                        {note && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <NoteIcon size={11} />
                                {note.title}
                            </span>
                        )}
                        {modelLabel && <span className="text-[11px] text-muted-foreground/60">{modelLabel}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            title="Clear messages"
                            disabled={isStreaming || messages.length === 0}
                            onClick={clearChat}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                        >
                            <TrashIcon size={14} />
                        </button>
                        <button
                            type="button"
                            title="New chat"
                            disabled={isStreaming}
                            onClick={newChat}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                        >
                            <PlusIcon size={14} />
                        </button>
                    </div>
                </div>

                {!config && (
                    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                        <WarningCircleIcon size={48} className="text-warning" />
                        <h3 className="text-lg font-bold">AI Not Configured</h3>
                        <p className="text-sm text-muted-foreground">
                            Please configure your AI CLI command in settings to start using this feature.
                        </p>
                        <Button
                            onClick={() => {
                                globalDispatch.setAiDrawer({ isOpen: false, chatId: null });
                                navigate("/settings/ai");
                            }}
                        >
                            Configure AI
                        </Button>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex flex-1 items-center justify-center">
                        <ArrowsCounterClockwiseIcon size={20} className="animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div ref={parentRef} className="scrollbar-hide relative flex-1 space-y-6 overflow-y-auto py-4">
                        <div
                            style={{
                                width: "100%",
                                position: "relative",
                                height: `${virtualizer.getTotalSize()}px`,
                            }}
                        >
                            {virtualizer.getVirtualItems().map((virtualRow) => {
                                const msg = messages[virtualRow.index];
                                if (!msg) return null;
                                const isUser = msg.role === "user";
                                const isSystem = msg.role === "system";
                                const showAssistantLoading =
                                    msg.role === "assistant" && isStreaming && virtualRow.index === messages.length - 1;
                                return (
                                    <div
                                        key={virtualRow.key}
                                        data-index={virtualRow.index}
                                        ref={virtualizer.measureElement}
                                        style={{ transform: `translateY(${virtualRow.start}px)` }}
                                        className={css(
                                            "absolute top-0 left-0 flex w-full flex-col gap-2 px-4 pb-5",
                                            isUser ? "items-end" : isSystem ? "items-center" : "items-start",
                                        )}
                                    >
                                        <AIChatMessageItem
                                            message={msg}
                                            isStreaming={showAssistantLoading}
                                            loadingIndex={loadingMessageIndex}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                <div
                    className="flex flex-col gap-1 border-t border-floating-border py-4"
                    onPaste={handlePaste}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <Textarea
                        value={input}
                        optionalText=" "
                        placeholder="Message AI..."
                        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInput(event.target.value)}
                        onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                                event.preventDefault();
                                void onSend();
                            }
                        }}
                        right={
                            <div className="flex items-center gap-2">
                                {isStreaming ? (
                                    <button
                                        type="button"
                                        onClick={cancel}
                                        className="text-destructive hover:bg-destructive/10 rounded-md p-2 transition-colors"
                                    >
                                        <StopCircleIcon size={20} />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => void onSend()}
                                        disabled={
                                            (!input.trim() && pendingFiles.length === 0) ||
                                            attachmentController.isPreparing
                                        }
                                        className="rounded-md p-2 text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                                        aria-label="Send message"
                                    >
                                        <PaperPlaneRightIcon size={20} aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                        }
                    />
                    {adapter?.supportsFiles ? (
                        <AIFileAttachment
                            files={pendingFiles}
                            controller={attachmentController}
                            disabled={!attachmentsEnabled}
                        />
                    ) : null}
                </div>
            </div>
        </Modal>
    );
};
