import { Button, Checkbox, Tag } from "@g4rcez/components";
import { BracketsCurlyIcon } from "@phosphor-icons/react/dist/csr/BracketsCurly";
import { ColumnsIcon } from "@phosphor-icons/react/dist/csr/Columns";
import { PrinterIcon } from "@phosphor-icons/react/dist/csr/Printer";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import clsx from "clsx";
import { type PropsWithChildren, lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { saveNoteTitle } from "@/app/note-title";
import { notificationRef } from "@/app/notification-ref";
import { useVimSettings } from "@/app/vim/use-vim-settings";
import { FEATURES } from "@/lib/build-features";
import { Dates } from "@/lib/dates";
import { OPEN_EDITOR_NOTE_EVENT, ACTIVE_EDITOR_NOTE_EVENT } from "@/lib/editor-tab-drag";
import { getReadingTime } from "@/lib/file-utils";
import { isElectron } from "@/lib/is-electron";
import { findFirstMarkdownH1 } from "@/lib/markdown-title";
import { resolveNoteLinks } from "@/lib/note-links";
import { isNoteRouteTabOpenSuppressed } from "@/lib/note-route-tab-open-suppression";
import { isMobile } from "@/lib/platform";
import { printDocument } from "@/lib/print-document";
import { isNoteTabForNoteId } from "@/lib/tab-target";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import { type EditorMode, SettingsService } from "@/store/settings";
import { uiDispatch, useUIStore } from "@/store/ui.store";
import { isLatexFilePath } from "@/types/workspace-files";
import { EditorDropTarget } from "../components/editor-drop-target";
import { EditorPanes } from "../components/editor-panes";
import { ExcalidrawNoteView } from "../components/excalidraw-note-view";
import { FreehandNoteView } from "../components/freehand-note-view";
import { MeetingNotePanel } from "../components/meeting-note-panel";
import { NoteFooter } from "../components/note-footer";
import { NoteHistoryButton, NoteHistoryDialog } from "../components/note-history-dialog";
import { NoteToolTooltip } from "../components/note-tool-tooltip";
import { SendResearchExcerpt } from "../components/send-research-excerpt";
import { TableOfContents } from "../components/table-of-contents";
import { TaskNoteView } from "../components/task-note-view";
import { Editor } from "../editor";
import { JsonGraph } from "../elements/json-graph/json-graph";
import { addFrontmatterToCurrentEditor } from "../frontmatter";
import { useAgendaSource } from "../hooks/use-agenda-source";
import { useEditorPanes } from "../hooks/use-editor-panes";

const PdfNoteView = lazy(() =>
    import("../components/pdf-note-view").then((module) => ({ default: module.PdfNoteView })),
);

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
    <div className={`writeme-editor-page @container${props.paneMode ? " writeme-editor-page--panes" : ""}`}>
        {props.children}
    </div>
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
        <fieldset className="m-0 flex min-w-0 items-center gap-1 border-0 p-0">
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
                        className="h-8 min-h-8 max-sm:h-11 max-sm:min-h-11 pointer-coarse:h-11 pointer-coarse:min-h-11"
                    >
                        {item.label}
                    </Button>
                );
            })}
        </fieldset>
    );
};

