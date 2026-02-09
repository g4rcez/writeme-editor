import { clsx } from "clsx";
import { FileText, X } from "lucide-react";
import React, { useCallback, useEffect, useRef } from "react";
import { useGlobalStore } from "../../store/global.store";
import { Tab } from "../../store/repositories/dexie/dexie-db";
import { useNavigate } from "react-router-dom";

export const TabsBar: React.FC = () => {
  const [state, dispatch] = useGlobalStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleTabClick = useCallback(
    (tab: Tab) => {
      navigate(`/note/${tab.noteId}`);
    },
    [navigate],
  );

  const handleCloseTab = useCallback(
    async (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      const result = await dispatch.removeTab(tabId);
      if (result.activeTabId && result.activeTabId !== tabId) {
          const newTab = result.tabs.find((t) => t.id === result.activeTabId);
          if (newTab) {
              navigate(`/note/${newTab.noteId}`);
          }
      } else if (!result.activeTabId) {
          navigate('/');
      }
    },
    [dispatch, navigate],
  );

  const handleMiddleClick = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      if (e.button === 1) {
        handleCloseTab(e,tabId);
      }
    },
    [handleCloseTab],
  );

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

  if (state.tabs.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="flex overflow-x-auto fixed z-10 flex-row items-center mx-auto w-full h-10 select-none top-navbar max-w-safe bg-background/90 isolate backdrop-blur-sm scrollbar-none"
    >
      {state.tabs.map((tab) => {
        const note = state.notes.find((n) => n.id === tab.noteId);
        const isActive = state.activeTabId === tab.id;
        const title = note?.title || "Untitled";
        return (
          <div
            key={tab.id}
            data-tab-id={tab.id}
            title={note?.filePath || title}
            onClick={() =>
              state.tabs.length === 1 ? undefined : handleTabClick(tab)
            }
            onMouseDown={(e) => handleMiddleClick(e, tab.id)}
            className={clsx(
              "group flex items-center min-w-32 max-w-xs h-full px-3 gap-2 cursor-pointer transition-all relative",
              isActive
                ? "bg-background shadow-sm text-foreground"
                : "bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/20",
            )}
          >
            <FileText className="flex-shrink-0 w-3.5 h-3.5 opacity-60" />
            <span className="flex-1 text-xs truncate">{title}</span>
            <button
              onClick={(e) => handleCloseTab(e, tab.id)}
              className="p-0.5 rounded-md opacity-0 transition-opacity group-hover:opacity-100 hover:bg-foreground/10"
            >
              <X className="w-3 h-3" />
            </button>
            {isActive && (
              <div className="absolute bottom-0 right-2 left-2 h-0.5 rounded-full bg-primary" />
            )}
          </div>
        );
      })}
    </div>
  );
};
