import { Autocomplete, Button, Input, Modal } from "@g4rcez/components";
import { startOfDay } from "date-fns";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScripts } from "@/app/hooks/use-scripts";
import { useTemplates } from "@/app/hooks/use-templates";
import { getOrCreateDailyQuickNote } from "@/lib/daily-quick-note";
import { buildExcalidrawNoteContent } from "@/lib/excalidraw-note";
import { generateNotePath, getUniqueFilePath, getUniqueNoteTitle } from "@/lib/file-utils";
import { isElectron } from "@/lib/is-electron";
import { getDailyQuickNoteTitle } from "@/lib/quicknote-utils";
import { getUserVariables, substituteVariables } from "@/lib/template-utils";
import { isFloatingEditorWindow } from "@/lib/window-mode";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import { WorkspaceFolderAutocomplete } from "./workspace-folder-autocomplete";

export const CreateNoteDialog = () => {
    const [state, dispatch] = useGlobalStore();
    const [title, setTitle] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
    const [variableValues, setVariableValues] = useState<Record<string, string>>({});
    const [quickNoteDate, setQuickNoteDate] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
    const [folderSelectionPending, setFolderSelectionPending] = useState(false);
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
            setError(null);
            setSelectedFolderPath(null);
            setFolderSelectionPending(false);
            if (type === "quick") {
                const date = new Date();
                setQuickNoteDate(date);
                setTitle(getDailyQuickNoteTitle(startOfDay(date)));
            } else {
                setQuickNoteDate(null);
                setTitle(getUniqueNoteTitle(initialTitle?.trim() ?? "", state.notes));
            }
            setSelectedTemplateId(templateId || "");
            setVariableValues({});
        }
    }, [isOpen, type, templateId, initialTitle, state.notes, state.directory]);

    const onClose = () => {
        setError(null);
        setSelectedFolderPath(null);
        setFolderSelectionPending(false);
        dispatch.setCreateNoteDialog({ isOpen: false, type });
    };

    const onVariableChange = (name: string, value: string) => {
        setVariableValues((prev) => ({ ...prev, [name]: value }));
    };

    const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!title.trim() || folderSelectionPending) return;
        setError(null);

        try {
            let content = type === "excalidraw" ? buildExcalidrawNoteContent() : "";
            if ((type === "note" || type === "quick") && selectedTemplateId) {
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

            const note =
                type === "quick"
                    ? await getOrCreateDailyQuickNote(quickNoteDate ?? new Date(), { title, content })
                    : Note.new(title, content, type === "excalidraw" ? NoteType.excalidraw : NoteType.note);
            if (type === "excalidraw" && selectedFolderPath) {
                const folderResult = await window.electronAPI.fs.readDir(selectedFolderPath);
                if (folderResult.error) throw new Error(`Could not access the selected folder: ${folderResult.error}`);

                const candidatePath = generateNotePath(selectedFolderPath, title.trim());
                note.filePath = await getUniqueFilePath(candidatePath, async (path) => {
                    const result = await window.electronAPI.fs.statFile(path);
                    if (!result.success)
                        throw new Error(result.error ?? "Could not check whether the note already exists.");
                    return result.exists;
                });
            }
            if (type !== "quick") await repositories.notes.save(note);
            dispatch.note(note, !isFloatingEditorWindow);
            onClose();
            if (isFloatingEditorWindow) {
                navigate("/floating-editor");
            } else if (type === "quick") {
                navigate(`/quicknote/${note.id}`);
            } else {
                navigate(`/note/${note.id}`);
            }
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Failed to create the note.");
        }
    };

    return (
        <Modal
            open={isOpen}
            onChange={onClose}
            className="max-w-md"
            title={
                type === "quick"
                    ? "Today's quick note"
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

                {type === "excalidraw" && isElectron() && state.directory ? (
                    <WorkspaceFolderAutocomplete
                        workspaceDirectory={state.directory}
                        onSelectionChange={(path, isPending) => {
                            setSelectedFolderPath(path);
                            setFolderSelectionPending(isPending);
                        }}
                    />
                ) : null}

                {type === "quick" ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                        This opens or creates today's note. A template applies only when the note is new; existing text
                        is never replaced.
                    </p>
                ) : null}

                {error ? (
                    <p
                        className="rounded border border-danger/40 bg-danger-subtle p-3 text-sm text-foreground"
                        role="alert"
                    >
                        {error}
                    </p>
                ) : null}

                {(type === "note" || type === "quick") && templates.length > 0 && (
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
                            <div className="space-y-3 rounded-lg border border-border/40 bg-muted/30 p-4">
                                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase opacity-70">
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

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" theme="muted" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={folderSelectionPending}>
                        {type === "quick" ? "Open today's note" : `Create ${selectedTemplate ? "from template" : ""}`}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
