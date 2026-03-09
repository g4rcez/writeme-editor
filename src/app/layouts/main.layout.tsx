import { TabsBar } from "@/app/components/tabs-bar";
import { TerminalPanel } from "@/app/components/terminal/terminal-panel";
import { useGlobalStore } from "@/store/global.store";
import { XIcon } from "@phosphor-icons/react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Outlet } from "react-router-dom";
import { useJsonDrop } from "../hooks/use-json-drop";
import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";

export const MainLayout = () => {
  const [state, dispatch] = useGlobalStore();
  useJsonDrop();
  return (
    <div className="writeme-layout">
      <Navbar />
      <div className="writeme-layout-body">
        <Sidebar />
        <div className="writeme-layout-main">
          <TabsBar />
          <Group orientation="vertical">
            <Panel defaultSize={70} minSize={30}>
              <div id="main-scroll-container" className="writeme-layout-scroll py-8">
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
