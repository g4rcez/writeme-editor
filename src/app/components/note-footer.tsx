import { useEffect, useState } from "react";
import { editorGlobalRef, editorSearchGlobalRef, subscribeEditorSearchGlobalRef } from "@/app/editor-global-ref";
import { HARD_LIMIT, WARN_THRESHOLD } from "@/lib/markdown-worker";
import { useUIStore } from "@/store/ui.store";

type Counts = { chars: number; words: number; lines: number };

const INITIAL: Counts = { chars: 0, words: 0, lines: 1 };

function getMarkdownCounts(content: string): Counts {
    const trimmed = content.trim();
    return {
        chars: content.length,
        words: trimmed ? trimmed.split(/\s+/).length : 0,
        lines: content.length === 0 ? 1 : content.split("\n").length,
    };
}

function formatCount(chars: number): string {
    if (chars < 1_000) return `${chars} chars`;
    if (chars < 1_000_000) return `${(chars / 1_000).toFixed(1)}K chars`;
    return `${(chars / 1_000_000).toFixed(2)}M chars`;
}

function usageColor(chars: number): string {
    if (chars >= WARN_THRESHOLD) return "text-danger";
    if (chars >= WARN_THRESHOLD * 0.5) return "text-warn";
    return "text-muted-foreground";
}

const WARNING_LABEL = formatCount(WARN_THRESHOLD);
const HARD_LIMIT_LABEL = formatCount(HARD_LIMIT);

export function NoteFooter({ noteId, content }: { noteId: string; content?: string }) {
    const [editorCounts, setEditorCounts] = useState<Counts>(INITIAL);
    const [{ editorSaveStatus }] = useUIStore();
    const counts = content === undefined ? editorCounts : getMarkdownCounts(content);

    useEffect(() => {
        if (content !== undefined) return;
        let cleanup: (() => void) | undefined;

        const subscribe = () => {
            const searchEditor = editorSearchGlobalRef.current;
            const editor = editorGlobalRef.current;
            if (!searchEditor && !editor) return false;

            const compute = () => {
                if (editorSearchGlobalRef.current) {
                    setEditorCounts(getMarkdownCounts(editorSearchGlobalRef.current.getContent()));
                    return;
                }
                if (editor) {
                    setEditorCounts(getMarkdownCounts(editor.getMarkdown()));
                }
            };

            compute();
            cleanup = searchEditor
                ? searchEditor.subscribe(compute)
                : () => {
                      editor?.off("update", compute);
                  };
            if (editor && !searchEditor) editor.on("update", compute);
            return true;
        };

        const unsubscribeGlobal = subscribeEditorSearchGlobalRef(() => {
            cleanup?.();
            cleanup = undefined;
            subscribe();
        });
        if (!subscribe()) {
            const interval = setInterval(() => {
                if (subscribe()) clearInterval(interval);
            }, 50);
            return () => {
                clearInterval(interval);
                unsubscribeGlobal();
                cleanup?.();
            };
        }

        return () => {
            unsubscribeGlobal();
            cleanup?.();
        };
    }, [content, noteId]);

    const pct = Math.min((counts.chars / HARD_LIMIT) * 100, 100);
    const color = usageColor(counts.chars);
    const isNearHardLimit = counts.chars >= HARD_LIMIT * 0.8;
    const title = `${formatCount(counts.chars)} used. Warning at ${WARNING_LABEL}; hard limit at ${HARD_LIMIT_LABEL}.${isNearHardLimit ? " Approaching hard limit." : ""}`;
    const saveLabel =
        editorSaveStatus === "saving"
            ? "Saving…"
            : editorSaveStatus === "unsaved"
              ? "Unsaved changes"
              : editorSaveStatus === "error"
                ? "Save failed"
                : "Saved";

    return (
        <div className="fixed right-4 bottom-3 z-navbar flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-end gap-x-3 gap-y-1 rounded-lg border border-border/40 bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-soft print:hidden">
            <output aria-live="polite" className="flex items-center gap-1.5">
                <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${editorSaveStatus === "error" ? "bg-danger" : editorSaveStatus === "unsaved" ? "bg-warn" : "bg-success"}`}
                />
                {saveLabel}
            </output>
            <span title={title} className={`flex items-center gap-1.5 tabular-nums ${color}`}>
                <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                    <span
                        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                            counts.chars >= WARN_THRESHOLD
                                ? "bg-danger"
                                : counts.chars >= WARN_THRESHOLD * 0.5
                                  ? "bg-warn"
                                  : "bg-primary/60"
                        }`}
                        style={{ width: `${pct}%` }}
                    />
                </span>
                <span>{formatCount(counts.chars)}</span>
                <span className="text-muted-foreground/50">/ {HARD_LIMIT_LABEL}</span>
            </span>
            <span className="tabular-nums">{counts.words} words</span>
            <span className="tabular-nums">{counts.lines} lines</span>
        </div>
    );
}
