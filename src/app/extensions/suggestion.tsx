import { TextSelection, type EditorState } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { updatePosition } from "@/app/extensions/update-position";
import {
    getEditorAllNotes,
    getEditorMentionItems,
    type EditorMentionItem,
} from "@/lib/editor-storage";
import { filterMentionItems } from "@/app/extensions/mention-search";
import { innerUrl } from "@/lib/encoding";
import { formatSimplifiedPath, getRelativePath } from "@/lib/file-utils";
import { globalDispatch, useGlobalStore } from "@/store/global.store";

const MentionList = (props: any) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef<HTMLUListElement>(null);

    const itemsRef = useRef(props.items);
    const queryRef = useRef(props.query);
    const editorRef = useRef(props.editor);
    const rangeRef = useRef(props.range);
    const selectedIndexRef = useRef(selectedIndex);

    itemsRef.current = props.items;
    queryRef.current = props.query;
    editorRef.current = props.editor;
    rangeRef.current = props.range;
    selectedIndexRef.current = selectedIndex;

    const selectItem = (index: number) => {
        const item = itemsRef.current[index];
        if (!item) return;
        const { from, to } = rangeRef.current;
        editorRef.current
            .chain()
            .focus()
            .command(({ tr, state }: { tr: any; state: any }) => {
                const node = state.schema.nodes.mention.create({
                    id: item.id,
                    label: item.label,
                    path: item.path,
                });
                tr.replaceWith(getMentionReplacementFrom(state, from), to, node);
                return true;
            })
            .run();
    };

    const closeSuggestionBeforeDialog = () => {
        const editor = editorRef.current;
        const range = rangeRef.current;

        if (editor && range) {
            editor
                .chain()
                .command(({ tr, state }: { tr: any; state: EditorState }) => {
                    const from = getMentionReplacementFrom(state, range.from);
                    tr.setSelection(TextSelection.create(state.doc, from));
                    return true;
                })
                .run();
            editor.commands.blur();
        }

        props.closeSuggestion?.();
    };

    const createNoteFromQuery = () => {
        const initialTitle = String(queryRef.current ?? "").trim();
        if (!initialTitle) return false;

        closeSuggestionBeforeDialog();
        globalDispatch.setCreateNoteDialog({
            isOpen: true,
            type: "note",
            initialTitle,
        });
        return true;
    };

    useEffect(() => setSelectedIndex(0), [props.items]);

    useEffect(() => {
        listRef.current?.children[selectedIndex]?.scrollIntoView({
            block: "nearest",
        });
    }, [selectedIndex]);

    useLayoutEffect(() => {
        const handler = ({ event }: { event: KeyboardEvent }) => {
            if (itemsRef.current.length === 0) {
                if (event.key === "Tab" || event.key === "Enter") {
                    if (!createNoteFromQuery()) return false;
                    event.preventDefault();
                    return true;
                }
                return false;
            }

            if (event.key === "ArrowUp") {
                setSelectedIndex((prev) => (prev + itemsRef.current.length - 1) % itemsRef.current.length);
                return true;
            }
            if (event.key === "ArrowDown") {
                setSelectedIndex((prev) => (prev + 1) % itemsRef.current.length);
                return true;
            }
            if (event.key === "Tab" || event.key === "Enter") {
                event.preventDefault();
                selectItem(selectedIndexRef.current);
                return true;
            }
            return false;
        };
        props.registerKeyDown(handler);
    }, []);

    const [directory] = useGlobalStore((s) => s.directory);
    const storageDir = directory || "";

    return (
        <ul
            ref={listRef}
            role="listbox"
            aria-label="Note and file suggestions"
            aria-activedescendant={props.items.length ? `note-suggestion-${selectedIndex}` : undefined}
            className="flex overflow-y-auto relative flex-col p-1 w-80 max-h-64 rounded-lg border shadow-lg border-border bg-background z-50 animate-fade-in-scale"
        >
            {props.items.length ? (
                props.items.map((item: EditorMentionItem, index: number) => {
                    const relativePath = item.filePath && storageDir ? getRelativePath(storageDir, item.filePath) : "";
                    const folderPath = relativePath.includes("/")
                        ? relativePath.substring(0, relativePath.lastIndexOf("/"))
                        : "";
                    const displayPath = formatSimplifiedPath(folderPath);
                    const isSelected = index === selectedIndex;
                    return (
                        <li key={item.id} role="presentation">
                            <button
                                type="button"
                                id={`note-suggestion-${index}`}
                                role="option"
                                aria-selected={isSelected}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    selectItem(index);
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={`flex flex-col px-3 py-2 rounded-md w-full text-left transition-colors ${isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted/50 text-foreground"
                                    }`}
                            >
                                <span className="flex w-full items-center justify-between gap-3">
                                    <span className="truncate text-sm font-medium">{item.label || "Untitled"}</span>
                                    <span className="shrink-0 text-[10px] text-muted-foreground">
                                        {item.kind === "file" ? "File" : "Note"}
                                    </span>
                                </span>
                                {displayPath && (
                                    <span className="text-xs text-foreground/50 truncate">{displayPath}</span>
                                )}
                            </button>
                        </li>
                    );
                })
            ) : (
                <li role="presentation" className="flex flex-col gap-2 p-2">
                    <div className="px-3 py-2 text-center text-sm text-foreground/50">No notes or files found</div>
                    {String(props.query ?? "").trim() && (
                        <button
                            type="button"
                            role="option"
                            aria-selected={false}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                createNoteFromQuery();
                            }}
                            className="flex flex-col rounded-md px-3 py-2 text-left text-foreground transition-colors hover:bg-muted/50"
                        >
                            <span className="text-sm font-medium truncate">
                                Create note “{String(props.query).trim()}”
                            </span>
                            <span className="text-xs text-foreground/50 truncate">Opens New note with this title</span>
                        </button>
                    )}
                </li>
            )}
        </ul>
    );
};

