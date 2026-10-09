import { Button, Checkbox, Tag } from "@g4rcez/components";
import { BracketsCurlyIcon } from "@phosphor-icons/react/dist/csr/BracketsCurly";
import { ColumnsIcon } from "@phosphor-icons/react/dist/csr/Columns";
import { PrinterIcon } from "@phosphor-icons/react/dist/csr/Printer";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { notificationRef } from "@/app/notification-ref";
import { Dates } from "@/lib/dates";
import { OPEN_EDITOR_NOTE_EVENT, ACTIVE_EDITOR_NOTE_EVENT } from "@/lib/editor-tab-drag";
import { getReadingTime } from "@/lib/file-utils";
import { isElectron } from "@/lib/is-electron";
import { findFirstMarkdownH1, replaceFirstMarkdownH1 } from "@/lib/markdown-title";
import { resolveNoteLinks } from "@/lib/note-links";
import { isNoteRouteTabOpenSuppressed } from "@/lib/note-route-tab-open-suppression";
import { printDocument } from "@/lib/print-document";
import { isNoteTabForNoteId } from "@/lib/tab-target";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import { type EditorMode, SettingsService } from "@/store/settings";
import { useUIStore } from "@/store/ui.store";
import { isLatexFilePath } from "@/types/workspace-files";
import { EditorDropTarget } from "../components/editor-drop-target";
import { EditorPanes } from "../components/editor-panes";
import { ExcalidrawNoteView } from "../components/excalidraw-note-view";
import { NoteFooter } from "../components/note-footer";
import { NoteHistoryButton, NoteHistoryDialog } from "../components/note-history-dialog";
import { TableOfContents } from "../components/table-of-contents";
import { Editor } from "../editor";
import { JsonGraph } from "../elements/json-graph/json-graph";
import { addFrontmatterToCurrentEditor } from "../frontmatter";
import { useEditorPanes } from "../hooks/use-editor-panes";

function getUrlLabel(value: string): string {
    try {
        return new URL(value).hostname || value;
    } catch {
        return value;
    }
}

