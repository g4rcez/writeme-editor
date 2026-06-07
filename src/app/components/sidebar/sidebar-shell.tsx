import { Button } from "@g4rcez/components";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { InfoIcon } from "@phosphor-icons/react/dist/csr/Info";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/csr/ListBullets";
import { SidebarIcon } from "@phosphor-icons/react/dist/csr/Sidebar";
import { TrashSimpleIcon } from "@phosphor-icons/react/dist/csr/TrashSimple";
import { useEffect, useMemo, type JSX } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useLayoutStore } from "@/app/contexts/layout-context";
import { fishify } from "@/lib/fmt";
import { CommanderType, useGlobalStore } from "@/store/global.store";
import { uiDispatch, useUIStore } from "@/store/ui.store";
import { FileSearchIcon, NotePencilIcon } from "@phosphor-icons/react";
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

function SidebarNavItem({
  icon,
  label,
  active,
  onClick,
}: SidebarNavItemProps): JSX.Element {
  return (
    <Button
      size="small"
      onClick={onClick}
      theme={active ? "ghost-primary" : "ghost-muted"}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </Button>
  );
}

function SidebarFooterTab({
  icon,
  label,
  active,
  onClick,
}: SidebarFooterTabProps): JSX.Element {
  return (
    <Button
      size="small"
      onClick={onClick}
      aria-pressed={active}
      theme={active ? "ghost-primary" : "ghost-muted"}
    >
      <span className="text-xs shrink-0">{icon}</span>
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
    if (!source) return { title: "Writeme", directory: "~" };
    const parts = source.split(/[\\/]/).filter(Boolean);
    return { title: parts.at(-1) ?? "Writeme", directory: source || "~" };
  }, [state.directory, state.explorerRoot]);

  useEffect(() => {
    void dispatch.loadGroups();
  }, [dispatch]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-background px-4">
      <header className="flex px-3 my-2 shrink-0 flex-nowrap justify-between">
        <div className="flex items-center gap-4">
          <WritemeLogo className="size-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-foreground">
              {workspace.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {fishify(workspace.directory, state.homedir ?? "")}
            </p>
          </div>
        </div>
        <Button
          size="tiny"
          theme="ghost-muted"
          onClick={() => uiDispatch.toggleSidebar()}
          title={uiState.sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-label={
            uiState.sidebarOpen ? "Collapse sidebar" : "Expand sidebar"
          }
        >
          <SidebarIcon size={14} />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <nav className="grid lg:grid-cols-2 gap-2 grid-cols-1">
          <SidebarNavItem
            label="Search"
            icon={<FileSearchIcon size={14} />}
            active={location.pathname.startsWith("/notes")}
            onClick={() => {
              dispatch.commander(true, CommanderType.Notes);
            }}
          />
          <SidebarNavItem
            label="Notes"
            icon={<NotePencilIcon size={14} />}
            active={location.pathname.startsWith("/notes")}
            onClick={() => {
              navigate("/notes");
              layoutDispatch.setActivity("explorer");
            }}
          />
          <SidebarNavItem
            label="Tasks"
            active={uiState.tasksDialog.isOpen}
            icon={<ListBulletsIcon size={14} />}
            onClick={() => uiDispatch.openTasksDialog()}
          />
          <SidebarNavItem
            label="Trash"
            icon={<TrashSimpleIcon size={14} />}
            active={location.pathname.startsWith("/settings/trash")}
            onClick={() => {
              layoutDispatch.setView({ type: "trash" });
              navigate("/settings/trash");
            }}
          />
        </nav>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SidebarContent />
        </div>
      </div>
      <footer className="shrink-0 border-t border-card-border">
        <div className="flex items-center gap-4 justify-between mt-2">
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
