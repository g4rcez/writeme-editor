import { uuid } from "@g4rcez/components";
import Mention from "@tiptap/extension-mention";
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
import { CursorPositionStore } from "../store/cursor-position.store";
import {
  globalState,
  repositories,
  useGlobalStore,
} from "../store/global.store";
import { Note } from "../store/note";
import { editorGlobalRef } from "./editor-global-ref";
import { getThemeForMode } from "./elements/code-block";
import { createExtensions } from "./extensions";

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
  const [state] = useGlobalStore();

  const extensions = useMemo(
    () => createExtensions(() => getThemeForMode(globalState().theme)),
    [state.theme],
  );

  const editor = useEditor({
    extensions,
    editable: true,
    autofocus: true,
    content: props.content,
    immediatelyRender: true,
    enableContentCheck: true,
    enableCoreExtensions: true,
    shouldRerenderOnTransaction: false,
    onCreate: ({ editor: currentEditor }) => migrateMathStrings(currentEditor),
    editorProps: {
      handlePaste: () => false,
      handleKeyDown: (view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "c") {
          const { from, to } = view.state.selection;
          const selectedContent = view.state.doc.slice(from, to);
          const content = {
            type: "doc",
            content: selectedContent.content.toJSON(),
          };

          const copyExtensions = extensions.map((extension) => {
            if (extension.name === "mention") {
              return Mention.extend({
                renderHTML({ node }) {
                  const label = node.attrs.label ?? node.attrs.id;
                  return `[[${label}]]`;
                },
              }).configure({});
            }
            return extension;
          });

          const html = tiptapToMarkdown({
            content,
            extensions: copyExtensions,
          });
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
    <div className="flex flex-col justify-start items-start mx-auto w-full h-full max-w-safe">
      <EditorContext.Provider value={{ editor }}>
        <EditorContent
          key={props.id}
          editor={editor}
          className="w-full text-lg"
        />
      </EditorContext.Provider>
    </div>
  );
};

export const Editor = (props: { content: string; note?: Note }) => {
  const [state] = useGlobalStore();
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
        <div className="flex justify-center items-center">Loading...</div>
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
