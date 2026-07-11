import type { Note } from "@/store/note";
import { getWorkspaceKey } from "@/store/global.store";
import { NoteType } from "@/store/note";

type WorkspaceTagCount = {
    tag: string;
    count: number;
};

export const WORKSPACE_CHAT_SCOPE_PREFIX = "workspace:";

export function getWorkspaceChatScope(directory: string | null): string {
    return `${WORKSPACE_CHAT_SCOPE_PREFIX}${getWorkspaceKey(directory)}`;
}

export function buildWorkspaceContextSummary(directory: string | null, notes: Note[]): string {
    const workspaceLabel = directory ? directory : "local workspace";
    const sortedNotes = [...notes].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const countsByType = Object.values(NoteType).reduce(
        (acc, noteType) => {
            acc[noteType] = 0;
            return acc;
        },
        {} as Record<string, number>,
    );

    const tagCounts = new Map<string, number>();
    for (const note of notes) {
        const typeCount = countsByType[note.noteType];
        countsByType[note.noteType] = (typeCount ?? 0) + 1;

        for (const tag of note.tags) {
            tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        }
    }

    const topTags: WorkspaceTagCount[] = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

    const recentNotes = sortedNotes.slice(0, 8).map((note) => ({
        id: note.id,
        title: note.title,
        noteType: note.noteType,
        tags: [...note.tags],
        updatedAt: note.updatedAt.toISOString(),
    }));

    const notesByType = Object.entries(countsByType)
        .filter((entry): entry is [string, number] => entry[1] > 0)
        .map(([noteType, count]) => `${noteType}:${count}`)
        .join(", ");

    const tagSummary = topTags.map((entry) => `${entry.tag} (${entry.count})`).join(", ");

    return [
        `Workspace: ${workspaceLabel}`,
        `Notes in workspace: ${notes.length}`,
        notesByType ? `Notes by type: ${notesByType}` : "No notes by type yet.",
        tagSummary ? `Top tags: ${tagSummary}` : "Top tags: none",
        `Recent notes: ${JSON.stringify(recentNotes)}`,
        "Tools are available: listNotes, readNote, searchNotes, runNotesQuery.",
        "Always use tools before reading full note bodies when possible.",
    ].join("\n");
}
