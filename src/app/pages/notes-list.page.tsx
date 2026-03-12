import {
  Button,
  Checkbox,
  createColumns,
  Input,
  Modal,
  Table,
  Tag,
  type TagProps,
} from "@g4rcez/components";
import { LinkIcon } from "@phosphor-icons/react/dist/csr/Link";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/csr/ListBullets";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { FolderSimplePlusIcon } from "@phosphor-icons/react/dist/csr/FolderSimplePlus";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { Link } from "react-router-dom";
import { Note } from "@/store/note";
import { useNoteList, type NoteWithTags } from "@/app/hooks/use-note-list";
import { useGlobalStore } from "@/store/global.store";
import { useEffect, useState } from "react";
import { NoteGroup } from "@/store/repositories/entities/note-group";

const tag: Record<
  Note["noteType"],
  { title: string; theme: TagProps["theme"] }
> = {
  json: { theme: "warn", title: "Json" },
  note: { theme: "primary", title: "Note" },
  quick: { theme: "muted", title: "Quick note" },
  template: { theme: "secondary", title: "Template" },
  "read-it-later": { theme: "info", title: "Read it later" },
  freehand: { theme: "secondary", title: "Freehand" },
};

function AddToGroupModal({
  noteIds,
  open,
  onClose,
}: {
  noteIds: string[];
  open: boolean;
  onClose: () => void;
}) {
  const [state, dispatch] = useGlobalStore();
  const [pendingGroupIds, setPendingGroupIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    dispatch.loadGroups();
  }, []);

  useEffect(() => {
    if (!open) return;
    const initial = new Set(
      state.noteGroups
        .filter((group) =>
          noteIds.every((id) =>
            state.noteGroupMembers.some((m) => m.noteId === id && m.groupId === group.id),
          ),
        )
        .map((g) => g.id),
    );
    setPendingGroupIds(initial);
  }, [open]);

  const toggle = (group: NoteGroup) => {
    setPendingGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(group.id)) next.delete(group.id);
      else next.add(group.id);
      return next;
    });
  };

  const onConfirm = async () => {
    for (const group of state.noteGroups) {
      const wantsIn = pendingGroupIds.has(group.id);
      const allCurrentlyIn = noteIds.every((id) =>
        state.noteGroupMembers.some((m) => m.noteId === id && m.groupId === group.id),
      );
      if (wantsIn && !allCurrentlyIn) {
        for (const id of noteIds) {
          const alreadyIn = state.noteGroupMembers.some(
            (m) => m.noteId === id && m.groupId === group.id,
          );
          if (!alreadyIn) await dispatch.addNoteToGroup(group.id, id);
        }
      } else if (!wantsIn && allCurrentlyIn) {
        for (const id of noteIds) {
          await dispatch.removeNoteFromGroup(group.id, id);
        }
      }
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      className="max-w-sm"
      onChange={onClose}
      title="Add to Group"
    >
      {state.noteGroups.length === 0 ? (
        <p className="text-sm text-foreground/50 py-4 text-center">
          No groups yet. Create one from the Groups page.
        </p>
      ) : (
        <ul className="space-y-1 max-h-64 overflow-y-auto">
          {state.noteGroups.map((group) => (
            <li key={group.id}>
              <label className="flex items-center gap-3 px-2 py-1.5 rounded cursor-pointer hover:bg-muted/30">
                <Checkbox
                  checked={pendingGroupIds.has(group.id)}
                  onChange={() => toggle(group)}
                />
                <span className="text-sm truncate">{group.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 mt-4 w-full justify-end">
        <Button theme="ghost-muted" onClick={onClose}>Cancel</Button>
        <Button theme="primary" onClick={onConfirm}>Confirm</Button>
      </div>
    </Modal>
  );
}

export default function NotesListPage() {
  const {
    loading,
    search,
    setSearch,
    filteredNotes,
    selectedIds,
    toggleSelection,
    selectAll,
    deselectAll,
    handleDelete,
    handleBatchDelete: onBatchDelete,
  } = useNoteList();

  const [groupPickerNoteIds, setGroupPickerNoteIds] = useState<string[]>([]);
  const [batchGroupOpen, setBatchGroupOpen] = useState(false);

  const cols = createColumns<NoteWithTags>((col) => {
    col.add(
      "id",
      <Checkbox
        checked={
          selectedIds.size === filteredNotes.length && filteredNotes.length > 0
        }
        onChange={
          selectedIds.size === filteredNotes.length ? deselectAll : selectAll
        }
      />,
      {
        thProps: { className: "w-12" },
        cellProps: { className: "w-12" },
        Element: (props) => (
          <Checkbox
            onClick={(e) => e.stopPropagation()}
            checked={selectedIds.has(props.row.id)}
            onChange={() => toggleSelection(props.row.id)}
          />
        ),
      },
    );
    col.add("title", "Title", {
      Element: (props) => (
        <Link
          to={`/note/${props.row.id}`}
          className="flex gap-1.5 items-baseline transition-colors duration-300 ease-linear hover:underline text-primary hover:text-primary-hover"
        >
          <LinkIcon className="min-w-4" size={12} />
          {props.row.title}
        </Link>
      ),
    });
    col.add("noteType", "Type", {
      Element: (props) => (
        <Tag className="rounded-xl" size="small" theme={tag[props.value].theme}>
          {tag[props.value].title}
        </Tag>
      ),
    });
    col.add("tagCount", "Hashtags", {
      Element: (props) => props.row.tagCount,
    });
    col.add("createdAt", "Actions", {
      Element: (props) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setGroupPickerNoteIds([props.row.id]);
            }}
            className="p-2 rounded transition-colors text-foreground/50 hover:bg-muted/30 hover:text-foreground"
            title="Add to group"
          >
            <FolderSimplePlusIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDelete(e, props.row.id)}
            className="p-2 text-red-500 rounded transition-colors hover:bg-red-500/10"
            title="Delete note"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    });
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center w-full h-full">
        Loading notes...
      </div>
    );
  }

  return (
    <div className="relative flex-col py-6 mx-auto min-h-full max-w-safe">
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-4 items-center">
          <h1 className="flex gap-2 items-center text-2xl font-bold">
            <ListBulletsIcon className="w-6 h-6" />
            All Notes
          </h1>
        </div>
        <div className="relative w-64">
          <Input
            hiddenLabel
            type="text"
            value={search}
            left={<MagnifyingGlassIcon size={16} />}
            title="Search notes or tags..."
            placeholder="Search notes or tags..."
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <Table
        cols={cols}
        name="notes"
        reference="id"
        useControl={false}
        rows={filteredNotes}
      />

      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 z-50 duration-200 -translate-x-1/2 animate-in slide-in-from-bottom-4 fade-in">
          <div className="flex gap-4 items-center py-3 px-6 rounded-xl border shadow-xl border-border bg-floating-background text-card-foreground">
            <span className="font-medium">{selectedIds.size} selected</span>
            <div className="w-px h-4 bg-border" />
            <Button
              size="small"
              theme="ghost"
              onClick={() => setBatchGroupOpen(true)}
            >
              <FolderSimplePlusIcon className="size-4" />
              Add to group
            </Button>
            <Button size="small" theme="ghost-danger" onClick={onBatchDelete}>
              <TrashIcon className="size-4" />
              Delete
            </Button>
            <button
              onClick={deselectAll}
              className="p-1 ml-2 rounded-full transition-colors hover:bg-muted/50"
              title="Clear selection"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <AddToGroupModal
        noteIds={groupPickerNoteIds}
        open={groupPickerNoteIds.length > 0}
        onClose={() => setGroupPickerNoteIds([])}
      />
      <AddToGroupModal
        noteIds={Array.from(selectedIds)}
        open={batchGroupOpen}
        onClose={() => setBatchGroupOpen(false)}
      />
    </div>
  );
}
