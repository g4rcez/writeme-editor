import { migrateMathStrings } from "@tiptap/extension-mathematics";
import {
  EditorContent,
  EditorContext,
  useEditor,
  type Editor as TipTapEditor,
} from "@tiptap/react";
import { renderToMarkdown } from "@tiptap/static-renderer";
import "katex/dist/katex.min.css";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  COPY_EVENT_DISPATCHED,
  COPY_EVENT_FINISHED,
  COPY_EVENT_STARTED,
} from "../ipc/copy-event";
import { tiptapToMarkdown } from "../lib/render-tiptap-to-markdown";
import {
  globalState,
  repositories,
  useGlobalStore,
} from "../store/global.store";
import { Note } from "../store/note";
import { editorGlobalRef } from "./editor-global-ref";
import { getThemeForMode } from "./elements/code-block";
import { createExtensions } from "./extensions";
import { uuid } from "@g4rcez/components";

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

const InnerEditor = (props: { content: string; note?: Note; id: string }) => {
  const [state, dispatch] = useGlobalStore();
  const extensions = createExtensions(() =>
    getThemeForMode(globalState().theme),
  );
  const editor = useEditor({
    extensions,
    autofocus: true,
    content: props.content,
    enableContentCheck: true,
    shouldRerenderOnTransaction: true,
    onCreate: ({ editor: currentEditor }) => migrateMathStrings(currentEditor),
    editorProps: {
      handleKeyDown: (view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "c") {
          const { from, to } = view.state.selection;
          const selectedContent = view.state.doc.slice(from, to);
          const content = {
            type: "doc",
            content: selectedContent.content.toJSON(),
          };
          const html = tiptapToMarkdown({ content, extensions });
          const text = renderToMarkdown({ content, extensions });
          navigator.clipboard.write([
            new ClipboardItem({
              "text/html": new Blob([html], { type: "text/html" }),
              "text/plain": new Blob([text], { type: "text/plain" }),
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
    if (editor === null) return;
    if (!props.note) return;
    let saveTimeout: NodeJS.Timeout;
    editor.on("update", () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        try {
          const html = (editor.storage as any).markdown.getMarkdown();
          props.note.setContent(html);
          await repositories.notes.update(props.note.id, props.note);
        } catch (error) {
          console.error("Failed to save document:", error);
        }
      }, 500);
    });
    return () => {
      clearTimeout(saveTimeout);
    };
  }, [editor, props.note]);

  useEffect(() => {
    if (editor) {
      const tr = editor.state.tr.setMeta("shikiPluginForceDecoration", true);
      editor.view.dispatch(tr);
    }
  }, [state.theme, editor]);

  return (
    <div className="container flex flex-col gap-8 mx-auto w-full max-w-5xl h-full">
      <input
        value={state.note.title}
        placeholder="Note title..."
        type={props.note ? "text" : "hidden"}
        className="p-2 w-full text-lg bg-transparent rounded border-b border-transparent border-b-card-border"
        onChange={(e) => {
          const note = Note.parse(state.note);
          note.title = e.target.value;
          dispatch.note(note);
        }}
      />
      <EditorContext.Provider value={{ editor }}>
        <EditorContent
          key={props.id}
          editor={editor}
          className="items-stretch w-full text-lg"
        />
      </EditorContext.Provider>
    </div>
  );
};

export const Editor = (props: { content: string; note?: Note }) => {
  const [content, setContent] = useState<null | string>(props.content);

  useEffect(() => {
    if (props.content === null) return;
    const initializeEditor = async () => setContent(props.content);
    initializeEditor();
  }, [props.content]);

  const id = useMemo(() => props.note?.id || uuid(), [props.note]);

  return (
    <Fragment key={props.note?.id}>
      {content === null ? (
        <div className="flex justify-center items-center p-8">Loading...</div>
      ) : (
        <InnerEditor
          id={id}
          content={content}
          note={props.note}
          key={props.note?.id}
        />
      )}
    </Fragment>
  );
};
