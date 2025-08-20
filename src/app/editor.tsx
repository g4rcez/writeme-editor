import {
  EditorContent,
  EditorContext,
  useEditor,
  type Editor as TipTapEditor,
} from "@tiptap/react";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  COPY_EVENT_DISPATCHED,
  COPY_EVENT_FINISHED,
  COPY_EVENT_STARTED,
} from "../ipc/copy-event";
import { shortcuts } from "../lib/shortcuts";
import { repositories, useGlobalStore } from "../store/global.store";
import { Note } from "../store/note";
import { getThemeForMode } from "./elements/code-block";
import { createExtensions } from "./extensions";
import { Modal } from "@g4rcez/components";
import { ShortcutItem, useWritemeShortcuts, writemeShortcuts } from "./elements/shortcut-items";

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

const InnerEditor = (props: { content: string; note: Note }) => {
  const [state] = useGlobalStore();
  const getCurrentTheme = () => getThemeForMode(state.theme);
  const editor = useEditor({
    autofocus: true,
    enableContentCheck: true,
    content: props.content,
    immediatelyRender: false,
    parseOptions: { preserveWhitespace: true },
    extensions: createExtensions(getCurrentTheme),
  });
  useCopyEvents(editor);

  useEffect(() => {
    if (editor === null) return;
    let saveTimeout: NodeJS.Timeout;
    editor.on("update", (args) => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        try {
          const html = args.editor.getHTML();
          props.note.setContent(html);
          await repositories.notes.update(props.note.id, props.note);
        } catch (error) {
          console.error("Failed to save document:", error);
        }
      }, 1000);
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
    <div className="container flex p-8 mx-auto w-full max-w-5xl h-full">
      <EditorContext.Provider value={{ editor }}>
        <EditorContent
          editor={editor}
          className="items-stretch w-full text-lg"
        />
      </EditorContext.Provider>
    </div>
  );
};

export const Editor = () => {
  const [state, dispatch] = useGlobalStore();
  const [content, setContent] = useState<null | string>(state.note.content);
  const writemeShortcuts = useWritemeShortcuts();

  useEffect(() => {
    if (state.note === null) return;
    const initializeEditor = async () => setContent(state.note.content);
    initializeEditor();
  }, [state.note]);

  return (
    <Fragment>
      {state.note === null || content === null ? (
        <div className="flex justify-center items-center p-8">Loading...</div>
      ) : (
        <InnerEditor key={state.note.id} note={state.note} content={content} />
      )}
      <Modal title="Shortcuts" open={state.help} onChange={dispatch.help}>
        <ul className="flex flex-col gap-4">
          {writemeShortcuts.map((x) => (
            <ShortcutItem key={x.bind} shortcut={x} />
          ))}
        </ul>
      </Modal>
    </Fragment>
  );
};
