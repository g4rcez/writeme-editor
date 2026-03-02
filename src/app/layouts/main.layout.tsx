import { motion } from "motion/react";
import { ActivityBar } from "@/app/components/sidebar/activity-bar";
import { SidebarContent } from "@/app/components/sidebar/sidebar-content";
import { TabsBar } from "@/app/components/tabs-bar";
import { useGlobalStore } from "@/store/global.store";
import { css } from "@g4rcez/components";
import { Fragment, useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Navbar } from "./navbar";

const Aside = () => {
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
      <div className="flex-shrink-0 print:hidden w-fit">
        <ActivityBar />
      </div>
      <motion.div
        style={{
          width: state.isSidebarCollapsed ? 0 : `${state.sidebarWidth}px`,
        }}
        className={css(
          "flex-shrink-0 print:hidden bg-sidebar/30 backdrop-blur-sm transition-all duration-300 ease-in-out overflow-hidden",
          state.isSidebarCollapsed
            ? "w-0 border-r-0 opacity-0"
            : "border-r border-border/20 opacity-100",
        )}
      >
        <motion.div
          style={{ width: `${state.sidebarWidth}px` }}
          className="flex flex-col flex-1 h-full min-h-full print:hidden"
        >
          <SidebarContent />
        </motion.div>
      </motion.div>
      {!state.isSidebarCollapsed && (
        <div
          onMouseDown={startResizing}
          className="z-10 flex-shrink-0 -ml-0.5 w-1 transition-colors cursor-col-resize print:hidden hover:bg-primary/50"
        />
      )}
    </Fragment>
  );
};

export const MainLayout = () => (
  <div className="flex flex-col w-screen h-screen print:block print:h-auto print:w-auto print:overflow-visible bg-background">
    <Navbar />
    <div className="flex overflow-hidden flex-1 w-screen print:block print:overflow-visible print:h-auto print:w-auto bg-floating-background">
      <Aside />
      <div className="flex relative flex-col flex-1 min-w-0 bg-background print:block print:w-auto print:h-auto print:overflow-visible">
        <TabsBar />
        <div
          id="main-scroll-container"
          className="overflow-y-auto flex-1 w-full h-full print:block print:overflow-visible print:h-auto bg-background"
        >
          <Outlet />
        </div>
      </div>
    </div>
  </div>
);
