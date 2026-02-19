import { globalDispatch, useGlobalStore } from "@/store/global.store";
import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { ActivityBar } from "../components/sidebar/activity-bar";
import { SidebarContent } from "../components/sidebar/sidebar-content";
import { TabsBar } from "../components/tabs-bar";
import { Navbar } from "./navbar";
import { css } from "@g4rcez/components";

export const MainLayout = () => {
  const [state] = useGlobalStore();
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        // 52 is the activity bar width
        const newWidth = e.clientX - 52;
        if (newWidth >= 150 && newWidth <= 600) {
          globalDispatch.setSidebarWidth(newWidth);
        }
      }
    },
    [isResizing],
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <div className="flex flex-col w-screen h-screen bg-background">
      <Navbar />
      <div className="flex overflow-hidden flex-1 w-screen bg-floating-background">
        <div className="flex-shrink-0 w-fit">
          <ActivityBar />
        </div>
        <div
          className={css(
            "flex-shrink-0 bg-sidebar/30 backdrop-blur-sm transition-all duration-300 ease-in-out overflow-hidden",
            state.isSidebarCollapsed
              ? "w-0 border-r-0 opacity-0"
              : "border-r border-border/20 opacity-100",
          )}
          style={{
            width: state.isSidebarCollapsed ? 0 : `${state.sidebarWidth}px`,
          }}
        >
          <div style={{ width: `${state.sidebarWidth}px` }}>
            <SidebarContent />
          </div>
        </div>
        {!state.isSidebarCollapsed && (
          <div
            onMouseDown={startResizing}
            className="z-10 flex-shrink-0 -ml-0.5 w-1 transition-colors cursor-col-resize hover:bg-primary/50"
          />
        )}
        <div className="flex relative flex-col flex-1 min-w-0 bg-background">
          <TabsBar />
          <div
            id="main-scroll-container"
            className="overflow-y-auto flex-1 w-full"
          >
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};
