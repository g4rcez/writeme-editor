import {
  LayoutTemplate,
  Plus,
  FileText,
  Trash2,
  RefreshCw,
  FilePlus,
  Info,
  Code,
} from "lucide-react";
import { useTemplates } from "@/app/hooks/use-templates";
import { useScripts } from "@/app/hooks/use-scripts";
import { useNavigate } from "react-router-dom";
import { repositories } from "@/store/repositories";
import { Note } from "@/store/note";
import { globalDispatch } from "@/store/global.store";
import { isElectron } from "@/lib/is-electron";
import { SYSTEM_VARIABLES } from "@/lib/template-utils";
import { Confirm } from "../confirm";
import { useState } from "react";
import { Tag, Modal, Button } from "@g4rcez/components";
import { Editor } from "../../editor";
import { Script } from "@/store/repositories/entities/script";
import { SystemVariable } from "@/lib/template-utils";

export const TemplatesPane = () => {
  const { templates, loading, refresh } = useTemplates();
  const { scripts, refresh: refreshScripts } = useScripts();
  const navigate = useNavigate();
  const [deletingTemplate, setDeletingTemplate] = useState<Note | null>(null);
  const [inspectingVariable, setInspectingVariable] = useState<{
    name: string;
    description?: string;
    content?: string;
    type: "system" | "script";
  } | null>(null);

  const onCreateTemplate = () => {
    globalDispatch.setCreateTemplateDialog(true);
  };

  const onCreateVariable = () => {
    globalDispatch.setCreateVariableDialog(true);
  };

  const onCreateNoteFromTemplate = (
    e: React.MouseEvent,
    template: Note,
  ) => {
    e.stopPropagation();
    globalDispatch.setCreateNoteDialog({
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

    await repositories.notes.delete(deletingTemplate.id);
    setDeletingTemplate(null);
    refresh();
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
            <RefreshCw className="size-3" />
          </button>
          <button
            onClick={onCreateTemplate}
            className="p-1 rounded-md transition-colors text-muted-foreground hover:bg-muted/50"
            title="New template"
          >
            <Plus className="size-3" />
          </button>
          <button
            onClick={onCreateVariable}
            className="p-1 rounded-md transition-colors text-muted-foreground hover:bg-muted/50"
            title="New from Expression"
          >
            <Code className="size-3" />
          </button>
        </div>
      </div>
      <div className="overflow-y-auto flex-1 p-2">
        {loading ? (
          <div className="flex justify-center items-center h-20 text-xs text-muted-foreground">
            Loading...
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col gap-2 justify-center items-center h-40 text-center">
            <LayoutTemplate className="opacity-20 size-8" />
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
                <FileText className="opacity-60 size-3.5" />
                <span className="flex-1 text-left truncate">
                  {template.title}
                </span>
                <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => onCreateNoteFromTemplate(e, template)}
                    className="p-1 rounded transition-all text-primary hover:bg-primary/10"
                    title="Create note from template"
                  >
                    <FilePlus className="size-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingTemplate(template);
                    }}
                    className="p-1 rounded transition-all text-destructive hover:bg-destructive/10"
                    title="Delete template"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-4 border-t border-border/20 bg-muted/10">
        <div className="flex gap-1.5 items-center mb-2 opacity-50">
          <Info size={10} />
          <span className="font-bold tracking-widest uppercase text-[10px]">
            Variables
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SYSTEM_VARIABLES.map((variable) => (
            <Tag
              as="button"
              size="small"
              type="button"
              theme="secondary"
              key={variable.name}
              title="Click to view details"
              onClick={() => {
                setInspectingVariable({
                  name: variable.name,
                  description: (variable as SystemVariable).description,
                  type: "system",
                });
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
                  name: script.name,
                  content: script.content,
                  type: "script",
                });
              }}
            >
              {`{{${script.name}}}`}
            </Tag>
          ))}
        </div>
      </div>

      <Modal
        open={!!inspectingVariable}
        onChange={() => setInspectingVariable(null)}
        title={`Variable: {{${inspectingVariable?.name}}}`}
        className="max-w-lg"
      >
        <div className="flex flex-col gap-4 p-6">
          {inspectingVariable?.type === "system" ? (
            <div className="space-y-2">
              <p className="text-sm text-foreground">
                {inspectingVariable.description}
              </p>
              <p className="text-xs text-muted-foreground italic">
                This is a system-provided variable and cannot be modified.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-70">
                JavaScript Expression
              </span>
              <div className="border rounded-md overflow-hidden bg-card-background max-h-[300px] overflow-y-auto">
                <Editor
                  id={`inspect-${inspectingVariable?.name}`}
                  readonly
                  content={`\`\`\`javascript\n${inspectingVariable?.content}\n\`\`\``}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              theme="ghost-muted"
              onClick={() => {
                if (inspectingVariable) {
                  navigator.clipboard.writeText(`{{${inspectingVariable.name}}}`);
                  setInspectingVariable(null);
                }
              }}
            >
              Copy Placeholder
            </Button>
            <Button theme="primary" onClick={() => setInspectingVariable(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <Confirm
        open={!!deletingTemplate}
        title="Delete Template"
        message={`Are you sure you want to delete "${deletingTemplate?.name}"? This will also delete the physical file if applicable.`}
        type="danger"
        confirmText="Delete"
        onConfirm={onDeleteTemplate}
        onCancel={() => setDeletingTemplate(null)}
      />
    </div>
  );
};
