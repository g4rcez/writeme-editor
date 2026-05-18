import { editorGlobalRef } from "@/app/editor-global-ref";
import { useEffect, useState } from "react";

type Counts = { chars: number; words: number; lines: number };

const INITIAL: Counts = { chars: 0, words: 0, lines: 1 };

export function NoteFooter({ noteId }: { noteId: string }) {
  const [counts, setCounts] = useState<Counts>(INITIAL);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const subscribe = () => {
      const editor = editorGlobalRef.current;
      if (!editor) return false;

      const compute = () =>
        setCounts({
          chars: editor.storage.characterCount.characters(),
          words: editor.storage.characterCount.words(),
          lines: editor.state.doc.textContent.split("\n").length,
        });

      compute();
      editor.on("update", compute);
      cleanup = () => editor.off("update", compute);
      return true;
    };

    if (!subscribe()) {
      const interval = setInterval(() => {
        if (subscribe()) clearInterval(interval);
      }, 50);
      return () => {
        clearInterval(interval);
        cleanup?.();
      };
    }

    return () => cleanup?.();
  }, [noteId]);

  return (
    <div className="fixed right-0 rounded-rb bottom-0 z-navbar flex items-center justify-end gap-4 px-3 py-1 text-xs text-muted-foreground bg-background">
      <span>{counts.chars} chars</span>
      <span>{counts.words} words</span>
      <span>{counts.lines} lines</span>
    </div>
  );
}
