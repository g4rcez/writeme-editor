import { JsonEditor } from "@/app/components/json-editor";
import { Dates } from "@/lib/dates";
import { getUniqueNoteTitle } from "@/lib/file-utils";
import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";
import { Button, Modal } from "@g4rcez/components";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const InspectJsonDialog = () => {
  const [state, dispatch] = useGlobalStore();
  const [json, setJson] = useState(state.inspectJsonInitialContent ?? "");

  useEffect(() => {
    if (state.inspectJsonDialog) {
      setJson(state.inspectJsonInitialContent ?? "");
    }
  }, [state.inspectJsonDialog, state.inspectJsonInitialContent]);
  const [title, setTitle] = useState(
    `json-${Dates.isoDate(new Date())}-${state.notes.length + 1}.md`,
  );
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
      const __ = JSON.parse(json);
      const finalTitle =
        title.trim() || getUniqueNoteTitle("JSON", state.notes);
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
      className="max-w-4xl"
      open={state.inspectJsonDialog}
    >
      <div className="flex flex-col gap-4">
        <JsonEditor
          value={json}
          onChange={setJson}
          className="overflow-hidden h-full rounded border min-h-96 border-floating-border"
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
