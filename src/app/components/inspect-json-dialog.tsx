import { Modal, Button, Textarea, Input } from "@g4rcez/components";
import { useState } from "react";
import { globalDispatch, useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";
import { useNavigate } from "react-router-dom";
import { getUniqueNoteTitle } from "@/lib/file-utils";

export const InspectJsonDialog = () => {
  const [state, dispatch] = useGlobalStore();
  const [json, setJson] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleClose = () => {
    dispatch.setInspectJsonDialog(false);
    setJson("");
    setTitle("");
    setError(null);
  };

  const handleInspect = async () => {
    try {
      if (!json.trim()) return;
      JSON.parse(json); // Validate JSON
      
      const finalTitle = title.trim() || getUniqueNoteTitle("JSON Inspector", state.notes);
      const note = Note.new(finalTitle, json, "json" as any);
      await repositories.notes.save(note);
      dispatch.notes(await repositories.notes.getAll());
      dispatch.note(note);
      handleClose();
      navigate(`/note/${note.id}`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Modal
      open={state.inspectJsonDialog}
      onChange={handleClose}
      title="Inspect JSON"
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-4 p-4">
        <Input
          label="Title (Optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter a title for this JSON inspection"
        />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">JSON Data</span>
          <Textarea
            value={json}
            rows={15}
            onChange={(e: any) => setJson(e.target.value)}
            placeholder='Paste your JSON here... e.g. { "name": "Writeme", "version": "1.0.0" }'
            className="font-mono text-xs"
          />
        </div>
        {error && (
          <div className="p-2 text-xs text-red-500 rounded bg-red-50 dark:bg-red-950/30">
            Invalid JSON: {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button theme="muted" onClick={handleClose}>
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
