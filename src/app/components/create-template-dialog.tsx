import { Button, Input, Modal } from "@g4rcez/components";
import { FormEvent, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  repositories,
  useGlobalStore,
  globalDispatch,
} from "@/store/global.store";
import { Note } from "@/store/note";
import { isElectron } from "@/lib/is-electron";
import { SettingsService } from "@/store/settings";

export const CreateTemplateDialog = () => {
  const [state] = useGlobalStore();
  const [name, setName] = useState("");
  const navigate = useNavigate();

  const { isOpen } = state.createTemplateDialog;

  useEffect(() => {
    if (isOpen) {
      setName("");
    }
  }, [isOpen]);

  const handleClose = () => {
    globalDispatch.setCreateTemplateDialog(false);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newTemplate = Note.new(
      name,
      "# " + name + "\n\n{{content}}",
      "template"
    );

    if (isElectron()) {
      const settings = SettingsService.load();
      const templatesDir =
        settings.templatesDirectory ||
        (settings.directory ? `${settings.directory}/.templates` : null);

      if (templatesDir) {
        const filePath = `${templatesDir}/${name}.md`;
        newTemplate.filePath = filePath;
        await window.electronAPI.fs.writeFile(filePath, newTemplate.content);
      }
    }

    await repositories.notes.save(newTemplate);

    // Notify listeners that templates have updated
    window.dispatchEvent(new CustomEvent("templates:updated"));

    handleClose();
    navigate(`/templates/${newTemplate.id}`);
  };

  return (
    <Modal
      open={isOpen}
      className="max-w-md"
      onChange={handleClose}
      title="Create new template"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4 p-4">
        <Input
          required
          autoFocus
          value={name}
          title="Template Name"
          placeholder="e.g. Daily Journal"
          onChange={(e) => setName(e.target.value)}
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
