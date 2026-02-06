import { useEffect, useMemo } from "react";
import { shortcuts } from "../../lib/shortcuts";
import {
  useGlobalStore,
} from "../../store/global.store";
import { isElectron } from "../../lib/is-electron";
import { SettingsRepository } from "../../store/settings";
import {
  createStandaloneNote,
  generateNotePath,
  getUniqueFilePath,
} from "../../lib/file-utils";
import { Note } from "../../store/note";
import { db } from "../../store/repositories/dexie/dexie-db";

// Shortcuts that require filesystem access (Electron only)
const FILESYSTEM_SHORTCUTS = ["mod+o", "mod+shift+e"];

const noop = () => { };

export enum Type {
  Shortcut = "shortcut",
  Command = "command",
}

export type Shortcut = {
  bind: string;
  hidden?: boolean;
  action: () => any;
  description: string;
  type: Type;
};

const zoom = (op: (a: number, b: number) => number) => {
  const value =
    window
      .getComputedStyle(window.document.querySelector(":root")!)
      .getPropertyValue("--default-size") || "1rem";
  const int = value.replace(/rem$/g, "");
  window.document.documentElement.style.setProperty(
    "--default-size",
    `${op(+int, 0.25)}rem`,
  );
};

export const useWritemeShortcuts = () => {
  const [state, dispatch] = useGlobalStore();
  return useMemo(
    (): Shortcut[] =>
      [
        {
          bind: "mod+shift+m",
          type: Type.Shortcut,
          description: state.theme === "dark" ? "Light Mode" : "Dark Mode",
          action: () => {
            document.documentElement.classList.toggle("dark");
            dispatch.theme((prev) => (prev === "dark" ? "light" : "dark"));
          },
        },
        {
          hidden: true,
          bind: "mod+k",
          type: Type.Shortcut,
          description: "Commander",
          action: () => dispatch.commander(true),
        },
        {
          description: "Reload",
          bind: "mod+r",
          type: Type.Shortcut,
          action: () => window.location.reload(),
        },
        {
          description: "Zoom out",
          bind: "mod+-",
          type: Type.Shortcut,
          action: () => zoom((a, b) => a - b),
        },
        {
          description: "Zoom in",
          bind: "mod+=",
          type: Type.Shortcut,
          action: () => zoom((a, b) => a + b),
        },
        {
          description: "Zoom normal",
          bind: "mod+0",
          type: Type.Shortcut,
          action: () => zoom(() => 1),
        },
        {
          description: "Shortcut/Help menu",
          bind: "mod+/",
          type: Type.Shortcut,
          action: () => dispatch.help(true),
        },
        {
          description: "Browse files",
          bind: "mod+shift+e",
          type: Type.Shortcut,
          action: () => dispatch.directoryBrowserDialog(true),
        },
        {
          description: "Open...",
          bind: "mod+o",
          type: Type.Shortcut,
          action: async () => {
            const result = await window.electronAPI.fs.openFileOrDirectory();
            if (!result) return;

            if (result.isDirectory) {
              // Migrate IndexedDB-only notes to filesystem
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

                  const writeResult = await window.electronAPI.fs.writeFile(
                    uniquePath,
                    note.content,
                  );
                  if (writeResult.success) {
                    await db.notes.update(note.id, {
                      filePath: uniquePath,
                      fileSize: writeResult.fileSize,
                      lastSynced: new Date(writeResult.lastModified),
                      content: undefined,
                    });
                    console.log(
                      `Migrated note "${note.title}" to ${uniquePath}`,
                    );
                  }
                } catch (err) {
                  console.error("Failed to migrate note:", noteData.title, err);
                }
              }

              SettingsRepository.save({ storageDirectory: result.path });
              window.location.reload();
            } else {
              const file = await window.electronAPI.fs.readFile(result.path);
              if (file.success) {
                const noteData = createStandaloneNote(
                  result.path,
                  file.content,
                );
                const note = Note.parse(noteData);
                const { content: _, ...metadata } = noteData;
                await db.notes.put(metadata as any, note.id);
                dispatch.setNote(note);
              }
            }
          },
        },
        {
          description: "Open Recent",
          bind: "mod+e",
          type: Type.Shortcut,
          action: () => dispatch.recentNotesDialog(true),
        },
        {
          description: "Start copy watcher mode",
          bind: ">>copy",
          type: Type.Command,
          action: noop,
        },
        {
          description:
            "Parse and solve the math expression until your next `=`",
          bind: ">>math",
          type: Type.Command,
          action: noop,
        },
      ]
        // Filter out filesystem shortcuts in browser mode
        .filter((s) => isElectron() || !FILESYSTEM_SHORTCUTS.includes(s.bind))
        .toSorted((a, b) =>
          a.bind.toLocaleLowerCase().localeCompare(b.bind.toLocaleLowerCase()),
        ),
    [],
  );
};

export const useShortcuts = () => {
  const commands = useWritemeShortcuts();
  useEffect(() => {
    commands.forEach((x) => {
      if (x.hidden) return;
      shortcuts.add(x.bind, x.action);
    });
    return () => {
      shortcuts.removeAll();
    };
  }, []);
};

const IOS_DEVICES = [
  "iPad Simulator",
  "iPhone Simulator",
  "iPod Simulator",
  "iPad",
  "iPhone",
  "iPod",
  "AppleWebkit",
  "Apple",
];

function iOS() {
  return (
    IOS_DEVICES.includes(navigator.platform) ||
    IOS_DEVICES.some((x) => navigator.userAgent.includes(x)) ||
    (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  );
}

export const mapShortcutOS = (s: string) =>
  s.replace("mod+", iOS() ? "⌘ + " : "Ctrl + ");

export const ShortcutItem = (props: { shortcut: Shortcut }) => (
  <li className="flex flex-row gap-2 items-center">
    <kbd className="flex flex-row gap-2 items-center py-1 px-2 font-medium rounded-md bg-background">
      {props.shortcut.bind.split("+").map((x, i) => {
        return (
          <span key={`bind-${i}-${x}`}>
            {x === "mod" ? (iOS() ? "⌘" : "Ctrl") : x}
          </span>
        );
      })}
    </kbd>
    <span>{props.shortcut.description}</span>
  </li>
);
