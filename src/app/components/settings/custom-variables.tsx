import { Button, Card, Input, Textarea, uuid } from "@g4rcez/components";
import { Plus, Trash2, Code } from "lucide-react";
import { useEffect, useState } from "react";
import { repositories } from "@/store/repositories";
import { Script } from "@/store/repositories/entities/script";
import { useScripts } from "@/app/hooks/use-scripts";
import { uiDispatch } from "@/store/ui.store";
import { Confirm } from "../confirm";

export const CustomVariables = () => {
  const { scripts, refresh } = useScripts();
  const [localScripts, setLocalScripts] = useState<Script[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setLocalScripts(scripts);
  }, [scripts]);

  const handleAdd = () => {
    const newScript = new Script(
      uuid(),
      "NEW_VAR",
      "return 'Value';",
      new Date(),
      new Date(),
    );
    setLocalScripts([...localScripts, newScript]);
  };

  const handleUpdate = (id: string, updates: Partial<Script>) => {
    setLocalScripts(
      localScripts.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s,
      ),
    );
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await repositories.scripts.delete(deletingId);
    setLocalScripts(localScripts.filter((s) => s.id !== deletingId));
    setDeletingId(null);
    refresh();
  };

  const handleSaveAll = async () => {
    for (const script of localScripts) {
      await repositories.scripts.save(script);
    }
    uiDispatch.setAlert({
      open: true,
      message: "Custom variables saved!",
      type: "success",
    });
    refresh();
  };

  return (
    <Card title="Custom Variables (JS Expressions)">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="max-w-md text-sm text-muted-foreground">
            Create variables that execute JavaScript. Use <code>return</code> to
            set the value. Available in templates as{" "}
            <code>{"{{VAR_NAME}}"}</code>.
          </p>
          <Button
            size="small"
            onClick={handleAdd}
            className="flex gap-1 items-center"
          >
            <Plus size={14} />
            Add Variable
          </Button>
        </div>

        {localScripts.length === 0 ? (
          <div className="flex flex-col gap-2 items-center p-8 rounded-lg border border-dashed border-border/50 opacity-50">
            <Code size={24} />
            <p className="text-sm">No custom variables yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {localScripts.map((script) => (
              <div
                key={script.id}
                className="relative p-4 space-y-4 rounded-lg border bg-muted/5 border-border/50"
              >
                <div className="flex justify-between items-start gap-4">
                  <Input
                    value={script.name}
                    title="Variable Name"
                    placeholder="MY_VAR"
                    container="flex-1"
                    onChange={(e: any) =>
                      handleUpdate(script.id, { name: e.target.value })
                    }
                  />
                  <Button
                    size="small"
                    theme="ghost-danger"
                    onClick={() => setDeletingId(script.id)}
                    className="mt-6"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground opacity-70 ml-1">
                    JS Expression
                  </span>
                  <Textarea
                    rows={2}
                    value={script.content}
                    placeholder="return new Date().getFullYear();"
                    onChange={(e: any) =>
                      handleUpdate(script.id, { content: e.target.value })
                    }
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {localScripts.length > 0 && (
          <div className="flex justify-end pt-4 border-t border-border/50">
            <Button size="small" onClick={handleSaveAll}>
              Save Variables
            </Button>
          </div>
        )}
      </div>

      <Confirm
        open={!!deletingId}
        title="Delete Variable"
        message="Are you sure you want to delete this custom variable? This action cannot be undone."
        type="danger"
        confirmText="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </Card>
  );
};
