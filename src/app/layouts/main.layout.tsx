import { TabsBar } from "@/app/components/tabs-bar";
import { TerminalPanel } from "@/app/components/terminal/terminal-panel";
import { useGlobalStore } from "@/store/global.store";
import { XIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { useLocation, useOutlet } from "react-router-dom";
import { useJsonDrop } from "../hooks/use-json-drop";
import { Sidebar } from "./sidebar";

const routeTransition = {
  duration: 0.12,
  ease: [0.22, 1, 0.36, 1] as const,
};

function RouteTransitionOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const shouldReduceMotion = useReducedMotion();
  const routeKey = `${location.pathname}${location.search}`;

  return (
    <motion.div
      key={routeKey}
      animate={{ opacity: 1 }}
      className="w-full min-h-full"
      initial={shouldReduceMotion ? false : { opacity: 0.2 }}
      transition={shouldReduceMotion ? { duration: 0 } : routeTransition}
    >
      {outlet}
    </motion.div>
  );
}

export const MainLayout = () => {
  const [terminalVisible, dispatch] = useGlobalStore((s) => s.terminalVisible);
  useJsonDrop();
  return (
    <div className="writeme-layout">
      <div className="writeme-layout-body">
        <Sidebar />
        <main className="writeme-layout-main" aria-label="Editor workspace">
          <TabsBar />
          <Group orientation="vertical" className="flex-1 min-h-0">
            <Panel defaultSize={70} minSize={30} className="min-h-0">
              <div
                id="main-scroll-container"
                className="overflow-y-auto overscroll-contain w-full h-full min-h-0 print:block print:overflow-visible print:h-auto bg-background py-8"
              >
                <RouteTransitionOutlet />
              </div>
            </Panel>
            {terminalVisible && (
              <>
                <Separator
                  aria-label="Resize terminal panel"
                  className="h-1 bg-border/20 hover:bg-primary/50 transition-colors cursor-row-resize"
                />
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
        </main>
      </div>
    </div>
  );
};
