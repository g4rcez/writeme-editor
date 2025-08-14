import {
  EditorContent,
  EditorContext,
  useEditor,
  type Editor as TipTapEditor,
} from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
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
      // const markdown = tiptapToMarkdown({
      //   content,
      //   extensions: createExtensions(getCurrentTheme),
      // });
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        try {
          props.note.setContent(args.editor.getHTML());
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
        {/* <FloatingMenu editor={editor}>This is the floating menu</FloatingMenu> */}
        {/* <BubbleMenu editor={editor}>This is the bubble menu</BubbleMenu> */}
      </EditorContext.Provider>
    </div>
  );
};

const zoom = (op: (a: number, b: number) => number) => {
  const value =
    window
      .getComputedStyle(window.document.querySelector(":root")!)
      .getPropertyValue("--default-size") || "1rem";
  const int = value.replace(/rem$/g, "");
  window.document.documentElement.style.setProperty(
    "--default-size",
    `${op(+int, 0.25)}rem`,
  );
};

export const Editor = () => {
  const [state] = useGlobalStore();
  const [content, setContent] = useState<null | string>(state.note.content);

  useEffect(() => {
    if (state.note === null) return;
    shortcuts.add("control+r", () => void window.location.reload());
    shortcuts.add("control+-", () => zoom((a, b) => a - b));
    shortcuts.add("control+=", () => zoom((a, b) => a + b));
    shortcuts.add("control+0", () => zoom(() => 1));
    const initializeEditor = async () => {
      setContent(state.note.content);
    };
    initializeEditor();
    return () => {
      shortcuts.removeAll();
    };
  }, [state.note]);

  if (state.note === null || content === null) {
    return (
      <div className="flex justify-center items-center p-8">Loading...</div>
    );
  }
  return (
    <InnerEditor key={state.note.id} note={state.note} content={content} />
  );
};
