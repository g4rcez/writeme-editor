import { useGlobalStore } from "@/store/global.store";
import { NoteGroupMember } from "@/store/repositories/entities/note-group-member";
import { Note } from "@/store/note";
import { Button, Input } from "@g4rcez/components";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { DotsSixVerticalIcon } from "@phosphor-icons/react/dist/csr/DotsSixVertical";
import { GitMergeIcon } from "@phosphor-icons/react/dist/csr/GitMerge";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { repositories } from "@/store/repositories";

type SortableMemberRowProps = {
  member: NoteGroupMember;
  note: Note | undefined;
  onRemove: (member: NoteGroupMember) => void;
  onOrderChange: (member: NoteGroupMember, value: number) => void;
};

function SortableMemberRow({
  member,
  note,
  onRemove,
  onOrderChange,
}: SortableMemberRowProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: member.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card group"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-foreground/30 hover:text-foreground/60 shrink-0"
        title="Drag to reorder"
      >
        <DotsSixVerticalIcon className="w-4 h-4" />
      </button>
      <input
        type="number"
        step="0.5"
        value={member.order}
        onChange={(e) => onOrderChange(member, parseFloat(e.target.value))}
        className="w-16 px-1.5 py-0.5 text-xs border rounded border-border bg-background text-foreground"
        title="Order"
      />
      <button
        onClick={() => navigate(`/note/${member.noteId}`)}
        className="flex-1 text-left text-sm truncate hover:underline text-primary"
      >
        {note?.title || "Untitled"}
      </button>
      <button
        onClick={() => onRemove(member)}
        className="shrink-0 p-1.5 rounded text-foreground/40 opacity-0 group-hover:opacity-100 transition-all hover:text-red-500 hover:bg-red-500/10"
        title="Remove from group"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [state, dispatch] = useGlobalStore();
  const navigate = useNavigate();
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState<string | null>(null);
  const [localMembers, setLocalMembers] = useState<NoteGroupMember[]>([]);
  const [merging, setMerging] = useState(false);

  const group = state.noteGroups.find((g) => g.id === groupId);

  useEffect(() => {
    dispatch.loadGroups();
  }, []);

  useEffect(() => {
    const members = state.noteGroupMembers
      .filter((m) => m.groupId === groupId)
      .sort((a, b) => a.order - b.order);
    setLocalMembers(members);
  }, [state.noteGroupMembers, groupId]);

  const noteMap = useMemo(() => {
    const map = new Map<string, Note>();
    for (const note of state.notes) {
      map.set(note.id, note);
    }
    return map;
  }, [state.notes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localMembers.findIndex((m) => m.id === active.id);
    const newIndex = localMembers.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(localMembers, oldIndex, newIndex).map(
      (m, i) => ({ ...m, order: i } as NoteGroupMember),
    );
    setLocalMembers(reordered);
    await dispatch.reorderGroupMembers(groupId!, reordered);
  };

  const handleOrderChange = async (member: NoteGroupMember, value: number) => {
    const updated = localMembers
      .map((m) => (m.id === member.id ? { ...m, order: value } : m) as NoteGroupMember)
      .sort((a, b) => a.order - b.order);
    setLocalMembers(updated);
    await dispatch.reorderGroupMembers(groupId!, updated);
  };

  const handleRemove = async (member: NoteGroupMember) => {
    await dispatch.removeNoteFromGroup(member.groupId, member.noteId);
  };

  const handleTitleSave = async () => {
    if (editingTitle !== null && editingTitle.trim()) {
      await dispatch.updateGroup(groupId!, { title: editingTitle.trim() });
    }
    setEditingTitle(null);
  };

  const handleDescSave = async () => {
    if (editingDesc !== null) {
      await dispatch.updateGroup(groupId!, {
        description: editingDesc.trim() || null,
      });
    }
    setEditingDesc(null);
  };

  const handleMerge = async () => {
    if (localMembers.length === 0) return;
    setMerging(true);
    try {
      const parts: string[] = [];
      for (const member of localMembers) {
        const note =
          noteMap.get(member.noteId) ||
          (await repositories.notes.getOne(member.noteId));
        if (!note) continue;
        parts.push(`## ${note.title || "Untitled"}\n\n${note.content || ""}`);
      }
      const content = parts.join("\n\n---\n\n");
      const mergedNote = Note.new(
        `${group?.title ?? "Group"} (merged)`,
        content,
      );
      await repositories.notes.save(mergedNote);
      navigate(`/note/${mergedNote.id}`);
    } finally {
      setMerging(false);
    }
  };

  if (!group) {
    return (
      <div className="py-6 mx-auto max-w-safe">
        <p className="text-foreground/50">Group not found.</p>
      </div>
    );
  }

  return (
    <div className="relative flex-col py-6 mx-auto min-h-full max-w-safe">
      <button
        onClick={() => navigate("/groups")}
        className="flex items-center gap-1.5 mb-4 text-sm text-foreground/60 hover:text-foreground transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        All Groups
      </button>

      <div className="mb-6">
        {editingTitle !== null ? (
          <Input
            hiddenLabel
            title="Group title"
            autoFocus
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSave();
              if (e.key === "Escape") setEditingTitle(null);
            }}
          />
        ) : (
          <h1
            className="text-2xl font-bold cursor-text hover:underline decoration-dashed"
            onClick={() => setEditingTitle(group.title)}
            title="Click to edit"
          >
            {group.title}
          </h1>
        )}
        {editingDesc !== null ? (
          <textarea
            autoFocus
            value={editingDesc}
            onChange={(e) => setEditingDesc(e.target.value)}
            onBlur={handleDescSave}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditingDesc(null);
            }}
            rows={2}
            placeholder="Add a description..."
            className="mt-1 w-full px-2 py-1 text-sm rounded border border-border bg-background text-foreground resize-none"
          />
        ) : (
          <p
            className="mt-1 text-sm text-foreground/60 cursor-text hover:underline decoration-dashed"
            onClick={() => setEditingDesc(group.description ?? "")}
            title="Click to edit description"
          >
            {group.description || (
              <span className="italic opacity-50">Add a description...</span>
            )}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-foreground/50">
          {localMembers.length} note{localMembers.length !== 1 ? "s" : ""}
        </p>
        <Button
          size="small"
          theme="primary"
          onClick={handleMerge}
          disabled={localMembers.length === 0 || merging}
        >
          <GitMergeIcon className="w-4 h-4" />
          {merging ? "Merging…" : "Merge into new note"}
        </Button>
      </div>

      {localMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-foreground/40">
          <p className="text-sm">
            No notes in this group yet. Add notes from the Notes list.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localMembers.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2">
              {localMembers.map((member) => (
                <SortableMemberRow
                  key={member.id}
                  member={member}
                  note={noteMap.get(member.noteId)}
                  onRemove={handleRemove}
                  onOrderChange={handleOrderChange}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
