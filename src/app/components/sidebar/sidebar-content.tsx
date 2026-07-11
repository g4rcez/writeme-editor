import { useLayoutStore } from "@/app/contexts/layout-context";
import { NoteListSidebar } from "../note-list/note-list-sidebar";
import { ChatSidebarContent } from "./chat-sidebar-content";
import { ExplorerPane } from "./explorer-pane";
import { GroupsPane } from "./groups-pane";
import { QuickSettingsPane } from "./quick-settings-pane";
import { SearchPane } from "./search-pane";
import { TagsPane } from "./tags-pane";
import { TemplatesPane } from "./templates-pane";
import { TrashPane } from "./trash-pane";

export const SidebarContent = () => {
    const [state] = useLayoutStore();
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
        case "groups":
            return <GroupsPane />;
        case "trash":
            return <TrashPane />;
        case "settings":
            return <QuickSettingsPane />;
        case "ai":
            return <ChatSidebarContent />;
        default:
            return <ExplorerPane />;
    }
};
