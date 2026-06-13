import {
  useLayoutStore,
  type ActivityType,
} from "@/app/contexts/layout-context";
import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { uiDispatch, useUIStore } from "@/store/ui.store";
import { css, Tooltip } from "@g4rcez/components";
import { CalendarIcon, type Icon } from "@phosphor-icons/react";
import { FilesIcon } from "@phosphor-icons/react/dist/csr/Files";
import { FolderSimpleIcon } from "@phosphor-icons/react/dist/csr/FolderSimple";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { HashIcon } from "@phosphor-icons/react/dist/csr/Hash";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { SidebarIcon } from "@phosphor-icons/react/dist/csr/Sidebar";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { TableIcon } from "@phosphor-icons/react/dist/csr/Table";
import { TrashSimpleIcon } from "@phosphor-icons/react/dist/csr/TrashSimple";
import { useLocation, useNavigate } from "react-router-dom";

type ActivityIconProps = {
  icon: Icon;
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
        aria-label={label}
        onClick={onClick}
        className={css(
          "writeme-aside-activity-icon",
          active
            ? "writeme-aside-activity-icon--active"
            : "writeme-aside-activity-icon--inactive",
        )}
      >
        <Icon size={18} strokeWidth={1.5} />
        {active ? <div className="writeme-aside-activity-indicator" /> : null}
        {badge !== undefined && badge > 0 && (
          <span className="writeme-aside-activity-badge">
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
  const navigate = useNavigate();
  const location = useLocation();
  const [layout, dispatchLayout] = useLayoutStore();
  const [state] = useGlobalStore();
  const [uiState] = useUIStore();
  const favoritesCount = state.notes.filter((n: Note) => n.favorite).length;

  const onActivityClick = (activity: ActivityType, shouldCollapse = false) => {
    dispatchLayout.setActivity(activity);
    uiDispatch.setSidebarOpen(!shouldCollapse);
  };

  const onExplorerClick = () => {
    if (layout.activeActivity === "explorer") {
      uiDispatch.toggleSidebar();
    } else {
      dispatchLayout.setActivity("explorer");
      uiDispatch.setSidebarOpen(true);
    }
  };

  return (
    <div className="writeme-aside-activity-bar">
      <div className="writeme-aside-activity-icons">
        <ActivityIcon
          icon={FilesIcon}
          label="Explorer"
          onClick={onExplorerClick}
          active={layout.activeActivity === "explorer"}
        />
        <ActivityIcon
          label="Search"
          icon={MagnifyingGlassIcon}
          onClick={() => onActivityClick("search")}
          active={layout.activeActivity === "search"}
        />
        <ActivityIcon
          icon={StarIcon}
          label="Favorites"
          badge={favoritesCount}
          onClick={() => onActivityClick("favorites")}
          active={layout.activeActivity === "favorites"}
        />
        <ActivityIcon
          label="Tags"
          icon={HashIcon}
          onClick={() => onActivityClick("tags")}
          active={layout.activeActivity === "tags"}
        />
        <ActivityIcon
          label="Groups"
          icon={FolderSimpleIcon}
          onClick={() => onActivityClick("groups")}
          active={layout.activeActivity === "groups"}
        />
        <ActivityIcon
          label="Calendar"
          icon={CalendarIcon}
          active={layout.activeActivity === "calendar"}
          onClick={() => {
            onActivityClick("calendar");
            if (!location.pathname.startsWith("/calendar")) {
              navigate("/calendar");
            }
          }}
        />
        <ActivityIcon
          label="Views"
          icon={TableIcon}
          onClick={() => {
            onActivityClick("views", true);
            if (!location.pathname.startsWith("/views")) {
              navigate("/views");
            }
          }}
          active={layout.activeActivity === "views"}
        />
        <ActivityIcon
          label="Trash"
          icon={TrashSimpleIcon}
          onClick={() => onActivityClick("trash")}
          active={layout.activeActivity === "trash"}
        />
      </div>
      <div className="writeme-aside-activity-bottom">
        <ActivityIcon
          icon={SidebarIcon}
          onClick={() => uiDispatch.toggleSidebar()}
          label={uiState.sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        />
        <ActivityIcon
          label="Settings"
          icon={GearIcon}
          active={layout.activeActivity === "settings"}
          onClick={() => {
            onActivityClick("settings");
            if (!location.pathname.startsWith("/settings")) {
              navigate("/settings");
            }
          }}
        />
      </div>
    </div>
  );
};
