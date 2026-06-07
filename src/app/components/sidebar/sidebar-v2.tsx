import { Button, css } from "@g4rcez/components";
import { FilePlusIcon } from "@phosphor-icons/react/dist/csr/FilePlus";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { FilesIcon } from "@phosphor-icons/react/dist/csr/Files";
import { FolderSimpleIcon } from "@phosphor-icons/react/dist/csr/FolderSimple";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { InfoIcon } from "@phosphor-icons/react/dist/csr/Info";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/csr/ListBullets";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { SidebarIcon } from "@phosphor-icons/react/dist/csr/Sidebar";
import { TrashSimpleIcon } from "@phosphor-icons/react/dist/csr/TrashSimple";
import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useLayoutStore } from "@/app/contexts/layout-context";
import { fishify } from "@/lib/fmt";
import { isElectron } from "@/lib/is-electron";
import {
  globalDispatch,
  repositories,
  useGlobalStore,
} from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import { uiDispatch, useUIStore, type MediaSource } from "@/store/ui.store";
import type { TreeNode } from "@/types/tree";
import { NotePencilIcon } from "@phosphor-icons/react";
import { WritemeLogo } from "../logo";
import { TreeView, type TreeCreateRequest } from "../tree-view";

type Mime = { mediaType: MediaSource["type"]; mimeType: string };

const MEDIA_EXTENSION_MAP = {
  ".bmp": { mediaType: "image", mimeType: "image/bmp" },
  ".gif": { mediaType: "image", mimeType: "image/gif" },
  ".jpeg": { mediaType: "image", mimeType: "image/jpeg" },
  ".jpg": { mediaType: "image", mimeType: "image/jpeg" },
  ".mov": { mediaType: "video", mimeType: "video/quicktime" },
  ".mp4": { mediaType: "video", mimeType: "video/mp4" },
  ".ogg": { mediaType: "video", mimeType: "video/ogg" },
  ".pdf": { mediaType: "pdf", mimeType: "application/pdf" },
  ".png": { mediaType: "image", mimeType: "image/png" },
  ".svg": { mediaType: "image", mimeType: "image/svg+xml" },
  ".webm": { mediaType: "video", mimeType: "video/webm" },
  ".webp": { mediaType: "image", mimeType: "image/webp" },
} satisfies Record<string, Mime>;

type MediaExtension = keyof typeof MEDIA_EXTENSION_MAP;

function isMediaExtension(
  extension: string | undefined,
): extension is MediaExtension {
  return Boolean(extension && extension in MEDIA_EXTENSION_MAP);
}

function copyToArrayBuffer(data: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return buffer;
}

type SidebarNavItemProps = {
  icon: JSX.Element;
  label: string;
  active?: boolean;
  onClick: () => void;
};

type SidebarFooterTabProps = {
  icon: JSX.Element;
  label: string;
  active?: boolean;
  onClick: () => void;
};

type GroupBucket = {
  id: string;
  title: string;
  count: number;
  notes: Note[];
};

const formatBadge = (count: number) => (count > 99 ? "99+" : String(count));

function SidebarNavItem({
  icon,
  label,
  active,
  onClick,
}: SidebarNavItemProps): JSX.Element {
  return (
    <Button
      size="small"
      onClick={onClick}
      theme={active ? "ghost-primary" : "ghost-muted"}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </Button>
  );
}

function SidebarFooterTab({
  icon,
  label,
  active,
  onClick,
}: SidebarFooterTabProps): JSX.Element {
  return (
    <Button
      size="small"
      onClick={onClick}
      aria-pressed={active}
      theme={active ? "ghost-primary" : "ghost-muted"}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </Button>
  );
}

