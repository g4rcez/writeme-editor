import {
  COPY_EVENT_DISPATCHED,
  COPY_EVENT_FINISHED,
  COPY_EVENT_STARTED,
} from "@/ipc/copy-event";
import { setEditorAllNotes, setEditorNote } from "@/lib/editor-storage";
import { YAML } from "@/lib/encoding";
import { isElectron } from "@/lib/is-electron";
import { isRelativeLink } from "@/lib/link-utils";
import {
  getMarkdownWorker,
  HARD_LIMIT,
  LARGE_MARKDOWN_THRESHOLD,
  WARN_THRESHOLD,
} from "@/lib/markdown-worker";
import { findCompatibleNote } from "@/lib/note-lookup";
import { tiptapToHtml } from "@/lib/render-tiptap-to-html";
import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { SettingsService } from "@/store/settings";
import { uiDispatch, useUIStore } from "@/store/ui.store";
import { uuid } from "@g4rcez/components";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { migrateMathStrings } from "@tiptap/extension-mathematics";
import {
  EditorContent,
  EditorContext,
  useEditor,
  type Editor as TipTapEditor,
} from "@tiptap/react";
import "katex/dist/katex.min.css";
import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import { editorGlobalRef } from "./editor-global-ref";
import { getThemeForMode } from "./elements/code-block";
import { createExtensions, handlePasteImage } from "./extensions";
import { applyPastedUrlToSelection } from "./extensions/link-paste";
import { useEditorScrollMemory } from "./hooks/use-editor-scroll-memory";

