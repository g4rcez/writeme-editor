import { Empty, Input, Modal, css } from "@g4rcez/components";
import { Shortcut } from "@g4rcez/components/components/display/shortcut";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { FolderSimpleIcon } from "@phosphor-icons/react/dist/csr/FolderSimple";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useListSearch } from "@/app/hooks/use-list-search";
import { Dates } from "@/lib/dates";
import { formatSimplifiedPath, getRelativePath } from "@/lib/file-utils";
import { useGlobalStore } from "@/store/global.store";
import type { Note } from "@/store/note";
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
        const pathMatch = note.filePath
          ? note.filePath.toLowerCase().includes(lowerQuery)
          : false;

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
      const selectedElement = listRef.current.children[
        selectedIndex
      ] as HTMLElement;
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
      className="max-w-5xl"
      bodyClassName="overflow-hidden p-0"
    >
      <div className="flex h-[70vh] min-h-96 flex-col overflow-hidden">
        <div className="border-b border-floating-border px-6 py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Jump back into a note from this workspace.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Move</span>
              <Shortcut value="↑ + ↓" />
              <span>Open</span>
              <Shortcut value="Enter" />
              <span>Close</span>
              <Shortcut value="Esc" />
            </div>
          </div>

          <Input
            ref={inputRef}
            type="text"
            title="Search recent notes"
            hiddenLabel
            left={
              <MagnifyingGlassIcon className="size-4 text-muted-foreground" />
            }
            placeholder="Search recent notes..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
          />

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {resultLabel}
          </p>
        </div>

        {filteredNotes.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12">
            <Empty
              Icon={MagnifyingGlassIcon}
              message={
                query
                  ? "No recent notes match your search"
                  : "No recent notes yet"
              }
            />
          </div>
        ) : (
          <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-3">
            {filteredNotes.map((note: Note, index) => {
              const relativePath =
                note.filePath && storageDir
                  ? getRelativePath(storageDir, note.filePath)
                  : "";
              const folderPath = relativePath.includes("/")
                ? relativePath.substring(0, relativePath.lastIndexOf("/"))
                : "";
              const displayPath = formatSimplifiedPath(folderPath);
              const selected = index === selectedIndex;

              return (
                <li key={note.id}>
                  <button
                    type="button"
                    className={css(
                      "group flex w-full items-center gap-3 rounded-card-radius border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-primary/30 bg-primary/10"
                        : "border-transparent hover:border-card-border hover:bg-muted/40",
                    )}
                    onClick={() => openNote(note)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span
                      className={css(
                        "flex size-9 shrink-0 items-center justify-center rounded-button-radius transition-colors",
                        selected
                          ? "bg-primary/15 text-primary"
                          : "bg-muted/60 text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      <FileTextIcon size={18} />
                    </span>

                    <span className="min-w-0 flex-1">
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

                    <span className="ml-3 hidden shrink-0 items-center gap-1 rounded-button-radius border border-card-border px-2 py-1 text-xs text-muted-foreground sm:flex">
                      <ClockCounterClockwiseIcon size={13} />
                      {Dates.yearMonthDay(new Date(note.updatedAt))}
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
