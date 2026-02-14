import { Modal } from "@g4rcez/components";
import { startOfDay } from "date-fns";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dates } from "../../lib/dates";
import { getUniqueNoteTitle } from "../../lib/file-utils";
import { repositories, useGlobalStore } from "../../store/global.store";
import { Note } from "../../store/note";

export const CreateNoteDialog = () => {
  const [state, dispatch] = useGlobalStore();
  const [title, setTitle] = useState("");
  const navigate = useNavigate();

  const { isOpen, type } = state.createNoteDialog;

  useEffect(() => {
    if (isOpen) {
      if (type === "note") {
        setTitle(getUniqueNoteTitle("Untitled", state.notes));
      } else {
        const dateTitle = Dates.yearMonthDay(startOfDay(new Date()));
        setTitle(`${dateTitle}-QuickNote`);
      }
    }
  }, [isOpen, type, state.notes]);

  const handleClose = () => {
    dispatch.setCreateNoteDialog({ isOpen: false, type });
  };

  const handleCreate = async () => {
    if (!title.trim()) return;

    const note = Note.new(title, "", type);
    await repositories.notes.save(note);
    dispatch.note(note);
    handleClose();
    if (type === "note") {
      navigate(`/note/${note.id}`);
    } else {
      navigate(`/quicknote/${note.id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreate();
    }
  };

  return (
    <Modal
      open={isOpen}
      onChange={handleClose}
      title={type === "note" ? "Create New Note" : "Create Quick Note"}
      className="max-w-md"
    >
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="note-title" className="text-sm font-medium">
            Note Title
          </label>
          <input
            id="note-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            Create
          </button>
        </div>
      </div>
    </Modal>
  );
};