function NoteReferences({ note, notes }: { note: Note; notes: Note[] }) {
    const refs = resolveNoteLinks(note, notes);
    if (refs.length === 0) return null;
    return (
        <footer className="my-4 flex flex-col gap-2 border-t border-card-border py-4">
            <p className="text-sm font-medium text-muted-foreground">Linked notes</p>
            <ul className="flex flex-wrap gap-2">
                {refs.map(({ note: ref }) => (
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

const Wrapper = (props: PropsWithChildren<{ paneMode?: boolean }>) => (
    <div className={`writeme-editor-page${props.paneMode ? " writeme-editor-page--panes" : ""}`}>{props.children}</div>
);

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
                className="writeme-note-title-editor w-full border-0 border-b border-transparent bg-transparent px-0 py-2 text-3xl font-semibold tracking-tight text-foreground transition-colors outline-none placeholder:text-muted-foreground/60 hover:border-border focus:border-primary focus-visible:ring-0"
            />
        </div>
    );
}

const EditorModeToggle = ({ mode, onChange }: { mode: EditorMode; onChange: (mode: EditorMode) => void }) => {
    const modes: Array<{ value: EditorMode; label: string }> = [
        { value: "formatted", label: "Formatted" },
        { value: "markdown", label: "Markdown" },
    ];

    return (
        <fieldset className="writeme-editor-mode-toggle">
            <legend className="sr-only">Editor mode</legend>
            {modes.map((item) => {
                const active = item.value === mode;
                return (
                    <Button
                        size="min"
                        type="button"
                        key={item.value}
                        aria-pressed={active}
                        onClick={() => onChange(item.value)}
                        theme={active ? "ghost-primary" : "ghost-muted"}
                    >
                        {item.label}
                    </Button>
                );
            })}
        </fieldset>
    );
};

const MarkdownVimModeToggle = ({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) => {
    return (
        <Checkbox
            size="tiny"
            checked={enabled}
            id="markdown-vim-mode"
            container="writeme-markdown-vim-mode-toggle"
            onChange={(event) => onChange(event.target.checked)}
        >
            Vim mode
        </Checkbox>
    );
};

function AddFrontmatterButton() {
    return (
        <Button
            type="button"
            size="icon"
            theme="ghost-muted"
            className="writeme-note-tool-button"
            aria-label="Add frontmatter"
            title="Add Markdown frontmatter"
            icon={<BracketsCurlyIcon aria-hidden="true" />}
            onClick={addFrontmatterToCurrentEditor}
        />
    );
}

function EditorPaneToggleButton({ open, onChange }: { open: boolean; onChange: () => void }) {
    return (
        <Button
            type="button"
            size="icon"
            theme={open ? "primary" : "ghost-muted"}
            className="writeme-note-tool-button"
            aria-label={open ? "Exit pane mode" : "Open pane mode"}
            aria-pressed={open}
            title={open ? "Exit pane mode" : "Open pane mode"}
            icon={<ColumnsIcon aria-hidden="true" />}
            onClick={onChange}
        />
    );
}

function ExportNoteButton({ note }: { note: Note }) {
    return (
        <Button
            type="button"
            size="icon"
            theme="ghost-muted"
            className="writeme-note-tool-button"
            aria-label={`Export ${note.title}`}
            title="Export document (print or save as PDF)"
            icon={<PrinterIcon aria-hidden="true" />}
            onClick={() => printDocument({ title: note.title })}
        />
    );
}

function FavoriteNoteButton({ note, disabled, onToggle }: { note: Note; disabled: boolean; onToggle: () => void }) {
    const label = note.favorite ? "Remove from favorites" : "Add to favorites";

    return (
        <Button
            type="button"
            size="icon"
            theme="ghost-muted"
            className={`writeme-note-tool-button ${note.favorite ? "text-warn" : ""}`}
            aria-label={label}
            aria-pressed={note.favorite}
            title={label}
            disabled={disabled}
            icon={<StarIcon weight={note.favorite ? "fill" : "regular"} aria-hidden="true" />}
            onClick={onToggle}
        />
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
    const [historyOpen, setHistoryOpen] = useState(false);
    const [favoriteSaving, setFavoriteSaving] = useState(false);
    const editorPanes = useEditorPanes(
        id ?? null,
        state.notes,
        state.tabs.filter((tab) => isNoteTabForNoteId(tab, tab.noteId)).map((tab) => tab.noteId),
    );
    const paneMode = editorPanes.state !== null;
    useEffect(() => {
        const panes = editorPanes.state;
        if (!panes) return;
        const openNote = (event: Event): void => {
            if (!(event instanceof CustomEvent) || typeof event.detail !== "string") return;
            const selected = state.notes.find((note) => note.id === event.detail);
            if (!selected || selected.noteType === NoteType.json || selected.noteType === NoteType.excalidraw) return;
            event.preventDefault();
            editorPanes.selectNote(panes.activePaneId, selected.id);
        };
        window.dispatchEvent(
            new CustomEvent(ACTIVE_EDITOR_NOTE_EVENT, {
                detail: panes.panes.find((pane) => pane.id === panes.activePaneId)?.noteId,
            }),
        );
        window.addEventListener(OPEN_EDITOR_NOTE_EVENT, openNote);
        return () => {
            window.removeEventListener(OPEN_EDITOR_NOTE_EVENT, openNote);
            window.dispatchEvent(new CustomEvent(ACTIVE_EDITOR_NOTE_EVENT, { detail: null }));
        };
    }, [editorPanes.state, editorPanes.selectNote, state.notes]);
    const togglePaneMode = useCallback((): void => {
        if (paneMode) editorPanes.exit();
        else editorPanes.enter();
    }, [editorPanes, paneMode]);
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

    const isLatexSource = note ? isLatexFilePath(note.filePath) : false;
    const markdownTitle = !isLatexSource && note ? findFirstMarkdownH1(note.content || "") : null;
    const markdownTitleText = markdownTitle?.title;
    useEffect(() => {
        if (!note?.id || !markdownTitleText || markdownTitleText === note.title) return;
        void dispatch.updateNoteTitle(note.id, markdownTitleText);
    }, [dispatch, markdownTitleText, note?.id, note?.title]);

    const saveTitle = useCallback(
        async (title: string): Promise<void> => {
            if (!note) return;
            if (!isLatexSource) {
                const updatedContent = replaceFirstMarkdownH1(note.content || "", title);
                if (updatedContent !== null && updatedContent !== note.content) {
                    await dispatch.updateNoteContent(note.id, updatedContent);
                }
            }
            await dispatch.updateNoteTitle(note.id, title);
        },
        [dispatch, isLatexSource, note],
    );

    const toggleFavorite = useCallback(async (): Promise<void> => {
        if (!note || favoriteSaving) return;
        setFavoriteSaving(true);
        const updatedNote = Note.parse({ ...note, favorite: !note.favorite });
        dispatch.syncNoteState(updatedNote);
        try {
            await repositories.notes.update(updatedNote.id, updatedNote);
        } catch (reason) {
            dispatch.syncNoteState(note);
            notificationRef.current?.(
                <span>{reason instanceof Error ? reason.message : "Failed to update favorites"}</span>,
                { theme: "danger", closable: true, timeout: 4000 },
            );
        } finally {
            setFavoriteSaving(false);
        }
    }, [dispatch, favoriteSaving, note]);

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
    const isHistoryEligible = note.noteType === NoteType.note && !isLatexSource;
    const activeEditorMode: EditorMode = isLatexSource ? "markdown" : editorMode;
    const fileName = note.filePath?.split(/[\\/]/).filter(Boolean).at(-1);
    const hasRichEditor = !isJson && !isExcalidraw;

    const noteToolbar = (
        <div className="writeme-note-toolbar" role="toolbar" aria-label="Note tools">
            <div className="writeme-note-toolbar-leading">
                {hasRichEditor ? (
                    <div className="writeme-note-editor-controls">
                        {isLatexSource ? null : <EditorModeToggle mode={editorMode} onChange={changeEditorMode} />}
                        {activeEditorMode === "markdown" ? (
                            <MarkdownVimModeToggle enabled={rawEditorVimMode} onChange={changeRawEditorVimMode} />
                        ) : null}
                    </div>
                ) : null}
            </div>
            <span className="writeme-note-toolbar-file-name" title={note.filePath ?? undefined}>
                {fileName || note.title || "Untitled"}
            </span>
            <fieldset className="writeme-note-actions-group writeme-note-toolbar-actions">
                <legend className="sr-only">Note actions</legend>
                {hasRichEditor && !isLatexSource ? <AddFrontmatterButton /> : null}
                {isHistoryEligible ? <NoteHistoryButton onClick={() => setHistoryOpen(true)} /> : null}
                <FavoriteNoteButton note={note} disabled={favoriteSaving} onToggle={toggleFavorite} />
                {hasRichEditor ? (
                    <>
                        <EditorPaneToggleButton open={paneMode} onChange={togglePaneMode} />
                        <TableOfContents />
                        <ExportNoteButton note={note} />
                    </>
                ) : null}
            </fieldset>
        </div>
    );

    if (isJson || isExcalidraw) {
        return (
            <div className="writeme-note-special-page -my-8 flex h-[calc(100%+4rem)] min-h-0 w-full flex-col bg-background">
                {noteToolbar}
                <header className="writeme-editor-column writeme-note-header border-b border-border/50 print:hidden">
                    <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                        {note.title || "Untitled"}
                    </h1>
                </header>
                <div className="flex min-h-0 flex-1">
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
            </div>
        );
    }

    return (
        <Wrapper paneMode={paneMode}>
            <PrintableNoteHeader note={note} />
            {noteToolbar}
            {note.noteType === "read-it-later" ? (
                <header className="writeme-editor-column writeme-note-header border-b border-border/50 print:hidden">
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
                    <div className="writeme-note-metadata">
                        <span>Reading list</span>
                        {note.url ? <span className="truncate">/ {getUrlLabel(note.url)}</span> : null}
                        <Tag size="small">Read it later</Tag>
                        <span aria-hidden="true">·</span>
                        <time dateTime={note.createdAt.toISOString()}>{Dates.yearMonthDay(note.createdAt)}</time>
                        <span aria-hidden="true">·</span>
                        <i>{getReadingTime(note.content).formatted}</i>
                    </div>
                </header>
            ) : (
                <header className="writeme-editor-column writeme-note-header border-b border-border/50 print:hidden">
                    <EditableNoteTitle
                        key={`${note.id}:${markdownTitle?.title ?? note.title}`}
                        value={markdownTitle?.title ?? note.title}
                        onSave={saveTitle}
                    />
                    {!fileName || note.tags.length > 0 ? (
                        <div className="writeme-note-metadata">
                            {!fileName ? <span>Local note</span> : null}
                            {note.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="text-primary">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    ) : null}
                </header>
            )}
            {isHistoryEligible && historyOpen ? (
                <NoteHistoryDialog
                    note={note}
                    open
                    onClose={() => setHistoryOpen(false)}
                    onRestored={(restored) => dispatch.syncNoteState(restored)}
                />
            ) : null}
            {editorPanes.state ? (
                <EditorPanes
                    state={editorPanes.state}
                    notes={state.notes}
                    currentNote={note}
                    editorMode={activeEditorMode}
                    rawEditorVimMode={rawEditorVimMode}
                    onActivate={editorPanes.activate}
                    onSelectNote={editorPanes.selectNote}
                    onAdd={editorPanes.add}
                    onRemove={editorPanes.remove}
                    onExit={editorPanes.exit}
                    canAdd={editorPanes.canAdd}
                    onDropTab={editorPanes.dropTab}
                    onCloseTab={editorPanes.closeTab}
                />
            ) : (
                <EditorDropTarget onDropTab={editorPanes.dropTab}>
                    <Editor
                        note={note}
                        key={note.id}
                        content={note.content || ""}
                        mode={activeEditorMode}
                        rawEditorVimMode={rawEditorVimMode}
                    />
                </EditorDropTarget>
            )}
            <NoteReferences note={note} notes={state.notes ?? []} />
            <NoteFooter noteId={note.id} />
        </Wrapper>
    );
}
