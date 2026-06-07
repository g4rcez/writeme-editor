import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { useEffect, useRef } from "react";

import { CursorPositionStore } from "@/store/cursor-position.store";

const SCROLL_CONTAINER_ID = "main-scroll-container";

type ScrollMemorySnapshot = {
  id: string;
  anchor: number;
  y: number;
  loaded: boolean;
};

const createEmptySnapshot = (id: string): ScrollMemorySnapshot => ({
  id,
  anchor: 0,
  y: 0,
  loaded: false,
});

const getScrollContainer = (): HTMLElement | null =>
  document.getElementById(SCROLL_CONTAINER_ID);

const normalizeScrollY = (y: number): number => {
  if (!Number.isFinite(y)) return 0;
  return Math.max(0, Math.round(y));
};

const getSafeAnchor = (editor: Editor, anchor: number): number => {
  if (!Number.isFinite(anchor)) return 0;
  return Math.max(
    0,
    Math.min(Math.round(anchor), editor.state.doc.content.size),
  );
};

const getCurrentAnchor = (editor: Editor): number => {
  if (editor.isDestroyed) return 0;
  return getSafeAnchor(editor, editor.state.selection.$anchor.pos);
};

const getCurrentScrollY = (scroller: HTMLElement): number =>
  normalizeScrollY(scroller.scrollTop);

const readSnapshot = (
  id: string,
  editor: Editor,
  scroller: HTMLElement,
): Omit<ScrollMemorySnapshot, "loaded"> => ({
  id,
  anchor: getCurrentAnchor(editor),
  y: getCurrentScrollY(scroller),
});

const restoreSelection = (editor: Editor, anchor: number): void => {
  if (editor.isDestroyed) return;

  const safeAnchor = getSafeAnchor(editor, anchor);
  if (safeAnchor <= 0) return;

  try {
    const selection = TextSelection.create(editor.state.doc, safeAnchor);
    editor.view.dispatch(editor.state.tr.setSelection(selection));
  } catch {
    // Ignore invalid persisted positions from older document versions.
  }
};

const restoreScrollY = (scroller: HTMLElement, y: number): void => {
  const top = normalizeScrollY(y);
  if (typeof scroller.scrollTo === "function") {
    scroller.scrollTo({ top });
    return;
  }
  scroller.scrollTop = top;
};

export const useEditorScrollMemory = (
  id: string,
  editor: Editor | null,
): void => {
  const snapshotRef = useRef<ScrollMemorySnapshot>(createEmptySnapshot(id));

  useEffect(() => {
    if (!editor) {
      snapshotRef.current = createEmptySnapshot(id);
      return;
    }

    const scroller = getScrollContainer();
    if (!scroller) {
      snapshotRef.current = createEmptySnapshot(id);
      return;
    }

    const controller = new AbortController();

    const handleScroll = (): void => {
      snapshotRef.current = {
        ...readSnapshot(id, editor, scroller),
        loaded: true,
      };
    };

    void CursorPositionStore.get(id)
      .then((memory) => {
        if (controller.signal.aborted || editor.isDestroyed) return;

        if (memory) {
          restoreSelection(editor, memory.anchor);
          restoreScrollY(scroller, memory.y);
        }

        snapshotRef.current = {
          ...readSnapshot(id, editor, scroller),
          loaded: true,
        };
        scroller.addEventListener("scroll", handleScroll, {
          signal: controller.signal,
        });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.warn("Failed to restore editor scroll memory:", error);
        }
      });

    return () => {
      const wasLoaded =
        snapshotRef.current.loaded && snapshotRef.current.id === id;
      const snapshot = {
        ...readSnapshot(id, editor, scroller),
        loaded: false,
      };
      snapshotRef.current = snapshot;
      controller.abort();

      if (wasLoaded) {
        void CursorPositionStore.save(id, snapshot.anchor, snapshot.y).catch(
          (error: unknown) => {
            console.warn("Failed to save editor scroll memory:", error);
          },
        );
      }
    };
  }, [id, editor]);
};
