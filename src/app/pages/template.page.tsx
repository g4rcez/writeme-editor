import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import { repositories } from "@/store/repositories";
import { Note } from "@/store/note";
import { Editor } from "../editor";
import { isElectron } from "@/lib/is-electron";
import { Input } from "@g4rcez/components";
import { ArrowLeft, Save } from "lucide-react";

export default function TemplatePage() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");

  const templateRef = useRef<Note | null>(null);
  const titleRef = useRef("");

  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    const loadTemplate = async () => {
      if (!templateId) return;
      setLoading(true);
      const data = await repositories.notes.getOne(templateId);
      if (data) {
        setTemplate(data);
        setTitle(data.title);
      }
      setLoading(false);
    };
    loadTemplate();
  }, [templateId]);

  const onSave = useCallback(
    async (content: string) => {
      const currentTemplate = templateRef.current;
      if (!currentTemplate) return;
      
      setSaving(true);
      try {
        const updated = Note.parse({
          ...currentTemplate,
          content,
          title: titleRef.current || currentTemplate.title,
          updatedAt: new Date(),
        });

        if (isElectron() && updated.filePath) {
          await window.electronAPI.fs.writeFile(updated.filePath, content);
        }

        await repositories.notes.update(updated.id, updated);
        // We only update the ref so future saves have the correct base.
        // We don't call setTemplate(updated) here to avoid the reactivity loop with the Editor.
        templateRef.current = updated;
      } catch (error) {
        console.error("Failed to save template:", error);
      } finally {
        setTimeout(() => setSaving(false), 500);
      }
    },
    [],
  );

  const updateTitle = async (newTitle: string) => {
    setTitle(newTitle);
    const currentTemplate = templateRef.current;
    if (!currentTemplate) return;

    const updated = Note.parse({
      ...currentTemplate,
      title: newTitle,
      updatedAt: new Date(),
    });

    await repositories.notes.update(updated.id, updated);
    setTemplate(updated);
    templateRef.current = updated;
  };

  if (loading) return <div className="p-8">Loading template...</div>;
  if (!template)
    return <div className="p-8 mt-20 text-center">Template not found</div>;

  return (
    <div className="flex flex-col h-full duration-300 bg-background animate-in fade-in">
      <header className="flex sticky top-0 z-10 gap-4 items-center p-4 border-b border-border/40 bg-card-background/50 backdrop-blur-sm">
        <div className="flex flex-col flex-1">
          <Input
            hiddenLabel
            value={title}
            placeholder="Template Name"
            onChange={(e) => updateTitle(e.target.value)}
            className="px-0 h-8 text-xl bg-transparent border-none shadow-none focus:ring-0"
            feedback={
              <div className="flex gap-1.5 items-center px-0.5 text-xs">
                <span className="tracking-widest uppercase opacity-50">
                  Template Editor
                </span>
                {saving ? (
                  <span className="flex gap-1 items-center animate-pulse text-primary">
                    <Save size={8} />
                    Saving...
                  </span>
                ) : (
                  <span className="flex gap-1 items-center text-green-500/70">
                    <Save size={8} />
                    Saved
                  </span>
                )}
              </div>
            }
          />
        </div>
        <div className="flex gap-2">
          <button
            disabled={saving}
            title="Manual save"
            className="p-2 rounded-md transition-colors disabled:opacity-30 text-muted-foreground hover:bg-muted/50"
          >
            <Save size={18} />
          </button>
        </div>
      </header>
      <div className="overflow-y-auto flex-1 px-8 bg-card-background">
        <Editor id={template.id} content={template.content} onSave={onSave} />
      </div>
      <div className="p-4 border-t bg-muted/10 border-border/20 backdrop-blur-sm">
        <p className="font-bold tracking-widest text-center uppercase opacity-60 text-[10px] text-muted-foreground">
          Template Syntax
        </p>
        <p className="mt-1 text-xs text-center text-muted-foreground">
          Use{" "}
          <code className="px-1 rounded bg-primary/5">
            {"{{VARIABLE_NAME}}"}
          </code>{" "}
          for placeholders. Standard:{" "}
          <code className="px-1 rounded bg-muted">{"{{DATE}}"}</code>,
          <code className="px-1 rounded bg-muted">{"{{TIME}}"}</code>,
          <code className="px-1 rounded bg-muted">{"{{TITLE}}"}</code>.
        </p>
      </div>
    </div>
  );
}
