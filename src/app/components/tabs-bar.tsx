import React, { useCallback, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { useGlobalStore } from "../../store/global.store";
import { Tab } from "../../store/repositories/dexie/dexie-db";
import { clsx } from "clsx";

export const TabsBar: React.FC = () => {
  const [state, dispatch] = useGlobalStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTabClick = useCallback(
    (tab: Tab) => {
      dispatch.activeTabId(tab.id);
      // Also need to set the current note in the store
      const note = state.notes.find((n) => n.id === tab.noteId);
      if (note) {
        dispatch.setNote(note);
      }
    },
    [dispatch, state.notes]
  );

  const handleCloseTab = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      dispatch.removeTab(tabId);
    },
    [dispatch]
  );

  const handleMiddleClick = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      if (e.button === 1) {
        dispatch.removeTab(tabId);
      }
    },
    [dispatch]
  );

  // Scroll active tab into view
  useEffect(() => {
    if (state.activeTabId && scrollRef.current) {
      const activeElement = scrollRef.current.querySelector(
        `[data-tab-id="${state.activeTabId}"]`
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

  if (state.tabs.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="flex flex-row items-center w-full h-10 bg-background border-b border-border overflow-x-auto scrollbar-none select-none"
    >
      {state.tabs.map((tab) => {
        const note = state.notes.find((n) => n.id === tab.noteId);
        const isActive = state.activeTabId === tab.id;
        const title = note?.title || "Untitled";

        return (
          <div
            key={tab.id}
            data-tab-id={tab.id}
            onClick={() => handleTabClick(tab)}
            onMouseDown={(e) => handleMiddleClick(e, tab.id)}
            className={clsx(
              "group flex items-center min-w-32 max-w-xs h-full px-3 gap-2 border-r border-border cursor-pointer transition-colors relative",
              isActive
                ? "bg-muted text-foreground"
                : "bg-background text-muted-foreground hover:bg-muted/50"
            )}
            title={note?.filePath || title}
          >
            <span className="truncate text-sm flex-1">{title}</span>
            <button
              onClick={(e) => handleCloseTab(e, tab.id)}
              className="p-0.5 rounded-md hover:bg-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </div>
        );
      })}
    </div>
  );
};
