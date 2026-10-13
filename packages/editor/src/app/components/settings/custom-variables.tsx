import { Button, Input, Textarea } from "@g4rcez/components";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { useEffect, useState } from "react";
import { v7 as uuid } from "uuid";
import { useScripts } from "@/app/hooks/use-scripts";
import { repositories } from "@/store/repositories";
import { Script } from "@/store/repositories/entities/script";
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
        const newScript = new Script(uuid(), "NEW_VAR", "return 'Value';", new Date(), new Date());
        setLocalScripts([...localScripts, newScript]);
    };

    const handleUpdate = (id: string, updates: Partial<Script>) => {
        setLocalScripts(localScripts.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s)));
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
        <>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                        Create variables that execute JavaScript. Use <code>return</code> to set the value. Available in
                        templates as <code>{"{{VAR_NAME}}"}</code>.
                    </p>
                    <Button size="small" onClick={handleAdd} className="flex shrink-0 items-center gap-1 self-start">
                        <PlusIcon size={14} aria-hidden="true" />
                        Add Variable
                    </Button>
                </div>

                {localScripts.length === 0 ? (
                    <p className="py-6 text-sm text-muted-foreground">
                        No custom variables yet. Add a variable to use it in your templates.
                    </p>
                ) : (
                    <div className="divide-y divide-border">
                        {localScripts.map((script) => (
                            <div key={script.id} className="space-y-3 py-5 first:pt-0">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                    <Input
                                        value={script.name}
                                        title="Variable Name"
                                        optionalText=" "
                                        placeholder="MY_VAR"
                                        container="min-w-0 flex-1"
                                        aria-label={`Variable Name: ${script.name || "unnamed"}`}
                                        onChange={(event) => handleUpdate(script.id, { name: event.target.value })}
                                    />
                                    <Button
                                        size="small"
                                        theme="ghost-danger"
                                        onClick={() => setDeletingId(script.id)}
                                        aria-label={`Delete ${script.name || "unnamed variable"}`}
                                        className="flex shrink-0 items-center gap-1 self-start sm:self-auto"
                                    >
                                        <TrashIcon size={14} aria-hidden="true" />
                                        Delete
                                    </Button>
                                </div>
                                <Textarea
                                    title="JavaScript expression"
                                    aria-label={`JavaScript expression: ${script.name || "unnamed"}`}
                                    optionalText=" "
                                    rows={3}
                                    value={script.content}
                                    placeholder="return new Date().getFullYear();"
                                    onChange={(event) => handleUpdate(script.id, { content: event.target.value })}
                                    className="font-mono text-sm"
                                />
                            </div>
                        ))}
                    </div>
                )}

                {localScripts.length > 0 && (
                    <div className="flex justify-end">
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
        </>
    );
};
