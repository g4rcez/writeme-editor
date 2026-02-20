import {
  Files,
  Search,
  Star,
  Hash,
  Settings,
  PanelLeft,
  LayoutTemplate,
  LucideIcon,
} from "lucide-react";
import { useLayoutContext, ActivityType } from "@/app/contexts/layout-context";
import { globalDispatch, useGlobalStore } from "@/store/global.store";
import { css, Tooltip } from "@g4rcez/components";
import { Note } from "@/store/note";

type ActivityIconProps = {
  icon: LucideIcon;
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
  const { state, dispatch } = useLayoutContext();
  const [globalState] = useGlobalStore();
  const favoritesCount = globalState.notes.filter(
    (n: Note) => n.favorite,
  ).length;

  const onActivityClick = (activity: ActivityType) => {
    dispatch({ type: "SET_ACTIVITY", activity });
    globalDispatch.setSidebarCollapsed(false);
  };

  return (
    <div className="flex flex-col items-center bg-background py-2 h-full border-r w-[52px] bg-sidebar/50 backdrop-blur-xl border-border/40">
      <div className="flex flex-col flex-1 gap-1 w-full">
        <ActivityIcon
          label="Explorer"
          icon={Files}
          active={state.activeActivity === "explorer"}
          onClick={() => onActivityClick("explorer")}
        />
        <ActivityIcon
          label="Search"
          icon={Search}
          active={state.activeActivity === "search"}
          onClick={() => onActivityClick("search")}
        />
        <ActivityIcon
          label="Favorites"
          icon={Star}
          badge={favoritesCount}
          active={state.activeActivity === "favorites"}
          onClick={() => onActivityClick("favorites")}
        />
        <ActivityIcon
          label="Tags"
          icon={Hash}
          active={state.activeActivity === "tags"}
          onClick={() => onActivityClick("tags")}
        />
        <ActivityIcon
          label="Templates"
          icon={LayoutTemplate}
          active={state.activeActivity === "templates"}
          onClick={() => onActivityClick("templates")}
        />
      </div>
      <div className="flex flex-col gap-1 mt-auto w-full">
        <ActivityIcon
          label={
            globalState.isSidebarCollapsed
              ? "Expand Sidebar"
              : "Collapse Sidebar"
          }
          icon={PanelLeft}
          onClick={() => globalDispatch.toggleSidebar()}
        />
        <ActivityIcon
          label="Settings"
          icon={Settings}
          active={state.activeActivity === "settings"}
          onClick={() => onActivityClick("settings")}
        />
      </div>
    </div>
  );
};
