import { useScripts } from "@/app/hooks/use-scripts";
import { useTemplates } from "@/app/hooks/use-templates";
import { isElectron } from "@/lib/is-electron";
import { SYSTEM_VARIABLES, type SystemVariable } from "@/lib/template-utils";
import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";
import { Button, Input, Modal, Tag } from "@g4rcez/components";
import { ArrowsCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowsCounterClockwise";
import { CodeIcon } from "@phosphor-icons/react/dist/csr/Code";
import { FilePlusIcon } from "@phosphor-icons/react/dist/csr/FilePlus";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { LayoutIcon } from "@phosphor-icons/react/dist/csr/Layout";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { parse as mdParser } from "marked";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Editor } from "../../editor";
import { Confirm } from "../confirm";

export const TemplatesPane = () => {
  const [, dispatch] = useGlobalStore();
  const { templates, loading, refresh } = useTemplates();
  const { scripts, refresh: refreshScripts } = useScripts();
  const navigate = useNavigate();
  const [deletingTemplate, setDeletingTemplate] = useState<Note | null>(null);
  const [inspectingVariable, setInspectingVariable] = useState<{
    id?: string;
    name: string;
    description?: string;
    content?: string;
    type: "system" | "script";
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");

  const onCreateTemplate = () => {
    dispatch.setCreateTemplateDialog(true);
  };

  const onCreateVariable = () => {
    dispatch.setCreateVariableDialog(true);
  };

  const onCreateNoteFromTemplate = (e: React.MouseEvent, template: Note) => {
    e.stopPropagation();
    dispatch.setCreateNoteDialog({
      isOpen: true,
      type: "note",
      templateId: template.id,
    });
  };

  const onDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    if (isElectron() && deletingTemplate.filePath) {
      await window.electronAPI.fs.deleteFile(deletingTemplate.filePath);
    }
    await dispatch.deleteNote(deletingTemplate.id);
    setDeletingTemplate(null);
    refresh();
  };

  const unwrapExpression = (content: string) => {
    const dom = new DOMParser().parseFromString(
      mdParser(content, {
        gfm: true,
        breaks: false,
        async: false,
        silent: true,
      }) as string,
      "text/html",
    );
    const codeBlock = dom.querySelector("code");
    return codeBlock ? codeBlock.innerText.trim().replace(/\n$/g, "") : content;
  };

  const handleUpdateVariable = async () => {
    if (!inspectingVariable?.id || !editName) return;
    const script = await repositories.scripts.getOne(inspectingVariable.id);
    if (!script) return;
    script.name = editName.toUpperCase().replace(/\s+/g, "_");
    script.content = unwrapExpression(editContent);
    script.updatedAt = new Date();
    await repositories.scripts.update(script.id, script);
    setInspectingVariable({
      ...inspectingVariable,
      name: script.name,
      content: script.content,
    });
    setIsEditing(false);
    refreshScripts();
  };

  const onDeleteVariable = async () => {
    if (!inspectingVariable?.id) return;
    const confirmed = await Modal.confirm({
      title: "Delete variable",
      description: `Are you sure you want to delete variable {{${inspectingVariable.name}}}?`,
      confirm: { text: "Delete", theme: "danger" },
    });
    if (confirmed) {
      await repositories.scripts.delete(inspectingVariable.id);
      setInspectingVariable(null);
      refreshScripts();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/50">
      <div className="flex justify-between items-center py-2 px-4 border-b border-border/20">
        <span className="font-bold tracking-wider uppercase text-[10px] text-muted-foreground">
          Templates
        </span>
        <div className="flex gap-1">
          <button
            onClick={refresh}
            className="p-1 rounded-md transition-colors text-muted-foreground hover:bg-muted/50"
            title="Refresh templates"
          >
            <ArrowsCounterClockwiseIcon className="size-3" />
          </button>
          <button
            onClick={onCreateTemplate}
            className="p-1 rounded-md transition-colors text-muted-foreground hover:bg-muted/50"
            title="New template"
          >
            <PlusIcon className="size-3" />
          </button>
          <button
            onClick={onCreateVariable}
            className="p-1 rounded-md transition-colors text-muted-foreground hover:bg-muted/50"
            title="New from Expression"
          >
            <CodeIcon className="size-3" />
          </button>
        </div>
      </div>
      <div>
        <div className="flex justify-between items-center py-2 px-4 border-b border-border/20">
          <span className="font-bold tracking-wider uppercase text-xs text-muted-foreground">
            Variables
          </span>
          <div className="flex gap-1">
            <button
              onClick={onCreateVariable}
              title="New from Expression"
              className="p-1 rounded-md transition-colors text-muted-foreground hover:bg-muted/50"
            >
              <PlusIcon className="size-3" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 p-3">
          {SYSTEM_VARIABLES.map((variable) => (
            <Tag
              as="button"
              size="small"
              type="button"
              theme="secondary"
              className="text-xs"
              key={variable.name}
              title="Click to view details"
              onClick={() => {
                setInspectingVariable({
                  name: variable.name,
                  description: (variable as SystemVariable).description,
                  type: "system",
                });
                setIsEditing(false);
              }}
            >
              {`{{${variable.name}}}`}
            </Tag>
          ))}
          {scripts.map((script) => (
            <Tag
              as="button"
              size="small"
              type="button"
              key={script.id}
              theme="primary"
              title="Click to view details"
              onClick={() => {
                setInspectingVariable({
                  id: script.id,
                  name: script.name,
                  content: script.content,
                  type: "script",
                });
                setEditName(script.name);
                setEditContent(script.content || "");
                setIsEditing(true);
              }}
            >
              {`{{${script.name}}}`}
            </Tag>
          ))}
        </div>
      </div>
      <div className="overflow-y-auto flex-1 p-2 border-t border-border/20">
        {loading ? (
          <div className="flex justify-center items-center h-20 text-xs text-muted-foreground">
            Loading...
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col gap-2 justify-center items-center h-40 text-center">
            <LayoutIcon className="opacity-20 size-8" />
            <p className="text-xs text-muted-foreground">No templates found</p>
            <button
              onClick={onCreateTemplate}
              className="hover:underline text-[10px] text-primary"
            >
              Create your first template
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => navigate(`/templates/${template.id}`)}
                className="flex gap-2 items-center py-1.5 px-2 w-full text-sm rounded-md transition-colors cursor-pointer group text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <FileTextIcon className="opacity-60 size-3.5" />
                <span className="flex-1 text-left truncate">
                  {template.title}
                </span>
                <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => onCreateNoteFromTemplate(e, template)}
                    className="p-1 rounded transition-all text-primary hover:bg-primary/10"
                    title="Create note from template"
                  >
                    <FilePlusIcon className="size-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingTemplate(template);
                    }}
                    className="p-1 rounded transition-all text-destructive hover:bg-destructive/10"
                    title="Delete template"
                  >
                    <TrashIcon className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Modal
        open={!!inspectingVariable}
        onChange={() => setInspectingVariable(null)}
        className={
          inspectingVariable?.type === "system" ? "max-w-lg" : "max-w-3xl"
        }
        title={
          isEditing
            ? `Editing variable: {{${inspectingVariable?.name}}}`
            : `Variable: {{${inspectingVariable?.name}}}`
        }
      >
        <div className="flex flex-col gap-4">
          {inspectingVariable?.type === "system" ? (
            <div className="space-y-2">
              <p>{inspectingVariable.description}</p>
              <p className="text-sm italic font-light text-muted-foreground">
                This is a system-provided variable and cannot be modified.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Input
                autoFocus
                optionalText=" "
                value={editName}
                title="Variable name"
                placeholder="VAR_NAME"
                onChange={(e) => setEditName(e.target.value)}
              />
              <div className="space-y-2">
                <span className="font-bold tracking-widest uppercase opacity-70 text-[10px] text-muted-foreground">
                  JavaScript Expression
                </span>
                <div className="overflow-hidden overflow-y-auto rounded-md border bg-card-background border-border/20">
                  <Editor
                    id={`edit-${inspectingVariable?.id}`}
                    content={`\`\`\`javascript\n${editContent}\n\`\`\``}
                    onSave={async (content) => setEditContent(content)}
                  />
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-4 border-t border-border/20">
            {inspectingVariable?.type === "script" ? (
              <>
                <div className="flex flex-1">
                  <Button theme="ghost-danger" onClick={onDeleteVariable}>
                    Delete
                  </Button>
                </div>
                <Button
                  theme="ghost-muted"
                  onClick={() => setInspectingVariable(null)}
                >
                  Cancel
                </Button>
                <Button
                  theme="ghost-primary"
                  onClick={() => {
                    if (inspectingVariable) {
                      navigator.clipboard.writeText(
                        `{{${inspectingVariable.name}}}`,
                      );
                      setInspectingVariable(null);
                    }
                  }}
                >
                  Copy placeholder
                </Button>
                <Button theme="primary" onClick={handleUpdateVariable}>
                  Save changes
                </Button>
              </>
            ) : (
              <>
                <Button
                  theme="ghost-muted"
                  onClick={() => setInspectingVariable(null)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    if (inspectingVariable) {
                      navigator.clipboard.writeText(
                        `{{${inspectingVariable.name}}}`,
                      );
                      setInspectingVariable(null);
                    }
                  }}
                >
                  Copy placeholder
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>
      <Confirm
        type="danger"
        confirmText="Delete"
        title="Delete template"
        open={!!deletingTemplate}
        onConfirm={onDeleteTemplate}
        onCancel={() => setDeletingTemplate(null)}
        message={`Are you sure you want to delete "${deletingTemplate?.title}"? This will also delete the physical file if applicable.`}
      />
    </div>
  );
};
