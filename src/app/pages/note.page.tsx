import { Button, Checkbox, Tag } from "@g4rcez/components";
import { PrinterIcon } from "@phosphor-icons/react/dist/csr/Printer";
import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Dates } from "@/lib/dates";
import { getReadingTime } from "@/lib/file-utils";
import { isElectron } from "@/lib/is-electron";
import { findFirstMarkdownH1, replaceFirstMarkdownH1 } from "@/lib/markdown-title";
import { isNoteRouteTabOpenSuppressed } from "@/lib/note-route-tab-open-suppression";
import { printDocument } from "@/lib/print-document";
import { isNoteTabForNoteId } from "@/lib/tab-target";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import { type EditorMode, SettingsService } from "@/store/settings";
import { useUIStore } from "@/store/ui.store";
import { ExcalidrawNoteView } from "../components/excalidraw-note-view";
import { NoteFooter } from "../components/note-footer";
import { TableOfContents } from "../components/table-of-contents";
import { Editor } from "../editor";
import { JsonGraph } from "../elements/json-graph/json-graph";

function useNoteReferences(content: string) {
    const [refs, setRefs] = useState<Note[]>([]);
    useEffect(() => {
        let cancelled = false;
        async function resolve() {
            const ids = new Set<string>();
            for (const m of content.matchAll(/\[([^\]]+)\]\([^)]*"writeme-mention:([^"]+)"\)/g)) {
                ids.add(m![2]!);
            }
            for (const m of content.matchAll(/app:\/\/note\/([^\s<>"')\]]+)/g)) {
                ids.add(m![1]!);
            }
            const wikiMatches = [...content.matchAll(/\[\[([^\]]+)\]\]/g)];
            if (wikiMatches.length > 0) {
                const allNotes = await repositories.notes.getAll();
                const byTitle = new Map(allNotes.map((n) => [n.title, n.id]));
                const byId = new Set(allNotes.map((n) => n.id));
                for (const m of wikiMatches) {
                    const raw = m[1]!;
                    if (byId.has(raw)) ids.add(raw);
                    else if (byTitle.has(raw)) ids.add(byTitle.get(raw)!);
                }
            }
            const settled = await Promise.all([...ids].map((id) => repositories.notes.getOne(id)));
            if (!cancelled) setRefs(settled.filter((n): n is Note => n != null));
        }
        resolve();
        return () => {
            cancelled = true;
        };
    }, [content]);
    return refs;
}

function NoteReferences({ note }: { note: Note }) {
    const refs = useNoteReferences(note.content ?? "");
    if (refs.length === 0) return null;
    return (
        <footer className="my-4 flex flex-col gap-2 border-t border-card-border py-4">
            <p className="text-sm font-medium text-muted-foreground">Linked notes</p>
            <ul className="flex flex-wrap gap-2">
                {refs.map((ref) => (
                    <li key={ref.id}>
                        <Link
                            to={`/note/${ref.id}`}
                            className="text-sm text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                        >
                            {ref.title || ref.id}
                        </Link>
                    </li>
                ))}
            </ul>
        </footer>
    );
}

const Wrapper = (props: PropsWithChildren) => <div className="writeme-editor-page">{props.children}</div>;

const PrintableNoteHeader = ({ note }: { note: Note }) => {
    return (
        <header className="writeme-print-header hidden print:block">
            <h1 className="writeme-print-title">{note.title}</h1>
            <p className="writeme-print-meta">Updated {Dates.yearMonthDay(note.updatedAt)}</p>
        </header>
    );
};

function EditableNoteTitle({ value, onSave }: { value: string; onSave: (title: string) => Promise<void> }) {
    const [draft, setDraft] = useState(value);
    const [saving, setSaving] = useState(false);
    const cancelBlurRef = useRef(false);

    const commit = async (): Promise<void> => {
        const nextTitle = draft.trim() || "Untitled";
        setDraft(nextTitle);
        if (nextTitle === value.trim()) return;
        setSaving(true);
        try {
            await onSave(nextTitle);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="w-full">
            <label className="sr-only" htmlFor="note-title-editor">
                Note title
            </label>
            <input
                id="note-title-editor"
                type="text"
                value={draft}
                disabled={saving}
                placeholder="Untitled"
                aria-label="Note title"
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => {
                    if (cancelBlurRef.current) {
                        cancelBlurRef.current = false;
                        return;
                    }
                    void commit();
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                    }
                    if (event.key === "Escape") {
                        cancelBlurRef.current = true;
                        setDraft(value);
                        event.currentTarget.blur();
                    }
                }}
                className="writeme-note-title-editor w-full border-0 border-b border-transparent bg-transparent px-0 py-3 text-3xl font-semibold tracking-tight text-foreground transition-colors outline-none placeholder:text-muted-foreground/60 hover:border-border focus:border-primary focus-visible:ring-0"
            />
        </div>
    );
}

