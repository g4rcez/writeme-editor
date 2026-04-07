import { useEffect, useRef, useState } from "react";
import { ArrowDownIcon } from "@phosphor-icons/react/dist/csr/ArrowDown";
import { ArrowUpIcon } from "@phosphor-icons/react/dist/csr/ArrowUp";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { editorGlobalRef } from "@/app/editor-global-ref";
import { useUIStore } from "@/store/ui.store";

export const FindReplaceBar = () => {
  const [uiState, uiDispatch] = useUIStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [, forceUpdate] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { isOpen } = uiState.findReplace;

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const editor = editorGlobalRef.current;
    if (!editor) return;
    editor.commands.setSearchTerm(searchTerm);
    forceUpdate((n) => n + 1);
  }, [searchTerm, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const editor = editorGlobalRef.current;
    if (!editor) return;
    editor.commands.setCaseSensitive(caseSensitive);
    forceUpdate((n) => n + 1);
  }, [caseSensitive, isOpen]);

  const close = () => {
    const editor = editorGlobalRef.current;
    if (editor) {
      editor.commands.setSearchTerm("");
    }
    setSearchTerm("");
    uiDispatch.closeFindReplace();
  };

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
  }, [isOpen]);

  if (!isOpen) return null;

  const editor = editorGlobalRef.current;
  const storage = (editor?.storage as any)?.searchReplace;
  const total = storage?.results?.length ?? 0;
  const current = total === 0 ? 0 : (storage?.resultIndex ?? 0) + 1;

  const onNext = () => {
    editor?.commands.nextSearchResult();
    forceUpdate((n) => n + 1);
  };

  const onPrev = () => {
    editor?.commands.previousSearchResult();
    forceUpdate((n) => n + 1);
  };

  const onReplace = () => {
    editor?.commands.replace(replaceTerm);
    forceUpdate((n) => n + 1);
  };

  const onReplaceAll = () => {
    editor?.commands.replaceAll(replaceTerm);
    forceUpdate((n) => n + 1);
  };

  return (
    <div
      className="fixed top-12 right-4 z-50 flex flex-col gap-1 rounded-lg border border-border bg-background shadow-lg p-2 w-80 text-sm"
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Search row */}
      <div className="flex items-center gap-1">
        <button
          title={showReplace ? "Collapse replace" : "Expand replace"}
          onClick={() => setShowReplace((v) => !v)}
          className="flex-shrink-0 p-1 rounded hover:bg-accent text-foreground/60"
        >
          {showReplace ? (
            <CaretDownIcon className="size-3.5" />
          ) : (
            <CaretRightIcon className="size-3.5" />
          )}
        </button>
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.shiftKey ? onPrev() : onNext();
            }
          }}
          placeholder="Find"
          className="flex-1 min-w-0 bg-muted rounded px-2 py-1 outline-none text-foreground placeholder:text-foreground/40 text-sm"
        />
        <span className="flex-shrink-0 text-foreground/50 tabular-nums text-xs min-w-[3.5rem] text-right">
          {searchTerm ? `${current} of ${total}` : ""}
        </span>
        <button
          title="Previous match (Shift+Enter)"
          onClick={onPrev}
          disabled={total === 0}
          className="flex-shrink-0 p-1 rounded hover:bg-accent text-foreground/60 disabled:opacity-40"
        >
          <ArrowUpIcon className="size-3.5" />
        </button>
        <button
          title="Next match (Enter)"
          onClick={onNext}
          disabled={total === 0}
          className="flex-shrink-0 p-1 rounded hover:bg-accent text-foreground/60 disabled:opacity-40"
        >
          <ArrowDownIcon className="size-3.5" />
        </button>
        <button
          title="Toggle case-sensitive"
          onClick={() => setCaseSensitive((v) => !v)}
          className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-mono ${caseSensitive ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground/60"}`}
        >
          Aa
        </button>
        <button
          title="Close (Escape)"
          onClick={close}
          className="flex-shrink-0 p-1 rounded hover:bg-accent text-foreground/60"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>

      {/* Replace row */}
      {showReplace && (
        <div className="flex items-center gap-1 pl-6">
          <input
            type="text"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            placeholder="Replace"
            className="flex-1 min-w-0 bg-muted rounded px-2 py-1 outline-none text-foreground placeholder:text-foreground/40 text-sm"
          />
          <button
            onClick={onReplace}
            disabled={total === 0}
            className="flex-shrink-0 px-2 py-1 rounded text-xs hover:bg-accent text-foreground/70 disabled:opacity-40"
          >
            Replace
          </button>
          <button
            onClick={onReplaceAll}
            disabled={total === 0}
            className="flex-shrink-0 px-2 py-1 rounded text-xs hover:bg-accent text-foreground/70 disabled:opacity-40"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
};
