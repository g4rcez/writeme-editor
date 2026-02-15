import { CommandItemTypes, CommandPalette } from "@g4rcez/components";
import { useNavigate } from "react-router-dom";
import { version } from "../../package.json";
import { utf8ToBase64 } from "../lib/encoding";
import {
  createStandaloneNote,
  generateNotePath,
  getUniqueFilePath,
} from "../lib/file-utils";
import { isElectron } from "../lib/is-electron";
import { CommanderType, useGlobalStore } from "../store/global.store";
import { Note } from "../store/note";
import { db } from "../store/repositories/dexie/dexie-db";
import { SettingsRepository } from "../store/settings";
import { editorGlobalRef } from "./editor-global-ref";
import {
  mapShortcutOS,
  Type,
  useShortcuts,
  useWritemeShortcuts,
} from "./elements/shortcut-items";
import { useMemo } from "react";
import { FileTextIcon } from "lucide-react";

export const Commander = () => {
  useShortcuts();
  const [state, dispatch] = useGlobalStore();
  const commands = useWritemeShortcuts();
  const navigate = useNavigate();

  const options = useMemo(() => {
    const noteGroup = state.notes.map((note): CommandItemTypes => {
      return {
        type: "shortcut",
        title: `Note: ${note.title}`,
        action: (args) => {
          args.setOpen(false);
          navigate(`/note/${note.id}`);
        },
      };
    });
    if (state.commander.type === CommanderType.Notes) {
      return noteGroup;
    }
    const electron: CommandItemTypes[] = isElectron()
      ? [
        {
          title: "Filesystem",
          type: "group" as const,
          items: [
            {
              title: "Browse files",
              shortcut: mapShortcutOS("mod+shift+e"),
              type: "shortcut" as const,
              action: (args: { setOpen: (v: boolean) => void }) => {
                args.setOpen(false);
                dispatch.directoryBrowserDialog(true);
              },
            },
            {
              title: "Open...",
              shortcut: mapShortcutOS("mod+o"),
              type: "shortcut" as const,
              action: async (args: { setOpen: (v: boolean) => void }) => {
                args.setOpen(false);
                const result =
                  await window.electronAPI.fs.openFileOrDirectory();
                if (!result) return;
                if (result.isDirectory) {
                  const allNotes = await db.notes.toArray();
                  const webOnlyNotes = allNotes.filter(
                    (n: any) => !n.filePath && n.content,
                  );
                  for (const noteData of webOnlyNotes) {
                    try {
                      const note = Note.parse(noteData);
                      const filePath = generateNotePath(
                        result.path,
                        note.title,
                      );
                      const uniquePath = await getUniqueFilePath(
                        filePath,
                        async (p) => {
                          const r = await window.electronAPI.fs.statFile(p);
                          return r.exists;
                        },
                      );
                      const writeResult =
                        await window.electronAPI.fs.writeFile(
                          uniquePath,
                          note.content,
                        );
                      if (writeResult.success) {
                        await db.notes.update(note.id, {
                          content: undefined,
                          filePath: uniquePath,
                          fileSize: writeResult.fileSize,
                          lastSynced: new Date(writeResult.lastModified),
                        });
                        console.log(
                          `Migrated note "${note.title}" to ${uniquePath}`,
                        );
                      }
                    } catch (err) {
                      console.error(
                        "Failed to migrate note:",
                        noteData.title,
                        err,
                      );
                    }
                  }
                  SettingsRepository.save({
                    storageDirectory: result.path,
                  });
                  window.location.reload();
                } else {
                  const file = await window.electronAPI.fs.readFile(
                    result.path,
                  );
                  if (file.success) {
                    const noteData = createStandaloneNote(
                      result.path,
                      file.content,
                    );
                    const note = Note.parse(noteData);
                    const { content: _, ...metadata } = noteData;
                    await db.notes.put(metadata as any, note.id);
                    navigate(`/note/${note.id}`);
                  }
                }
              },
            },
          ],
        },
      ]
      : [];

    const notesItem: CommandItemTypes = {
      title: "Notes",
      type: "group",
      items: [
        {
          title: "New note",
          type: "shortcut",
          action: (args) => {
            args.setOpen(false);
            dispatch.setCreateNoteDialog({ isOpen: true, type: "note" });
          },
        },
        {
          title: "Quick note",
          shortcut: mapShortcutOS("mod+alt+n"),
          type: "shortcut",
          action: (args) => {
            args.setOpen(false);
            dispatch.setCreateNoteDialog({ isOpen: true, type: "quick" });
          },
        },
        {
          title: 'New "read it later" note',
          type: "shortcut",
          action: (args) => {
            args.setOpen(false);
            dispatch.readItLaterDialog(true);
          },
        },
        {
          title: "Share content",
          type: "shortcut",
          action: (args) => {
            const editor = editorGlobalRef.current;
            if (editor) {
              const content = (editor.storage as any).markdown.getMarkdown();
              const encoded = utf8ToBase64(content);
              const url = isElectron()
                ? `${window.location.origin}/#/share?q=${encoded}`
                : `${window.location.origin}/share?q=${encoded}`;
              navigator.clipboard.writeText(url);
            }
            args.setOpen(false);
          },
        },
        ...noteGroup,
      ],
    };
    const actions = commands
      .filter((x) => !x.hidden)
      .filter((x) => x.type === Type.Shortcut)
      .map(
        (x): CommandItemTypes => ({
          title: x.description,
          shortcut: mapShortcutOS(x.bind),
          type: "shortcut",
          action: (args) => {
            x.action();
            args.setOpen(false);
          },
        }),
      );
    const otherStuff: CommandItemTypes[] = [
      {
        title: "Actions",
        type: "group",
        items: [
          {
            type: "shortcut",
            title: "All notes",
            action: () => navigate("/notes"),
          },
          {
            type: "shortcut",
            title: "Find notes",
            action: (args) => {
              dispatch.commander(true, CommanderType.Notes);
              args.setOpen(false);
            },
          },
          ...actions,
        ],
      },
      {
        title: "About",
        type: "group",
        items: [
          {
            title: "About the project",
            type: "shortcut",
            action: (args) => {
              args.setOpen(false);
              navigate("/about");
            },
          },
          {
            title: "Examples",
            type: "shortcut",
            action: (args) => {
              args.setOpen(false);
              navigate("/examples");
            },
          }
        ],
      },
    ];
    return [...electron, notesItem, ...otherStuff];
  }, [state.commander]);

  return (
    <CommandPalette
      commands={options}
      open={state.commander.enabled}
      onChangeVisibility={dispatch.commander}
      footer={
        <div className="flex justify-center items-center min-w-full text-sm text-disabled">
          Version: {version}
        </div>
      }
    />
  );
};
