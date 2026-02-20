import { Button, Input, Modal, Select } from "@g4rcez/components";
import { startOfDay } from "date-fns";
import { FormEvent, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Dates } from "@/lib/dates";
import { getUniqueNoteTitle } from "@/lib/file-utils";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { useTemplates } from "@/app/hooks/use-templates";
import { useScripts } from "@/app/hooks/use-scripts";
import { getUserVariables, substituteVariables } from "@/lib/template-utils";

export const CreateNoteDialog = () => {
  const [state, dispatch] = useGlobalStore();
  const [title, setTitle] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    {},
  );
  const { templates } = useTemplates();
  const { scripts } = useScripts();
  const navigate = useNavigate();

  const { isOpen, type, templateId } = state.createNoteDialog;

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId),
    [templates, selectedTemplateId],
  );

  const userVariables = useMemo(() => {
    if (!selectedTemplate) return [];
    const scriptNames = scripts.map((s) => s.name);
    return getUserVariables(selectedTemplate.content, scriptNames);
  }, [selectedTemplate, scripts]);

  useEffect(() => {
    if (isOpen) {
      if (type === "note") {
        setTitle(getUniqueNoteTitle("Untitled", state.notes));
      } else {
        const dateTitle = Dates.yearMonthDay(startOfDay(new Date()));
        setTitle(`${dateTitle}-QuickNote`);
      }
      setSelectedTemplateId(templateId || "");
      setVariableValues({});
    }
  }, [isOpen, type, templateId, state.notes]);

  const handleClose = () => {
    dispatch.setCreateNoteDialog({ isOpen: false, type });
  };

  const onVariableChange = (name: string, value: string) => {
    setVariableValues((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;

    let content = "";
    if (selectedTemplateId) {
      const latestTemplate = await repositories.notes.getOne(selectedTemplateId);
      if (latestTemplate) {
        content = substituteVariables(
          latestTemplate.content,
          {
            ...variableValues,
            TITLE: title,
          },
          scripts,
        );
      }
    }

    const note = Note.new(title, content, type);
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
      title={type === "note" ? "Create new note" : "Create quick note"}
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

        {type === "note" && templates.length > 0 && (
          <div className="flex flex-col gap-4">
            <Select
              value={selectedTemplateId}
              title="From Template (Optional)"
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              options={[
                { value: "", label: "Blank Document" },
                ...templates.map((t) => ({ value: t.id, label: t.title })),
              ]}
            />

            {userVariables.length > 0 && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border/40 space-y-3">
                <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground opacity-70">
                  Template Variables
                </span>
                <div className="grid grid-cols-1 gap-3">
                  {userVariables.map((v) => (
                    <Input
                      key={v}
                      title={v}
                      value={variableValues[v] || ""}
                      onChange={(e) => onVariableChange(v, e.target.value)}
                      placeholder={`Enter ${v}...`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-4">
          <Button theme="muted" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">
            Create {selectedTemplate ? "from template" : ""}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