const VimModeToggle = ({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) => {
    return (
        <Checkbox
            size="tiny"
            checked={enabled}
            id="markdown-vim-mode"
            container="inline-flex min-h-8 shrink-0 items-center whitespace-nowrap text-xs text-muted-foreground max-sm:min-h-11 pointer-coarse:min-h-11"
            onChange={(event) => onChange(event.target.checked)}
        >
            Vim mode
        </Checkbox>
    );
};

function AddFrontmatterButton() {
    return (
        <NoteToolTooltip title="Add frontmatter" description="Add a metadata block at the start of this note.">
            <Button
                type="button"
                size="icon"
                theme="ghost-muted"
                className="size-8 min-h-8 shrink-0 max-sm:size-11 max-sm:min-h-11 pointer-coarse:size-11 pointer-coarse:min-h-11 text-base"
                aria-label="Add frontmatter"
                icon={<BracketsCurlyIcon aria-hidden="true" />}
                onClick={addFrontmatterToCurrentEditor}
            />
        </NoteToolTooltip>
    );
}

function EditorPaneToggleButton({ open, onChange }: { open: boolean; onChange: () => void }) {
    return (
        <NoteToolTooltip
            title={open ? "Exit pane mode" : "Open pane mode"}
            description={open ? "Return to a single editor." : "Open notes side by side in editor panes."}
        >
            <Button
                type="button"
                size="icon"
                theme={open ? "primary" : "ghost-muted"}
                className="size-8 min-h-8 shrink-0 max-sm:size-11 max-sm:min-h-11 pointer-coarse:size-11 pointer-coarse:min-h-11 text-base"
                aria-label={open ? "Exit pane mode" : "Open pane mode"}
                aria-pressed={open}
                icon={<ColumnsIcon aria-hidden="true" />}
                onClick={onChange}
            />
        </NoteToolTooltip>
    );
}

function ExportNoteButton({ note }: { note: Note }) {
    if (isMobile()) return null;
    return (
        <NoteToolTooltip title="Export document" description="Print this note or save it as a PDF.">
            <Button
                type="button"
                size="icon"
                theme="ghost-muted"
                className="size-8 min-h-8 shrink-0 max-sm:size-11 max-sm:min-h-11 pointer-coarse:size-11 pointer-coarse:min-h-11 text-base"
                aria-label={`Export ${note.title}`}
                icon={<PrinterIcon aria-hidden="true" />}
                onClick={() => printDocument({ title: note.title })}
            />
        </NoteToolTooltip>
    );
}

function FavoriteNoteButton({
    note,
    disabled,
    onToggle,
    className = "",
}: {
    note: Note;
    disabled: boolean;
    onToggle: () => void;
    className?: string;
}) {
    const label = note.favorite ? "Remove from favorites" : "Add to favorites";

    return (
        <NoteToolTooltip
            title={label}
            description={
                note.favorite
                    ? "Remove this note from your favorites list."
                    : "Keep this note in your favorites list for quick access."
            }
        >
            <Button
                type="button"
                size="icon"
                theme="ghost-muted"
                className={clsx(
                    "size-8 min-h-8 shrink-0 max-sm:size-11 max-sm:min-h-11 pointer-coarse:size-11 pointer-coarse:min-h-11 text-base",
                    note.favorite && "text-warn",
                    className,
                )}
                aria-label={label}
                aria-pressed={note.favorite}
                disabled={disabled}
                icon={<StarIcon weight={note.favorite ? "fill" : "regular"} aria-hidden="true" />}
                onClick={onToggle}
            />
        </NoteToolTooltip>
    );
}

export default function NotePage() {
    const [uiState] = useUIStore();
    const [state, dispatch] = useGlobalStore();
    const params = useParams<{ noteId: string }>();
    const id = params.noteId;
    const note = state.note;
    useAgendaSource(note?.id === id ? (id ?? null) : null);
    const hasRouteNoteTab = id ? state.tabs.some((tab) => isNoteTabForNoteId(tab, id)) : false;
    const isLoading = note === null;
    const [editorMode, setEditorMode] = useState<EditorMode>(() => SettingsService.load().editorMode);
    const vimSettings = useVimSettings();
    const [pendingVimMode, setPendingVimMode] = useState<boolean | null>(null);
    const vimSaveVersion = useRef(0);
    const vimMode = pendingVimMode ?? vimSettings.enabled;
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
            if (
                !selected ||
                selected.noteType === NoteType.json ||
                selected.noteType === NoteType.excalidraw ||
                selected.noteType === NoteType.freehand ||
                selected.noteType === NoteType.pdf ||
                selected.noteType === NoteType["meeting-note"]
            )
                return;
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
    const changeVimMode = useCallback((nextVimMode: boolean): void => {
        const version = ++vimSaveVersion.current;
        setPendingVimMode(nextVimMode);
        void SettingsService.save({ vimMode: nextVimMode })
            .catch((error: unknown) => {
                uiDispatch.setAlert({
                    open: true,
                    type: "error",
                    message: error instanceof Error ? error.message : String(error),
                });
            })
            .finally(() => {
                if (version === vimSaveVersion.current) setPendingVimMode(null);
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
    const markdownTitle =
        !isLatexSource && note && !note.metadata.commentSourceId ? findFirstMarkdownH1(note.content || "") : null;
    const markdownTitleText = markdownTitle?.title;
    useEffect(() => {
        if (!note?.id || !markdownTitleText || markdownTitleText === note.title) return;
        void dispatch.updateNoteTitle(note.id, markdownTitleText);
    }, [dispatch, markdownTitleText, note?.id, note?.title]);

    const saveTitle = useCallback(
        async (title: string): Promise<void> => {
            if (!note) return;
            await saveNoteTitle(note, title, dispatch);
        },
        [dispatch, note],
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
    const isFreehand = note.noteType === NoteType.freehand;
    const isTask = note.noteType === NoteType.task;
    const isPdf = note.noteType === NoteType.pdf;
    const isHistoryEligible = note.noteType === NoteType.note && !isLatexSource;
    const activeEditorMode: EditorMode = isLatexSource ? "markdown" : editorMode;
    const fileName = note.filePath?.split(/[\\/]/).filter(Boolean).at(-1);
    const hasRichEditor = !isJson && !isExcalidraw && !isFreehand && !isPdf && !isTask;

    const noteToolbar = (
        <div
            className={clsx(
                "mx-auto flex min-h-9 w-full min-w-0 max-w-3xl items-center justify-between gap-2 border-b border-border/50 bg-background print:hidden",
                "@max-2xl:relative @max-2xl:flex-col @max-2xl:justify-center @max-2xl:gap-y-1 @max-2xl:py-2",
                paneMode ? "shrink-0 px-4" : "px-3",
            )}
            role="toolbar"
            aria-label="Note tools"
        >
            <div className="order-1 flex min-w-0 shrink-0 items-center justify-start @max-2xl:order-2 @max-2xl:w-full @max-2xl:justify-center">
                {hasRichEditor ? (
                    <div className="flex min-w-0 max-w-full flex-nowrap items-center gap-3 @max-2xl:w-full @max-2xl:justify-center">
                        {isLatexSource ? null : <EditorModeToggle mode={editorMode} onChange={changeEditorMode} />}
                        <VimModeToggle enabled={vimMode} onChange={changeVimMode} />
                    </div>
                ) : null}
            </div>
            <span
                className="order-2 min-w-0 max-w-xs flex-1 truncate text-center text-sm font-medium text-foreground/80 @max-2xl:order-1 @max-2xl:w-full @max-2xl:flex-none"
                title={note.filePath ?? undefined}
            >
                {fileName || note.title || "Untitled"}
            </span>
            <fieldset className="order-3 m-0 flex shrink-0 flex-nowrap items-center justify-end gap-1 border-0 p-0 @max-2xl:w-full @max-2xl:justify-center">
                <legend className="sr-only">Note actions</legend>
                {hasRichEditor && !isLatexSource ? <AddFrontmatterButton /> : null}
                {isHistoryEligible ? <NoteHistoryButton onClick={() => setHistoryOpen(true)} /> : null}
                <FavoriteNoteButton note={note} disabled={favoriteSaving} onToggle={toggleFavorite} />
                {hasRichEditor ? (
                    <>
                        {note.noteType !== NoteType["meeting-note"] ? (
                            <EditorPaneToggleButton open={paneMode} onChange={togglePaneMode} />
                        ) : null}
                        <TableOfContents />
                        <ExportNoteButton note={note} />
                    </>
                ) : null}
            </fieldset>
        </div>
    );

    if (isPdf)
        return (
            <Suspense fallback={<p role="status">Opening PDF…</p>}>
                <PdfNoteView
                    key={note.id}
                    note={note}
                    actions={<FavoriteNoteButton note={note} disabled={favoriteSaving} onToggle={toggleFavorite} />}
                />
            </Suspense>
        );

    if (isTask)
        return (
            <TaskNoteView
                key={note.id}
                note={note}
                actions={<FavoriteNoteButton note={note} disabled={favoriteSaving} onToggle={toggleFavorite} />}
            />
        );

    if (isFreehand) {
        return (
            <FreehandNoteView
                key={note.id}
                note={note}
                actions={
                    <FavoriteNoteButton
                        note={note}
                        disabled={favoriteSaving}
                        onToggle={toggleFavorite}
                        className="min-h-11 min-w-11"
                    />
                }
            />
        );
    }

    if (isJson || isExcalidraw) {
        return (
            <div className="@container -my-8 flex h-[calc(100%+4rem)] min-h-0 w-full flex-col bg-background">
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
                    <SendResearchExcerpt key={note.id} source={{ kind: "article", note }} />
                </header>
            ) : !fileName || note.tags.length > 0 ? (
                <header className="writeme-editor-column writeme-note-header empty:border-b-transparent border-b border-border/50 print:hidden">
                    <div className="writeme-note-metadata">
                        {!fileName ? <span>Local note</span> : null}
                        {note.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-primary">
                                #{tag}
                            </span>
                        ))}
                    </div>
                </header>
            ) : null}
            {isHistoryEligible && historyOpen ? (
                <NoteHistoryDialog
                    open
                    note={note}
                    onClose={() => setHistoryOpen(false)}
                    onRestored={(restored) => dispatch.syncNoteState(restored)}
                />
            ) : null}
            {FEATURES.meetingNotes && !isMobile() && note.noteType === NoteType["meeting-note"] ? (
                <MeetingNotePanel key={note.id} note={note} />
            ) : null}
            {editorPanes.state ? (
                <EditorPanes
                    state={editorPanes.state}
                    notes={state.notes}
                    currentNote={note}
                    editorMode={activeEditorMode}
                    vimMode={vimMode}
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
                        vimMode={vimMode}
                    />
                </EditorDropTarget>
            )}
            <NoteReferences note={note} notes={state.notes ?? []} />
            <NoteFooter noteId={note.id} />
        </Wrapper>
    );
}
