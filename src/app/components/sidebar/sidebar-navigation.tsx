import {
  Archive,
  Book,
  FileText,
  Folder,
  Hash,
  LayoutGrid,
  Settings,
  Star,
  Trash2,
} from "lucide-react";
import { useGlobalStore } from "../../../store/global.store";
import { useLayoutContext } from "../../contexts/layout-context";
import { repositories } from "../../../store/repositories";
import { useEffect, useState } from "react";
import { Hashtag } from "../../../store/repositories/entities/hashtag";
import { SettingsService } from "../../../store/settings";
import { Note } from "../../../store/note";
import { formatSimplifiedPath, getRelativePath } from "../../../lib/file-utils";

type SidebarItemProps = {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
  depth?: number;
};

const SidebarItem = ({
  icon,
  label,
  count,
  active,
  onClick,
  depth = 0,
}: SidebarItemProps) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
      active
        ? "bg-primary/10 text-primary font-medium"
        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
    }`}
    style={{ paddingLeft: `${8 + depth * 12}px` }}
  >
    <span className="shrink-0 opacity-70">{icon}</span>
    <span className="flex-1 truncate text-left">{label}</span>
    {count !== undefined && <span className="text-xs opacity-50">{count}</span>}
  </button>
);

const SectionHeader = ({ label }: { label: string }) => (
  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mt-4 mb-1">
    {label}
  </div>
);

export const SidebarNavigation = () => {
  const { state, dispatch } = useLayoutContext();
  const [globalState] = useGlobalStore();
  const [tags, setTags] = useState<Hashtag[]>([]);

  // Load tags
  useEffect(() => {
    repositories.hashtags.getAll().then(setTags);
  }, []);

  // Calculate counts
  const allNotesCount = globalState.notes.filter(
    (n: Note) => n.noteType === "note",
  ).length;
  const favoritesCount = globalState.notes.filter(
    (n: Note) => n.favorite,
  ).length;
  const trashCount = 0; // TODO: Implement trash

  // Unique tags with counts
  const uniqueTags = Array.from(new Set(tags.map((t) => t.hashtag))).map(
    (tag) => {
      return {
        tag,
        count: tags.filter((t) => t.hashtag === tag).length,
      };
    },
  );

  return (
    <div className="flex flex-col h-full w-full bg-sidebar/50 backdrop-blur-xl border-r border-border/40">
      <div className="p-3">
        <div className="flex items-center gap-2 px-2 py-2 text-foreground font-semibold">
          <LayoutGrid className="size-4" />
          <span>Writeme</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-hide">
        <SidebarItem
          icon={<FileText className="size-4" />}
          label="All Notes"
          count={allNotesCount}
          active={state.activeView.type === "all"}
          onClick={() => dispatch({ type: "SET_VIEW", view: { type: "all" } })}
        />
        <SidebarItem
          icon={<Star className="size-4" />}
          label="Favorites"
          count={favoritesCount}
          active={state.activeView.type === "favorites"}
          onClick={() =>
            dispatch({ type: "SET_VIEW", view: { type: "favorites" } })
          }
        />
        <SidebarItem
          icon={<Trash2 className="size-4" />}
          label="Trash"
          count={trashCount}
          active={state.activeView.type === "trash"}
          onClick={() =>
            dispatch({ type: "SET_VIEW", view: { type: "trash" } })
          }
        />

        <SectionHeader label="Tags" />
        {uniqueTags.map(({ tag, count }) => (
          <SidebarItem
            key={tag}
            icon={<Hash className="size-3" />}
            label={tag}
            count={count}
            active={
              state.activeView.type === "tag" && state.activeView.id === tag
            }
            onClick={() =>
              dispatch({ type: "SET_VIEW", view: { type: "tag", id: tag } })
            }
          />
        ))}

        {/* 
            TODO: Implement Folder/Notebook Tree structure here.
            For now, we can list top-level folders or integrate the TreeView component if needed.
        */}
      </div>

      <div className="p-2 border-t border-border/40">
        <SidebarItem
          icon={<Settings className="size-4" />}
          label="Settings"
          active={false}
          onClick={() => {
            /* Navigate to settings */
          }}
        />
      </div>
    </div>
  );
};
