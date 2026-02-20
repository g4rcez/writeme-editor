import { useLayoutContext } from "@/app/contexts/layout-context";
import { NoteListSidebar } from "../note-list/note-list-sidebar";
import { ExplorerPane } from "./explorer-pane";
import { QuickSettingsPane } from "./quick-settings-pane";
import { SearchPane } from "./search-pane";
import { TagsPane } from "./tags-pane";
import { TemplatesPane } from "./templates-pane";

export const SidebarContent = () => {
  const { state } = useLayoutContext();
  switch (state.activeActivity) {
    case "explorer":
      return <ExplorerPane />;
    case "search":
      return <SearchPane />;
    case "favorites":
      return <NoteListSidebar />;
    case "tags":
      if (state.activeView.type === "tag") {
        return <NoteListSidebar />;
      }
      return <TagsPane />;
    case "templates":
      return <TemplatesPane />;
    case "settings":
      return <QuickSettingsPane />;
    default:
      return <ExplorerPane />;
  }
};
