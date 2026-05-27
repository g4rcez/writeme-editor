import { editorGlobalRef } from "@/app/editor-global-ref";
import { CursorPositionStore } from "@/store/cursor-position.store";
import { globalState } from "@/store/global.store";
import { getScrollY } from "@/lib/scroll-utils";

export const saveCursorIfActive = () => {
  const note = globalState().note;
  if (note && editorGlobalRef.current) {
    CursorPositionStore.save(
      note.id,
      editorGlobalRef.current.state.selection.anchor,
      getScrollY(),
    );
  }
};
