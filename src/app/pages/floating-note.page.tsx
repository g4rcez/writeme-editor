import { startOfDay } from "date-fns";
import { useEffect, useState } from "react";
import { Editor } from "@/app/editor";
import { isElectron } from "@/lib/is-electron";
import { getDailyQuickNotePath, getDailyQuickNoteTitle } from "@/lib/quicknote-utils";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import { SettingsService } from "@/store/settings";

type FloatingNoteKind = "quick" | "math";

type FloatingNoteConfig = {
    kind: FloatingNoteKind;
    loadingLabel: string;
    errorLabel: string;
    getOrCreateNote: () => Promise<Note>;
};

const MATH_INITIAL_CONTENT = "```math\n```";
const MATH_NOTE_TITLE = "Math Scratchpad";

async function getOrCreateDailyQuickNote(date: Date): Promise<Note> {
    const day = startOfDay(date);
    const settings = SettingsService.load();

    if (isElectron() && settings.directory) {
        const filePath = getDailyQuickNotePath(settings.directory, day);
        const existingMetadata = await window.electronAPI.db.notes.getByFilePath(filePath);

        if (existingMetadata) {
            const existing = await repositories.notes.getOne(existingMetadata.id);
            if (existing) return existing;

            const recreateResult = await window.electronAPI.fs.writeFile(filePath, "");
            if (!recreateResult.success) {
                throw new Error(`Failed to recreate quick note: ${recreateResult.error}`);
            }
            return Note.parse({ ...existingMetadata, content: "" });
        }

        const statResult = await window.electronAPI.fs.statFile(filePath);
        if (!statResult.success) {
            throw new Error(`Failed to check quick note: ${statResult.error}`);
        }

        const readResult = statResult.exists ? await window.electronAPI.fs.readFile(filePath) : null;
        if (readResult && !readResult.success) {
            throw new Error(`Failed to read quick note: ${readResult.error}`);
        }

        const content = readResult?.content ?? "";
        const fileResult = statResult.exists ? statResult : await window.electronAPI.fs.writeFile(filePath, content);

        if (!fileResult.success) {
            throw new Error(`Failed to create quick note: ${fileResult.error}`);
        }

        const note = Note.new(getDailyQuickNoteTitle(day), content, NoteType.quick);
        note.setFilePath(filePath, new Date(fileResult.lastModified));
        note.fileSize = fileResult.fileSize ?? content.length;
        await repositories.notes.save(note);
        return note;
    }

    const existing = await repositories.notes.getQuicknoteByDate(day);
    if (existing) return existing;

    const note = Note.new(getDailyQuickNoteTitle(day), "", NoteType.quick);
    await repositories.notes.save(note);
    return note;
}

async function getOrCreateMathScratchpad(): Promise<Note> {
    const { mathNoteId } = SettingsService.load();
    const existing = mathNoteId ? await repositories.notes.getOne(mathNoteId) : null;

    if (existing) {
        if (existing.noteType === NoteType.math) return existing;

        const migrated = Note.parse({ ...existing, noteType: NoteType.math });
        await repositories.notes.save(migrated);
        return migrated;
    }

    const note = Note.new(MATH_NOTE_TITLE, MATH_INITIAL_CONTENT, NoteType.math);
    await repositories.notes.save(note);
    await SettingsService.save({ mathNoteId: note.id });
    return note;
}

const floatingNoteConfigs: Record<FloatingNoteKind, FloatingNoteConfig> = {
    quick: {
        kind: "quick",
        loadingLabel: "Loading Quick Note...",
        errorLabel: "Quick note not found",
        getOrCreateNote: () => getOrCreateDailyQuickNote(new Date()),
    },
    math: {
        kind: "math",
        loadingLabel: "Loading Math Scratchpad...",
        errorLabel: "Math scratchpad not found",
        getOrCreateNote: getOrCreateMathScratchpad,
    },
};

export function FloatingNotePage({ kind }: { kind: FloatingNoteKind }) {
    const config = floatingNoteConfigs[kind];
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [state, dispatch] = useGlobalStore();

    useEffect(() => {
        let ignored = false;
        async function request() {
            setLoading(true);
            setError(null);
            try {
                const note = await config.getOrCreateNote();
                if (ignored) return;
                dispatch.note(note, false);
            } catch (error) {
                console.error(`Failed to open ${config.kind} floating note:`, error);
                if (!ignored) setError(`Failed to open ${config.errorLabel}`);
            } finally {
                if (!ignored) setLoading(false);
            }
        }
        request();
        return () => {
            ignored = true;
        };
    }, [config, dispatch]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                window.close();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    if (loading || (!error && !state.note)) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground">{config.loadingLabel}</div>
        );
    }

    if (error || !state.note) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground">
                {error ?? config.errorLabel}
            </div>
        );
    }

    return (
        <div className="container mx-auto flex h-full min-h-0 w-full max-w-safe flex-col bg-background print:block print:h-auto print:overflow-visible">
            <div className="quicknote-window-drag-region mt-4 mb-4 flex shrink-0 items-center justify-between border-b border-card-border py-2">
                <h1 className="truncate text-lg font-semibold">{state.note.title}</h1>
                <span className="text-xs text-disabled">Press Esc to close</span>
            </div>
            <div className="min-h-0 flex-1 p-8 overflow-y-auto overscroll-contain">
                <Editor content={state.note.content} note={state.note} />
            </div>
        </div>
    );
}
