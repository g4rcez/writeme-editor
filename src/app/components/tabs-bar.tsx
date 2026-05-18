import { css } from "@g4rcez/components";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useGlobalStore } from "@/store/global.store";
import { Tab } from "@/store/repositories/entities/tab";
import { Note } from "@/store/note";

export const TabsBar: React.FC = () => {
  const [state, dispatch] = useGlobalStore();
  const params = useParams<{ noteId: string }>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const renameEscapedRef = useRef(false);
  const renameCommittedRef = useRef(false);

  const onCloseTab = async (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    e.preventDefault();
    dispatch.removeTab(tabId);
  };

  const onMiddleClick = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.button === 1) {
      onCloseTab(e, tabId);
    }
  };

  const commitRename = async (noteId: string) => {
    if (renameEscapedRef.current) {
      renameEscapedRef.current = false;
      setRenamingNoteId(null);
      return;
    }
    if (renameCommittedRef.current) return;
    renameCommittedRef.current = true;
    const note = state.notes.find((n: Note) => n.id === noteId);
    if (!note) {
      renameCommittedRef.current = false;
      setRenamingNoteId(null);
      return;
    }
    const trimmed = renamingValue.trim();
    if (trimmed && trimmed !== note.title) {
      const parsed = Note.parse(note);
      parsed.setTitle(trimmed);
      await dispatch.note(parsed);
    }
    renameCommittedRef.current = false;
    setRenamingNoteId(null);
  };

  useEffect(() => {
    if (state.activeTabId && scrollRef.current) {
      const activeElement = scrollRef.current.querySelector(
        `[data-tab-id="${state.activeTabId}"]`,
      );
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "nearest",
        });
      }
    }
  }, [state.activeTabId]);

  return (
    <div
      ref={scrollRef}
      className="flex tab-scrollbar overflow-x-auto sticky top-0 flex-row items-center mx-auto w-full h-11 md:h-9 select-none print:hidden z-navbar bg-background isolate border-b border-border/20"
    >
      {state.tabs.map((tab: Tab) => {
        const note = state.notes.find((n: Note) => n.id === tab.noteId);
        const isActive = params?.noteId === tab.noteId;
        const title = note?.title || "Untitled";
        return (
          <Link
            key={tab.id}
            data-tab-id={tab.id}
            title={note?.filePath || title}
            to={tab.noteId ? `/note/${tab.noteId}` : "#"}
            onMouseDown={(e) => onMiddleClick(e, tab.id)}
            onClick={(e) => {
              if (renamingNoteId === tab.noteId || isActive) e.preventDefault();
            }}
            className={css(
              "group flex border-r border-card-border items-center min-w-24 max-w-xs h-full px-2.5 gap-1.5 cursor-pointer transition-[color,background-color] relative",
              isActive
                ? "bg-muted/30 text-foreground"
                : "bg-transparent text-foreground/50 hover:text-foreground/80 hover:bg-muted/10",
            )}
          >
            {renamingNoteId === tab.noteId ? (
              <input
                autoFocus
                className="flex-1 text-xs bg-transparent outline-none min-w-0"
                value={renamingValue}
                onChange={(e) => setRenamingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    commitRename(tab.noteId);
                  }
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    renameEscapedRef.current = true;
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                onBlur={() => void commitRename(tab.noteId)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="flex-1 text-xs truncate"
                tabIndex={0}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  renameCommittedRef.current = false;
                  setRenamingNoteId(tab.noteId);
                  setRenamingValue(title);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "F2") {
                    e.preventDefault();
                    renameCommittedRef.current = false;
                    setRenamingNoteId(tab.noteId);
                    setRenamingValue(title);
                  }
                }}
              >
                {title}
              </span>
            )}
            <button
              aria-label={`Close ${title}`}
              onClick={(e) => onCloseTab(e, tab.id)}
              className={css(
                "p-0.5 rounded transition-opacity hover:bg-foreground/10",
                isActive
                  ? "opacity-60 group-hover:opacity-100"
                  : "opacity-0 group-hover:opacity-100",
              )}
            >
              <XIcon className="size-2.5" />
            </button>
            {isActive && (
              <div className="absolute bottom-0 right-0 left-0 h-hairline bg-primary" />
            )}
          </Link>
        );
      })}
    </div>
  );
};
