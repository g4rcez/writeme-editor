import { Button, Modal, Textarea, css } from "@g4rcez/components";
import { useVirtualizer } from "@tanstack/react-virtual";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { ArrowsCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowsCounterClockwise";
import { PaperPlaneRightIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneRight";
import { StopCircleIcon } from "@phosphor-icons/react/dist/csr/StopCircle";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { globalDispatch, useGlobalStore } from "@/store/global.store";
import { editorGlobalRef } from "../editor-global-ref";
import { AIDiffView } from "./ai-diff-view";
import { useAIChat } from "./use-ai-chat";
import { useNavigate } from "react-router-dom";

export const AIDrawer = () => {
  const navigate = useNavigate();
  const [state] = useGlobalStore();
  const { note, aiDrawer, aiContext } = state;
  const { messages, isStreaming, send, stop, config } = useAIChat(note?.id);
  const [input, setInput] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    estimateSize: () => 100,
    getScrollElement: () => parentRef.current,
  });

  useEffect(() => {
    if (aiContext && aiDrawer.isOpen && messages.length === 0 && !isStreaming) {
      send(aiContext.selection, {
        context: aiContext.context,
        selection: aiContext.selection,
        selectionSlice: aiContext.selectionSlice || undefined,
      });
      globalDispatch.setAiContext(null);
    }
  }, [aiContext, aiDrawer.isOpen, messages.length, isStreaming]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        virtualizer.scrollToIndex(messages.length - 1);
      }, 100);
    }
  }, [messages.length, isStreaming]);

  const onSend = () => {
    if (!input.trim() || isStreaming) return;
    const editor = editorGlobalRef.current;
    const selection = editor
      ? editor.state.doc.textBetween(
          editor.state.selection.from,
          editor.state.selection.to,
          " ",
        )
      : "";
    const context = editor
      ? (editor.storage as any).markdown.getMarkdown()
      : "";
    const selectionSlice = editor
      ? { from: editor.state.selection.from, to: editor.state.selection.to }
      : undefined;
    send(input, { selection, context, selectionSlice });
    setInput("");
  };

  const onApply = (msg: any) => {
    if (!msg.selectionSlice || !editorGlobalRef.current) return;
    editorGlobalRef.current
      .chain()
      .focus()
      .insertContentAt(msg.selectionSlice.to, "\n" + msg.content)
      .run();
    globalDispatch.setAiDrawer({ isOpen: false, chatId: null });
  };

  return (
    <Modal
      resizer
      type="drawer"
      position="right"
      title="AI Assistant"
      open={aiDrawer.isOpen}
      onChange={(open) =>
        !open && globalDispatch.setAiDrawer({ isOpen: false, chatId: null })
      }
    >
      <div className="flex overflow-hidden flex-col h-full min-w-[400px]">
        {!config && (
          <div className="flex flex-col gap-4 justify-center items-center p-8 text-center">
            <WarningCircleIcon size={48} className="text-warning" />
            <h3 className="text-lg font-bold">AI Not Configured</h3>
            <p className="text-sm text-muted-foreground">
              Please configure your AI CLI command in settings to start using
              this feature.
            </p>
            <Button
              onClick={() => {
                globalDispatch.setAiDrawer({ isOpen: false, chatId: null });
                navigate("/settings");
              }}
            >
              Configure AI
            </Button>
          </div>
        )}
        <div
          ref={parentRef}
          className="overflow-y-auto relative flex-1 py-4 space-y-6 scrollbar-hide"
        >
          <div
            style={{
              width: "100%",
              position: "relative",
              height: `${virtualizer.getTotalSize()}px`,
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const msg = messages[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                  className={css(
                    "absolute top-0 left-0 w-full flex flex-col gap-2 px-4",
                    msg.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={css(
                      "max-w-[90%] p-3 rounded-lg text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground ml-8"
                        : "bg-muted text-foreground mr-8",
                    )}
                  >
                    <div className="max-w-none prose prose-sm dark:prose-invert">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                  {msg.role === "assistant" &&
                    msg.diffOriginal &&
                    msg.content && (
                      <div className="mt-2 space-y-2 w-full">
                        <div className="flex justify-between items-center px-1">
                          <span className="font-bold tracking-wider uppercase opacity-50 text-[10px]">
                            Suggested Changes
                          </span>
                          {msg.selectionSlice && (
                            <Button
                              size="small"
                              theme="primary"
                              onClick={() => onApply(msg)}
                            >
                              <CheckIcon size={12} className="mr-1" />
                              Apply
                            </Button>
                          )}
                        </div>
                        <AIDiffView
                          oldContent={msg.diffOriginal}
                          newContent={msg.content}
                        />
                      </div>
                    )}
                </div>
              );
            })}
          </div>
          {isStreaming && (
            <div className="flex gap-2 items-center text-xs animate-pulse text-muted-foreground">
              <ArrowsCounterClockwiseIcon size={12} className="animate-spin" />
              AI is thinking...
            </div>
          )}
        </div>
        <div className="py-4 border-t border-floating-border">
          <Textarea
            value={input}
            optionalText=" "
            placeholder="Message AI..."
            onChange={(e: any) => setInput(e.target.value)}
            onKeyDown={(e: any) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            right={
              <div className="flex gap-2">
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="p-2 rounded-md transition-colors text-destructive hover:bg-destructive/10"
                  >
                    <StopCircleIcon size={20} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onSend}
                    disabled={!input.trim()}
                    className="p-2 rounded-md transition-colors disabled:opacity-50 text-primary hover:bg-primary/10"
                  >
                    <PaperPlaneRightIcon size={20} />
                  </button>
                )}
              </div>
            }
          />
        </div>
      </div>
    </Modal>
  );
};
