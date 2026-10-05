import type { EditorMentionItem } from "@/lib/editor-storage";
import { getRelativePath } from "@/lib/file-utils";
import { innerUrl } from "@/lib/encoding";
import type { Note } from "@/store/note";

export type WorkspaceMentionFile = {
  name: string;
  path: string;
  relativePath: string;
};

export function createWorkspaceMentionItems(
  notes: Pick<Note, "id" | "title" | "filePath">[],
  files: WorkspaceMentionFile[],
  workspaceDirectory: string | null,
): EditorMentionItem[] {
  const items: EditorMentionItem[] = [];
  const normalizePath = (path: string): string => path.replaceAll("\\", "/");
  const knownFilePaths = new Set<string>();
  const fileSearchPaths = new Map(
    files.map((file) => [normalizePath(file.path), normalizePath(file.relativePath)]),
  );

  for (const note of notes) {
    if (note.filePath) knownFilePaths.add(normalizePath(note.filePath));
    const searchPath = note.filePath
      ? fileSearchPaths.get(normalizePath(note.filePath)) ??
      (workspaceDirectory ? getRelativePath(workspaceDirectory, note.filePath) : normalizePath(note.filePath))
      : undefined;
    items.push({
      id: note.id,
      label: note.title || "Untitled",
      path: note.filePath || innerUrl(`/note/${note.id}`, "mention"),
      filePath: note.filePath,
      searchText: searchPath,
      kind: "note",
    });
  }

  for (const file of files) {
    if (knownFilePaths.has(normalizePath(file.path))) continue;
    knownFilePaths.add(normalizePath(file.path));
    const relativePath = normalizePath(file.relativePath);
    items.push({
      id: `file:${relativePath}`,
      label: file.name,
      path: relativePath,
      filePath: file.path,
      searchText: relativePath,
      kind: "file",
    });
  }

  return items;
}
