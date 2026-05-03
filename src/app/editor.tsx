import {
  COPY_EVENT_DISPATCHED,
  COPY_EVENT_FINISHED,
  COPY_EVENT_STARTED,
} from "@/ipc/copy-event";
import { setEditorAllNotes, setEditorNote } from "@/lib/editor-storage";
import { isElectron } from "@/lib/is-electron";
import { tiptapToHtml } from "@/lib/render-tiptap-to-html";
import { CursorPositionStore } from "@/store/cursor-position.store";
import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { SettingsService } from "@/store/settings";
import { uuid } from "@g4rcez/components";
import { migrateMathStrings } from "@tiptap/extension-mathematics";
import {
  EditorContent,
  EditorContext,
  useEditor,
  type Editor as TipTapEditor,
} from "@tiptap/react";
import "katex/dist/katex.min.css";
import { Fragment, useEffect, useMemo, useRef } from "react";
import { YAML } from "@/lib/encoding";
import { isRelativeLink } from "@/lib/link-utils";
import { editorGlobalRef } from "./editor-global-ref";
import { getThemeForMode } from "./elements/code-block";
import { createExtensions, handlePasteImage } from "./extensions";
import { CircleNotch } from "@phosphor-icons/react";
import {
  getMarkdownWorker,
  LARGE_MARKDOWN_THRESHOLD,
} from "@/lib/markdown-worker";
import { uiDispatch, useUIStore } from "@/store/ui.store";

const getScrollContainer = () =>
  document.getElementById("main-scroll-container") || window;

const getScrollY = () => {
  const container = getScrollContainer();
  return container === window
    ? window.scrollY
    : (container as HTMLElement).scrollTop;
};

const setScrollY = (y: number) => {
  const container = getScrollContainer();
  if (container === window) {
    window.scrollTo(0, y);
  } else {
    (container as HTMLElement).scrollTop = y;
  }
};

const useCopyEvents = (editor: TipTapEditor) => {
  const monitoring = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    window.addEventListener(
      COPY_EVENT_FINISHED,
      () => (monitoring.current = false),
      opts,
    );
    window.addEventListener(
      COPY_EVENT_STARTED,
      () => (monitoring.current = true),
      opts,
    );
    window.addEventListener(
      COPY_EVENT_DISPATCHED,
      ((data: CustomEvent) => {
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
      }) as EventListener,
      opts,
    );
    return () => controller.abort();
  }, [editor]);
};

