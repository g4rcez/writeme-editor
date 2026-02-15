import { Button, Input, Modal } from "@g4rcez/components";
import { startOfDay } from "date-fns";
import { FormEvent, useEffect, useState } from "react";
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

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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

  return (
    <Modal
      open={isOpen}
      className="max-w-md"
      onChange={handleClose}
      title={type === "note" ? "Create new Note" : "Create quick Note"}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4 p-4">
        <Input
          required
          autoFocus
          value={title}
          id="note-title"
          title="Note title"
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex gap-2 justify-end">
          <Button theme="muted" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </Modal>
  );
};
