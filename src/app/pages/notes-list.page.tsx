import { Button, Checkbox, createColumns, Input, Modal, Table, Tag, type TagProps } from "@g4rcez/components";
import { FilePlusIcon } from "@phosphor-icons/react/dist/csr/FilePlus";
import { FolderSimplePlusIcon } from "@phosphor-icons/react/dist/csr/FolderSimplePlus";
import { LinkIcon } from "@phosphor-icons/react/dist/csr/Link";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/csr/ListBullets";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Note } from "@/store/note";
import type { NoteGroup } from "@/store/repositories/entities/note-group";
import { useNoteList, type NoteWithTags } from "@/app/hooks/use-note-list";
import { useGlobalStore } from "@/store/global.store";

const tag: Record<Note["noteType"], { title: string; theme: TagProps["theme"] }> = {
    json: { theme: "warn", title: "Json" },
    note: { theme: "primary", title: "Note" },
    quick: { theme: "muted", title: "Quick note" },
    math: { theme: "neutral", title: "Math" },
    template: { theme: "secondary", title: "Template" },
    "read-it-later": { theme: "info", title: "Read it later" },
    freehand: { theme: "secondary", title: "Freehand" },
    excalidraw: { theme: "neutral", title: "Excalidraw" },
};

function AddToGroupModal({ noteIds, open, onClose }: { noteIds: string[]; open: boolean; onClose: () => void }) {
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
                    const alreadyIn = state.noteGroupMembers.some((m) => m.noteId === id && m.groupId === group.id);
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
        <Modal open={open} onChange={onClose} className="max-w-sm" title="Add to Group">
            {state.noteGroups.length === 0 ? (
                <p className="text-sm text-foreground/50 py-4 text-center">
                    No groups yet. Create one from the Groups page.
                </p>
            ) : (
                <ul className="space-y-1 max-h-64 overflow-y-auto">
                    {state.noteGroups.map((group) => (
                        <li key={group.id}>
                            <label
                                htmlFor={`group-${group.id}`}
                                className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-muted/30"
                            >
                                <Checkbox
                                    id={`group-${group.id}`}
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
                <Button theme="ghost-muted" onClick={onClose}>
                    Cancel
                </Button>
                <Button theme="primary" onClick={onConfirm}>
                    Confirm
                </Button>
            </div>
        </Modal>
    );
}

export default function NotesListPage() {
    const {
        loading,
        search,
        setSearch,
        notes,

        filteredNotes,
        selectedIds,
        toggleSelection,
        selectAll,
        deselectAll,
        handleDelete,
        handleBatchDelete: onBatchDelete,
    } = useNoteList();

    const [, dispatch] = useGlobalStore();
    const [groupPickerNoteIds, setGroupPickerNoteIds] = useState<string[]>([]);
    const [batchGroupOpen, setBatchGroupOpen] = useState(false);

    const createNewNote = () => dispatch.setCreateNoteDialog({ isOpen: true, type: "note" });

    const renderNotesContent = (): ReactNode => {
        if (notes.length === 0) {
            return (
                <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FilePlusIcon size={20} aria-hidden="true" />
                    </span>
                    <p className="mt-3 text-sm font-medium text-foreground">No notes yet.</p>
                    <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                        Create your first note to start building your local workspace.
                    </p>
                    <Button type="button" theme="outlined" size="small" onClick={createNewNote} className="mt-4">
                        Create a note
                    </Button>
                </div>
            );
        }

        if (filteredNotes.length === 0) {
            return (
                <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
                    <p className="text-sm font-medium text-foreground">No notes match “{search}”.</p>
                    <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                        Try a different title, content, description, or tag, or clear the search to see every note.
                    </p>
                    <Button type="button" theme="outlined" size="small" onClick={() => setSearch("")} className="mt-4">
                        Clear search
                    </Button>
                </div>
            );
        }

        return (
            <div className="mt-5 overflow-x-auto rounded-xl border border-border/45 bg-card-background">
                <Table
                    name="notes"
                    reference="id"
                    useControl={false}
                    cols={cols as any}
                    rows={filteredNotes as any[]}
                />
            </div>
        );
    };

    const cols = createColumns<NoteWithTags>((col) => {
        col.add(
            "id",
            <Checkbox
                checked={selectedIds.size === filteredNotes.length && filteredNotes.length > 0}
                onChange={selectedIds.size === filteredNotes.length ? deselectAll : selectAll}
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
                        type="button"
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
                        type="button"
                        onClick={(e) => handleDelete(e, props.row.id)}
                        className="p-2 text-danger rounded transition-colors hover:bg-danger/10"
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
            <div className="flex h-full w-full items-center justify-center p-8 text-sm text-muted-foreground">
                Loading notes...
            </div>
        );
    }

    return (
        <section className="writeme-notes-list-page mx-auto min-h-full w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
            <header className="border-b border-border/45 pb-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                            <ListBulletsIcon size={14} aria-hidden="true" />
                            Your workspace
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">All Notes</h1>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Browse every note in your workspace, or search by title, content, description, or tag.
                        </p>
                    </div>
                    <Button
                        type="button"
                        theme="primary"
                        size="small"
                        onClick={createNewNote}
                        className="inline-flex shrink-0 items-center gap-2 self-start sm:self-auto"
                    >
                        <FilePlusIcon size={16} aria-hidden="true" />
                        New note
                    </Button>
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                        <Input
                            value={search}
                            optionalText=" "
                            left={<MagnifyingGlassIcon size={16} aria-hidden="true" />}
                            title="Search notes or tags..."
                            placeholder="Search notes or tags..."
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <span className="shrink-0 pb-2 text-xs text-muted-foreground">
                        {filteredNotes.length} of {notes.length} {notes.length === 1 ? "note" : "notes"}
                    </span>
                </div>
            </header>
            {renderNotesContent()}

            {selectedIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 z-50 duration-200 -translate-x-1/2 animate-in slide-in-from-bottom-4 fade-in">
                    <div className="flex gap-4 items-center py-3 px-6 rounded-xl border shadow-xl border-border bg-floating-background text-card-foreground">
                        <span className="font-medium">{selectedIds.size} selected</span>
                        <div className="w-px h-4 bg-border" />
                        <Button size="small" theme="ghost-danger" onClick={() => setBatchGroupOpen(true)}>
                            <FolderSimplePlusIcon className="size-4" />
                            Add to group
                        </Button>
                        <Button size="small" theme="ghost-danger" onClick={onBatchDelete}>
                            <TrashIcon className="size-4" />
                            Delete
                        </Button>
                        <button
                            type="button"
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
        </section>
    );
}
