import { useGlobalStore } from "@/store/global.store";
import { Button, Input } from "@g4rcez/components";
import { FolderSimpleIcon } from "@phosphor-icons/react/dist/csr/FolderSimple";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function GroupsListPage() {
  const [state, dispatch] = useGlobalStore();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    dispatch.loadGroups();
  }, []);

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    await dispatch.createGroup(title, newDescription.trim() || undefined);
    setNewTitle("");
    setNewDescription("");
    setShowCreate(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this group? Notes will not be deleted.")) return;
    await dispatch.deleteGroup(id);
  };

  const memberCountFor = (groupId: string) =>
    state.noteGroupMembers.filter((m) => m.groupId === groupId).length;

  return (
    <div className="relative flex-col py-6 mx-auto min-h-full max-w-safe">
      <div className="flex justify-between items-center mb-6">
        <h1 className="flex gap-2 items-center text-2xl font-bold">
          <FolderSimpleIcon className="w-6 h-6" />
          Note Groups
        </h1>
        <Button
          size="small"
          theme="primary"
          onClick={() => setShowCreate(true)}
        >
          <PlusIcon className="w-4 h-4" />
          New Group
        </Button>
      </div>

      {showCreate && (
        <div className="mb-6 p-4 rounded-lg border border-border bg-card">
          <h2 className="mb-3 font-semibold">New Group</h2>
          <div className="flex flex-col gap-3">
            <Input
              title="Group title"
              placeholder="Group title"
              value={newTitle}
              autoFocus
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowCreate(false);
              }}
            />
            <Input
              title="Description (optional)"
              placeholder="Description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="small"
                theme="ghost-muted"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
              <Button size="small" theme="primary" onClick={handleCreate}>
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {state.noteGroups.length === 0 && !showCreate && (
        <div className="flex flex-col items-center justify-center py-24 text-foreground/50">
          <FolderSimpleIcon className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">No groups yet. Create one to get started.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {state.noteGroups.map((group) => (
          <div
            key={group.id}
            onClick={() => navigate(`/groups/${group.id}`)}
            className="group relative flex flex-col gap-1 p-4 rounded-lg border border-border bg-card cursor-pointer transition-colors hover:border-primary/50 hover:bg-card/80"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold truncate">{group.title}</h2>
              <button
                onClick={(e) => handleDelete(e, group.id)}
                className="shrink-0 p-1.5 rounded text-foreground/40 opacity-0 group-hover:opacity-100 transition-all hover:text-red-500 hover:bg-red-500/10"
                title="Delete group"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
            {group.description && (
              <p className="text-sm text-foreground/60 line-clamp-2">
                {group.description}
              </p>
            )}
            <p className="mt-1 text-xs text-foreground/40">
              {memberCountFor(group.id)} note
              {memberCountFor(group.id) !== 1 ? "s" : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
