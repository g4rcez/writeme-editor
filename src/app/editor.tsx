import { uuid } from "@g4rcez/components";
import { migrateMathStrings } from "@tiptap/extension-mathematics";
import {
  EditorContent,
  EditorContext,
  useEditor,
  type Editor as TipTapEditor,
} from "@tiptap/react";
import "katex/dist/katex.min.css";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import * as YAML from "yaml";
import {
  COPY_EVENT_DISPATCHED,
  COPY_EVENT_FINISHED,
  COPY_EVENT_STARTED,
} from "../ipc/copy-event";
import { tiptapToMarkdown } from "../lib/render-tiptap-to-markdown";
import { CursorPositionStore } from "../store/cursor-position.store";
import {
  globalDispatch,
  globalState,
  useGlobalStore,
} from "../store/global.store";

import { BubbleMenu } from "@tiptap/react/menus";
import { Sparkles } from "lucide-react";
import { Note } from "../store/note";
import { AITooltip } from "./ai/ai-tooltip";
import { editorGlobalRef } from "./editor-global-ref";
import { getThemeForMode } from "./elements/code-block";
import { createExtensions } from "./extensions";
import { isElectron } from "@/lib/is-electron";

const useCopyEvents = (editor: TipTapEditor) => {
  const monitoring = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    window.addEventListener(
      COPY_EVENT_FINISHED,
      () => (monitoring.current = false),
      { signal: controller.signal },
    );
    window.addEventListener(
      COPY_EVENT_STARTED,
      () => (monitoring.current = true),
      { signal: controller.signal },
    );
    window.addEventListener(
      COPY_EVENT_DISPATCHED,
      (data: CustomEvent) => {
        if (!monitoring.current) return;
        const text = data.detail;
        editor
          .chain()
          .focus()
          .selectTextblockEnd()
          .focus()
          .selectNodeForward()
          .selectTextblockEnd()
          .insertContent({
            type: "paragraph",
            content: [{ type: "text", text }],
          })
          .run();
      },
      { signal: controller.signal },
    );
    return () => controller.abort();
  }, [editor]);
};

