import { useEffect, useRef, useState, useCallback } from "react";
import { Tooltip, Input } from "@g4rcez/components";
import { SidebarSimpleIcon } from "@phosphor-icons/react/dist/csr/SidebarSimple";
import { PaperPlaneRightIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneRight";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { globalDispatch } from "../../store/global.store";
import { Editor } from "@tiptap/react";

export const AITooltip = ({
  editor,
  trigger,
}: {
  editor: Editor;
  trigger: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const selection = editor.state.doc.textBetween(
        editor.state.selection.from,
        editor.state.selection.to,
        " ",
      );
      if (selection) {
        setPrompt(selection);
      }
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open, editor]);

  const onSubmit = useCallback(() => {
    if (!prompt.trim()) return;
    const selection = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      " ",
    );
    const context = (editor.storage as any).markdown.getMarkdown();
    const selectionSlice = {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };
    globalDispatch.setAiContext({ selection, context, selectionSlice });
    globalDispatch.setAiDrawer({ isOpen: true, chatId: null });
    setOpen(false);
    setPrompt("");
  }, [prompt, editor]);

  const onPromote = () => {
    globalDispatch.setAiDrawer({ isOpen: true, chatId: null });
    setOpen(false);
  };

  return (
    <Tooltip
      popover
      open={open}
      hover={false}
      title={trigger}
      onChange={setOpen}
    >
      <div className="flex flex-col gap-2 w-80">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">
            Ask AI
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onPromote}
              className="p-1 rounded transition-colors hover:bg-muted"
              title="Open in Side Drawer"
            >
              <SidebarSimpleIcon size={14} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded transition-colors hover:bg-muted"
            >
              <XIcon size={14} />
            </button>
          </div>
        </div>
        <Input
          required
          ref={inputRef}
          value={prompt}
          placeholder="How can I help you?"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setPrompt(e.target.value)
          }
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit();
            if (e.key === "Escape") setOpen(false);
          }}
          right={
            <button
              type="button"
              onClick={onSubmit}
              className="p-1 transition-colors text-primary"
            >
              <PaperPlaneRightIcon size={16} />
            </button>
          }
        />
        <div className="flex justify-between items-center px-1 text-xs text-muted-foreground">
          <span>
            Press <kbd className="px-1 font-sans">⌘</kbd> +{" "}
            <kbd className="px-1 font-sans">Enter</kbd> to send
          </span>
        </div>
      </div>
    </Tooltip>
  );
};
