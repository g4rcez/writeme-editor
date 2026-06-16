import type React from "react";
import { css } from "@g4rcez/components";
import { ChatCircleDotsIcon, FileTextIcon } from "@phosphor-icons/react";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { GlobalDispatchers } from "@/store/global.store";
import type { Tab } from "@/store/repositories/entities/tab";
import { getPreviousTabAfterClose } from "@/lib/tab-closing";
import { getCurrentRouteTabTarget, getRouteForTab, getTabTarget, isAiChatTab, isSameTabTarget } from "@/lib/tab-target";
import { Note } from "@/store/note";
import { useAiChatTabs } from "../hooks/use-ai-chat-tabs";
import { useNoteTabs } from "../hooks/use-note-tabs";

type Props = {
  tabs: Tab[];
  notes: Note[];
  directory: string | null;
  activeTabId: string | null;
  dispatch: GlobalDispatchers;
};

export const TabsBar = (props: Props) => {
  const dispatch = props.dispatch;
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const renameEscapedRef = useRef(false);
  const renameCommittedRef = useRef(false);
  const notesById = useNoteTabs(props.notes);
  const chatsById = useAiChatTabs(props.directory, props.tabs);
  const currentTarget = useMemo(
    () => getCurrentRouteTabTarget(location.pathname, location.search),
    [location.pathname, location.search],
  );

  const navigateToTab = async (tab: Tab): Promise<void> => {
    const target = getTabTarget(tab);
    if (target.type === "note") {
      await dispatch.selectNoteById(target.id);
    } else {
      await dispatch.addAiChatTab(target.id);
    }
    navigate(getRouteForTab(tab));
  };

  const isCurrentTab = (tab: Tab): boolean => {
    if (currentTarget) {
      return isSameTabTarget(getTabTarget(tab), currentTarget);
    }
    return props.activeTabId === tab.id;
  };

  const onCloseTab = async (e: React.MouseEvent, tab: Tab) => {
    e.stopPropagation();
    e.preventDefault();
    const isClosingCurrentTab = isCurrentTab(tab);
    const nextTab = getPreviousTabAfterClose(props.tabs, tab.id);
    await dispatch.removeTab(tab.id);
    if (!isClosingCurrentTab) return;
    if (nextTab) {
      await navigateToTab(nextTab);
      return;
    }
    dispatch.setNote(null);
    navigate("/");
  };

  const onMiddleClick = (e: React.MouseEvent, tab: Tab) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.button === 1) {
      void onCloseTab(e, tab);
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
    const note = notesById.get(noteId);
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
    if (props.activeTabId && scrollRef.current) {
      const activeElement = scrollRef.current.querySelector(`[data-tab-id="${props.activeTabId}"]`);
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "nearest",
        });
      }
    }
  }, [props.activeTabId]);

  return (
    <div
      ref={scrollRef}
      className="flex tab-scrollbar overflow-x-auto sticky top-0 flex-row items-center mx-auto w-full h-11 md:h-9 select-none print:hidden z-navbar bg-background isolate border-b border-border/20"
    >
      {props.tabs.map((tab: Tab) => {
        const isChatTab = isAiChatTab(tab);
        const note = isChatTab ? undefined : notesById.get(tab.noteId);
        const chat = isChatTab ? chatsById.get(tab.noteId) : undefined;
        const isActive = isCurrentTab(tab);
        const title = isChatTab ? chat?.title?.trim() || "AI Chat" : note?.title || "Untitled";
        const tabTitle = isChatTab ? title : note?.filePath || title;
        return (
          <Link
            key={tab.id}
            data-tab-id={tab.id}
            title={tabTitle}
            to={getRouteForTab(tab)}
            onMouseDown={(e) => onMiddleClick(e, tab)}
            onClick={(e) => {
              if (!isChatTab && renamingNoteId === tab.noteId) {
                e.preventDefault();
                return;
              }
            }}
            className={css(
              "group flex border-r border-card-border items-center min-w-28 max-w-xs h-full px-2.5 gap-1.5 cursor-pointer transition-[color,background-color] relative",
              isActive
                ? "bg-muted/30 text-foreground"
                : "bg-transparent text-foreground/50 hover:text-foreground/80 hover:bg-muted/10",
            )}
          >
            {isChatTab ? (
              <ChatCircleDotsIcon size={13} className="shrink-0 opacity-70" aria-hidden="true" />
            ) : (
              <FileTextIcon size={13} className="shrink-0 opacity-70" aria-hidden="true" />
            )}
            {!isChatTab && renamingNoteId === tab.noteId ? (
              <input
                autoFocus
                value={renamingValue}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => void commitRename(tab.noteId)}
                onChange={(e) => setRenamingValue(e.target.value)}
                className="flex-1 text-xs bg-transparent outline-none min-w-0"
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
              />
            ) : (
              <span
                className="flex-1 text-xs truncate"
                tabIndex={isChatTab ? undefined : 0}
                onDoubleClick={(e) => {
                  if (isChatTab) return;
                  e.preventDefault();
                  renameCommittedRef.current = false;
                  setRenamingNoteId(tab.noteId);
                  setRenamingValue(title);
                }}
                onKeyDown={(e) => {
                  if (isChatTab) return;
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
              type="button"
              aria-label={`Close ${title}`}
              onClick={(e) => void onCloseTab(e, tab)}
              className={css(
                "p-0.5 rounded transition-opacity hover:bg-foreground/10",
                isActive ? "opacity-60 group-hover:opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
            >
              <XIcon className="size-2.5" />
            </button>
            {isActive && <div className="absolute bottom-0 right-0 left-0 h-hairline bg-primary" />}
          </Link>
        );
      })}
    </div>
  );
};
