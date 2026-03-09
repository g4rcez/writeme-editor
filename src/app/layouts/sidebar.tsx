import { ActivityBar } from "@/app/components/sidebar/activity-bar";
import { SidebarContent } from "@/app/components/sidebar/sidebar-content";
import { useGlobalStore } from "@/store/global.store";
import { css } from "@g4rcez/components";
import { motion } from "motion/react";
import { Fragment, useCallback, useEffect, useState } from "react";

export const Sidebar = () => {
  const [state, dispatch] = useGlobalStore();
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

  return (
    <Fragment>
      <div className="writeme-aside-activity-wrapper">
        <ActivityBar />
      </div>
      <motion.div
        style={{
          width: state.isSidebarCollapsed ? 0 : `${state.sidebarWidth}px`,
        }}
        className={css(
          "writeme-aside-panel",
          state.isSidebarCollapsed
            ? "writeme-aside-panel--collapsed"
            : "writeme-aside-panel--open",
        )}
      >
        <motion.div
          style={{ width: `${state.sidebarWidth}px` }}
          className="writeme-aside-panel-inner"
        >
          <SidebarContent />
        </motion.div>
      </motion.div>
      {!state.isSidebarCollapsed && (
        <div onMouseDown={startResizing} className="writeme-aside-resize" />
      )}
    </Fragment>
  );
};