const EditorModeToggle = ({ mode, onChange }: { mode: EditorMode; onChange: (mode: EditorMode) => void }) => {
    const modes: Array<{ value: EditorMode; label: string }> = [
        { value: "markdown", label: "Markdown" },
        { value: "formatted", label: "Formatted" },
    ];

    return (
        <div className="flex items-center">
            {modes.map((item) => {
                const active = item.value === mode;
                return (
                    <Button
                        size="tiny"
                        key={item.value}
                        aria-pressed={active}
                        onClick={() => onChange(item.value)}
                        theme={active ? "primary" : "muted"}
                    >
                        {item.label}
                    </Button>
                );
            })}
        </div>
    );
};

const MarkdownVimModeToggle = ({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) => {
    return (
        <Button
            size="tiny"
            theme="muted"
            className="h-fit"
            data-enabled={enabled.toString()}
            onClick={(event) => {
                const isTrue = event.currentTarget.dataset.enabled === "true";
                onChange(!isTrue);
            }}
        >
            <Checkbox size="tiny" onChange={(e) => onChange(e.target.checked)} checked={enabled} id="markdown-vim-mode">
                <span>Vim mode</span>
            </Checkbox>
        </Button>
    );
};

function ExportNoteButton({ note }: { note: Note }) {
    return (
        <Button
            size="tiny"
            theme="ghost-primary"
            aria-label={`Export ${note.title}`}
            title="Export document (print or save as PDF)"
            onClick={() => printDocument({ title: note.title })}
        >
            <PrinterIcon aria-hidden="true" size={21} />
        </Button>
    );
}

export default function NotePage() {
    const [uiState] = useUIStore();
    const [state, dispatch] = useGlobalStore();
    const params = useParams<{ noteId: string }>();
    const id = params.noteId;
    const note = state.note;
    const hasRouteNoteTab = id ? state.tabs.some((tab) => isNoteTabForNoteId(tab, id)) : false;
    const isLoading = note === null;
    const [editorMode, setEditorMode] = useState<EditorMode>(() => SettingsService.load().editorMode);
    const [rawEditorVimMode, setRawEditorVimMode] = useState<boolean>(() => SettingsService.load().rawEditorVimMode);
    const changeEditorMode = useCallback((nextMode: EditorMode): void => {
        setEditorMode((currentMode) => {
            if (currentMode === nextMode) return currentMode;
            void SettingsService.save({ editorMode: nextMode }).catch((error) => {
                console.error("Failed to save editor mode:", error);
            });
            return nextMode;
        });
    }, []);
    const changeRawEditorVimMode = useCallback((nextVimMode: boolean): void => {
        setRawEditorVimMode((currentVimMode) => {
            if (currentVimMode === nextVimMode) return currentVimMode;
            void SettingsService.save({ rawEditorVimMode: nextVimMode }).catch((error) => {
                console.error("Failed to save raw editor Vim mode:", error);
            });
            return nextVimMode;
        });
    }, []);

    useEffect(() => {
        if (!id || isNoteRouteTabOpenSuppressed(id)) return;

        let cancelled = false;

        const openRouteNote = async (): Promise<void> => {
            if (id === state.note?.id) {
                if (!hasRouteNoteTab) await dispatch.addTab(id);
                return;
            }

            const note = await repositories.notes.getOne(id);
            if (cancelled) return;

            if (!note) {
                dispatch.setNote(null);
                return;
            }

            await dispatch.addTab(id);
            if (cancelled) return;
            dispatch.setNote(note);
        };

        void openRouteNote();

        return () => {
            cancelled = true;
        };
    }, [dispatch, hasRouteNoteTab, id, state.note?.id]);

    useEffect(() => {
        if (!isElectron() || !note?.filePath) return;
        const filePath = note.filePath;
        return window.electronAPI.fs.onFileChanged(async ({ filePath: changedPath }) => {
            if (changedPath !== filePath) return;
            const result = await window.electronAPI.fs.readFile(changedPath);
            if (!result.success) return;
            if (result.content !== note.content) {
                dispatch.setNote(Note.parse({ ...note, content: result.content }));
            }
        });
    }, [dispatch, note]);

    const markdownTitle = note ? findFirstMarkdownH1(note.content || "") : null;
    const markdownTitleText = markdownTitle?.title;
    useEffect(() => {
        if (!note?.id || !markdownTitleText || markdownTitleText === note.title) return;
        void dispatch.updateNoteTitle(note.id, markdownTitleText);
    }, [dispatch, markdownTitleText, note?.id, note?.title]);

    const saveTitle = useCallback(
        async (title: string): Promise<void> => {
            if (!note) return;
            const updatedContent = replaceFirstMarkdownH1(note.content || "", title);
            if (updatedContent !== null && updatedContent !== note.content) {
                await dispatch.updateNoteContent(note.id, updatedContent);
            }
            await dispatch.updateNoteTitle(note.id, title);
        },
        [dispatch, note],
    );

    if (isLoading) {
        return <div className="flex items-center justify-center p-8">Fetching note...</div>;
    }

    if (uiState.error && note === null) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 p-8">
                <span className="text-lg font-medium capitalize">Note not found</span>
                <Link to="/">Go to dashboard</Link>
            </div>
        );
    }

    const isJson = note.noteType === NoteType.json;
    const isExcalidraw = note.noteType === NoteType.excalidraw;

    if (isJson || isExcalidraw) {
        return (
            <div className="-my-8 flex h-[calc(100%+4rem)] min-h-0 w-full bg-background">
                {isJson ? (
                    <JsonGraph
                        key={note.id}
                        json={(() => {
                            try {
                                return JSON.parse(note.content);
                            } catch {
                                return { error: "Failed to parse JSON", raw: note.content };
                            }
                        })()}
                        onChange={(newJson) => {
                            const content = JSON.stringify(newJson, null, 2);
                            repositories.notes.updateContent(note.id, content);
                            dispatch.updateNoteContent(note.id, content);
                        }}
                    />
                ) : (
                    <ExcalidrawNoteView note={note} />
                )}
            </div>
        );
    }

    return (
        <Wrapper>
            <PrintableNoteHeader note={note} />
            {note.noteType === "read-it-later" ? (
                <header className="writeme-editor-column writeme-note-header flex flex-col gap-2 border-b border-border/50 print:hidden">
                    <div className="writeme-note-header-top">
                        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                            <span className="shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em]">
                                Reading list
                            </span>
                            {note.url ? <span className="truncate">/ {new URL(note.url).hostname}</span> : null}
                        </div>
                        <div className="flex items-center" role="toolbar" aria-label="Note tools">
                            {editorMode === "markdown" ? (
                                <MarkdownVimModeToggle enabled={rawEditorVimMode} onChange={changeRawEditorVimMode} />
                            ) : null}
                            <EditorModeToggle mode={editorMode} onChange={changeEditorMode} />
                            <div className="flex flex-col items-center">
                                <TableOfContents />
                                <ExportNoteButton note={note} />
                            </div>
                        </div>
                    </div>
                    <EditableNoteTitle
                        key={`${note.id}:${markdownTitle?.title ?? note.title}`}
                        value={markdownTitle?.title ?? note.title}
                        onSave={saveTitle}
                    />
                    {note.url ? (
                        <Link
                            target="_blank"
                            className="link truncate text-sm"
                            to={note.url}
                            rel="noopener noreferrer nofollow"
                        >
                            {note.url}
                        </Link>
                    ) : null}
                    <span className="writeme-note-metadata">
                        <Tag size="small">Read it later</Tag>
                        <span aria-hidden="true">·</span>
                        <time dateTime={note.createdAt.toISOString()}>{Dates.yearMonthDay(note.createdAt)}</time>
                        <span aria-hidden="true">·</span>
                        <i>{getReadingTime(note.content).formatted}</i>
                    </span>
                </header>
            ) : (
                <header className="writeme-editor-column writeme-note-header border-b border-border/50 print:hidden">
                    <div className="writeme-note-header-top">
                        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                            {note.filePath ? (
                                <span className="truncate" title={note.filePath}>
                                    Workspace file
                                </span>
                            ) : (
                                <span className="shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em]">
                                    Local note
                                </span>
                            )}
                        </div>
                        <div className="writeme-note-header-actions" role="toolbar" aria-label="Note tools">
                            {editorMode === "markdown" ? (
                                <MarkdownVimModeToggle enabled={rawEditorVimMode} onChange={changeRawEditorVimMode} />
                            ) : null}
                            <EditorModeToggle mode={editorMode} onChange={changeEditorMode} />
                            <TableOfContents />
                            <ExportNoteButton note={note} />
                        </div>
                    </div>
                    <EditableNoteTitle
                        key={`${note.id}:${markdownTitle?.title ?? note.title}`}
                        value={markdownTitle?.title ?? note.title}
                        onSave={saveTitle}
                    />
                    <div className="writeme-note-metadata">
                        <time dateTime={note.updatedAt.toISOString()}>
                            Updated {Dates.yearMonthDay(note.updatedAt)}
                        </time>
                        {note.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-primary">
                                #{tag}
                            </span>
                        ))}
                    </div>
                </header>
            )}
            <Editor
                note={note}
                key={note.id}
                content={note.content || ""}
                mode={editorMode}
                rawEditorVimMode={rawEditorVimMode}
            />
            <NoteReferences note={note} />
            <NoteFooter noteId={note.id} />
        </Wrapper>
    );
}
