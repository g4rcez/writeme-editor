import { useCallback, useEffect, useState } from "react";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import { TrashSimpleIcon } from "@phosphor-icons/react/dist/csr/TrashSimple";
import { Button } from "@g4rcez/components";
import { globalDispatch } from "@/store/global.store";
import { type Note } from "@/store/note";
import { repositories } from "@/store/repositories";
import { Confirm } from "../confirm";

export const TrashPane = () => {
  const [trashed, setTrashed] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const notes = await repositories.notes.getTrashed();
      setTrashed(notes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRestore = async (id: string) => {
    await globalDispatch.restoreNote(id);
    setTrashed((prev) => prev.filter((n) => n.id !== id));
  };

  const handleHardDelete = async () => {
    if (!confirmDeleteId) return;
    await globalDispatch.hardDeleteNote(confirmDeleteId);
    setTrashed((prev) => prev.filter((n) => n.id !== confirmDeleteId));
    setConfirmDeleteId(null);
  };

  const handleEmptyTrash = async () => {
    await globalDispatch.emptyTrash();
    setTrashed([]);
    setConfirmEmpty(false);
  };

  const confirmingNote = trashed.find((n) => n.id === confirmDeleteId);

  return (
    <div className="flex flex-col h-full bg-background/50">
      <div className="flex justify-between items-center py-2 px-4 border-b border-border/20">
        <span className="font-bold tracking-wider uppercase text-xs text-muted-foreground">
          Trash
        </span>
        {trashed.length > 0 && (
          <Button
            theme="ghost-danger"
            onClick={() => setConfirmEmpty(true)}
            className="text-xs h-6 px-2"
          >
            Empty Trash
          </Button>
        )}
      </div>

      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex justify-center items-center h-20 text-xs text-muted-foreground">
            Loading...
          </div>
        ) : trashed.length === 0 ? (
          <div className="flex flex-col gap-2 justify-center items-center h-40 text-center">
            <TrashSimpleIcon className="opacity-20 size-8" />
            <p className="text-xs text-muted-foreground">Trash is empty</p>
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            {trashed.map((note) => (
              <div
                key={note.id}
                className="flex gap-2 items-center py-1.5 px-2 w-full text-sm rounded-md group text-muted-foreground"
              >
                <span className="flex-1 text-left truncate text-xs">
                  {note.title}
                </span>
                <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    title="Restore"
                    onClick={() => handleRestore(note.id)}
                    className="p-1 rounded transition-all text-primary hover:bg-primary/10"
                  >
                    <ArrowCounterClockwiseIcon className="size-3" />
                  </button>
                  <button
                    type="button"
                    title="Delete permanently"
                    onClick={() => setConfirmDeleteId(note.id)}
                    className="p-1 rounded transition-all text-destructive hover:bg-destructive/10"
                  >
                    <TrashSimpleIcon className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Confirm
        type="danger"
        confirmText="Delete permanently"
        title="Delete permanently"
        open={!!confirmDeleteId}
        onConfirm={handleHardDelete}
        onCancel={() => setConfirmDeleteId(null)}
        message={`"${confirmingNote?.title}" will be permanently deleted and cannot be recovered.`}
      />

      <Confirm
        type="danger"
        confirmText="Empty Trash"
        title="Empty Trash"
        open={confirmEmpty}
        onConfirm={handleEmptyTrash}
        onCancel={() => setConfirmEmpty(false)}
        message={`All ${trashed.length} note${trashed.length === 1 ? "" : "s"} in Trash will be permanently deleted.`}
      />
    </div>
  );
};
