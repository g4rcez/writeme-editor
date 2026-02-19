import { css } from "@g4rcez/components";
import { FileText, XIcon } from "lucide-react";
import React, { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useGlobalStore } from "../../store/global.store";
import { Tab } from "@/store/repositories/entities/tab";
import { Note } from "@/store/note";

export const TabsBar: React.FC = () => {
  const [state, dispatch] = useGlobalStore();
  const params = useParams<{ noteId: string }>();
  const scrollRef = useRef<HTMLDivElement>(null);

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
      className="flex overflow-x-auto sticky flex-row items-center mx-auto w-full h-10 select-none z-navbar top-0 bg-background isolate scrollbar-none"
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
            className={css(
              "group flex items-center min-w-32 max-w-xs h-full px-3 gap-2 cursor-pointer transition-all relative",
              isActive
                ? "bg-background shadow-sm text-foreground"
                : "bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/20",
            )}
          >
            <FileText className="flex-shrink-0 w-3.5 h-3.5 opacity-60" />
            <span className="flex-1 text-xs truncate">{title}</span>
            <button
              onClick={(e) => onCloseTab(e, tab.id)}
              className="p-0.5 rounded-md opacity-0 transition-opacity group-hover:opacity-100 hover:bg-foreground/10"
            >
              <XIcon className="size-3" />
            </button>
            {isActive && (
              <div className="absolute bottom-0 right-2 left-2 h-0.5 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </div>
  );
};