const InnerEditor = (props: {
  id: string;
  note?: Note;
  content?: string;
  readonly?: boolean;
  onPasteRawText?: (text: string) => string;
}) => {
  const [state] = useGlobalStore();

  const extensions = createExtensions(() =>
    getThemeForMode(globalState().theme),
  );

  const editor = useEditor({
    extensions,
    autofocus: true,
    immediatelyRender: true,
    enableContentCheck: true,
    editable: !props.readonly,
    enableCoreExtensions: true,
    content: props.content ?? "",
    shouldRerenderOnTransaction: false,
    parseOptions: { preserveWhitespace: "full" },
    onCreate: ({ editor: currentEditor }) => {
      (currentEditor.storage as any).note = props.note;
      try {
        return void migrateMathStrings(currentEditor);
      } catch (e) { }
    },
    onUpdate: ({ editor: currentEditor }) => {
      (currentEditor.storage as any).note = props.note;
    },
    editorProps: {
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain");
        if (text && text.startsWith("---") && props.note) {
          const match = text.match(/^---\n([\s\S]*?)\n---/);
          if (match) {
            try {
              const parsed = YAML.parse(match[1]);
              if (parsed && typeof parsed === "object") {
                const note = Note.parse(props.note);
                let changed = false;
                if (parsed.title && parsed.title !== note.title) {
                  note.setTitle(parsed.title);
                  changed = true;
                }
                if (parsed.tags) {
                  const newTags = Array.isArray(parsed.tags)
                    ? parsed.tags
                      .map((t: any) => String(t).trim())
                      .filter(Boolean)
                    : String(parsed.tags)
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean);

                  if (
                    newTags.sort().join(",") !== [...note.tags].sort().join(",")
                  ) {
                    note.tags = newTags;
                    changed = true;
                  }
                }
                if (changed) {
                  globalDispatch.syncNoteState(note);
                }
              }
            } catch (e) {
              console.warn("Failed to parse pasted frontmatter:", e);
            }
          }
        }
        return false;
      },
      handleKeyDown: (view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "c") {
          const { from, to } = view.state.selection;
          const selectedContent = view.state.doc.slice(from, to);
          const content = {
            type: "doc",
            content: selectedContent.content.toJSON(),
          };

          const markdown = (editor.storage as any).markdown.getMarkdown();
          navigator.clipboard.write([
            new ClipboardItem({
              "text/html": new Blob(
                [tiptapToMarkdown({ content, extensions })],
                { type: "text/html" },
              ),
              "text/plain": new Blob([markdown], { type: "text/plain" }),
            }),
          ]);
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
  });
  editorGlobalRef.current = editor;
  useCopyEvents(editor);

  useEffect(() => {
    if (editor) {
      (editor.storage as any).note = props.note;
    }
  }, [editor, props.note]);

  const noteRef = useRef(props.note);

  useEffect(() => {
    noteRef.current = props.note;
  }, [props.note]);

  useEffect(() => {
    if (editor === null) return;
    if (props.readonly) return;

    let saveTimeout: NodeJS.Timeout;

    const updateHandler = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        try {
          const html = (editor.storage as any).markdown.getMarkdown();
          if (!noteRef.current) return;

          const note = Note.parse(noteRef.current);
          note.setContent(html);
          await globalDispatch.note(note);
        } catch (error) {
          console.error("Failed to save document:", error);
        }
      }, 500);
    };

    editor.on("update", updateHandler);

    return () => {
      editor.off("update", updateHandler);
      clearTimeout(saveTimeout);
      try {
        const html = (editor.storage as any).markdown.getMarkdown();
        if (noteRef.current) {
          const note = Note.parse(noteRef.current);
          note.setContent(html);
          globalDispatch.note(note);
        }
      } catch (error) {
        console.warn("Failed to perform final save on unmount:", error);
      }
    };
  }, [editor, props.readonly]);

  useEffect(() => {
    if (editor) {
      const tr = editor.state.tr.setMeta("shikiPluginForceDecoration", true);
      editor.view.dispatch(tr);
    }
  }, [state.theme, editor]);

  useEffect(() => {
    if (!editor || !props.note) return;
    const position = CursorPositionStore.get(props.note.id);
    if (!position) return;
    const maxPos = editor.state.doc.content.size;
    const safePos = Math.min(position.cursor, maxPos);
    const raf = requestAnimationFrame ?? ((fn: Function) => fn());
    raf(() => {
      editor.chain().setTextSelection(safePos).run();
      window.scrollTo(0, position.scroll);
    });
  }, [editor, props.note?.id]);

  return (
    <div
      id="editor-container"
      className="flex flex-col justify-start items-start py-4 mx-auto w-full h-full max-w-safe"
    >
      <EditorContext.Provider value={{ editor }}>
        <BubbleMenu className="z-navbar isolate" editor={editor}>
          <ul className="flex overflow-y-auto gap-1 p-2 rounded-lg shadow-lg bg-floating-background border-floating-border max-w-48">
            {isElectron() ? (
              <li>
                <AITooltip
                  editor={editor}
                  trigger={
                    <button
                      type="button"
                      className="flex gap-2 items-center w-full"
                    >
                      <Sparkles size={14} className="text-primary" />
                      Ask AI
                    </button>
                  }
                />
              </li>
            ) : null}
          </ul>
        </BubbleMenu>

        <EditorContent
          key={props.id}
          editor={editor}
          className="w-full text-lg"
        />
      </EditorContext.Provider>
    </div>
  );
};

export const Editor = (props: {
  content: string;
  note?: Note;
  readonly?: boolean;
  onPasteRawText?: (text: string) => string;
}) => {
  const id = useMemo(() => props.note?.id || uuid(), [props.note]);

  return (
    <Fragment key={props.note?.id}>
      {props.note?.content ? (
        <InnerEditor
          id={id}
          note={props.note}
          key={props.note?.id}
          content={props.content}
          readonly={props.readonly}
          onPasteRawText={props.onPasteRawText}
        />
      ) : (
        <div className="flex justify-center items-center">Loading...</div>
      )}
    </Fragment>
  );
};