function WorkspaceTreeSection(): JSX.Element {
  const [state] = useGlobalStore();
  const [layout] = useLayoutStore((layout) => ({
    searchQuery: layout.searchQuery,
  }));
  const navigate = useNavigate();
  const [createRequest, setCreateRequest] = useState<TreeCreateRequest | null>(
    null,
  );

  const map = useMemo(() => {
    const entries = state.notes
      .filter((note) => Boolean(note.filePath))
      .map((note) => [note.filePath!, note] as const);
    return new Map(entries);
  }, [state.notes]);

  const requestRootCreate = useCallback((kind: TreeCreateRequest["kind"]) => {
    setCreateRequest((previous) => ({
      id: (previous?.id ?? 0) + 1,
      kind,
    }));
  }, []);

  const handleNewFile = useCallback(
    async (targetPath: string): Promise<boolean> => {
      try {
        const writeResult = await window.electronAPI.fs.writeFile(
          targetPath,
          "",
        );
        if (!writeResult?.success) return false;
        const title = targetPath
          .substring(targetPath.lastIndexOf("/") + 1)
          .replace(/\.md$/, "");
        const note = Note.new(title, "");
        note.filePath = targetPath;
        await repositories.notes.save(note);
        const updatedNotes = await repositories.notes.getAll();
        globalDispatch.notes(updatedNotes);
        navigate(`/note/${note.id}`);
        return true;
      } catch {
        return false;
      }
    },
    [navigate],
  );

  const handleNewFolder = useCallback(
    async (targetPath: string): Promise<boolean> => {
      try {
        const result = await window.electronAPI.fs.mkdir(targetPath);
        return Boolean(result?.success);
      } catch {
        return false;
      }
    },
    [],
  );

  const handleDelete = useCallback(async (node: TreeNode): Promise<boolean> => {
    const isDir = node.type === "directory";
    try {
      if (!isDir) {
        const allNotes = await repositories.notes.getAll();
        const existingNote = allNotes.find((n) => n.filePath === node.path);
        if (existingNote) {
          await globalDispatch.deleteNote(existingNote.id);
          return true;
        }
      } else {
        const allNotes = await repositories.notes.getAll();
        const notesInDir = allNotes.filter((n) =>
          n.filePath?.startsWith(node.path + "/"),
        );
        for (const note of notesInDir) {
          await globalDispatch.deleteNote(note.id);
        }
      }
      const result = await window.electronAPI.fs.deleteFile(node.path);
      return typeof result === "object" && result !== null
        ? result.success
        : result === true;
    } catch (error) {
      console.error("Error deleting:", error);
      return false;
    }
  }, []);

  const handleFileSelect = useCallback(
    async (node: TreeNode): Promise<void> => {
      if (node.type === "file" && node.extension === ".md") {
        const allNotes = await repositories.notes.getAll();
        let note = allNotes.find((existing) => existing.filePath === node.path);
        if (!note) {
          const result = await window.electronAPI.fs.readFile(node.path);
          note = Note.new(node.name.replace(".md", ""), result.content || "");
          note.filePath = node.path;
          await repositories.notes.save(note);
          const updatedNotes = await repositories.notes.getAll();
          globalDispatch.notes(updatedNotes);
        }
        navigate(`/note/${note.id}`);
      } else if (node.type === "file" && node.extension === ".json") {
        const allNotes = await repositories.notes.getAll();
        let note = allNotes.find((existing) => existing.filePath === node.path);
        if (!note) {
          const result = await window.electronAPI.fs.readFile(node.path);
          note = Note.new(
            node.name.replace(".json", ""),
            result.content || "",
            NoteType.json,
          );
          note.filePath = node.path;
          await repositories.notes.save(note);
          const updatedNotes = await repositories.notes.getAll();
          globalDispatch.notes(updatedNotes);
        }
        navigate(`/note/${note.id}`);
      } else if (node.type === "file" && isMediaExtension(node.extension)) {
        const parentDir = node.path.substring(0, node.path.lastIndexOf("/"));
        const dirResult = await window.electronAPI.fs.readDir(parentDir);
        const siblingMediaFiles = (dirResult?.entries ?? []).filter(
          (entry): entry is TreeNode & { extension: MediaExtension } =>
            entry.type === "file" && isMediaExtension(entry.extension),
        );
        const sources = (
          await Promise.all(
            siblingMediaFiles.map(
              async (sibling): Promise<MediaSource | null> => {
                const { mediaType, mimeType } =
                  MEDIA_EXTENSION_MAP[sibling.extension];
                const result = await window.electronAPI.fs.readBinaryFile(
                  sibling.path,
                );
                if (!result.success || !result.data) return null;
                const blobUrl = URL.createObjectURL(
                  new Blob([copyToArrayBuffer(result.data)], {
                    type: mimeType,
                  }),
                );
                return { src: blobUrl, type: mediaType, title: sibling.name };
              },
            ),
          )
        ).filter((source): source is MediaSource => source !== null);
        if (sources.length === 0) return;
        const clickedIndex = siblingMediaFiles.findIndex(
          (entry) => entry.path === node.path,
        );
        uiDispatch.openMediaPreview(sources, Math.max(0, clickedIndex));
      }
    },
    [navigate],
  );

  if (!isElectron() || !state.explorerRoot) {
    return <SidebarNotesFallback />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground pb-2">
        <span>Notes</span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            theme="ghost-muted"
            title="Create file"
            aria-label="Create file"
            icon={<FilePlusIcon size={14} />}
            onClick={() => requestRootCreate("file")}
          />
          <Button
            size="icon"
            theme="ghost-muted"
            title="Create folder"
            aria-label="Create folder"
            icon={<FolderSimpleIcon size={14} />}
            onClick={() => requestRootCreate("directory")}
          />
        </div>
      </div>
      <div className="min-h-0 overflow-y-auto bg-card-background">
        <TreeView
          map={map}
          onDelete={handleDelete}
          onNewFile={handleNewFile}
          createRequest={createRequest}
          onNewFolder={handleNewFolder}
          rootPath={state.explorerRoot}
          onFileSelect={handleFileSelect}
          searchQuery={layout.searchQuery}
        />
      </div>
    </div>
  );
}

