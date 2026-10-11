import { Autocomplete, Button, Input, Modal } from "@g4rcez/components";
import { startOfDay } from "date-fns";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScripts } from "@/app/hooks/use-scripts";
import { useTemplates } from "@/app/hooks/use-templates";
import { getOrCreateDailyQuickNote } from "@/lib/daily-quick-note";
import { buildExcalidrawNoteContent } from "@/lib/excalidraw-note";
import { generateNotePath, getUniqueFilePath, getUniqueNoteTitle } from "@/lib/file-utils";
import { buildFreehandNoteContent } from "@/lib/freehand-note";
import { isElectron } from "@/lib/is-electron";
import { getDailyQuickNoteTitle } from "@/lib/quicknote-utils";
import { getUserVariables, substituteVariables } from "@/lib/template-utils";
import { isFloatingEditorWindow } from "@/lib/window-mode";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";

export const CreateNoteDialog = () => {
    const [state, dispatch] = useGlobalStore();
    const [title, setTitle] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
    const [variableValues, setVariableValues] = useState<Record<string, string>>({});
    const [quickNoteDate, setQuickNoteDate] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [errorDetails, setErrorDetails] = useState<string | null>(null);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [folders, setFolders] = useState<string[]>([]);
    const [folderSearchError, setFolderSearchError] = useState<string | null>(null);
    const initializedDialog = useRef<string | null>(null);
    const { templates } = useTemplates();
    const { scripts } = useScripts();
    const navigate = useNavigate();

    const { isOpen, type, templateId, initialTitle } = state.createNoteDialog;

    const supportsFolders =
        (type === "note" || type === "excalidraw" || type === "freehand") && isElectron() && !!state.directory;
    const titleOptions = useMemo(() => [
        // Autocomplete needs the current value in options to keep free text visible after blur.
        ...(title ? [{ value: title, hidden: true }] : []),
        ...[...folders].sort((left, right) => left.localeCompare(right))
            .map((folder) => ({ value: `/${folder}/` }))
            .filter((option) => option.value !== title),
    ], [folders, title]);

    useEffect(() => {
        setFolders([]);
        setFolderSearchError(null);
        const workspaceDirectory = state.directory;
        if (!isOpen || !supportsFolders || !workspaceDirectory) return;
        let active = true;
        const loadFolders = async (directory: string, prefix: string, depth: number): Promise<void> => {
            try {
                const result = await window.electronAPI.fs.readDir(directory);
                if (!active) return;
                if (result.error) throw new Error(result.error);
                const directories = result.entries.filter((entry) => entry.type === "directory" && entry.name !== ".git");
                const paths = directories.map((entry) => `${prefix}${entry.name}`);
                setFolders((previous) => [...previous, ...paths]);
                if (depth < 2) {
                    for (const [index, entry] of directories.entries()) {
                        if (!active) return;
                        await loadFolders(entry.path, `${paths[index]}/`, depth + 1);
                    }
                }
            } catch (reason: unknown) {
                if (active) setFolderSearchError(reason instanceof Error ? reason.message : "Failed to load folders.");
            }
        };
        void loadFolders(workspaceDirectory, "", 1);
        return () => {
            active = false;
        };
    }, [isOpen, supportsFolders, state.directory]);

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
        const key = isOpen ? JSON.stringify([type, templateId, initialTitle]) : null;
        if (key === initializedDialog.current) return;
        initializedDialog.current = key;
        if (isOpen) {
            setError(null);
            setErrorDetails(null);
            setPdfFile(null);
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
        if (importing) return;
        setError(null);
        dispatch.setCreateNoteDialog({ isOpen: false, type });
    };

    const onVariableChange = (name: string, value: string) => {
        setVariableValues((prev) => ({ ...prev, [name]: value }));
    };

    const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!title.trim() || importing) return;
        setErrorDetails(null);
        if (supportsFolders && /[/\\]$/.test(title.trim())) {
            setError("Enter a note name after the folder path.");
            return;
        }
        const relativeTitle = title.trim().replace(/\\/g, "/").replace(/^\//, "");
        const pathSegments = relativeTitle.split("/");
        if (supportsFolders && (pathSegments.some((segment) => segment === ".." || segment === "." || !segment) ||
            /^[A-Za-z]:/.test(title.trim()))) {
            setError("Use a relative folder path inside the workspace.");
            return;
        }
        setError(null);
        let failureMessage = "Couldn’t finish creating the note. Check your notes before trying again.";

        try {
            if (type === "pdf") {
                failureMessage = "Couldn’t import the PDF. Check that the file opens in a PDF viewer, then try again.";
                if (!pdfFile) throw new Error("Choose a PDF to import.");
                setImporting(true);
                const { importPdfNote } = await import("@/lib/pdf-import");
                const note = await importPdfNote(pdfFile, title.trim());
                failureMessage = "Couldn’t open the imported PDF. Check your notes before importing it again.";
                await dispatch.note(note, !isFloatingEditorWindow);
                dispatch.setCreateNoteDialog({ isOpen: false, type });
                navigate(isFloatingEditorWindow ? "/floating-editor" : `/note/${note.id}`);
                return;
            }
            let content =
                type === "excalidraw"
                    ? buildExcalidrawNoteContent()
                    : type === "freehand"
                      ? buildFreehandNoteContent()
                      : "";
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
                    : Note.new(title, content, NoteType[type]);
            if (supportsFolders && state.directory && /[/\\]/.test(title)) {
                failureMessage = "Couldn’t open the workspace folder. Check folder access or choose another workspace in settings.";
                const folderResult = await window.electronAPI.fs.readDir(state.directory);
                if (folderResult.error) throw new Error(`Could not access the workspace folder: ${folderResult.error}`);

                failureMessage = "Couldn’t check for an existing note. Check folder access or enter a different folder path and try again.";
                const noteName = pathSegments.pop()!;
                const candidatePath = generateNotePath(`${state.directory}/${pathSegments.join("/")}`, noteName);
                const filePath = await getUniqueFilePath(candidatePath, async (path) => {
                    const result = await window.electronAPI.fs.statFile(path);
                    if (!result.success)
                        throw new Error(result.error ?? "Could not check whether the note already exists.");
                    return result.exists;
                });
                failureMessage = "Couldn’t save the note in this folder. Check folder access or enter a different folder path and try again.";
                const writeResult = await window.electronAPI.fs.writeFile(filePath, note.content);
                if (!writeResult.success) {
                    throw new Error(`Could not write the note to the folder: ${writeResult.error}`);
                }
                note.filePath = filePath;
                note.fileSize = writeResult.fileSize;
                note.lastSynced = writeResult.lastModified ? new Date(writeResult.lastModified) : new Date();
            }
            failureMessage = "Couldn’t finish creating the note. Check your notes before trying again.";
            if (type !== "quick") await repositories.notes.save(note);
            await dispatch.note(note, !isFloatingEditorWindow);
            onClose();
            if (isFloatingEditorWindow) {
                navigate("/floating-editor");
            } else if (type === "quick") {
                navigate(`/quicknote/${note.id}`);
            } else {
                navigate(`/note/${note.id}`);
            }
        } catch (reason) {
            setError(failureMessage);
            setErrorDetails(reason instanceof Error ? reason.message : null);
        } finally {
            setImporting(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onChange={onClose}
            className="max-w-md"
            title={
                type === "pdf"
                    ? "Import PDF"
                    : type === "quick"
                    ? "Today's quick note"
                    : type === "excalidraw"
                      ? "Create Excalidraw note"
                      : type === "freehand"
                        ? "Create handwritten note"
                        : type === "meeting-note"
                          ? "Create meeting note"
                          : "Create new note"
            }
        >
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
                {type === "pdf" ? (
                    <label className="flex flex-col gap-2 text-sm text-foreground">
                        PDF document
                        <input
                            type="file"
                            accept="application/pdf,.pdf"
                            aria-label="PDF document"
                            required
                            disabled={importing}
                            onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                setPdfFile(file);
                                setError(null);
                                if (file) setTitle(getUniqueNoteTitle(file.name.replace(/\.pdf$/i, ""), state.notes));
                            }}
                        />
                        {importing ? <span role="status">Importing PDF…</span> : null}
                    </label>
                ) : null}
                {type === "quick" || type === "pdf" || !supportsFolders ? (
                    <Input
                        required
                        autoFocus
                        value={title}
                        id="note-title"
                        title="Note title"
                        onChange={(e) => setTitle(e.target.value)}
                    />
                ) : (
                    <Autocomplete
                        required
                        autoFocus={!initialTitle}
                        dynamicOption
                        value={title}
                        options={titleOptions}
                        id="note-title"
                        title="Note title"
                        onInput={(e) => setTitle(e.currentTarget.value)}
                        onChange={(e) => setTitle(e.target.value)}
                        emptyMessage="Type a name to create a note"
                        feedback={supportsFolders
                            ? folderSearchError
                            ? "Couldn’t search folders. Enter a folder path or try again."
                            : "Use /folder/name. The leading / is the workspace root."
                            : undefined}
                    />
                )}
                {type === "quick" ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                        This opens or creates today's note. A template applies only when the note is new; existing text
                        is never replaced.
                    </p>
                ) : null}
                {error ? (
                    <div className="rounded border border-danger/40 bg-danger-subtle p-3 text-sm text-foreground">
                        <p role="alert">{error}</p>
                        {errorDetails ? (
                            <details className="mt-2">
                                <summary className="cursor-pointer">Technical details</summary>
                                <p className="mt-1 break-words">{errorDetails}</p>
                            </details>
                        ) : null}
                    </div>
                ) : null}
                {(type === "note" || type === "quick") && templates.length > 0 && (
                    <div className="flex flex-col gap-4">
                        <Autocomplete
                            required={false}
                            value={selectedTemplateId}
                            placeholder="Choose a template"
                            title="Template (optional)"
                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                            options={[
                                { value: "", label: "Blank note" },
                                ...templates.map((t) => ({ value: t.id, label: t.title })),
                            ]}
                        />

                        {userVariables.length > 0 && (
                            <div className="space-y-3 rounded-lg border border-border/40 bg-muted/30 p-4">
                                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase opacity-70">
                                    Template variables
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
                    <Button type="button" theme="muted" onClick={onClose} disabled={importing}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={importing || (type === "pdf" && !pdfFile)}>
                        {type === "pdf" ? "Import PDF" : type === "quick" ? "Open today's note" : "Create note"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
