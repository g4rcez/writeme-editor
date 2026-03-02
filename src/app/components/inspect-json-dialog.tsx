import { Modal, Button, Textarea, Input } from "@g4rcez/components";
import { useState } from "react";
import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";
import { useNavigate } from "react-router-dom";
import { getUniqueNoteTitle } from "@/lib/file-utils";

export const InspectJsonDialog = () => {
  const [state, dispatch] = useGlobalStore();
  const [json, setJson] = useState("");
  const [title, setTitle] = useState(`${new Date()}.md`);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const onClose = () => {
    dispatch.setInspectJsonDialog(false);
    setJson("");
    setTitle("");
    setError(null);
  };

  const handleInspect = async () => {
    try {
      if (!json.trim()) return;
      JSON.parse(json); // Validate JSON

      const finalTitle =
        title.trim() || getUniqueNoteTitle("JSON Inspector", state.notes);
      const note = Note.new(finalTitle, json, "json" as any);
      await repositories.notes.save(note);
      dispatch.notes(await repositories.notes.getAll());
      dispatch.note(note);
      onClose();
      navigate(`/note/${note.id}`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Modal
      onChange={onClose}
      title="Inspect JSON"
      className="max-w-2xl"
      open={state.inspectJsonDialog}
    >
      <div className="flex flex-col gap-4">
        <Textarea
          required
          rows={15}
          value={json}
          title="JSON Data"
          onChange={(e: any) => setJson(e.target.value)}
          placeholder='Paste your JSON here... e.g. { "name": "Writeme", "version": "1.0.0" }'
        />
        {error && (
          <div className="p-2 text-xs text-red-500 bg-red-50 rounded dark:bg-red-950/30">
            Invalid JSON: {error}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <Button theme="muted" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleInspect} disabled={!json.trim()}>
            Inspect Graph
          </Button>
        </div>
      </div>
    </Modal>
  );
};
