import { FilePlusIcon } from "@phosphor-icons/react/dist/csr/FilePlus";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { SidebarSimpleIcon } from "@phosphor-icons/react/dist/csr/SidebarSimple";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Group, Panel } from "react-resizable-panels";
import { useLocation, useOutlet } from "react-router-dom";
import { ContextPane } from "@/app/components/context-pane";
import { TabsBar } from "@/app/components/tabs-bar";
import { TerminalWorkspace } from "@/app/components/terminal/terminal-workspace";
import { getCurrentRouteTabTarget } from "@/lib/tab-target";
import { CommanderType, useGlobalStore } from "@/store/global.store";
import { uiDispatch, useUIStore } from "@/store/ui.store";
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

const getRouteLabel = (pathname: string): string => {
    if (pathname === "/") return "Home";
    if (pathname.startsWith("/note/")) return "Note";
    if (pathname.startsWith("/notes")) return "All notes";
    if (pathname.startsWith("/chat")) return "Workspace AI";
    if (pathname.startsWith("/settings")) return "Settings";
    if (pathname.startsWith("/calendar")) return "Calendar";
    if (pathname.startsWith("/views")) return "Views";
    if (pathname.startsWith("/groups")) return "Groups";
    return "Workspace";
};

export const MainLayout = () => {
    useJsonDrop();
    const location = useLocation();
    const [contextOpen, setContextOpen] = useState(false);
    const [state, dispatch] = useGlobalStore((s) => ({
        tabs: s.tabs,
        notes: s.notes,
        note: s.note,
        activeTabId: s.activeTabId,
        directory: s.directory,
        terminalSessions: s.terminalSessions,
        restoredTerminalSessionIds: s.restoredTerminalSessionIds,
    }));
    const [uiState] = useUIStore();
    const isNoteRoute = location.pathname.startsWith("/note/");
    const routeLabel = getRouteLabel(location.pathname);

    useEffect(() => {
        if (!isNoteRoute) setContextOpen(false);
    }, [isNoteRoute]);

    useEffect(() => {
        if (!contextOpen || !uiState.sidebarOpen) return;
        if (window.matchMedia("(max-width: 959px)").matches) setContextOpen(false);
    }, [contextOpen, uiState.sidebarOpen]);

    const currentTarget = useMemo(
        () => getCurrentRouteTabTarget(location.pathname, location.search),
        [location.pathname, location.search],
    );
    const activeTerminalSessionId = currentTarget?.type === "terminal" ? currentTarget.id : null;

    return (
        <div className="writeme-layout">
            <div className="writeme-layout-body">
                <Sidebar />
                <main
                    className="writeme-layout-main"
                    aria-label={routeLabel === "Note" ? "Editor workspace" : routeLabel}
                >
                    <header className="writeme-app-header">
                        <div className="writeme-app-header-start flex min-w-0 items-center gap-2">
                            <button
                                type="button"
                                className="writeme-header-action writeme-mobile-header-action"
                                aria-label={uiState.sidebarOpen ? "Close workspace menu" : "Open workspace menu"}
                                title={uiState.sidebarOpen ? "Close workspace menu" : "Open workspace menu"}
                                onClick={() => uiDispatch.toggleSidebar()}
                            >
                                <SidebarSimpleIcon size={17} aria-hidden="true" />
                            </button>
                        </div>
                        <div className="writeme-app-header-tabs">
                            <TabsBar
                                tabs={state.tabs}
                                dispatch={dispatch}
                                notes={state.notes}
                                directory={state.directory}
                                activeTabId={state.activeTabId}
                                terminalSessions={state.terminalSessions}
                            />
                        </div>
                        <div className="writeme-app-header-actions">
                            <button
                                type="button"
                                className="writeme-header-action"
                                aria-label="Find anything"
                                title="Find anything (⌘K)"
                                onClick={() => dispatch.commander(true, CommanderType.Notes)}
                            >
                                <MagnifyingGlassIcon size={17} aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                className="writeme-header-action"
                                aria-label="New note"
                                title="New note (⌘N)"
                                onClick={() => dispatch.setCreateNoteDialog({ isOpen: true, type: "note" })}
                            >
                                <FilePlusIcon size={17} aria-hidden="true" />
                            </button>
                            {isNoteRoute && state.note ? (
                                <button
                                    type="button"
                                    className={`writeme-header-action ${contextOpen ? "bg-primary/10 text-primary" : ""}`}
                                    aria-label={contextOpen ? "Close note context" : "Open note context"}
                                    aria-pressed={contextOpen}
                                    title={contextOpen ? "Close note context" : "Open note context"}
                                    onClick={() => {
                                        setContextOpen((open) => !open);
                                        if (window.matchMedia("(max-width: 959px)").matches) {
                                            uiDispatch.setSidebarOpen(false);
                                        }
                                    }}
                                >
                                    <SidebarSimpleIcon size={17} aria-hidden="true" />
                                </button>
                            ) : null}
                        </div>
                    </header>
                    <Group orientation="vertical" className="flex-1 min-h-0">
                        <Panel defaultSize={100} minSize={30} className="min-h-0">
                            <div className="writeme-main-surface relative w-full h-full min-h-0 bg-background">
                                <div className={activeTerminalSessionId ? "hidden" : "w-full h-full min-h-0"}>
                                    <div
                                        id="main-scroll-container"
                                        className="writeme-scroll-container h-full print:block print:h-auto"
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
                {contextOpen && isNoteRoute && state.note ? (
                    <>
                        <button
                            type="button"
                            className="writeme-context-backdrop"
                            tabIndex={-1}
                            aria-label="Close note context"
                            onClick={() => setContextOpen(false)}
                            onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                    event.preventDefault();
                                    setContextOpen(false);
                                }
                            }}
                        />
                        <ContextPane note={state.note} notes={state.notes} onClose={() => setContextOpen(false)} />
                    </>
                ) : null}
            </div>
        </div>
    );
};
