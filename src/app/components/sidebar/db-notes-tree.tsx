import { Modal } from "@g4rcez/components";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { type Note, NoteType } from "@/store/note";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { FolderIcon } from "@phosphor-icons/react/dist/csr/Folder";
import { FolderOpenIcon } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { NoteItem } from "@/app/components/note-list/note-list-sidebar";
import { globalDispatch } from "@/store/global.store";
import { repositories } from "@/store/repositories";

type VirtualNode =
  | { type: "file"; path: string; name: string; note: Note }
  | { type: "directory"; path: string; name: string; children: VirtualNode[] };

function buildVirtualTree(notes: Note[], rootPath: string): VirtualNode[] {
  const prefix = rootPath + "/";
  const relevant = notes.filter(
    (n) => n.filePath && n.filePath.startsWith(prefix),
  );

  const dirMap = new Map<string, VirtualNode & { type: "directory" }>();
  const roots: VirtualNode[] = [];

  const getOrCreateDir = (
    dirPath: string,
    parent: VirtualNode[] | null,
  ): (VirtualNode & { type: "directory" }) | null => {
    if (dirMap.has(dirPath)) return dirMap.get(dirPath)!;
    const name = dirPath.substring(dirPath.lastIndexOf("/") + 1);
    const node: VirtualNode & { type: "directory" } = {
      type: "directory",
      path: dirPath,
      name,
      children: [],
    };
    dirMap.set(dirPath, node);
    if (parent) {
      parent.push(node);
    }
    return node;
  };

  for (const note of relevant) {
    const rel = note.filePath!.substring(prefix.length);
    const segments = rel.split("/");

    let currentChildren = roots;
    let currentPath = rootPath;

    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      currentPath = currentPath + "/" + seg;
      const existing = dirMap.get(currentPath);
      if (existing) {
        currentChildren = existing.children;
      } else {
        const dir = getOrCreateDir(currentPath, currentChildren)!;
        currentChildren = dir.children;
      }
    }

    const fileName = segments[segments.length - 1];
    const displayName = fileName.endsWith(".md")
      ? fileName.slice(0, -3)
      : fileName;
    currentChildren.push({
      type: "file",
      path: note.filePath!,
      name: displayName,
      note,
    });
  }

  const sortNodes = (nodes: VirtualNode[]): VirtualNode[] => {
    return nodes
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((n) => {
        if (n.type === "directory") {
          return { ...n, children: sortNodes(n.children) };
        }
        return n;
      });
  };

  return sortNodes(roots);
}

type FlatNode = { node: VirtualNode; depth: number };

function flattenVisible(
  nodes: VirtualNode[],
  expandedPaths: Set<string>,
  depth = 0,
): FlatNode[] {
  return nodes.flatMap((node) => {
    const result: FlatNode[] = [{ node, depth }];
    if (node.type === "directory" && expandedPaths.has(node.path)) {
      result.push(...flattenVisible(node.children, expandedPaths, depth + 1));
    }
    return result;
  });
}

interface DbNotesTreeProps {
  notes: Note[];
  rootPath: string;
}

export const DbNotesTree = ({ notes, rootPath }: DbNotesTreeProps) => {
  const navigate = useNavigate();
  const { noteId } = useParams<{ noteId: string }>();
  const [expandedPaths, setExpandedPaths] = useState(() => new Set<string>());

  const tree = useMemo(
    () => buildVirtualTree(notes, rootPath),
    [notes, rootPath],
  );

  const flatNodes = useMemo(
    () => flattenVisible(tree, expandedPaths),
    [tree, expandedPaths],
  );

  const toggleDir = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleFavorite = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    const updatedNote = { ...note, favorite: !note.favorite } as Note;
    await repositories.notes.update(note.id, updatedNote);
    globalDispatch.syncNoteState(updatedNote);
  };

  const handleDelete = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    const confirmed = await Modal.confirm({
      title: "Delete note",
      description: "Are you sure you want to delete this note?",
      confirm: { text: "Delete", theme: "danger" },
    });
    if (confirmed) {
      await globalDispatch.deleteNote(note.id);
    }
  };

  if (flatNodes.length === 0) {
    return (
      <div className="p-4 text-xs text-center text-muted-foreground">
        No notes with files in this directory
      </div>
    );
  }

  return (
    <div role="tree" className="py-2 outline-none">
      {flatNodes.map(({ node, depth }) => {
        const paddingLeft = 12 + depth * 16;
        if (node.type === "directory") {
          const isExpanded = expandedPaths.has(node.path);
          return (
            <div
              key={node.path}
              role="treeitem"
              aria-expanded={isExpanded}
              style={{ paddingLeft }}
              onClick={() => toggleDir(node.path)}
              className="flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors hover:bg-muted"
            >
              {isExpanded ? (
                <CaretDownIcon className="size-4" />
              ) : (
                <CaretRightIcon className="size-4" />
              )}
              {isExpanded ? (
                <FolderOpenIcon className="size-4 text-secondary" />
              ) : (
                <FolderIcon className="size-4 text-warn" />
              )}
              <span className="text-sm truncate flex-1 text-gray-700 dark:text-gray-300">
                {node.name}
              </span>
            </div>
          );
        }

        const isJson = node.note.noteType === NoteType.json;
        return (
          <div key={node.path} style={{ paddingLeft }}>
            <ul>
              <NoteItem
                note={{ ...node.note, tagCount: node.note.tags.length }}
                isActive={node.note.id === noteId}
                onClick={() => navigate(`/note/${node.note.id}`)}
                onToggleFavorite={(e) => toggleFavorite(e, node.note)}
                onDelete={(e) => handleDelete(e, node.note)}
                extra={
                  isJson ? (
                    <span className="px-1 rounded bg-warn/10 text-warn text-[10px] font-medium shrink-0">
                      JSON
                    </span>
                  ) : undefined
                }
              />
            </ul>
          </div>
        );
      })}
    </div>
  );
};
