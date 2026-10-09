import { useEffect, useState } from "react";
import { Editor } from "@/app/editor";
import { getOrCreateDailyQuickNote } from "@/lib/daily-quick-note";
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
                if (!ignored) {
                    setError(error instanceof Error ? error.message : `Failed to open ${config.errorLabel}`);
                }
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
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            window.close();
        };
        window.addEventListener("keydown", handleKeyDown, true);
        return () => window.removeEventListener("keydown", handleKeyDown, true);
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
