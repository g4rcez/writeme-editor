import { Autocomplete, Button, Input, Modal } from "@g4rcez/components";
import { startOfDay } from "date-fns";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScripts } from "@/app/hooks/use-scripts";
import { useTemplates } from "@/app/hooks/use-templates";
import { buildExcalidrawNoteContent } from "@/lib/excalidraw-note";
import { getUniqueNoteTitle } from "@/lib/file-utils";
import { getDailyQuickNoteTitle } from "@/lib/quicknote-utils";
import { getUserVariables, substituteVariables } from "@/lib/template-utils";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";

export const CreateNoteDialog = () => {
    const [state, dispatch] = useGlobalStore();
    const [title, setTitle] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
    const [variableValues, setVariableValues] = useState<Record<string, string>>({});
    const { templates } = useTemplates();
    const { scripts } = useScripts();
    const navigate = useNavigate();

    const { isOpen, type, templateId, initialTitle } = state.createNoteDialog;

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
            if (type === "quick") {
                setTitle(getDailyQuickNoteTitle(startOfDay(new Date())));
            } else {
                setTitle(getUniqueNoteTitle(initialTitle?.trim() ?? "", state.notes));
            }
            setSelectedTemplateId(templateId || "");
            setVariableValues({});
        }
    }, [isOpen, type, templateId, initialTitle, state.notes]);

    const onClose = () => {
        dispatch.setCreateNoteDialog({ isOpen: false, type });
    };

    const onVariableChange = (name: string, value: string) => {
        setVariableValues((prev) => ({ ...prev, [name]: value }));
    };

    const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!title.trim()) return;

        let content = type === "excalidraw" ? buildExcalidrawNoteContent() : "";
        if (type === "note" && selectedTemplateId) {
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

        const noteType =
            type === "excalidraw" ? NoteType.excalidraw : type === "quick" ? NoteType.quick : NoteType.note;
        const note = Note.new(title, content, noteType);
        await repositories.notes.save(note);
        dispatch.note(note);
        onClose();
        if (type === "quick") {
            navigate(`/quicknote/${note.id}`);
        } else {
            navigate(`/note/${note.id}`);
        }
    };

    return (
        <Modal
            open={isOpen}
            onChange={onClose}
            className="max-w-md"
            title={
                type === "quick"
                    ? "Create quick note"
                    : type === "excalidraw"
                      ? "Create Excalidraw note"
                      : "Create new note"
            }
        >
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
                        <Autocomplete
                            required={false}
                            value={selectedTemplateId}
                            placeholder="Template 123"
                            title="From Template (Optional)"
                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                            options={[
                                { value: "", label: "Blank Document" },
                                ...templates.map((t) => ({ value: t.id, label: t.title })),
                            ]}
                        />

                        {userVariables.length > 0 && (
                            <div className="p-4 space-y-3 rounded-lg border bg-muted/30 border-border/40">
                                <span className="font-bold tracking-widest uppercase opacity-70 text-[10px] text-muted-foreground">
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
                    <Button theme="muted" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit">Create {selectedTemplate ? "from template" : ""}</Button>
                </div>
            </form>
        </Modal>
    );
};
