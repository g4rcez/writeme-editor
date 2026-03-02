import { FilesIcon } from "@phosphor-icons/react/dist/csr/Files";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { HashIcon } from "@phosphor-icons/react/dist/csr/Hash";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { SidebarIcon } from "@phosphor-icons/react/dist/csr/Sidebar";
import { LayoutIcon } from "@phosphor-icons/react/dist/csr/Layout";
import { type Icon } from "@phosphor-icons/react";
import {
  useLayoutStore,
  type ActivityType,
} from "@/app/contexts/layout-context";
import { globalDispatch, useGlobalStore } from "@/store/global.store";
import { css, Tooltip } from "@g4rcez/components";
import { Note } from "@/store/note";

type ActivityIconProps = {
  icon: Icon;
  id?: string;
  label: string;
  badge?: number;
  active?: boolean;
  onClick: () => void;
};

const ActivityIcon = ({
  icon: Icon,
  label,
  badge,
  active,
  onClick,
}: ActivityIconProps) => (
  <Tooltip
    placement="right"
    title={
      <button
        type="button"
        onClick={onClick}
        className={css(
          "relative flex items-center justify-center w-12 h-12 transition-all duration-200 group",
          active
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon size={24} strokeWidth={1.5} />
        {active ? (
          <div className="absolute left-0 w-0.5 h-8 bg-primary" />
        ) : null}
        {badge !== undefined && badge > 0 && (
          <span className="flex absolute top-2 right-2 justify-center items-center px-1 h-4 font-bold rounded-full shadow-sm min-w-[16px] bg-primary text-[10px] text-primary-foreground">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    }
  >
    {label}
  </Tooltip>
);

export const ActivityBar = () => {
  const [layout, dispatchLayout] = useLayoutStore();

  const [state, dispatch] = useGlobalStore((s) => ({
    notes: s.notes,
    isSidebarCollapsed: s.isSidebarCollapsed,
  }));

  const favoritesCount = state.notes.filter((n: Note) => n.favorite).length;

  const onActivityClick = (activity: ActivityType) => {
    dispatchLayout.setActivity(activity);
    globalDispatch.setSidebarCollapsed(false);
  };

  return (
    <div className="flex flex-col items-center py-2 h-full border-r bg-background w-[52px] bg-sidebar/50 backdrop-blur-xl border-border/40">
      <div className="flex flex-col flex-1 gap-1 w-full">
        <ActivityIcon
          label="Explorer"
          icon={FilesIcon}
          active={layout.activeActivity === "explorer"}
          onClick={() => onActivityClick("explorer")}
        />
        <ActivityIcon
          label="Search"
          icon={MagnifyingGlassIcon}
          active={layout.activeActivity === "search"}
          onClick={() => onActivityClick("search")}
        />
        <ActivityIcon
          label="Favorites"
          icon={StarIcon}
          badge={favoritesCount}
          active={layout.activeActivity === "favorites"}
          onClick={() => onActivityClick("favorites")}
        />
        <ActivityIcon
          label="Tags"
          icon={HashIcon}
          active={layout.activeActivity === "tags"}
          onClick={() => onActivityClick("tags")}
        />
        <ActivityIcon
          label="Templates"
          icon={LayoutIcon}
          active={layout.activeActivity === "templates"}
          onClick={() => onActivityClick("templates")}
        />
      </div>
      <div className="flex flex-col gap-1 mt-auto w-full">
        <ActivityIcon
          icon={SidebarIcon}
          onClick={() => globalDispatch.toggleSidebar()}
          label={
            state.isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"
          }
        />
        <ActivityIcon
          label="Settings"
          icon={GearIcon}
          active={layout.activeActivity === "settings"}
          onClick={() => onActivityClick("settings")}
        />
      </div>
    </div>
  );
};
