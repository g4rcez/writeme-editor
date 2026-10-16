import { uuid } from "@g4rcez/components";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { EditorContent, EditorContext, useEditor, type Editor as TipTapEditor } from "@tiptap/react";
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COPY_EVENT_DISPATCHED, COPY_EVENT_FINISHED, COPY_EVENT_STARTED } from "@/ipc/copy-event";
import { getEditorMarkdown, setEditorAllNotes, setEditorNote } from "@/lib/editor-storage";
import { YAML } from "@/lib/encoding";
import { isElectron } from "@/lib/is-electron";
import { isRelativeLink } from "@/lib/link-utils";
import { getMarkdownWorker, HARD_LIMIT, LARGE_MARKDOWN_THRESHOLD, WARN_THRESHOLD } from "@/lib/markdown-worker";
import { applyMarkdownWorkerChunk } from "@/lib/markdown-worker/ingest";
import { MOBILE_PAUSE_EVENT } from "@/lib/mobile-runtime";
import { getCommentId } from "@/lib/note-comments";
import { registerNoteLinkRepairHandler, repairTiptapLink } from "@/lib/note-link-repair";
import { findCompatibleNote } from "@/lib/note-lookup";
import { supportsAI, isMobile } from "@/lib/platform";
import { tiptapToHtml } from "@/lib/render-tiptap-to-html";
import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";
import { SettingsService } from "@/store/settings";
import { uiDispatch, useUIStore } from "@/store/ui.store";
import "katex/dist/katex.min.css";
import { isLatexFilePath } from "@/types/workspace-files";
import type { SearchReplaceStorage } from "./extensions/search-replace";
import type { WritingEditorAdapter } from "./writing-assistant/types";
import { NoteComments } from "./comments/note-comments";
import { FormattingToolbar } from "./components/formatting-toolbar";
import {
    editorActionsGlobalRef,
    editorGlobalRef,
    type EditorSearchHandle,
    editorSearchGlobalRef,
    registerEditorActivation,
    setEditorActionsGlobalRef,
    setEditorSearchGlobalRef,
} from "./editor-global-ref";
import { getThemeForMode } from "./elements/code-block";
import { RawMarkdownEditor } from "./elements/raw-markdown-editor";
import { createExtensions, handlePasteImage } from "./extensions";
import { applyPastedUrlToSelection } from "./extensions/link-paste";
import { addFrontmatterToEditor } from "./frontmatter";
import { useEditorScrollMemory } from "./hooks/use-editor-scroll-memory";
import { registerNoteSaveShortcut } from "./note-save-shortcut";
import { applyTiptapVimConfiguration } from "./vim/apply-tiptap-configuration";
import { useVimConfiguration } from "./vim/use-vim-configuration";
import { useVimSettings } from "./vim/use-vim-settings";
import { createTiptapWritingEditorAdapter } from "./writing-assistant/tiptap-adapter";
import { WritingAssistant } from "./writing-assistant/writing-assistant";

