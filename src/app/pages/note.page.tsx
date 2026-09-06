import { Checkbox, Tag } from "@g4rcez/components";
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

const Wrapper = (props: PropsWithChildren) => {
    return (
        <div className="writeme-editor-page">
            <TableOfContents />
            {props.children}
        </div>
    );
};

function PrintableNoteHeader({ note }: { note: Note }) {
    return (
        <header className="writeme-print-header hidden print:block">
            <h1 className="writeme-print-title">{note.title}</h1>
            <p className="writeme-print-meta">Updated {Dates.yearMonthDay(note.updatedAt)}</p>
        </header>
    );
}

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
                className="w-full border-0 border-b border-transparent bg-transparent px-0 py-3 text-2xl font-semibold tracking-tight text-foreground transition-colors outline-none placeholder:text-muted-foreground/60 hover:border-border focus:border-primary focus-visible:ring-0"
            />
        </div>
    );
}

function EditorModeToggle({
    mode,
    vimMode,
    onChange,
    onVimModeChange,
}: {
    mode: EditorMode;
    vimMode: boolean;
    onChange: (mode: EditorMode) => void;
    onVimModeChange: (vimMode: boolean) => void;
}) {
    const modes: Array<{ value: EditorMode; label: string }> = [
        { value: "formatted", label: "Formatted" },
        { value: "markdown", label: "Markdown" },
    ];

    return (
        <div className="mx-auto flex w-full max-w-safe flex-col items-end gap-1 print:hidden">
            <fieldset
                aria-label="Editor mode"
                className="inline-flex rounded-lg border border-border bg-card-background p-0.5 shadow-soft"
            >
                {modes.map((item) => {
                    const active = item.value === mode;
                    return (
                        <button
                            key={item.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onChange(item.value)}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                                active
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </fieldset>
            {mode === "markdown" ? (
                <label
                    htmlFor="markdown-vim-mode"
                    className="flex items-center gap-2 px-1 py-1 text-xs font-medium text-muted-foreground"
                >
                    <Checkbox
                        id="markdown-vim-mode"
                        checked={vimMode}
                        onChange={(event) => onVimModeChange(event.target.checked)}
                    />
                    <span>Vim mode</span>
                </label>
            ) : null}
        </div>
    );
}

function ExportNoteButton({ note }: { note: Note }) {
    return (
        <button
            type="button"
            aria-label={`Export ${note.title}`}
            title="Export document (print or save as PDF)"
            onClick={() => printDocument({ title: note.title })}
            className="writeme-print-export-button rounded-button-radius fixed top-6 right-5 z-50 flex size-11 items-center justify-center border border-card-border bg-card-background text-muted-foreground shadow-soft transition-[background-color,border-color,color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none print:hidden"
        >
            <PrinterIcon aria-hidden="true" size={21} />
        </button>
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
            <ExportNoteButton note={note} />
            <PrintableNoteHeader note={note} />
            {note.noteType === "read-it-later" ? (
                <header className="writeme-editor-column flex flex-col gap-2 border-b border-card-border py-4 print:hidden">
                    <EditableNoteTitle
                        key={`${note.id}:${markdownTitle?.title ?? note.title}`}
                        value={markdownTitle?.title ?? note.title}
                        onSave={saveTitle}
                    />
                    {note.url ? (
                        <Link target="_blank" className="link" to={note.url} rel="noopener noreferrer nofollow">
                            {new URL(note.url).hostname}
                        </Link>
                    ) : null}
                    <span className="flex items-center gap-2 text-sm">
                        <Tag size="small">Read it later</Tag>-
                        <time dateTime={note.createdAt.toISOString()}>{Dates.yearMonthDay(note.createdAt)}</time>-
                        <i>{getReadingTime(note.content).formatted}</i>
                    </span>
                </header>
            ) : null}

            {note.noteType === "read-it-later" ? null : (
                <header className="writeme-editor-column border-b border-card-border print:hidden">
                    <EditableNoteTitle
                        key={`${note.id}:${markdownTitle?.title ?? note.title}`}
                        value={markdownTitle?.title ?? note.title}
                        onSave={saveTitle}
                    />
                </header>
            )}
            <EditorModeToggle
                mode={editorMode}
                vimMode={rawEditorVimMode}
                onChange={changeEditorMode}
                onVimModeChange={changeRawEditorVimMode}
            />
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
