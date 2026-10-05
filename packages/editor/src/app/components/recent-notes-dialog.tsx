import { Empty, Input, Modal, Shortcut, css } from "@g4rcez/components";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { FolderSimpleIcon } from "@phosphor-icons/react/dist/csr/FolderSimple";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Note } from "@/store/note";
import { useListSearch } from "@/app/hooks/use-list-search";
import { Dates } from "@/lib/dates";
import { formatSimplifiedPath, getRelativePath } from "@/lib/file-utils";
import { useGlobalStore } from "@/store/global.store";
import { SettingsService } from "@/store/settings";

export const RecentNotesDialog = () => {
    const [state, dispatch] = useGlobalStore();
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const navigate = useNavigate();

    const closeDialog = useCallback(() => {
        dispatch.recentNotesDialog(false);
    }, [dispatch]);

    const openNote = useCallback(
        (note: Note) => {
            navigate(`/note/${note.id}`);
            closeDialog();
        },
        [navigate, closeDialog],
    );

    useEffect(() => {
        if (state.recentNotesDialog) {
            dispatch.loadRecentNotes();
            setQuery("");
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [state.recentNotesDialog, dispatch]);

    const settings = SettingsService.load();
    const storageDir = settings.directory || "";

    const filteredNotes = useMemo(
        () =>
            state.recentNotes.filter((note: Note) => {
                if (!query) return true;
                const lowerQuery = query.toLowerCase();
                const titleMatch = note.title.toLowerCase().includes(lowerQuery);
                const pathMatch = note.filePath ? note.filePath.toLowerCase().includes(lowerQuery) : false;

                return titleMatch || pathMatch;
            }),
        [query, state.recentNotes],
    );

    const { selectedIndex, setSelectedIndex } = useListSearch({
        items: filteredNotes,
        onSelect: openNote,
        isOpen: state.recentNotesDialog,
    });

    useEffect(() => {
        if (listRef.current && filteredNotes.length > 0) {
            const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: "nearest" });
            }
        }
    }, [selectedIndex, filteredNotes]);

    const resultLabel = query
        ? `${filteredNotes.length} of ${state.recentNotes.length} notes`
        : `${state.recentNotes.length} recent notes`;

    return (
        <Modal
            open={state.recentNotesDialog}
            onChange={(val) => dispatch.recentNotesDialog(val)}
            title="Recent Notes"
            className="max-w-4xl focus-visible:!outline-none focus-visible:!ring-0 [&_h2]:!px-5 [&_h2]:!pb-4 [&_h2]:!text-3xl [&_h2]:!leading-tight"
            bodyClassName="overflow-hidden bg-background p-0"
        >
            <div className="flex h-[64vh] min-h-[32rem] flex-col overflow-hidden">
                <div className="border-b border-floating-border px-5 py-4">
                    <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <p className="text-sm text-muted-foreground">Jump back into a note from this workspace.</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>Move</span>
                            <Shortcut value="↑ ↓" />
                            <span>Open</span>
                            <Shortcut value="Enter" />
                            <span>Close</span>
                            <Shortcut value="Esc" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                            <Input
                                ref={inputRef}
                                type="text"
                                title="Search recent notes"
                                hiddenLabel
                                left={<MagnifyingGlassIcon className="size-4 text-muted-foreground" />}
                                placeholder="Search title or folder..."
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                }}
                            />
                        </div>
                        <span className="shrink-0 rounded-button-radius border border-card-border bg-muted/35 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            {resultLabel}
                        </span>
                    </div>
                </div>

                {filteredNotes.length === 0 ? (
                    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12">
                        <Empty
                            Icon={MagnifyingGlassIcon}
                            message={query ? "No recent notes match your search" : "No recent notes yet"}
                        />
                    </div>
                ) : (
                    <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
                        {filteredNotes.map((note: Note, index) => {
                            const relativePath =
                                note.filePath && storageDir ? getRelativePath(storageDir, note.filePath) : "";
                            const folderPath = relativePath.includes("/")
                                ? relativePath.substring(0, relativePath.lastIndexOf("/"))
                                : "";
                            const displayPath = formatSimplifiedPath(folderPath);
                            const selected = index === selectedIndex;
                            const updatedAt = Dates.yearMonthDay(new Date(note.updatedAt));

                            return (
                                <li key={note.id}>
                                    <button
                                        type="button"
                                        className={css(
                                            "group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-button-radius border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                            selected
                                                ? "border-primary/35 bg-primary/10"
                                                : "border-transparent hover:border-card-border hover:bg-muted/40",
                                        )}
                                        onClick={() => openNote(note)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        <span
                                            className={css(
                                                "flex size-8 shrink-0 items-center justify-center rounded-button-radius transition-colors",
                                                selected
                                                    ? "bg-primary/15 text-primary"
                                                    : "bg-muted/60 text-muted-foreground group-hover:text-foreground",
                                            )}
                                        >
                                            <FileTextIcon size={17} />
                                        </span>

                                        <span className="min-w-0">
                                            <span
                                                className={css(
                                                    "block truncate text-sm font-semibold",
                                                    selected ? "text-primary" : "text-foreground",
                                                )}
                                            >
                                                {note.title || "Untitled"}
                                            </span>
                                            {displayPath ? (
                                                <span className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                                                    <FolderSimpleIcon size={13} className="shrink-0" />
                                                    <span className="truncate">{displayPath}</span>
                                                </span>
                                            ) : null}
                                        </span>

                                        <span
                                            className={css(
                                                "hidden shrink-0 items-center gap-1 text-xs sm:flex",
                                                selected ? "text-foreground/80" : "text-muted-foreground",
                                            )}
                                        >
                                            <ClockCounterClockwiseIcon size={13} />
                                            {updatedAt}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </Modal>
    );
};