const InnerEditor = (props: {
  id: string;
  note?: Note;
  content?: string;
  readonly?: boolean;
  onSave?: (content: string) => Promise<void>;
}) => {
  const [state, dispatch] = useGlobalStore();

  const extensions = useMemo(
    () => createExtensions(() => getThemeForMode(state.theme)),
    [state.theme],
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
      } catch (e) {}
    },
    onUpdate: ({ editor: currentEditor }) => {
      (currentEditor.storage as any).note = props.note;
    },
    editorProps: {
      attributes: { class: "writeme-editor-content" },
      handleClick: (_, __, event) => {
        const node = event.target as HTMLElement;
        const linkNode = node.closest("a");
        if (linkNode) {
          const href = linkNode.getAttribute("href");
          if (href && isRelativeLink(href)) {
            const currentNote = props.note;
            if (currentNote) {
              const fileName = href.split("/").pop()?.replace(/\.md$/i, "");
              const target = state.notes.find(
                (n: Note) => n.title === fileName,
              );
              if (target) {
                dispatch.selectNoteById(target.id);
                return true;
              }
            }
          }
        }
        return false;
      },
      handlePaste: (_, event) => {
        // Handle image paste in Electron
        if (isElectron()) {
          const items = event.clipboardData?.items;
          if (items) {
            for (let i = 0; i < items.length; i++) {
              if (items[i]!.type.startsWith("image/")) {
                handlePasteImage(editor);
                return true;
              }
            }
          }
        }

        const cd = event.clipboardData;
        const text = cd?.getData("text/plain");

        if (text && text.length > LARGE_MARKDOWN_THRESHOLD) {
          triggerWorkerParseRef.current(text);
          return true;
        }

        if (text && text.startsWith("---") && props.note) {
          const match = text.match(/^---\n([\s\S]*?)\n---/);
          if (match) {
            try {
              const parsed = YAML.parse(match?.[1]!);
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
                  dispatch.syncNoteState(note);
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
          const markdown = editor.storage.markdown.serializer!.serialize(
            selectedContent.content as unknown as import("@tiptap/pm/model").Node,
          );
          navigator.clipboard.write([
            new ClipboardItem({
              "text/html": new Blob([tiptapToHtml({ content, extensions })], {
                type: "text/html",
              }),
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

  const generationRef = useRef(0);
  const triggerWorkerParseRef = useRef<(text: string) => void>(() => {});
  const [uiState] = useUIStore();
  const isSettingContent = useRef(false);

  triggerWorkerParseRef.current = (text: string) => {
    if (!editor) return;
    generationRef.current += 1;
    const myGen = generationRef.current;
    uiDispatch.setParsingContent(true);
    editor.setEditable(false);
    const worker = getMarkdownWorker();

    const recover = () => {
      if (generationRef.current !== myGen || editor.isDestroyed) return;
      uiDispatch.setParsingContent(false);
      editor.setEditable(true);
    };

    const watchdogId = setTimeout(recover, 30_000);

    worker.onerror = () => {
      clearTimeout(watchdogId);
      if (generationRef.current !== myGen || editor.isDestroyed) return;
      recover();
      isSettingContent.current = true;
      (editor.commands as any).setContent(text, {
        contentType: "markdown",
        parseOptions: { preserveWhitespace: "full" },
      });
      isSettingContent.current = false;
    };

    worker.addEventListener(
      "message",
      function handler(
        e: MessageEvent<{ html: string; gen: number; error?: string }>,
      ) {
        if (e.data.gen !== myGen || generationRef.current !== myGen) return;
        clearTimeout(watchdogId);
        worker.removeEventListener("message", handler);
        if (editor.isDestroyed) return;
        if (e.data.error) {
          recover();
          isSettingContent.current = true;
          (editor.commands as any).setContent(text, {
            contentType: "markdown",
            parseOptions: { preserveWhitespace: "full" },
          });
          isSettingContent.current = false;
          return;
        }
        isSettingContent.current = true;
        editor.commands.setContent(e.data.html);
        isSettingContent.current = false;
        uiDispatch.setParsingContent(false);
        editor.setEditable(true);
      },
    );

    worker.postMessage({ text, gen: myGen });
  };

  const onSaveRef = useRef(props.onSave);
  const noteRef = useRef(props.note);

  useEffect(() => {
    onSaveRef.current = props.onSave;
    noteRef.current = props.note;
  }, [props.onSave, props.note]);

  useEffect(() => {
    if (!editor || props.content === undefined) return;
    const currentMarkdown = editor.getMarkdown();
    if (props.content !== currentMarkdown) {
      if (props.content.length > LARGE_MARKDOWN_THRESHOLD) {
        triggerWorkerParseRef.current(props.content);
        return;
      }
      isSettingContent.current = true;
      (editor.commands as any).setContent(props.content, {
        contentType: "markdown",
        parseOptions: {
          preserveWhitespace: "full",
        },
      });
      isSettingContent.current = false;
    }
  }, [editor, props.content]);

  useEffect(() => {
    if (editor) {
      setEditorNote(editor, props.note);
    }
  }, [editor, props.note]);

  useEffect(() => {
    if (editor) {
      setEditorAllNotes(editor, state.notes);
    }
  }, [editor, state.notes]);

  useEffect(() => {
    if (editor === null) return;
    if (props.readonly) return;

    let saveTimeout: NodeJS.Timeout;

    const updateHandler = () => {
      if (isSettingContent.current) {
        clearTimeout(saveTimeout);
        return;
      }
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        try {
          const html = editor.getMarkdown();
          if (onSaveRef.current) {
            await onSaveRef.current(html);
            return;
          }
          if (!noteRef.current) return;
          await dispatch.updateNoteContent(noteRef.current.id, html);
          CursorPositionStore.save(
            noteRef.current.id,
            editor.state.selection.anchor,
            getScrollY(),
          );
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
        const html = editor.getMarkdown();
        if (onSaveRef.current) {
          onSaveRef.current(html);
          return;
        }
        if (noteRef.current) {
          dispatch.updateNoteContent(noteRef.current.id, html);

          CursorPositionStore.save(
            noteRef.current.id,
            editor.state.selection.anchor,
            getScrollY(),
          );
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
      setScrollY(position.scroll);
    });
  }, [editor, props.note?.id]);

  const settings = SettingsService.load();

  return (
    <div
      id="editor-container"
      style={{ fontSize: `${settings.editorFontSize}px` }}
      className="writeme-editor relative"
    >
      {uiState.parsingContent && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <CircleNotch size={32} className="animate-spin" />
          <span className="mt-2 text-sm text-foreground">
            Parsing large document…
          </span>
        </div>
      )}
      <EditorContext.Provider value={{ editor }}>
        <EditorContent
          key={props.id}
          editor={editor}
          className="writeme-block"
        />
      </EditorContext.Provider>
    </div>
  );
};

export const Editor = (props: {
  content: string;
  note?: Note;
  id?: string;
  readonly?: boolean;
  onSave?: (content: string) => Promise<void>;
}) => {
  const id = useMemo(
    () => props.id || props.note?.id || uuid(),
    [props.note, props.id],
  );

  return (
    <Fragment key={props.note?.id || props.id}>
      {props.content !== undefined ? (
        <InnerEditor
          id={id}
          note={props.note}
          key={props.note?.id || props.id}
          content={props.content}
          readonly={props.readonly}
          onSave={props.onSave}
        />
      ) : (
        <div className="flex justify-center items-center">Loading...</div>
      )}
    </Fragment>
  );
};