const useCopyEvents = (editor: TipTapEditor | null) => {
    const monitoring = useRef(false);
    useEffect(() => {
        if (!editor) return;

        const controller = new AbortController();
        const opts = { signal: controller.signal };
        window.addEventListener(COPY_EVENT_FINISHED, () => (monitoring.current = false), opts);
        window.addEventListener(COPY_EVENT_STARTED, () => (monitoring.current = true), opts);
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
    typeof requestIdleCallback === "undefined" ? (cb) => setTimeout(cb, 0) : (cb) => requestIdleCallback(cb);

type GlobalDispatch = ReturnType<typeof useGlobalStore>[1];
export type EditorMode = "formatted" | "markdown";

async function saveEditorDraft(expected: Note, content: string, dispatch: GlobalDispatch): Promise<Note> {
    const current = await repositories.notes.getOne(expected.id);
    const saved =
        current && current.deletedAt == null && current.title === expected.title && current.content === expected.content
            ? await repositories.notes.updateContentIfUnchanged(expected.id, current, content)
            : null;
    if (!saved) {
        throw new Error(
            "This note changed in another editor or was deleted. Your draft is still here and has not overwritten the saved note. Copy your draft before reloading to reconcile the changes.",
        );
    }
    dispatch.syncNoteFromRepository(saved);
    return saved;
}

type LinkContextTarget = {
    text: string;
    url: string;
};

function createTiptapSearchHandle(editor: TipTapEditor): EditorSearchHandle {
    // SAFETY: createExtensions installs SearchAndReplace; Tiptap does not type its storage here.
    const getStorage = (): SearchReplaceStorage =>
        (editor.storage as unknown as Record<string, SearchReplaceStorage>).searchReplace!;

    return {
        getState: () => {
            const storage = getStorage();
            return {
                searchTerm: storage.searchTerm,
                replaceTerm: storage.replaceTerm,
                resultsCount: storage.results.length,
                resultIndex: storage.resultIndex,
                caseSensitive: storage.caseSensitive,
            };
        },
        getContent: () => getEditorMarkdown(editor),
        setSearchTerm: (searchTerm) => {
            editor.commands.setSearchTerm(searchTerm);
        },
        setReplaceTerm: (replaceTerm) => {
            editor.commands.setReplaceTerm(replaceTerm);
        },
        setCaseSensitive: (caseSensitive) => {
            editor.commands.setCaseSensitive(caseSensitive);
        },
        nextSearchResult: () => {
            editor.commands.nextSearchResult();
        },
        previousSearchResult: () => {
            editor.commands.previousSearchResult();
        },
        replace: (replaceTerm) => {
            editor.commands.replace(replaceTerm);
        },
        replaceAll: (replaceTerm) => {
            editor.commands.replaceAll(replaceTerm);
        },
        focus: () => {
            editor.commands.focus();
        },
        subscribe: (listener) => {
            editor.on("update", listener);
            return () => editor.off("update", listener);
        },
    };
}

const resolveLinkContextTarget = (target: EventTarget | null): LinkContextTarget | null => {
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
        text: wrappedLinkNode.getAttribute("data-link-text")?.trim() || wrappedLinkNode.textContent?.trim() || "",
        url: wrappedLinkNode.getAttribute("data-link-url")?.trim() ?? "",
    };
};

type TiptapEditorCoreProps = {
    id: string;
    note?: Note;
    content?: string;
    readonly?: boolean;
    active?: boolean;
    vimMode: boolean;
    theme: string;
    dispatch: GlobalDispatch;
    onSaveRef: React.MutableRefObject<((content: string) => Promise<void>) | undefined>;
};

const TiptapEditorCore = memo(
    function TiptapEditorCore({
        id,
        note,
        content,
        readonly,
        active,
        vimMode,
        theme,
        dispatch,
        onSaveRef,
    }: TiptapEditorCoreProps) {
        const extensions = useMemo(() => createExtensions(() => getThemeForMode(theme), true), [theme]);
        const {
            configuration: vimConfiguration,
            error: vimConfigurationError,
            loading: vimConfigurationLoading,
        } = useVimConfiguration();
        const [globalState] = useGlobalStore();
        const noteRef = useRef(note);
        const persistedNoteRef = useRef(note);
        const dirtyRef = useRef(false);
        const [saveError, setSaveError] = useState<string | null>(null);
        const generationRef = useRef(0);
        const triggerWorkerParseRef = useRef<(text: string) => Promise<void>>(async () => {});
        const [uiState] = useUIStore();
        const isSettingContent = useRef(false);
        const lastEditorContentRef = useRef(content ?? "");
        const initialActiveRef = useRef(active);
        const activateRef = useRef<() => void>(() => {});
        const [parseProgress, setParseProgress] = useState(0);
        const [writingAssistantBinding, setWritingAssistantBinding] = useState<{
            editor: TipTapEditor;
            adapter: WritingEditorAdapter;
        } | null>(null);
        const settings = useMemo(() => SettingsService.load(), []);

        const editor = useEditor({
            extensions,
            autofocus: active ?? true,
            editable: false,
            content: content ?? "",
            immediatelyRender: true,
            enableContentCheck: true,
            enableCoreExtensions: true,
            shouldRerenderOnTransaction: false,
            parseOptions: { preserveWhitespace: "full" },
            onUpdate: ({ editor: currentEditor }) => {
                setEditorNote(currentEditor, noteRef.current);
                lastEditorContentRef.current = getEditorMarkdown(currentEditor);
            },
            onCreate: ({ editor: currentEditor }) => {
                setEditorNote(currentEditor, note);
                lastEditorContentRef.current = getEditorMarkdown(currentEditor);
            },
            editorProps: {
                scrollThreshold: { top: 0, right: 0, bottom: 80, left: 0 },
                scrollMargin: { top: 5, right: 5, bottom: 80, left: 5 },
                attributes: {
                    role: "textbox",
                    "aria-multiline": "true",
                    class: "writeme-editor-content",
                    "aria-readonly": readonly ? "true" : "false",
                    spellcheck: readonly ? "false" : "true",
                    "aria-label": readonly ? "Read-only note editor" : "Note editor",
                },
                handleDOMEvents: {
                    keydown: (view, event) => {
                        if (event.key !== "Escape" || event.isComposing || view.composing) return false;
                        // ProseMirror prevents every Escape by default, even when no keymap handles it.
                        if (view.someProp("handleKeyDown", (handler) => handler(view, event))) event.preventDefault();
                        return true;
                    },
                    contextmenu: (_, event) => {
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
                        return false;
                    },
                },
                handleClick: (_, __, event) => {
                    const node = event.target as HTMLElement;
                    const linkNode = node.closest("a");
                    const mentionNode = node.closest('[data-type="mention"]');
                    if (linkNode || mentionNode) {
                        const linkElement = (linkNode ?? mentionNode) as Element;
                        const href = linkElement.getAttribute("href");
                        const commentId = noteRef.current ? getCommentId(href, noteRef.current) : null;
                        if (commentId) {
                            event.preventDefault();
                            linkElement.dispatchEvent(
                                new CustomEvent("writeme:open-comment", { bubbles: true, detail: commentId }),
                            );
                            return true;
                        }
                        const mentionTarget = {
                            id: linkElement.getAttribute("data-id"),
                            label: linkElement.getAttribute("data-label"),
                            path: href || linkElement.getAttribute("data-path"),
                            target: `${linkElement.getAttribute("data-obsidian-target") ?? ""}${linkElement.getAttribute("data-obsidian-subpath") ?? ""}`,
                        };
                        const isMentionLink = linkElement.getAttribute("data-type") === "mention";
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
                    const vim = editor.storage.neovim.getState();
                    if (vim?.enabled && vim.mode !== "insert" && vim.mode !== "replace") return true;
                    if (isElectron()) {
                        const items = event.clipboardData?.items;
                        if (items) {
                            for (let i = 0; i < items.length; i++) {
                                const item = items[i]!;
                                if (item.kind === "file" && item.type.startsWith("image/")) {
                                    const insertPos = editor.state.selection.anchor;
                                    void handlePasteImage(editor, insertPos);
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
                                const parsed = YAML.parse(match[1] ?? "");
                                if (parsed && typeof parsed === "object") {
                                    const n = Note.parse(noteRef.current);
                                    let changed = false;
                                    if (parsed.title && parsed.title !== n.title) {
                                        n.setTitle(parsed.title);
                                        changed = true;
                                    }
                                    if (parsed.tags) {
                                        const newTags = Array.isArray(parsed.tags)
                                            ? parsed.tags.map((t: any) => String(t).trim()).filter(Boolean)
                                            : String(parsed.tags)
                                                  .split(",")
                                                  .map((t) => t.trim())
                                                  .filter(Boolean);
                                        if (newTags.sort().join(",") !== [...n.tags].sort().join(",")) {
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
                    if ((event.ctrlKey || event.metaKey) && editor.storage.neovim.getState()?.enabled) return false;
                    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "e") {
                        event.preventDefault();
                        return true;
                    }

                    if ((event.ctrlKey || event.metaKey) && event.key === "c") {
                        const { from, to } = view.state.selection;
                        const selectedContent = view.state.doc.slice(from, to);
                        const contentObj = {
                            type: "doc",
                            content: selectedContent.content.toJSON(),
                        };
                        // SAFETY: The serializer renders children with forEach, shared by Node and Fragment.
                        const markdown = editor.storage.markdown.serializer!.serialize(
                            selectedContent.content as unknown as import("@tiptap/pm/model").Node,
                        );
                        navigator.clipboard.write([
                            new ClipboardItem({
                                "text/html": new Blob([tiptapToHtml({ content: contentObj, extensions })], {
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
        useEffect(() => {
            if (editor && editor.storage.neovim.getState()?.enabled !== vimMode) {
                editor.storage.neovim.setEnabled(vimMode);
            }
        }, [editor, vimMode]);
        useEffect(() => {
            if (!editor) return;
            editor.view.dom.setAttribute("aria-busy", String(vimConfigurationLoading));
            if (vimConfigurationLoading) return;
            const cleanup = applyTiptapVimConfiguration(editor.storage.neovim, vimConfiguration);
            if (
                vimMode &&
                vimConfiguration.options.initialMode === "insert" &&
                editor.storage.neovim.getState()?.mode === "normal"
            )
                editor.storage.neovim.setMode("insert");
            return () => {
                if (!editor.isDestroyed) cleanup();
            };
        }, [editor, vimConfiguration, vimMode, vimConfigurationLoading]);
        const writingAssistantSelectionContext = useMemo(() => {
            if (!editor) return null;
            return {
                target: editor.view.dom,
                readSelection: () => {
                    if (editor.isDestroyed || editor.view.isDestroyed) return null;
                    const { selection } = editor.state;
                    return selection.empty ? null : { from: selection.from, to: selection.to };
                },
                readAnchor: (selection?: { from: number; to: number }) => {
                    if (editor.isDestroyed || editor.view.isDestroyed) return null;
                    const currentSelection = selection ?? {
                        from: editor.state.selection.from,
                        to: editor.state.selection.to,
                    };
                    try {
                        const resolved = editor.state.doc.resolve(currentSelection.from);
                        let lineStart = resolved.start();
                        resolved.parent.forEach((node, offset) => {
                            if (node.type.name === "hardBreak" && offset < resolved.parentOffset) {
                                lineStart = resolved.start() + offset + node.nodeSize;
                            }
                        });
                        const start = editor.view.coordsAtPos(lineStart);
                        const end = editor.view.coordsAtPos(currentSelection.to);
                        return { left: start.left, top: start.top, bottom: end.bottom };
                    } catch {
                        return null;
                    }
                },
            };
        }, [editor]);

        useEffect(() => {
            if (!editor) return;
            const adapter = createTiptapWritingEditorAdapter(editor);
            setWritingAssistantBinding({ editor, adapter });
            return () => adapter.dispose();
        }, [editor]);
        useEffect(() => {
            if (!editor) return;
            const searchHandle = createTiptapSearchHandle(editor);
            const actionHandle = {
                addFrontmatter: () => {
                    addFrontmatterToEditor(editor);
                },
            };
            const activate = () => {
                editorGlobalRef.current = editor;
                setEditorActionsGlobalRef(actionHandle);
                setEditorSearchGlobalRef(searchHandle);
            };
            const activation = registerEditorActivation(activate);
            activateRef.current = activation.activate;
            if (initialActiveRef.current || !editorGlobalRef.current) activation.activate();
            return () => {
                activation.unregister();
                if (activateRef.current === activation.activate) {
                    activateRef.current = () => {};
                }
                if (editorGlobalRef.current === editor) {
                    editorGlobalRef.current = null;
                }
                if (editorActionsGlobalRef.current === actionHandle) {
                    setEditorActionsGlobalRef(null);
                }
                if (editorSearchGlobalRef.current === searchHandle) {
                    setEditorSearchGlobalRef(null);
                }
            };
        }, [editor]);

        useEffect(() => {
            if (active) activateRef.current();
        }, [active]);

        useCopyEvents(editor);

        triggerWorkerParseRef.current = async (text: string) => {
            if (!editor) return;
            if (text.length > HARD_LIMIT) {
                console.error(`[writeme] Document exceeds ${HARD_LIMIT / 1_000_000}MB hard limit — import aborted.`);
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
                const tr = editor.state.tr.setMeta("shikiSuspended", false).setMeta("shikiPluginForceDecoration", true);
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

                        applyMarkdownWorkerChunk(editor, html, firstChunk);
                        firstChunk = false;

                        receivedChunks++;
                        if (totalChunks > 0) {
                            setParseProgress(Math.round((receivedChunks / totalChunks) * 100));
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

        const persistedContentRef = useRef<string | null>(null);

        useEffect(() => {
            if (!editor || content === undefined || editor.isDestroyed || !editor.schema) return;
            if (note && persistedNoteRef.current && +note.updatedAt < +persistedNoteRef.current.updatedAt) return;
            const currentMarkdown = getEditorMarkdown(editor);
            if (dirtyRef.current && content !== currentMarkdown) {
                if (note && content === persistedNoteRef.current?.content) persistedNoteRef.current = note;
                return;
            }
            dirtyRef.current = false;
            persistedNoteRef.current = note;
            if (content === persistedContentRef.current) return;
            if (content === currentMarkdown || content === lastEditorContentRef.current) {
                lastEditorContentRef.current = currentMarkdown;
                return;
            }

            if (content.length > LARGE_MARKDOWN_THRESHOLD) {
                triggerWorkerParseRef.current(content);
                return;
            }
            isSettingContent.current = true;
            (editor.commands as any).setContent(content, {
                contentType: "markdown",
                parseOptions: { preserveWhitespace: "full" },
            });
            lastEditorContentRef.current = content;
            isSettingContent.current = false;
        }, [editor, content, note]);

        useEffect(() => {
            if (!editor) return;
            return registerNoteLinkRepairHandler({
                noteId: () => noteRef.current?.id,
                getContent: () => getEditorMarkdown(editor),
                isEditable: () => editor.isEditable && !editor.isDestroyed,
                apply: (request) => repairTiptapLink(editor, request),
            });
        }, [editor]);

        useEffect(() => {
            if (editor) setEditorNote(editor, note);
            noteRef.current = note;
        }, [editor, note]);

        useEffect(() => {
            if (editor) setEditorAllNotes(editor, globalState.notes);
        }, [editor]);

        useEditorScrollMemory(id, editor);

        useEffect(() => {
            if (editor === null || readonly) return;
            let saveTimeout: NodeJS.Timeout | undefined;
            const dirty = dirtyRef;
            let saveQueue = Promise.resolve();

            const getCurrentMarkdown = (): string | null => {
                if (
                    editor.isDestroyed ||
                    !editor.schema ||
                    !editor.isEditable ||
                    Reflect.get(editor.storage, "commentSourcePending")
                )
                    return null;
                return getEditorMarkdown(editor);
            };

            const saveDocument = (markdown: string): Promise<void> => {
                const savingNote = persistedNoteRef.current;
                const onSave = onSaveRef.current;
                saveQueue = saveQueue.then(async () => {
                    uiDispatch.setEditorSaveStatus("saving", noteRef.current?.id ?? id);
                    try {
                        setSaveError(null);
                        if (onSave) {
                            await onSave(markdown);
                        } else if (savingNote) {
                            persistedNoteRef.current = await saveEditorDraft(
                                persistedNoteRef.current ?? savingNote,
                                markdown,
                                dispatch,
                            );
                        }
                        persistedContentRef.current = markdown;
                        if (editor.isDestroyed || getCurrentMarkdown() === markdown) dirty.current = false;
                        uiDispatch.setEditorSaveStatus(dirty.current ? "unsaved" : "saved", noteRef.current?.id ?? id);
                    } catch (error) {
                        setSaveError(error instanceof Error ? error.message : "Could not save this draft.");
                        uiDispatch.setEditorSaveStatus("error", noteRef.current?.id ?? id);
                        console.error("Failed to save document:", error);
                    }
                });
                return saveQueue;
            };

            const updateHandler = () => {
                if (isSettingContent.current) {
                    if (saveTimeout) clearTimeout(saveTimeout);
                    dirty.current = false;
                    return;
                }
                dirty.current = true;
                uiDispatch.setEditorSaveStatus("unsaved", noteRef.current?.id ?? id);
                if (!settings.autosave) return;
                if (saveTimeout) clearTimeout(saveTimeout);
                saveTimeout = setTimeout(
                    () => {
                        const markdown = getCurrentMarkdown();
                        if (markdown !== null) void saveDocument(markdown);
                    },
                    Math.max(0, settings.autosaveDelay),
                );
            };
            editor.on("update", updateHandler);
            editor.setEditable(true, false);
            const unregisterSaveShortcut = registerNoteSaveShortcut(
                id,
                () => {
                    if (saveTimeout) clearTimeout(saveTimeout);
                    const markdown = getCurrentMarkdown();
                    if (markdown !== null) void saveDocument(markdown);
                },
                active,
            );
            const flushPendingSave = (): void => {
                if (!isMobile() || !dirty.current || !settings.autosave) return;
                if (saveTimeout) clearTimeout(saveTimeout);
                const markdown = getCurrentMarkdown();
                if (markdown !== null) void saveDocument(markdown);
            };
            const onVisibilityChange = (): void => {
                if (document.visibilityState === "hidden") flushPendingSave();
            };
            window.addEventListener(MOBILE_PAUSE_EVENT, flushPendingSave);
            document.addEventListener("visibilitychange", onVisibilityChange);
            return () => {
                unregisterSaveShortcut();
                window.removeEventListener(MOBILE_PAUSE_EVENT, flushPendingSave);
                document.removeEventListener("visibilitychange", onVisibilityChange);
                editor.off("update", updateHandler);
                if (saveTimeout) clearTimeout(saveTimeout);
                const markdown = getCurrentMarkdown();
                if (dirty.current && markdown !== null) void saveDocument(markdown);
            };
        }, [dispatch, editor, readonly, settings, id, active]);

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

        return (
            <div
                id={`editor-container-${id}`}
                data-research-source={note?.noteType === "read-it-later" ? note.id : undefined}
                className="writeme-editor relative"
                style={{ fontSize: `${settings.editorFontSize}px` }}
                aria-busy={uiState.parsingContent ? "true" : "false"}
                onFocusCapture={() => activateRef.current()}
            >
                {uiState.parsingContent && (
                    <div
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/95"
                    >
                        <CircleNotchIcon aria-hidden="true" size={32} className="animate-spin" />
                        <span className="mt-2 text-sm text-foreground">
                            {parseProgress > 0
                                ? `Parsing large document… ${parseProgress}%`
                                : "Parsing large document…"}
                        </span>
                    </div>
                )}
                <EditorContext.Provider value={{ editor }}>
                    {note && editor ? (
                        <NoteComments
                            key={note.id}
                            editor={editor}
                            note={note}
                            readonly={Boolean(readonly)}
                            onSourcePersisted={(saved) => {
                                dispatch.syncNoteFromRepository(saved);
                                uiDispatch.setEditorSaveStatus("saved", noteRef.current?.id ?? id);
                            }}
                            onSaveSource={async (markdown, referenceHref) => {
                                uiDispatch.setEditorSaveStatus("saving", noteRef.current?.id ?? id);
                                try {
                                    if (onSaveRef.current) await onSaveRef.current(markdown);
                                    else {
                                        const latest = await repositories.notes.getOne(note.id);
                                        if (!latest)
                                            throw new Error(
                                                "The source note was deleted. Restore it before commenting.",
                                            );
                                        if (latest.content === markdown) dispatch.syncNoteFromRepository(latest);
                                        else {
                                            if (latest.content !== note.content || latest.title !== note.title)
                                                throw new Error(
                                                    "The source note changed in another editor. Reload it before saving its comment link.",
                                                );
                                            const saved = await repositories.notes.updateContentIfUnchanged(
                                                note.id,
                                                {
                                                    title: latest.title,
                                                    updatedAt: latest.updatedAt,
                                                    content: latest.content,
                                                },
                                                markdown,
                                            );
                                            if (!saved)
                                                throw new Error(
                                                    "The source note changed in another editor. Reload it before saving its comment link.",
                                                );
                                            dispatch.syncNoteFromRepository(saved);
                                        }
                                    }
                                    if (referenceHref) {
                                        const saved = await repositories.notes.getOne(note.id);
                                        if (!saved)
                                            throw new Error(
                                                "The source note was deleted. Restore it before commenting.",
                                            );
                                        const existing = saved.metadata.commentReferenceHrefs;
                                        const aliases = Array.isArray(existing)
                                            ? existing.filter((value): value is string => typeof value === "string")
                                            : [];
                                        if (!aliases.includes(referenceHref)) {
                                            const metadata = {
                                                ...saved.metadata,
                                                commentReferenceHrefs: [...aliases, referenceHref],
                                            };
                                            await repositories.notes.updateMetadata(saved.id, metadata);
                                            dispatch.syncNoteFromRepository(Note.parse({ ...saved, metadata }));
                                        }
                                    }
                                    uiDispatch.setEditorSaveStatus("saved", noteRef.current?.id ?? id);
                                } catch (reason) {
                                    uiDispatch.setEditorSaveStatus("error", noteRef.current?.id ?? id);
                                    throw reason;
                                }
                            }}
                        />
                    ) : (
                        <FormattingToolbar editor={editor} />
                    )}
                    {supportsAI() && writingAssistantBinding?.editor === editor && (
                        <WritingAssistant
                            adapter={writingAssistantBinding.adapter}
                            editor={writingAssistantBinding.editor}
                            selectionContext={writingAssistantSelectionContext}
                            disabled={Boolean(readonly || uiState.parsingContent)}
                        />
                    )}
                    {vimMode && vimConfigurationLoading ? <output>Loading Vim configuration...</output> : null}
                    {vimConfigurationError ? (
                        <output role="alert" className="text-danger">
                            Vim configuration: {vimConfigurationError}
                        </output>
                    ) : null}
                    {saveError ? (
                        <p role="alert" className="text-danger">
                            {saveError}
                        </p>
                    ) : null}
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
        prev.active === next.active &&
        prev.vimMode === next.vimMode &&
        prev.note === next.note,
);

const RawEditorCore = memo(
    function RawEditorCore(props: {
        id: string;
        note?: Note;
        content?: string;
        readonly?: boolean;
        theme: string;
        vimMode: boolean;
        active?: boolean;
        dispatch: GlobalDispatch;
        onSaveRef: React.MutableRefObject<((content: string) => Promise<void>) | undefined>;
    }) {
        const { dispatch, onSaveRef, id } = props;
        const noteRef = useRef(props.note);
        const persistedNoteRef = useRef(props.note);
        const [saveError, setSaveError] = useState<string | null>(null);
        const latestContentRef = useRef(props.content ?? "");
        const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
        const dirtyRef = useRef(false);
        const saveQueueRef = useRef(Promise.resolve());
        const [draft, setDraft] = useState({ source: props.content ?? "", content: props.content ?? "", dirty: false });
        if (draft.source !== (props.content ?? "")) {
            setDraft({
                source: props.content ?? "",
                content: draft.dirty ? draft.content : (props.content ?? ""),
                dirty: draft.dirty,
            });
        }
        const settings = useMemo(() => SettingsService.load(), []);

        const saveContent = useCallback(
            (content: string): Promise<void> => {
                const savingNote = persistedNoteRef.current;
                const onSave = onSaveRef.current;
                saveQueueRef.current = saveQueueRef.current.then(async () => {
                    uiDispatch.setEditorSaveStatus("saving", noteRef.current?.id ?? id);
                    try {
                        setSaveError(null);
                        if (onSave) {
                            await onSave(content);
                        } else if (savingNote) {
                            persistedNoteRef.current = await saveEditorDraft(
                                persistedNoteRef.current ?? savingNote,
                                content,
                                dispatch,
                            );
                        }
                        if (latestContentRef.current === content) dirtyRef.current = false;
                        setDraft((current) => (current.content === content ? { ...current, dirty: false } : current));
                        uiDispatch.setEditorSaveStatus(
                            dirtyRef.current ? "unsaved" : "saved",
                            noteRef.current?.id ?? id,
                        );
                    } catch (error) {
                        setSaveError(error instanceof Error ? error.message : "Could not save this draft.");
                        uiDispatch.setEditorSaveStatus("error", noteRef.current?.id ?? id);
                        console.error("Failed to save Markdown document:", error);
                    }
                });
                return saveQueueRef.current;
            },
            [dispatch, onSaveRef, id],
        );

        useEffect(() => {
            noteRef.current = props.note;
        }, [props.note]);

        useEffect(() => {
            if (props.note && persistedNoteRef.current && +props.note.updatedAt < +persistedNoteRef.current.updatedAt)
                return;
            if (dirtyRef.current) {
                if (props.note && props.content === persistedNoteRef.current?.content)
                    persistedNoteRef.current = props.note;
                return;
            }
            persistedNoteRef.current = props.note;
            latestContentRef.current = props.content ?? "";
        }, [props.content, props.note]);

        useEffect(() => {
            if (props.readonly) return;
            return registerNoteSaveShortcut(
                props.id,
                () => {
                    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                    void saveContent(latestContentRef.current);
                },
                props.active,
            );
        }, [props.id, props.active, props.readonly, saveContent]);

        useEffect(() => {
            const flushPendingSave = (): void => {
                if (!isMobile() || props.readonly || !dirtyRef.current || !settings.autosave) return;
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                void saveContent(latestContentRef.current);
            };
            const onVisibilityChange = (): void => {
                if (document.visibilityState === "hidden") flushPendingSave();
            };
            window.addEventListener(MOBILE_PAUSE_EVENT, flushPendingSave);
            document.addEventListener("visibilitychange", onVisibilityChange);
            return () => {
                window.removeEventListener(MOBILE_PAUSE_EVENT, flushPendingSave);
                document.removeEventListener("visibilitychange", onVisibilityChange);
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                if (!props.readonly && dirtyRef.current) {
                    void saveContent(latestContentRef.current);
                }
            };
        }, [props.readonly, saveContent, settings.autosave]);

        const handleChange = (nextContent: string): void => {
            latestContentRef.current = nextContent;
            if (props.readonly) return;
            dirtyRef.current = true;
            setDraft((current) => ({ ...current, content: nextContent, dirty: true }));
            uiDispatch.setEditorSaveStatus("unsaved", noteRef.current?.id ?? props.id);
            if (!settings.autosave) return;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(
                () => {
                    void saveContent(nextContent);
                },
                Math.max(0, settings.autosaveDelay),
            );
        };

        return (
            <div
                id={`editor-container-${props.id}`}
                data-research-source={props.note?.noteType === "read-it-later" ? props.note.id : undefined}
                className="writeme-editor relative"
                style={{ fontSize: `${settings.editorFontSize}px` }}
            >
                {saveError ? (
                    <p role="alert" className="text-danger">
                        {saveError}
                    </p>
                ) : null}
                <RawMarkdownEditor
                    noteId={props.id}
                    repairNoteId={props.note?.id}
                    value={draft.content}
                    onChange={handleChange}
                    readonly={props.readonly}
                    theme={props.theme}
                    fontSize={settings.editorFontSize}
                    vimMode={props.vimMode}
                    writingAssistantEnabled={!isLatexFilePath(props.note?.filePath)}
                    active={props.active}
                />
            </div>
        );
    },
    (prev, next) =>
        prev.id === next.id &&
        prev.theme === next.theme &&
        prev.vimMode === next.vimMode &&
        prev.content === next.content &&
        prev.readonly === next.readonly &&
        prev.active === next.active &&
        prev.note?.filePath === next.note?.filePath &&
        prev.note === next.note,
);

const InnerEditor = (props: {
    id: string;
    note?: Note;
    content?: string;
    readonly?: boolean;
    mode: EditorMode;
    vimMode: boolean;
    active?: boolean;
    onSave?: (content: string) => Promise<void>;
}) => {
    const [state, dispatch] = useGlobalStore();
    const onSaveRef = useRef(props.onSave);
    useEffect(() => {
        onSaveRef.current = props.onSave;
    }, [props.onSave]);

    useEffect(() => {
        if (props.mode !== "formatted") return;
        if (editorGlobalRef.current) {
            setEditorAllNotes(editorGlobalRef.current, state.notes);
        }
    }, [props.mode, state.notes]);

    if (props.mode === "markdown") {
        return (
            <RawEditorCore
                id={props.id}
                note={props.note}
                dispatch={dispatch}
                theme={state.theme}
                vimMode={props.vimMode}
                active={props.active}
                onSaveRef={onSaveRef}
                content={props.content}
                readonly={props.readonly}
            />
        );
    }

    return (
        <TiptapEditorCore
            id={props.id}
            note={props.note}
            dispatch={dispatch}
            theme={state.theme}
            onSaveRef={onSaveRef}
            content={props.content}
            readonly={props.readonly}
            active={props.active}
            vimMode={props.vimMode}
        />
    );
};

export const Editor = (props: {
    content: string;
    note?: Note;
    id?: string;
    readonly?: boolean;
    mode?: EditorMode;
    vimMode?: boolean;
    active?: boolean;
    onSave?: (content: string) => Promise<void>;
}) => {
    const id = useMemo(() => props.id || props.note?.id || uuid(), [props.note, props.id]);
    const settings = SettingsService.load();
    const vimSettings = useVimSettings();
    const requestedMode = props.mode ?? settings.editorMode;
    const mode = isLatexFilePath(props.note?.filePath) ? "markdown" : requestedMode;
    const vimMode = props.vimMode ?? vimSettings.enabled;

    if (props.content === undefined) {
        return <div className="flex items-center justify-center">Loading...</div>;
    }

    return (
        <Fragment key={`${props.note?.id || props.id}:${mode}`}>
            <InnerEditor
                id={id}
                mode={mode}
                note={props.note}
                onSave={props.onSave}
                content={props.content}
                readonly={props.readonly}
                vimMode={vimMode}
                active={props.active}
                key={`${props.note?.id || props.id}:${mode}`}
            />
        </Fragment>
    );
};
