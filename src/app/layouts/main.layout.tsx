import { TabsBar } from "@/app/components/tabs-bar";
import { TerminalPanel } from "@/app/components/terminal/terminal-panel";
import { useGlobalStore } from "@/store/global.store";
import { XIcon } from "@phosphor-icons/react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Outlet } from "react-router-dom";
import { useJsonDrop } from "../hooks/use-json-drop";
import { Sidebar } from "./sidebar";

export const MainLayout = () => {
  const [terminalVisible, dispatch] = useGlobalStore((s) => s.terminalVisible);
  useJsonDrop();
  return (
    <div className="writeme-layout">
      <div className="writeme-layout-body">
        <Sidebar />
        <div className="writeme-layout-main">
          <TabsBar />
          <Group orientation="vertical" className="flex-1 min-h-0">
            <Panel defaultSize={70} minSize={30} className="min-h-0">
              <div
                id="main-scroll-container"
                className="writeme-layout-scroll py-8"
              >
                <Outlet />
              </div>
            </Panel>
            {terminalVisible && (
              <>
                <Separator className="h-1 bg-border/20 hover:bg-primary/50 transition-colors cursor-row-resize" />
                <Panel defaultSize={30} minSize={10} className="min-h-0">
                  <div className="flex flex-col h-full min-h-0 bg-[#1e1e1e] border-t border-border/20">
                    <div className="flex justify-between items-center px-3 py-1 bg-sidebar/50 border-b border-border/20">
                      <span className="text-xs text-muted-foreground">
                        Terminal
                      </span>
                      <button
                        aria-label="Close terminal"
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
