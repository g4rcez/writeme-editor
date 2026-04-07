import { useGlobalStore } from "@/store/global.store";
import { Button } from "@g4rcez/components";
import { FolderSimpleIcon } from "@phosphor-icons/react/dist/csr/FolderSimple";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const GroupsPane = () => {
  const [state, dispatch] = useGlobalStore();
  const navigate = useNavigate();

  useEffect(() => {
    dispatch.loadGroups();
  }, []);

  const memberCountFor = (groupId: string) =>
    state.noteGroupMembers.filter((m) => m.groupId === groupId).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <span className="text-xs font-semibold uppercase text-foreground/50">
          Groups
        </span>
        <Button
          size="small"
          theme="ghost-muted"
          onClick={() => navigate("/groups")}
          title="Manage groups"
        >
          <PlusIcon className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {state.noteGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-foreground/40 text-center">
            <FolderSimpleIcon className="w-7 h-7 mb-2 opacity-50" />
            <p className="text-xs">No groups</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {state.noteGroups.map((group) => (
              <li key={group.id}>
                <button
                  onClick={() => navigate(`/groups/${group.id}`)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors text-foreground/70 hover:bg-muted/30 hover:text-foreground"
                >
                  <FolderSimpleIcon className="w-4 h-4 shrink-0" />
                  <span className="text-sm truncate flex-1">{group.title}</span>
                  <span className="text-xs text-foreground/40 shrink-0">
                    {memberCountFor(group.id)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
