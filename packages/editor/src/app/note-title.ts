import { replaceFirstMarkdownH1 } from "@/lib/markdown-title";
import type { GlobalDispatchers } from "@/store/global.store";
import type { Note } from "@/store/note";
import { isLatexFilePath } from "@/types/workspace-files";

type NoteTitleDispatchers = Pick<GlobalDispatchers, "updateNoteContent" | "updateNoteTitle">;

export async function saveNoteTitle(
    note: Note,
    title: string,
    dispatch: NoteTitleDispatchers,
): Promise<void> {
    if (!isLatexFilePath(note.filePath)) {
        const updatedContent = replaceFirstMarkdownH1(note.content || "", title);
        if (updatedContent !== null && updatedContent !== note.content) {
            await dispatch.updateNoteContent(note.id, updatedContent);
        }
    }

    await dispatch.updateNoteTitle(note.id, title);
}
