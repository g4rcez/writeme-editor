import { FilesIcon } from "@phosphor-icons/react/dist/csr/Files";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { HashIcon } from "@phosphor-icons/react/dist/csr/Hash";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { SidebarIcon } from "@phosphor-icons/react/dist/csr/Sidebar";
import { type Icon } from "@phosphor-icons/react";
import {
  useLayoutStore,
  type ActivityType,
} from "@/app/contexts/layout-context";
import { globalDispatch, useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { css, Tooltip } from "@g4rcez/components";
import { Link, useNavigate } from "react-router-dom";
import { WritemeLogo } from "../logo";

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
  const [layout, dispatchLayout] = useLayoutStore();
  const [state] = useGlobalStore();
  const favoritesCount = state.notes.filter((n: Note) => n.favorite).length;

  const onActivityClick = (
    activity: ActivityType,
    isSidebarCollapsed = false,
  ) => {
    dispatchLayout.setActivity(activity);
    globalDispatch.setSidebarCollapsed(isSidebarCollapsed);
  };

  return (
    <div className="writeme-aside-activity-bar">
      <div className="writeme-aside-activity-icons">
        <Link to="/" className="w-full flex items-center justify-center">
          <WritemeLogo className="size-8 aspect-square px-2" fill="white" />
        </Link>
        <ActivityIcon
          icon={FilesIcon}
          label="Explorer"
          onClick={() => onActivityClick("explorer")}
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
      </div>
      <div className="writeme-aside-activity-bottom">
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
          onClick={() => {
            onActivityClick("settings");
            navigate("/settings");
          }}
        />
      </div>
    </div>
  );
};
