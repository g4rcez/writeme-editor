import { Button } from "@g4rcez/components";
import { FileSearchIcon, NotePencilIcon, RobotIcon } from "@phosphor-icons/react";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { InfoIcon } from "@phosphor-icons/react/dist/csr/Info";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/csr/ListBullets";
import { SidebarIcon } from "@phosphor-icons/react/dist/csr/Sidebar";
import { useEffect, useMemo, type JSX } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLayoutStore } from "@/app/contexts/layout-context";
import { fishify } from "@/lib/fmt";
import { CommanderType, useGlobalStore } from "@/store/global.store";
import { uiDispatch, useUIStore } from "@/store/ui.store";
import { WritemeLogo } from "../logo";
import { SidebarContent } from "./sidebar-content";

type SidebarNavItemProps = {
    icon: JSX.Element;
    label: string;
    active?: boolean;
    onClick: () => void;
};

type SidebarFooterTabProps = {
    icon: JSX.Element;
    label: string;
    active?: boolean;
    onClick: () => void;
};

function SidebarNavItem({ icon, label, active, onClick }: SidebarNavItemProps): JSX.Element {
    return (
        <Button
            size="small"
            onClick={onClick}
            aria-current={active ? "page" : undefined}
            className="w-full justify-start gap-2.5 border border-transparent px-2.5"
            theme={active ? "ghost-primary" : "ghost-muted"}
        >
            <span className="shrink-0">{icon}</span>
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        </Button>
    );
}

function SidebarFooterTab({ icon, label, active, onClick }: SidebarFooterTabProps): JSX.Element {
    return (
        <Button
            size="small"
            onClick={onClick}
            aria-pressed={active}
            className="gap-2 px-2"
            theme={active ? "ghost-primary" : "ghost-muted"}
        >
            <span className="shrink-0 text-xs">{icon}</span>
            <span>{label}</span>
        </Button>
    );
}

export const SidebarShell = () => {
    const [state, dispatch] = useGlobalStore();
    const [, layoutDispatch] = useLayoutStore();
    const [uiState] = useUIStore();
    const location = useLocation();
    const navigate = useNavigate();

    const workspace = useMemo(() => {
        const source = state.explorerRoot ?? state.directory;
        if (!source) return { title: "Local workspace", directory: "Your notes" };
        const parts = source.split(/[\\/]/).filter(Boolean);
        return { title: parts.at(-1) ?? "Workspace", directory: source || "~" };
    }, [state.directory, state.explorerRoot]);

    useEffect(() => {
        void dispatch.loadGroups();
    }, [dispatch]);

    const createNewNote = () => dispatch.setCreateNoteDialog({ isOpen: true, type: "note" });
    const openSearch = () => dispatch.commander(true, CommanderType.Notes);

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden px-3">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-1 py-3">
                <button
                    type="button"
                    className="flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={workspace.directory}
                    onClick={() => navigate("/")}
                >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <WritemeLogo className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">{workspace.title}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                            {fishify(workspace.directory, state.homedir ?? "")}
                        </span>
                    </span>
                </button>
                <Button
                    size="tiny"
                    theme="ghost-muted"
                    onClick={() => uiDispatch.toggleSidebar()}
                    title={uiState.sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                    aria-label={uiState.sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                >
                    <SidebarIcon size={14} />
                </Button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="shrink-0 py-3">
                    <div className="mb-2 flex items-center justify-between px-1">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Workspace
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground/60">{state.notes.length}</span>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                        <Button
                            size="small"
                            theme="primary"
                            onClick={createNewNote}
                            className="justify-center gap-2"
                            title="New note (⌘N)"
                        >
                            <NotePencilIcon size={15} aria-hidden="true" />
                            <span>New note</span>
                        </Button>
                        <Button
                            size="small"
                            theme="outlined"
                            onClick={openSearch}
                            aria-label="Find anything"
                            title="Find anything (⌘K)"
                            className="px-2.5"
                        >
                            <FileSearchIcon size={16} aria-hidden="true" />
                        </Button>
                    </div>
                </div>

                <nav className="grid shrink-0 gap-0.5 border-b border-border/40 pb-3" aria-label="Workspace views">
                    <SidebarNavItem
                        active={location.pathname.startsWith("/notes")}
                        label="All notes"
                        icon={<NotePencilIcon size={15} />}
                        onClick={() => {
                            navigate("/notes");
                            layoutDispatch.setActivity("explorer");
                            layoutDispatch.setView({ type: "all" });
                        }}
                    />
                    <SidebarNavItem
                        label="Tasks"
                        active={uiState.tasksDialog.isOpen}
                        icon={<ListBulletsIcon size={15} />}
                        onClick={() => uiDispatch.openTasksDialog()}
                    />
                    <SidebarNavItem
                        label="Workspace AI"
                        icon={<RobotIcon size={15} />}
                        active={location.pathname.startsWith("/chat")}
                        onClick={() => {
                            layoutDispatch.setActivity("ai");
                            navigate("/chat");
                        }}
                    />
                </nav>

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-2">
                    <SidebarContent />
                </div>
            </div>

            <footer className="shrink-0 border-t border-border/40 py-2">
                <div className="flex items-center justify-between gap-1">
                    <SidebarFooterTab
                        label="Help"
                        icon={<InfoIcon size={14} />}
                        onClick={() => navigate("/examples")}
                        active={location.pathname.startsWith("/examples")}
                    />
                    <SidebarFooterTab
                        label="Settings"
                        icon={<GearIcon size={14} />}
                        onClick={() => navigate("/settings")}
                        active={location.pathname.startsWith("/settings")}
                    />
                </div>
            </footer>
        </div>
    );
};
