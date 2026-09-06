import { ArrowDownIcon } from "@phosphor-icons/react/dist/csr/ArrowDown";
import { ArrowUpIcon } from "@phosphor-icons/react/dist/csr/ArrowUp";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { editorSearchGlobalRef, subscribeEditorSearchGlobalRef } from "@/app/editor-global-ref";
import { useUIStore } from "@/store/ui.store";

export const FindReplaceBar = () => {
    const [uiState, uiDispatch] = useUIStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [replaceTerm, setReplaceTerm] = useState("");
    const [showReplace, setShowReplace] = useState(false);
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [searchHandleVersion, setSearchHandleVersion] = useState(0);
    const [, forceUpdate] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const replaceId = useId();
    const replaceControlsId = `${replaceId}-replace-controls`;

    const { isOpen } = uiState.findReplace;

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 0);
        }
    }, [isOpen]);

    useEffect(
        () =>
            subscribeEditorSearchGlobalRef(() => {
                setSearchHandleVersion((version) => version + 1);
                forceUpdate((n) => n + 1);
            }),
        [],
    );

    useEffect(() => {
        if (!isOpen) return;
        editorSearchGlobalRef.current?.setSearchTerm(searchTerm);
    }, [searchTerm, isOpen, searchHandleVersion]);

    useEffect(() => {
        if (!isOpen) return;
        editorSearchGlobalRef.current?.setCaseSensitive(caseSensitive);
    }, [caseSensitive, isOpen, searchHandleVersion]);

    useEffect(() => {
        if (!isOpen) return;
        editorSearchGlobalRef.current?.setReplaceTerm(replaceTerm);
    }, [replaceTerm, isOpen, searchHandleVersion]);

    const close = useCallback(() => {
        editorSearchGlobalRef.current?.setSearchTerm("");
        setSearchTerm("");
        uiDispatch.closeFindReplace();
    }, [uiDispatch]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                close();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [close, isOpen]);

    if (!isOpen) return null;

    const search = editorSearchGlobalRef.current;
    const searchState = search?.getState();
    const total = searchState?.resultsCount ?? 0;
    const current = total === 0 ? 0 : (searchState?.resultIndex ?? 0) + 1;

    const onNext = () => {
        search?.nextSearchResult();
        forceUpdate((n) => n + 1);
    };

    const onPrev = () => {
        search?.previousSearchResult();
        forceUpdate((n) => n + 1);
    };

    const onReplace = () => {
        search?.replace(replaceTerm);
        forceUpdate((n) => n + 1);
    };

    const onReplaceAll = () => {
        search?.replaceAll(replaceTerm);
        forceUpdate((n) => n + 1);
    };

    return (
        <dialog
            open
            aria-label="Find and replace"
            className="fixed top-12 right-4 z-50 m-0 flex w-80 flex-col gap-1 rounded-lg border border-border bg-background p-2 text-sm shadow-lg"
            onKeyDown={(e) => e.stopPropagation()}
        >
            <div className="flex items-center gap-1">
                <button
                    aria-expanded={showReplace}
                    aria-controls={replaceControlsId}
                    title={showReplace ? "Collapse replace" : "Expand replace"}
                    onClick={() => setShowReplace((v) => !v)}
                    className="hover:bg-accent flex-shrink-0 rounded p-1 text-foreground/60"
                    type="button"
                    aria-label={showReplace ? "Collapse replace controls" : "Expand replace controls"}
                >
                    {showReplace ? (
                        <CaretDownIcon aria-hidden="true" className="size-3.5" />
                    ) : (
                        <CaretRightIcon aria-hidden="true" className="size-3.5" />
                    )}
                </button>
                <input
                    type="text"
                    placeholder="Find"
                    value={searchTerm}
                    ref={searchInputRef}
                    aria-label="Find text"
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="min-w-0 flex-1 rounded bg-muted px-2 py-1 text-sm text-foreground placeholder:text-foreground/40"
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            if (e.shiftKey) onPrev();
                            else onNext();
                        }
                    }}
                />
                <span
                    aria-live="polite"
                    aria-atomic="true"
                    className="min-w-[3.5rem] flex-shrink-0 text-right text-xs text-foreground/50 tabular-nums"
                >
                    {searchTerm ? `${current} of ${total}` : ""}
                </span>
                <button
                    type="button"
                    aria-label="Previous match"
                    title="Previous match (Shift+Enter)"
                    onClick={onPrev}
                    disabled={total === 0}
                    className="hover:bg-accent flex-shrink-0 rounded p-1 text-foreground/60 disabled:opacity-40"
                >
                    <ArrowUpIcon aria-hidden="true" className="size-3.5" />
                </button>
                <button
                    type="button"
                    aria-label="Next match"
                    title="Next match (Enter)"
                    onClick={onNext}
                    disabled={total === 0}
                    className="hover:bg-accent flex-shrink-0 rounded p-1 text-foreground/60 disabled:opacity-40"
                >
                    <ArrowDownIcon aria-hidden="true" className="size-3.5" />
                </button>
                <button
                    type="button"
                    aria-label="Toggle case-sensitive search"
                    aria-pressed={caseSensitive}
                    title="Toggle case-sensitive"
                    onClick={() => setCaseSensitive((v) => !v)}
                    className={`flex-shrink-0 rounded px-1.5 py-0.5 font-mono text-xs ${caseSensitive ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground/60"}`}
                >
                    Aa
                </button>
                <button
                    type="button"
                    aria-label="Close find and replace"
                    title="Close (Escape)"
                    onClick={close}
                    className="hover:bg-accent flex-shrink-0 rounded p-1 text-foreground/60"
                >
                    <XIcon aria-hidden="true" className="size-3.5" />
                </button>
            </div>
            {showReplace && (
                <div id={replaceControlsId} className="flex items-center gap-1 pl-6">
                    <input
                        type="text"
                        value={replaceTerm}
                        onChange={(e) => setReplaceTerm(e.target.value)}
                        aria-label="Replace with"
                        placeholder="Replace"
                        className="min-w-0 flex-1 rounded bg-muted px-2 py-1 text-sm text-foreground placeholder:text-foreground/40"
                    />
                    <button
                        type="button"
                        onClick={onReplace}
                        disabled={total === 0}
                        className="hover:bg-accent flex-shrink-0 rounded px-2 py-1 text-xs text-foreground/70 disabled:opacity-40"
                    >
                        Replace
                    </button>
                    <button
                        type="button"
                        onClick={onReplaceAll}
                        disabled={total === 0}
                        className="hover:bg-accent flex-shrink-0 rounded px-2 py-1 text-xs text-foreground/70 disabled:opacity-40"
                    >
                        All
                    </button>
                </div>
            )}
        </dialog>
    );
};
