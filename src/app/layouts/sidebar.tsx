import { ActivityBar } from "@/app/components/sidebar/activity-bar";
import { SidebarContent } from "@/app/components/sidebar/sidebar-content";
import { useGlobalStore } from "@/store/global.store";
import { useUIStore } from "@/store/ui.store";
import { css } from "@g4rcez/components";
import {
  Fragment,
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";

export const Sidebar = () => {
  const [state, dispatch] = useGlobalStore();
  const [uiState, uiDispatch] = useUIStore();
  const collapsed = !uiState.sidebarOpen;
  const [isResizing, setIsResizing] = useState(false);
  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = e.clientX - 52;
        if (newWidth >= 150 && newWidth <= 600) {
          dispatch.setSidebarWidth(newWidth);
        }
      }
    },
    [isResizing],
  );

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    window.addEventListener("mousemove", resize, opts);
    window.addEventListener("mouseup", stopResizing, opts);
    return () => void controller.abort();
  }, [resize, stopResizing]);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const onNarrow = (e: MediaQueryListEvent) => {
      if (e.matches) uiDispatch.setSidebarOpen(false);
    };
    if (mql.matches) uiDispatch.setSidebarOpen(false);
    mql.addEventListener("change", onNarrow);
    return () => mql.removeEventListener("change", onNarrow);
  }, []);

  return (
    <Fragment>
      <div className="writeme-aside-activity-wrapper">
        <ActivityBar />
      </div>
      <div
        style={{ "--panel-w": `${state.sidebarWidth}px` } as CSSProperties}
        data-resizing={isResizing || undefined}
        className={css(
          "writeme-aside-panel",
          collapsed
            ? "writeme-aside-panel--collapsed"
            : "writeme-aside-panel--open",
        )}
      >
        <div
          className="writeme-aside-panel-inner"
          style={{
            width: `${state.sidebarWidth}px`,
            transform: collapsed ? "translateX(-100%)" : "translateX(0)",
          }}
        >
          <SidebarContent />
        </div>
      </div>
      {!collapsed && (
        <div
          tabIndex={0}
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          onMouseDown={startResizing}
          className="writeme-aside-resize"
          onKeyDown={(e) => {
            const step = e.shiftKey ? 32 : 16;
            if (e.key === "ArrowRight") {
              e.preventDefault();
              dispatch.setSidebarWidth(
                Math.min(state.sidebarWidth + step, 600),
              );
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              dispatch.setSidebarWidth(
                Math.max(state.sidebarWidth - step, 150),
              );
            }
          }}
        />
      )}
    </Fragment>
  );
};
