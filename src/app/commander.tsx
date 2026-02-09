import { Note } from "../store/note";
import { repositories, useGlobalStore } from "../store/global.store";
import { isElectron } from "../lib/is-electron";
import {
  mapShortcutOS,
  Type,
  useShortcuts,
  useWritemeShortcuts,
} from "./elements/shortcut-items";
import { CommandItemTypes, CommandPalette } from "@g4rcez/components";
import { SettingsRepository } from "../store/settings";
import {
  createStandaloneNote,
  generateNotePath,
  getUniqueFilePath,
  getUniqueNoteTitle,
} from "../lib/file-utils";
import { db } from "../store/repositories/dexie/dexie-db";
import { useNavigate } from "react-router-dom";
import { editorGlobalRef } from "./editor-global-ref";
import { utf8ToBase64 } from "../lib/encoding";

export const Commander = () => {
  const [state, dispatch] = useGlobalStore();
  const commands = useWritemeShortcuts();
  useShortcuts();
  const navigate = useNavigate();

  return (
    <CommandPalette
      open={state.commander}
      onChangeVisibility={dispatch.commander}
      commands={
        [
          ...(isElectron()
            ? [
              {
                title: "Filesystem",
                type: "group",
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
                    action: async (args: {
                      setOpen: (v: boolean) => void;
                    }) => {
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
                                const r =
                                  await window.electronAPI.fs.statFile(p);
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
                                lastSynced: new Date(
                                  writeResult.lastModified,
                                ),
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
                          // Index metadata in IndexedDB for recent notes
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
            : []),
          {
            title: "Notes",
            type: "group",
            items: [
              {
                title: "New note",
                type: "shortcut",
                action: (args) => {
                  const title = getUniqueNoteTitle("Untitled", state.notes);
                  const newNote = Note.new(title, "");
                  repositories.notes.save(newNote);
                  dispatch.note(newNote);
                  args.setOpen(false);
                  navigate(`/note/${newNote.id}`);
                },
              },
              {
                title: "Recent notes",
                shortcut: mapShortcutOS("mod+e"),
                type: "shortcut",
                action: (args) => {
                  args.setOpen(false);
                  dispatch.recentNotesDialog(true);
                },
              },
              {
                title: "Quick note",
                shortcut: mapShortcutOS("mod+alt+n"),
                type: "shortcut",
                action: (args) => {
                  args.setOpen(false);
                  window.electronAPI.app.openQuickNote();
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
                    const url = `${window.location.origin}/#/share?q=${encoded}`;
                    navigator.clipboard.writeText(url);
                  }
                  args.setOpen(false);
                },
              },
              ...state.notes.map((note): CommandItemTypes => {
                return {
                  type: "shortcut",
                  title: `Note: ${note.title}`,
                  action: (args) => {
                    args.setOpen(false);
                    navigate(`/note/${note.id}`);
                  },
                };
              }),
            ],
          },
          {
            title: "Actions",
            type: "group",
            items: commands
              .filter((x) => !x.hidden)
              .filter((x) => x.type === Type.Shortcut)
              .map((x) => ({
                title: x.description,
                shortcut: mapShortcutOS(x.bind),
                type: "shortcut",
                action: (args) => {
                  x.action();
                  args.setOpen(false);
                },
              })),
          },
        ] as const
      }
    />
  );
};
