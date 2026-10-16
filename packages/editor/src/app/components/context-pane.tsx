import { Modal } from "@g4rcez/components/modal";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { extractCompletionTags } from "@/app/extensions/editor-completion-data";
import type { Note } from "@/store/note";
import { Dates } from "@/lib/dates";
import { formatNoteHref, formatNoteMention } from "@/lib/markdown-links";
import { markdownLineToPlainText } from "@/lib/markdown-text";
import { isElectron } from "@/lib/is-electron";
import { joinImportPath } from "@/lib/obsidian-import";
import {
  applyConnectionRepair,
  createConnectionTarget,
  refreshConnectionNotes,
  undoConnectionRepair,
  type ConnectionRepair,
} from "@/lib/note-connection-actions";
import {
  extractWorkspaceFileReferences,
  findIncomingNoteLinks,
  findUnlinkedNoteMentions,
  findUnresolvedNoteLinks,
  resolveNoteLinks,
  type WorkspaceFileReference,
} from "@/lib/note-links";
import { parseObsidianLink, formatObsidianLink } from "@/lib/obsidian-links";

type OutlineHeading = {
  id: string;
  level: number;
  text: string;
  element: HTMLHeadingElement;
};

type ContextPaneProps = {
  note: Note;
  notes: Note[];
  workspaceDirectory: string | null;
  open: boolean;
  onClose: () => void;
};

type WorkspaceFileStatus = "checking" | "available" | "missing" | "outside-workspace" | "unavailable";
type WorkspaceFileReferenceEntry = {
  reference: WorkspaceFileReference;
  status: WorkspaceFileStatus;
  note: Note | null;
};

function workspaceFileStatusKey(directory: string | null, path: string): string {
  return `${directory ?? ""}\u0000${path}`;
}

function getWorkspaceFileStatus(result: unknown): WorkspaceFileStatus {
  if (
    result &&
    typeof result === "object" &&
    "success" in result &&
    result.success === true &&
    "exists" in result &&
    typeof result.exists === "boolean"
  ) {
    return result.exists ? "available" : "missing";
  }
  return "unavailable";
}

function readOutline(): OutlineHeading[] {
  const container = document.getElementById("main-scroll-container") ?? document.body;
  return Array.from(
    container.querySelectorAll<HTMLHeadingElement>(".ProseMirror h1, .ProseMirror h2, .ProseMirror h3"),
  )
    .map((element, index) => ({
      element,
      id: element.id || element.dataset.id || `context-heading-${index}`,
      level: Number(element.tagName.slice(1)),
      text: element.textContent?.trim() || "Untitled section",
    }))
    .filter((heading) => heading.text.length > 0);
}

function scrollToHeading(element: HTMLElement): void {
  const container = document.getElementById("main-scroll-container");
  if (!container) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const targetRect = element.getBoundingClientRect();
  const targetScrollTop = container.scrollTop + targetRect.top - containerRect.top - 48;
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  container.scrollTo({ top: Math.max(0, targetScrollTop), behavior });
}

function ContextSection({
  title,
  count,
  children,
  open = false,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="writeme-context-section" open={open}>
      <summary>
        <span className="flex min-w-0 items-center gap-2">
          <span>{title}</span>
          {count !== undefined ? (
            <span className="font-mono text-[10px] text-muted-foreground/60">{count}</span>
          ) : null}
        </span>
      </summary>
      {children}
    </details>
  );
}