const useCopyEvents = (editor: TipTapEditor | null) => {
  const monitoring = useRef(false);
  useEffect(() => {
    if (!editor) return;

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

type WorkerOutMessage =
  | { type: "start"; gen: number; totalChunks: number }
  | {
      type: "chunk";
      gen: number;
      html: string;
      chunkIndex: number;
      totalChunks: number;
    }
  | { type: "error"; gen: number; error: string };

const ric: (cb: () => void) => void =
  typeof requestIdleCallback !== "undefined"
    ? (cb) => requestIdleCallback(cb)
    : (cb) => setTimeout(cb, 0);

type GlobalDispatch = ReturnType<typeof useGlobalStore>[1];

type LinkContextTarget = {
  text: string;
  url: string;
};

const resolveLinkContextTarget = (
  target: EventTarget | null,
): LinkContextTarget | null => {
  if (!(target instanceof Element)) return null;

  const linkNode = target.closest("a");
  if (linkNode) {
    return {
      text: linkNode.textContent?.trim() ?? "",
      url: linkNode.getAttribute("href")?.trim() ?? "",
    };
  }

  const wrappedLinkNode = target.closest("[data-link-url]");
  if (!(wrappedLinkNode instanceof HTMLElement)) return null;

  return {
    text:
      wrappedLinkNode.getAttribute("data-link-text")?.trim() ||
      wrappedLinkNode.textContent?.trim() ||
      "",
    url: wrappedLinkNode.getAttribute("data-link-url")?.trim() ?? "",
  };
};

type TiptapEditorCoreProps = {
  id: string;
  note?: Note;
  content?: string;
  readonly?: boolean;
  theme: string;
  dispatch: GlobalDispatch;
  onSaveRef: React.MutableRefObject<
    ((content: string) => Promise<void>) | undefined
  >;
};

const TiptapEditorCore = memo(
  function TiptapEditorCore({
    id,
    note,
    content,
    readonly,
    theme,
    dispatch,
    onSaveRef,
  }: TiptapEditorCoreProps) {
    const extensions = useMemo(
      () => createExtensions(() => getThemeForMode(theme)),
      [theme],
    );

    const [globalState] = useGlobalStore();
    const noteRef = useRef(note);
    const generationRef = useRef(0);
    const triggerWorkerParseRef = useRef<(text: string) => Promise<void>>(
      async () => {},
    );
    const [uiState] = useUIStore();
    const isSettingContent = useRef(false);
    const [parseProgress, setParseProgress] = useState(0);

    const editor = useEditor({
      extensions,
      autofocus: true,
      editable: !readonly,
      content: content ?? "",
      immediatelyRender: true,
      enableContentCheck: true,
      enableCoreExtensions: true,
      shouldRerenderOnTransaction: false,
      parseOptions: { preserveWhitespace: "full" },
      onUpdate: ({ editor: currentEditor }) =>
        setEditorNote(currentEditor, noteRef.current),
      onCreate: ({ editor: currentEditor }) => {
        setEditorNote(currentEditor, note);
        try {
          return void migrateMathStrings(currentEditor);
        } catch (error) {
          console.warn("Failed to migrate math strings:", error);
        }
      },
      editorProps: {
        attributes: {
          class: "writeme-editor-content",
          role: "textbox",
          "aria-multiline": "true",
          "aria-readonly": readonly ? "true" : "false",
          "aria-label": readonly ? "Read-only note editor" : "Note editor",
        },
        handleDOMEvents: {
          contextmenu: (view, event) => {
            if (!isElectron()) return false;
            const linkTarget = resolveLinkContextTarget(event.target);
            if (linkTarget && (linkTarget.text || linkTarget.url)) {
              event.preventDefault();
              void window.electronAPI.contextMenu.showLink(
                linkTarget.text,
                linkTarget.url,
                event.clientX,
                event.clientY,
              );
              return true;
            }

            if (view.state.selection.empty) return false;

            event.preventDefault();
            void window.electronAPI.contextMenu.showEdit();
            return true;
          },
        },
        handleClick: (_, __, event) => {
          const node = event.target as HTMLElement;
          const linkNode = node.closest("a");
          const mentionNode = node.closest('[data-type="mention"]');
          if (linkNode || mentionNode) {
            const linkElement = (linkNode ?? mentionNode) as Element;
            const href = linkElement.getAttribute("href");
            const mentionTarget = {
              id: linkElement.getAttribute("data-id"),
              label: linkElement.getAttribute("data-label"),
              path: href || linkElement.getAttribute("data-path"),
              target: `${linkElement.getAttribute("data-obsidian-target") ?? ""}${linkElement.getAttribute("data-obsidian-subpath") ?? ""}`,
            };
            const isMentionLink =
              linkElement.getAttribute("data-type") === "mention";
            if ((href && isRelativeLink(href)) || isMentionLink) {
              const currentNote = noteRef.current;
              if (currentNote) {
                const fileName = href?.split("/").pop()?.replace(/\.md$/i, "");
                const target = findCompatibleNote(
                  globalState.notes,
                  isMentionLink ? mentionTarget : (fileName ?? href ?? ""),
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

          if (applyPastedUrlToSelection(editor, text)) {
            event.preventDefault();
            return true;
          }

          if (text && text.length > LARGE_MARKDOWN_THRESHOLD) {
            triggerWorkerParseRef.current(text);
            return true;
          }

          if (text && text.startsWith("---") && noteRef.current) {
            const match = text.match(/^---\n([\s\S]*?)\n---/);
            if (match) {
              try {
                const parsed = YAML.parse(match?.[1]!);
                if (parsed && typeof parsed === "object") {
                  const n = Note.parse(noteRef.current);
                  let changed = false;
                  if (parsed.title && parsed.title !== n.title) {
                    n.setTitle(parsed.title);
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
                      newTags.sort().join(",") !== [...n.tags].sort().join(",")
                    ) {
                      n.tags = newTags;
                      changed = true;
                    }
                  }
                  if (changed) dispatch.syncNoteState(n);
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
            const contentObj = {
              type: "doc",
              content: selectedContent.content.toJSON(),
            };
            const markdown = editor.storage.markdown.serializer!.serialize(
              selectedContent.content as unknown as import("@tiptap/pm/model").Node,
            );
            navigator.clipboard.write([
              new ClipboardItem({
                "text/html": new Blob(
                  [tiptapToHtml({ content: contentObj, extensions })],
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

    useEffect(() => {
      if (!editor) return;
      editorGlobalRef.current = editor;
      return () => {
        if (editorGlobalRef.current === editor) {
          editorGlobalRef.current = null;
        }
      };
    }, [editor]);

    useCopyEvents(editor);

    triggerWorkerParseRef.current = async (text: string) => {
      if (!editor) return;
      if (text.length > HARD_LIMIT) {
        console.error(
          `[writeme] Document exceeds ${HARD_LIMIT / 1_000_000}MB hard limit — import aborted.`,
        );
        return;
      }
      if (text.length > WARN_THRESHOLD) {
        const confirmed = await new Promise<boolean>((resolve) => {
          uiDispatch.setPrompt({
            open: true,
            title: "Large document",
            message: `This document is ${(text.length / 1_000_000).toFixed(1)}MB. Importing may take a while. Continue?`,
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (!confirmed) return;
      }
      generationRef.current += 1;
      const myGen = generationRef.current;
      uiDispatch.setParsingContent(true);
      setParseProgress(0);
      editor.setEditable(false);
      isSettingContent.current = true;
      const worker = getMarkdownWorker();
      let totalChunks = 0;
      let receivedChunks = 0;
      let firstChunk = true;
      const recover = () => {
        if (generationRef.current !== myGen || editor.isDestroyed) return;
        generationRef.current += 1;
        isSettingContent.current = false;
        uiDispatch.setParsingContent(false);
        setParseProgress(0);
        editor.setEditable(true);
      };
      const finalize = () => {
        if (generationRef.current !== myGen || editor.isDestroyed) return;
        isSettingContent.current = false;
        uiDispatch.setParsingContent(false);
        setParseProgress(0);
        editor.setEditable(true);
        const tr = editor.state.tr
          .setMeta("shikiSuspended", false)
          .setMeta("shikiPluginForceDecoration", true);
        editor.view.dispatch(tr);
      };

      if (!editor.isDestroyed) {
        editor.view.dispatch(editor.state.tr.setMeta("shikiSuspended", true));
      }

      const watchdogId = setTimeout(() => {
        worker.removeEventListener("message", handler);
        recover();
      }, 120_000);

      function handler(e: MessageEvent<WorkerOutMessage>) {
        if (e.data.gen !== myGen || generationRef.current !== myGen) {
          worker.removeEventListener("message", handler);
          return;
        }

        if (e.data.type === "start") {
          totalChunks = e.data.totalChunks;
          return;
        }

        if (e.data.type === "error") {
          clearTimeout(watchdogId);
          worker.removeEventListener("message", handler);
          recover();
          return;
        }

        if (e.data.type === "chunk") {
          const { html } = e.data;
          ric(() => {
            if (generationRef.current !== myGen || editor.isDestroyed) return;

            if (firstChunk) {
              firstChunk = false;
              editor.commands.setContent(html);
            } else {
              editor.commands.insertContentAt(
                editor.state.doc.content.size,
                html,
                { parseOptions: { preserveWhitespace: true } },
              );
            }

            receivedChunks++;
            if (totalChunks > 0) {
              setParseProgress(
                Math.round((receivedChunks / totalChunks) * 100),
              );
            }

            if (receivedChunks >= totalChunks && totalChunks > 0) {
              clearTimeout(watchdogId);
              worker.removeEventListener("message", handler);
              finalize();
            }
          });
        }
      }

      worker.onerror = () => {
        clearTimeout(watchdogId);
        if (generationRef.current !== myGen || editor.isDestroyed) return;
        recover();
        (editor.commands as any).setContent(text, {
          contentType: "markdown",
          parseOptions: { preserveWhitespace: "full" },
        });
        isSettingContent.current = false;
      };

      worker.addEventListener("message", handler);
      worker.postMessage({ text, gen: myGen });
    };

    useEffect(() => {
      if (!editor || content === undefined) return;
      const currentMarkdown = editor.getMarkdown();
      if (content !== currentMarkdown) {
        if (content.length > LARGE_MARKDOWN_THRESHOLD) {
          triggerWorkerParseRef.current(content);
          return;
        }
        isSettingContent.current = true;
        (editor.commands as any).setContent(content, {
          contentType: "markdown",
          parseOptions: { preserveWhitespace: "full" },
        });
        isSettingContent.current = false;
        return;
      }
    }, [editor, content]);

    useEffect(() => {
      if (editor) setEditorNote(editor, note);
      noteRef.current = note;
    }, [editor, note]);

    useEffect(() => {
      if (editor) setEditorAllNotes(editor, globalState.notes);
    }, [editor]);

    useEditorScrollMemory(id, editor);

    useEffect(() => {
      if (editor === null) return;
      if (readonly) return;
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
          }
        } catch (error) {
          console.warn("Failed to perform final save on unmount:", error);
        }
      };
    }, [editor, readonly]);

    useEffect(() => {
      if (editor) {
        const tr = editor.state.tr.setMeta("shikiPluginForceDecoration", true);
        editor.view.dispatch(tr);
      }
    }, [theme, editor]);

    useEffect(() => {
      return () => {
        uiDispatch.setParsingContent(false);
      };
    }, []);

    const settings = useMemo(() => SettingsService.load(), []);

    return (
      <div
        id="editor-container"
        className="writeme-editor relative"
        style={{ fontSize: `${settings.editorFontSize}px` }}
        aria-busy={uiState.parsingContent ? "true" : "false"}
      >
        {uiState.parsingContent && (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <CircleNotchIcon
              aria-hidden="true"
              size={32}
              className="animate-spin"
            />
            <span className="mt-2 text-sm text-foreground">
              {parseProgress > 0
                ? `Parsing large document… ${parseProgress}%`
                : "Parsing large document…"}
            </span>
          </div>
        )}
        <EditorContext.Provider value={{ editor }}>
          <EditorContent key={id} editor={editor} className="writeme-block" />
        </EditorContext.Provider>
      </div>
    );
  },
  (prev, next) =>
    prev.id === next.id &&
    prev.theme === next.theme &&
    prev.content === next.content &&
    prev.readonly === next.readonly &&
    prev.note?.id === next.note?.id,
);

const InnerEditor = (props: {
  id: string;
  note?: Note;
  content?: string;
  readonly?: boolean;
  onSave?: (content: string) => Promise<void>;
}) => {
  const [state, dispatch] = useGlobalStore();
  const onSaveRef = useRef(props.onSave);
  useEffect(() => {
    onSaveRef.current = props.onSave;
  }, [props.onSave]);

  useEffect(() => {
    if (editorGlobalRef.current) {
      setEditorAllNotes(editorGlobalRef.current, state.notes);
    }
  }, [state.notes]);

  return (
    <TiptapEditorCore
      id={props.id}
      note={props.note}
      dispatch={dispatch}
      theme={state.theme}
      onSaveRef={onSaveRef}
      content={props.content}
      readonly={props.readonly}
    />
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
          onSave={props.onSave}
          content={props.content}
          readonly={props.readonly}
          key={props.note?.id || props.id}
        />
      ) : (
        <div className="flex justify-center items-center">Loading...</div>
      )}
    </Fragment>
  );
};