function SidebarNotesFallback(): JSX.Element {
  const [state] = useGlobalStore();
  const location = useLocation();
  const navigate = useNavigate();

  const groupedNotes = useMemo(() => {
    const membersByGroupId = new Map<string, string[]>();
    for (const member of state.noteGroupMembers) {
      const list = membersByGroupId.get(member.groupId) ?? [];
      list.push(member.noteId);
      membersByGroupId.set(member.groupId, list);
    }

    const notesById = new Map(state.notes.map((note) => [note.id, note]));
    const buckets: GroupBucket[] = state.noteGroups
      .map((group) => {
        const noteIds = membersByGroupId.get(group.id) ?? [];
        const notes = noteIds
          .map((id) => notesById.get(id))
          .filter((note): note is Note => note !== undefined)
          .sort(
            (left, right) =>
              right.updatedAt.getTime() - left.updatedAt.getTime(),
          );

        return {
          id: group.id,
          title: group.title,
          count: notes.length,
          notes,
        };
      })
      .sort((left, right) => left.title.localeCompare(right.title));

    const groupedIds = new Set(
      state.noteGroupMembers.map((member) => member.noteId),
    );
    const ungroupedNotes = state.notes
      .filter((note) => !groupedIds.has(note.id))
      .sort(
        (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
      );

    return { buckets, ungroupedNotes };
  }, [state.noteGroupMembers, state.noteGroups, state.notes]);

  const openWorkspace = async (): Promise<void> => {
    if (!isElectron()) return;
    const path = await window.electronAPI.fs.chooseDirectory();
    if (path) {
      await globalDispatch.switchWorkspace(path);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="writeme-sidebar-v2-section-heading pb-2">
        <span>Notes</span>
        {isElectron() ? (
          <Button size="small" theme="ghost-muted" onClick={openWorkspace}>
            Open workspace
          </Button>
        ) : null}
      </div>

      <div className="writeme-sidebar-v2-group-list flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-hide">
        {groupedNotes.buckets.length === 0 &&
        groupedNotes.ungroupedNotes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-border/40 bg-card-background/70 px-4 py-8 text-center text-sm text-muted-foreground">
            <FolderSimpleIcon className="mb-2 size-6 text-muted-foreground/40" />
            <p>No folders yet.</p>
          </div>
        ) : null}

        {groupedNotes.buckets.map((group) => (
          <section key={group.id} className="writeme-sidebar-v2-group">
            <button
              type="button"
              onClick={() => navigate(`/groups/${group.id}`)}
              className="writeme-sidebar-v2-group-button"
            >
              <FolderSimpleIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{group.title}</span>
              <span className="writeme-sidebar-v2-nav-count">
                {formatBadge(group.count)}
              </span>
            </button>
            {group.notes.length > 0 ? (
              <div className="mt-1 flex flex-col gap-0.5 pl-3">
                {group.notes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => navigate(`/note/${note.id}`)}
                    className={css(
                      "writeme-sidebar-v2-file",
                      location.pathname === `/note/${note.id}`
                        ? "writeme-sidebar-v2-file--active"
                        : null,
                      note.noteType === NoteType.quick ? "text-warn" : null,
                    )}
                  >
                    <span className="shrink-0 text-muted-foreground">
                      {note.noteType === NoteType.quick ? (
                        <LightningIcon size={14} />
                      ) : (
                        <FileTextIcon size={14} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {note.title || "Untitled"}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ))}

        {groupedNotes.ungroupedNotes.length > 0 ? (
          <section className="writeme-sidebar-v2-group">
            <button
              type="button"
              className="writeme-sidebar-v2-group-button"
              disabled
            >
              <FilePlusIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">Unsorted</span>
              <span className="writeme-sidebar-v2-nav-count">
                {formatBadge(groupedNotes.ungroupedNotes.length)}
              </span>
            </button>
            <div className="mt-1 flex flex-col gap-0.5 pl-3">
              {groupedNotes.ungroupedNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => navigate(`/note/${note.id}`)}
                  className={css(
                    "writeme-sidebar-v2-file",
                    location.pathname === `/note/${note.id}`
                      ? "writeme-sidebar-v2-file--active"
                      : null,
                    note.noteType === NoteType.quick ? "text-warn" : null,
                  )}
                >
                  <span className="shrink-0 text-muted-foreground">
                    {note.noteType === NoteType.quick ? (
                      <LightningIcon size={14} />
                    ) : (
                      <FileTextIcon size={14} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {note.title || "Untitled"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function SidebarV2(): JSX.Element {
  const [state, dispatch] = useGlobalStore();
  const [, layoutDispatch] = useLayoutStore();
  const [uiState] = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();

  const workspace = useMemo(() => {
    const source = state.explorerRoot ?? state.directory;
    if (!source) return { title: "Writeme", directory: "~" };
    const parts = source.split(/[\\/]/).filter(Boolean);
    return { title: parts.at(-1) ?? "Writeme", directory: source || "~" };
  }, [state.directory, state.explorerRoot]);

  useEffect(() => {
    void dispatch.loadGroups();
  }, [dispatch]);

  const openNoteDialog = useCallback((type: "note" | "quick") => {
    globalDispatch.setCreateNoteDialog({ isOpen: true, type });
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-4 gap-4 bg-background">
      <header className="flex flex-nowrap justify-between">
        <div className="flex items-center gap-4">
          <WritemeLogo className="size-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-foreground">
              {workspace.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {fishify(workspace.directory, state.homedir ?? "")}
            </p>
          </div>
        </div>
        <Button
          size="tiny"
          theme="ghost-primary"
          onClick={() => uiDispatch.toggleSidebar()}
          title={uiState.sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-label={
            uiState.sidebarOpen ? "Collapse sidebar" : "Expand sidebar"
          }
        >
          <SidebarIcon size={14} />
        </Button>
      </header>
      <div className="flex items-center gap-2">
        <Button theme="ghost-muted" size="tiny">
          Search
        </Button>
        <Button
          size="tiny"
          theme="ghost-muted"
          title="Create note"
          aria-label="Create note"
          onClick={() => openNoteDialog("note")}
        >
          <PlusIcon size={14} />
        </Button>
        <Button
          size="tiny"
          theme="ghost-muted"
          title="Create quick note"
          aria-label="Create quick note"
          onClick={() => openNoteDialog("quick")}
        >
          <LightningIcon size={14} />
        </Button>
      </div>
      <nav className="flex flex-col gap-2">
        <SidebarNavItem
          label="Notes"
          onClick={() => navigate("/notes")}
          icon={<NotePencilIcon size={14} />}
          active={location.pathname.startsWith("/notes")}
        />
        <SidebarNavItem
          label="Tasks"
          active={uiState.tasksDialog.isOpen}
          icon={<ListBulletsIcon size={14} />}
          onClick={() => uiDispatch.openTasksDialog()}
        />
        <SidebarNavItem
          label="Trash"
          icon={<TrashSimpleIcon size={14} />}
          active={location.pathname.startsWith("/settings/trash")}
          onClick={() => {
            layoutDispatch.setView({ type: "trash" });
            navigate("/settings/trash");
          }}
        />
      </nav>
      <WorkspaceTreeSection />
      <footer className="mt-auto border-t border-card-border">
        <div className="grid grid-cols-3 gap-2">
          <SidebarFooterTab
            icon={<FilesIcon size={14} />}
            label="Files"
            active={location.pathname.startsWith("/folder")}
            onClick={() => {
              if (state.explorerRoot) {
                navigate(
                  `/folder?path=${encodeURIComponent(state.explorerRoot)}`,
                );
              } else {
                navigate("/notes");
              }
            }}
          />
          <SidebarFooterTab
            label="Help"
            icon={<InfoIcon size={14} />}
            onClick={() => navigate("/examples")}
            active={location.pathname.startsWith("/examples")}
          />
          <SidebarFooterTab
            label="Settings"
            icon={<GearIcon size={14} />}
            onClick={() => navigate("/settings")}
            active={location.pathname.startsWith("/settings")}
          />
        </div>
      </footer>
    </div>
  );
}