export function ContextPane({ note, notes, workspaceDirectory, open, onClose }: ContextPaneProps) {
  const [headings, setHeadings] = useState<OutlineHeading[]>([]);
  const [repairError, setRepairError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ConnectionRepair | null>(null);
  const [busy, setBusy] = useState(false);
  const actionPending = useRef(false);
  const previewElement = useRef<HTMLElement>(null);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const feedbackElement = useRef<HTMLOutputElement>(null);
  const connectionControls = useRef<HTMLFieldSetElement>(null);
  const searchElement = useRef<HTMLInputElement>(null);
  const choosingTrigger = useRef<HTMLButtonElement | null>(null);
  const [choosingReference, setChoosingReference] = useState<number | null>(null);
  const [targetQuery, setTargetQuery] = useState("");
  const [undo, setUndo] = useState<{ saved: Note; originalContent: string } | null>(null);
  const [fileStatuses, setFileStatuses] = useState<Record<string, WorkspaceFileStatus>>({});

  useEffect(() => {
    if (preview) previewElement.current?.focus();
  }, [preview]);
  useEffect(() => {
    if (!busy && repairError) feedbackElement.current?.focus();
  }, [busy, repairError]);
  useEffect(() => {
    if (choosingReference !== null) searchElement.current?.focus();
  }, [choosingReference]);
  useEffect(() => {
    const escape = (event: KeyboardEvent): void => {
      if (
        !open ||
        event.key !== "Escape" ||
        (!preview && choosingReference === null) ||
        !connectionControls.current?.contains(document.activeElement)
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (preview) {
        setPreview(null);
        previewTrigger.current?.focus();
      } else {
        setChoosingReference(null);
        choosingTrigger.current?.focus();
      }
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [open, preview, choosingReference]);
  const cancelPreview = (): void => {
    setPreview(null);
    previewTrigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const container = document.getElementById("main-scroll-container");
    if (!container) return;

    const update = () => setHeadings(readOutline());
    update();
    const observer = new MutationObserver(update);
    observer.observe(container, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [note.id, open]);
  const fileReferences = useMemo(() => extractWorkspaceFileReferences(note.content), [note.content]);
  const tags = useMemo(
    () => [...new Set([...note.tags, ...extractCompletionTags(note.content)])],
    [note.content, note.tags],
  );
  useEffect(() => {
    if (!open || fileReferences.length === 0 || !isElectron()) return;
    let current = true;
    void Promise.all(
      [...new Set(fileReferences.map(({ path }) => path))].map(async (path) => {
        const key = workspaceFileStatusKey(workspaceDirectory, path);
        const filePath = workspaceDirectory ? joinImportPath(workspaceDirectory, path) : null;
        if (!filePath) return [key, workspaceDirectory ? "outside-workspace" : "unavailable"] as const;
        try {
          const result: unknown = await window.electronAPI.fs.statFile(filePath);
          return [key, getWorkspaceFileStatus(result)] as const;
        } catch {
          return [key, "unavailable"] as const;
        }
      }),
    ).then((entries) => {
      if (current) setFileStatuses((statuses) => ({ ...statuses, ...Object.fromEntries(entries) }));
    });
    return () => {
      current = false;
    };
  }, [fileReferences, open, workspaceDirectory]);
  const fileReferenceEntries = useMemo(
    () =>
      fileReferences.map((reference): WorkspaceFileReferenceEntry => {
        const status =
          fileStatuses[workspaceFileStatusKey(workspaceDirectory, reference.path)] ??
          (workspaceDirectory && isElectron() ? "checking" : "unavailable");
        const filePath = workspaceDirectory ? joinImportPath(workspaceDirectory, reference.path) : null;
        const note =
          status === "available" && filePath
            ? (notes.find((candidate) => candidate.filePath === filePath) ?? null)
            : null;
        return { reference, status, note };
      }),
    [fileReferences, fileStatuses, notes, workspaceDirectory],
  );
  const linkedFileReferences = useMemo(
    () =>
      fileReferenceEntries.flatMap((entry) =>
        entry.note ? [{ reference: entry.reference, note: entry.note }] : [],
      ),
    [fileReferenceEntries],
  );
  const unresolvedFileReferences = useMemo(
    () =>
      fileReferenceEntries.filter(
        ({ status, note }) =>
          status === "missing" ||
          status === "outside-workspace" ||
          (status === "available" && !note) ||
          (status === "unavailable" && workspaceDirectory !== null && isElectron()),
      ),
    [fileReferenceEntries, workspaceDirectory],
  );

  const linkedNotes = useMemo(() => resolveNoteLinks(note, notes), [note, notes]);
  const incomingNotes = useMemo(() => findIncomingNoteLinks(note, notes), [note, notes]);
  const unresolvedLinks = useMemo(() => findUnresolvedNoteLinks(note, notes), [note, notes]);
  const unlinkedMentions = useMemo(() => findUnlinkedNoteMentions(note, notes), [note, notes]);
  const unresolvedCount = unresolvedLinks.length + unresolvedFileReferences.length;

  const runAction = async (action: () => Promise<void>): Promise<void> => {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setRepairError(null);
    try {
      await action();
    } catch (error: unknown) {
      setRepairError(error instanceof Error ? error.message : "Could not update the connection. Try again.");
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  };
  const applyRepair = async (repair: ConnectionRepair): Promise<void> => {
    const saved = await applyConnectionRepair(repair);
    setUndo(saved ? { saved, originalContent: repair.source.content } : null);
    setPreview(null);
    setRepairError(saved ? "Link added." : "Link added in the editor. Save or undo it as you would any edit.");
  };
  const repairReference = async (
    reference: (typeof unresolvedLinks)[number]["reference"],
    target: Note,
  ): Promise<void> => {
    const parsed = parseObsidianLink(reference.raw);
    const replacement =
      reference.kind === "id"
        ? reference.markdown
          ? `[${reference.markdown.label}](${formatNoteHref(target.id, reference.subpath)}${reference.markdown.title ? ` "${reference.markdown.title.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"` : ""})`
          : formatNoteMention(target.id, reference.label, reference.subpath)
        : formatObsidianLink({
          target: target.id,
          embed: parsed?.embed,
          subpath: parsed?.subpath,
          alias: parsed?.alias ?? parsed?.display ?? reference.target,
        });
    await applyRepair({ source: note, target, from: reference.from, to: reference.to, replacement });
  };
  const repairSections = (
    <fieldset ref={connectionControls} disabled={busy} className="min-w-0 border-0 p-0 [&_button]:min-h-11">
      <ContextSection title="Unresolved references" count={unresolvedCount}>
        {unresolvedCount === 0 ? (
          <p className="writeme-context-empty">Missing note and file references will appear here.</p>
        ) : (
          <ul className="writeme-context-list">
            {unresolvedLinks.map(({ reference, candidates }) => (
              <li key={reference.from} className="px-2 py-2">
                <p className="break-words text-sm font-medium text-foreground">{reference.raw}</p>
                <p className="text-xs text-muted-foreground">
                  {candidates.length > 1 ? "More than one matching note." : "No matching note yet."}
                </p>
                {candidates.length === 0 ? (
                  <button
                    type="button"
                    className="writeme-context-list-button"
                    onClick={() =>
                      void runAction(async () => {
                        const target = await createConnectionTarget(
                          reference.kind === "wiki" ? reference.target : reference.label,
                        );
                        if (reference.kind === "id") await repairReference(reference, target);
                        else setRepairError("Note ready. References have been refreshed.");
                      })
                    }
                  >
                    Create note
                  </button>
                ) : null}
                <button
                  type="button"
                  className="writeme-context-list-button"
                  aria-expanded={choosingReference === reference.from}
                  onClick={(event) => {
                    choosingTrigger.current = event.currentTarget;
                    setChoosingReference(
                      choosingReference === reference.from ? null : reference.from,
                    );
                    setTargetQuery("");
                  }}
                >
                  Choose existing note
                </button>
                {choosingReference === reference.from ? (
                  <div className="mt-2">
                    <label className="block text-xs text-muted-foreground">
                      Find a note
                      <input
                        ref={searchElement}
                        value={targetQuery}
                        onChange={(event) => setTargetQuery(event.target.value)}
                        className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <ul>
                      {(candidates.length > 0 && !targetQuery
                        ? candidates
                        : notes.filter(
                          (candidate) =>
                            candidate.id !== note.id &&
                            candidate.title
                              .toLocaleLowerCase()
                              .includes(targetQuery.toLocaleLowerCase()),
                        )
                      )
                        .slice(0, 30)
                        .map((candidate) => (
                          <li key={candidate.id}>
                            <button
                              type="button"
                              data-note-id={candidate.id}
                              className="writeme-context-list-button text-left"
                              onClick={() =>
                                void runAction(() =>
                                  repairReference(reference, candidate),
                                )
                              }
                            >
                              <span className="block">
                                {candidate.title || "Untitled"}
                              </span>
                              <span className="block break-all text-xs text-muted-foreground">
                                {candidate.filePath ||
                                  markdownLineToPlainText(
                                    candidate.content.slice(0, 100),
                                  ) ||
                                  "Empty note"}
                              </span>
                            </button>
                          </li>
                        ))}
                    </ul>
                    {notes.filter(
                      (candidate) =>
                        candidate.id !== note.id &&
                        candidate.title
                          .toLocaleLowerCase()
                          .includes(targetQuery.toLocaleLowerCase()),
                    ).length === 0 ? (
                      <p className="writeme-context-empty">No notes match. Try another name.</p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
            {unresolvedFileReferences.map(({ reference, status }) => (
              <li key={`file:${reference.from}:${reference.path}`} className="px-2 py-2">
                <p className="break-words text-sm font-medium text-foreground">
                  {reference.label || reference.path}
                </p>
                <p className="break-all text-xs text-muted-foreground">{reference.path}</p>
                <p className="text-xs text-muted-foreground">
                  {status === "missing"
                    ? "Missing from workspace"
                    : status === "outside-workspace"
                      ? "Outside workspace"
                      : status === "unavailable"
                        ? "Availability unavailable"
                        : "No matching note in workspace"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </ContextSection>
      <ContextSection title="Unlinked mentions" count={unlinkedMentions.length}>
        {unlinkedMentions.length === 0 ? (
          <p className="writeme-context-empty">No unlinked title or alias mentions in other notes.</p>
        ) : (
          <ul className="writeme-context-list">
            {unlinkedMentions.map((mention) => (
              <li key={mention.source.id + ":" + mention.from} className="px-2 py-2">
                <Link
                  className="block text-sm font-medium text-foreground hover:underline"
                  to={"/note/" + mention.source.id}
                >
                  {mention.source.title || "Untitled"}
                </Link>
                <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                  {mention.excerpt}
                </p>
                <button
                  type="button"
                  className="writeme-context-list-button"
                  onClick={(event) => {
                    previewTrigger.current = event.currentTarget;
                    setPreview({
                      source: mention.source,
                      target: note,
                      from: mention.from,
                      to: mention.to,
                      replacement: formatNoteMention(note.id, mention.text),
                    });
                    setRepairError(null);
                  }}
                >
                  Preview link
                </button>
              </li>
            ))}
          </ul>
        )}
        {preview ? (
          <section
            ref={previewElement}
            tabIndex={-1}
            aria-label="Link preview"
            className="m-2 rounded-md border border-border p-2 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="text-sm text-foreground">
              {preview.source.title} → {preview.target.title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Only the highlighted occurrence will become a link:
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-foreground">
              {preview.source.content.slice(Math.max(0, preview.from - 50), preview.from)}
              <mark className="bg-primary/10 text-primary underline">
                {preview.source.content.slice(preview.from, preview.to)}
              </mark>
              {preview.source.content.slice(preview.to, preview.to + 50)}
            </p>
            <button
              type="button"
              className="writeme-context-list-button"
              onClick={() => void runAction(() => applyRepair(preview))}
            >
              Link this mention
            </button>
            <button type="button" className="writeme-context-list-button" onClick={cancelPreview}>
              Cancel preview
            </button>
          </section>
        ) : null}
      </ContextSection>
      {busy ? (
        <output aria-live="polite" className="writeme-context-empty block">
          Updating connection…
        </output>
      ) : null}
      {repairError ? (
        <div>
          <output
            ref={feedbackElement}
            tabIndex={-1}
            aria-live="polite"
            className="writeme-context-empty block"
          >
            {repairError}
          </output>
          <button
            type="button"
            className="writeme-context-list-button"
            onClick={() =>
              void runAction(async () => {
                await refreshConnectionNotes();
                setPreview(null);
                setRepairError("Suggestions refreshed. Preview an occurrence to try again.");
              })
            }
          >
            Refresh suggestions
          </button>
        </div>
      ) : null}
      {undo ? (
        <button
          type="button"
          className="writeme-context-list-button"
          onClick={() =>
            void runAction(async () => {
              await undoConnectionRepair(undo.saved, undo.originalContent);
              setUndo(null);
              setRepairError("Link undone.");
            })
          }
        >
          Undo link
        </button>
      ) : null}
    </fieldset>
  );
  const noteType = note.noteType === "note" ? "Markdown" : note.noteType;

  const sections = (
    <div className="writeme-context-pane-content">
      <ContextSection title="On this page" count={headings.length} open={headings.length > 0}>
        {headings.length > 0 ? (
          <ul className="writeme-context-list">
            {headings.map((heading) => (
              <li key={`${heading.id}-${heading.text}`}>
                <button
                  type="button"
                  className="writeme-context-list-button"
                  style={{ paddingLeft: `${0.625 + Math.max(0, heading.level - 1) * 0.75}rem` }}
                  onClick={() => scrollToHeading(heading.element)}
                >
                  <span className="line-clamp-2">{heading.text}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="writeme-context-empty">Headings will appear here as you structure the note.</p>
        )}
      </ContextSection>
      {repairSections}
      <ContextSection title="File references" count={linkedFileReferences.length}>
        {linkedFileReferences.length > 0 ? (
          <ul className="writeme-context-list">
            {linkedFileReferences.map(({ reference, note: linkedFile }) => (
              <li key={`${reference.from}:${reference.path}`}>
                <Link
                  className="writeme-context-list-button block px-2 py-2"
                  to={`/note/${linkedFile.id}`}
                >
                  <span className="block break-words text-sm font-medium text-foreground">
                    {reference.label || linkedFile.title || "Untitled"}
                  </span>
                  <span className="block break-all text-xs text-muted-foreground">{reference.path}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="writeme-context-empty">Links to existing workspace notes will appear here.</p>
        )}
      </ContextSection>

      <ContextSection title="Linked notes" count={linkedNotes.length}>
        {linkedNotes.length > 0 ? (
          <ul className="writeme-context-list">
            {linkedNotes.map(({ note: linkedNote }) => (
              <li key={linkedNote.id}>
                <Link
                  className="writeme-context-list-button block truncate"
                  to={`/note/${linkedNote.id}`}
                >
                  {linkedNote.title || "Untitled"}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="writeme-context-empty">Links to other notes will show up here.</p>
        )}
      </ContextSection>

      <ContextSection title="Incoming links" count={incomingNotes.length}>
        {incomingNotes.length > 0 ? (
          <ul className="writeme-context-list">
            {incomingNotes.map(({ note: source, excerpt }) => (
              <li key={source.id} className="px-2 py-1.5">
                <Link
                  className="block truncate text-sm font-medium text-foreground hover:underline"
                  to={`/note/${source.id}`}
                >
                  {source.title || "Untitled"}
                </Link>
                <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{excerpt}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="writeme-context-empty">Notes that link here will appear here.</p>
        )}
      </ContextSection>

      <ContextSection title="Properties">
        <dl className="mt-2">
          <div className="writeme-context-property">
            <dt>Type</dt>
            <dd>{noteType}</dd>
          </div>
          <div className="writeme-context-property">
            <dt>Updated</dt>
            <dd>{Dates.yearMonthDay(note.updatedAt)}</dd>
          </div>
          <div className="writeme-context-property">
            <dt>Created</dt>
            <dd>{Dates.yearMonthDay(note.createdAt)}</dd>
          </div>
          <div className="writeme-context-property">
            <dt>Location</dt>
            <dd title={note.filePath ?? undefined}>{note.filePath ? "Workspace file" : "Local note"}</dd>
          </div>
        </dl>
      </ContextSection>

      <ContextSection title="Tags" count={tags.length}>
        {tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5 px-2.5">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                #{tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="writeme-context-empty">Add tags to make this note easier to find.</p>
        )}
      </ContextSection>
    </div>
  );

  return (
    <Modal
      open={open}
      onChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      type="drawer"
      position="right"
      forceType
      title="Context"
      ariaDescription={`Note context for ${note.title || "Untitled"}`}
      className="writeme-context-modal"
      bodyClassName="writeme-context-modal-body"
    >
      <p className="writeme-context-modal-note">{note.title || "Untitled"}</p>
      {sections}
    </Modal>
  );
}
