import { ActivityBar } from "@/app/components/sidebar/activity-bar";
import { SidebarContent } from "@/app/components/sidebar/sidebar-content";
import { TabsBar } from "@/app/components/tabs-bar";
import { useGlobalStore } from "@/store/global.store";
import { css } from "@g4rcez/components";
import { motion } from "motion/react";
import { Fragment, useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useJsonDrop } from "../hooks/use-json-drop";
import { Navbar } from "./navbar";
import { TerminalPanel } from "@/app/components/terminal/terminal-panel";
import { XIcon } from "@phosphor-icons/react";
import { Group, Panel, Separator } from "react-resizable-panels";

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

export const MainLayout = () => {
  const [state, dispatch] = useGlobalStore();
  useJsonDrop();
  return (
    <div className="flex flex-col w-screen h-screen print:block print:h-auto print:w-auto print:overflow-visible bg-background">
      <Navbar />
      <div className="flex overflow-hidden flex-1 w-screen print:block print:overflow-visible print:h-auto print:w-auto bg-floating-background">
        <Aside />
        <div className="flex relative flex-col flex-1 min-w-0 bg-background print:block print:w-auto print:h-auto print:overflow-visible">
          <TabsBar />
          <Group orientation="vertical">
            <Panel defaultSize={70} minSize={30}>
              <div
                id="main-scroll-container"
                className="overflow-y-auto w-full h-full print:block print:overflow-visible print:h-auto bg-background"
              >
                <Outlet />
              </div>
            </Panel>
            {state.terminalVisible && (
              <>
                <Separator className="h-1 bg-border/20 hover:bg-primary/50 transition-colors cursor-row-resize" />
                <Panel defaultSize={30} minSize={10}>
                  <div className="flex flex-col h-full bg-[#1e1e1e] border-t border-border/20">
                    <div className="flex justify-between items-center px-3 py-1 bg-sidebar/50 border-b border-border/20">
                      <span className="text-xs text-muted-foreground uppercase font-semibold">
                        Terminal
                      </span>
                      <button
                        onClick={() => dispatch.setTerminalVisible(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <XIcon size={14} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <TerminalPanel />
                    </div>
                  </div>
                </Panel>
              </>
            )}
          </Group>
        </div>
      </div>
    </div>
  );
};