export const getMentionReplacementFrom = (state: EditorState, from: number): number => {
    return from > 1 && state.doc.textBetween(from - 1, from) === "@" ? from - 1 : from;
};

function getMentionSuggestionItems(query: string, editor: Editor): EditorMentionItem[] {
    try {
        const items =
            getEditorMentionItems(editor) ??
            getEditorAllNotes(editor).map((note) => ({
                id: note.id,
                label: note.title,
                filePath: note.filePath,
                path: note.filePath || innerUrl(`/note/${note.id}`, "mention"),
                kind: "note" as const,
            }));
        return filterMentionItems(items, query);
    } catch {
        return [];
    }
}

const MENTION_SUGGESTION_REFRESH_KEY = "mentionSuggestionRefresh";

export const refreshMentionSuggestions = (editor: Editor): boolean => {
    const refresh = Reflect.get(editor.storage, MENTION_SUGGESTION_REFRESH_KEY);
    if (typeof refresh !== "function") return false;
    refresh();
    return true;
};

export const suggestion = {
    items: ({ query, editor }: { query: string; editor: Editor }) => getMentionSuggestionItems(query, editor),
    render: () => {
        let reactRenderer: ReactRenderer | undefined;
        let keyDownHandler: ((props: { event: KeyboardEvent }) => boolean) | null = null;
        let activeEditor: Editor | undefined;
        let activeProps: any;
        const getRendererProps = (props: any) => ({
            ...props,
            items: getMentionSuggestionItems(props.query, props.editor),
            closeSuggestion,
            registerKeyDown,
        });
        const refreshActiveSuggestion = () => {
            if (!activeProps || !reactRenderer) return;
            reactRenderer.updateProps(getRendererProps(activeProps));
        };
        const closeSuggestion = () => {
            keyDownHandler = null;
            if (activeEditor) Reflect.deleteProperty(activeEditor.storage, MENTION_SUGGESTION_REFRESH_KEY);
            activeEditor = undefined;
            activeProps = undefined;
            if (!reactRenderer) return;

            const element = reactRenderer.element;
            reactRenderer.destroy();
            element.remove();
            reactRenderer = undefined;
        };
        const registerKeyDown = (fn: (props: { event: KeyboardEvent }) => boolean) => {
            keyDownHandler = fn;
        };
        return {
            onStart: (props: any) => {
                if (!props.clientRect) return;
                activeEditor = props.editor;
                activeProps = props;
                Reflect.set(props.editor.storage, MENTION_SUGGESTION_REFRESH_KEY, refreshActiveSuggestion);
                reactRenderer = new ReactRenderer(MentionList, {
                    props: getRendererProps(props),
                    editor: props.editor,
                });
                reactRenderer.element.style.position = "absolute";
                document.body.appendChild(reactRenderer.element);
                updatePosition(props.editor, reactRenderer.element);
            },
            onUpdate(props: any) {
                if (!reactRenderer) return;
                activeProps = props;
                reactRenderer.updateProps(getRendererProps(props));
                if (!props.clientRect) return;
                updatePosition(props.editor, reactRenderer.element);
            },
            onKeyDown(props: { event: KeyboardEvent }) {
                if (props.event.key === "Escape") {
                    closeSuggestion();
                    return true;
                }
                return keyDownHandler?.(props) ?? false;
            },
            onExit() {
                closeSuggestion();
            },
        };
    },
};
