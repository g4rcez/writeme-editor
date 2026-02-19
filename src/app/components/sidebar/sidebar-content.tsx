import { useLayoutContext } from "../../contexts/layout-context";
import { ExplorerPane } from "./explorer-pane";
import { SearchPane } from "./search-pane";
import { QuickSettingsPane } from "./quick-settings-pane";
import { NoteListSidebar } from "../note-list/note-list-sidebar";
import { useEffect } from "react";

export const SidebarContent = () => {
  const { state, dispatch } = useLayoutContext();

  // Reset view when activity changes?
  // Maybe not, keep them independent if they have different sub-states.

  switch (state.activeActivity) {
    case "explorer":
      return <ExplorerPane />;
    case "search":
      return <SearchPane />;
    case "favorites":
      // We can reuse NoteListSidebar but we need to tell it to filter by favorites
      // For now, let's update NoteListSidebar to respect the activeView in context
      // which we will set when switching to favorites activity.
      return <NoteListSidebar />;
    case "tags":
      // Similar to favorites, show note list but with tag focus
      return <NoteListSidebar />;
    case "settings":
      return <QuickSettingsPane />;
    default:
      return <ExplorerPane />;
  }
};
