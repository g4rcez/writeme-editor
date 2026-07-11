import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { Group, Panel } from "react-resizable-panels";
import { useLocation, useOutlet } from "react-router-dom";
import { TabsBar } from "@/app/components/tabs-bar";
import { TerminalWorkspace } from "@/app/components/terminal/terminal-workspace";
import { getCurrentRouteTabTarget } from "@/lib/tab-target";
import { useGlobalStore } from "@/store/global.store";
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
            className="w-full h-full min-h-0"
            initial={shouldReduceMotion ? false : { opacity: 0.4 }}
            transition={shouldReduceMotion ? { duration: 0 } : routeTransition}
        >
            {outlet}
        </motion.div>
    );
}

export const MainLayout = () => {
    useJsonDrop();
    const location = useLocation();
    const [state, dispatch] = useGlobalStore((s) => ({
        tabs: s.tabs,
        notes: s.notes,
        activeTabId: s.activeTabId,
        directory: s.directory,
        terminalSessions: s.terminalSessions,
        restoredTerminalSessionIds: s.restoredTerminalSessionIds,
    }));
    const currentTarget = useMemo(
        () => getCurrentRouteTabTarget(location.pathname, location.search),
        [location.pathname, location.search],
    );
    const activeTerminalSessionId = currentTarget?.type === "terminal" ? currentTarget.id : null;

    return (
        <div className="writeme-layout">
            <div className="writeme-layout-body">
                <Sidebar />
                <main className="writeme-layout-main" aria-label="Editor workspace">
                    <TabsBar
                        tabs={state.tabs}
                        dispatch={dispatch}
                        notes={state.notes}
                        directory={state.directory}
                        activeTabId={state.activeTabId}
                        terminalSessions={state.terminalSessions}
                    />
                    <Group orientation="vertical" className="flex-1 min-h-0">
                        <Panel defaultSize={100} minSize={30} className="min-h-0">
                            <div className="relative w-full h-full min-h-0 bg-background">
                                <div className={activeTerminalSessionId ? "hidden" : "w-full h-full min-h-0"}>
                                    <div
                                        id="main-scroll-container"
                                        className="overflow-y-auto overscroll-contain w-full h-full min-h-0 print:block print:overflow-visible print:h-auto bg-background py-8"
                                    >
                                        <RouteTransitionOutlet />
                                    </div>
                                </div>
                                <TerminalWorkspace
                                    tabs={state.tabs}
                                    terminalSessions={state.terminalSessions}
                                    restoredTerminalSessionIds={state.restoredTerminalSessionIds}
                                    activeSessionId={activeTerminalSessionId}
                                    directory={state.directory}
                                    dispatch={dispatch}
                                    className={activeTerminalSessionId ? "block" : "hidden"}
                                />
                            </div>
                        </Panel>
                    </Group>
                </main>
            </div>
        </div>
    );
};
