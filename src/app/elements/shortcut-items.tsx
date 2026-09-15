import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { migrateWebOnlyNotesToDirectory } from "@/app/lib/open-directory-as-workspace";
import { createStandaloneNote } from "@/lib/file-utils";
import { isElectron } from "@/lib/is-electron";
import { shortcuts } from "@/lib/shortcuts";
import { CommanderType, useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";

// Shortcuts that only work in the Electron app
const ELECTRON_ONLY_SHORTCUTS = ["mod+o", "mod+shift+e"];

export enum Type {
    Shortcut = "shortcut",
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
        window.getComputedStyle(window.document.querySelector(":root")!).getPropertyValue("--default-size") || "1rem";
    const int = value.replace(/rem$/g, "");
    window.document.documentElement.style.setProperty("--default-size", `${op(+int, 0.25)}rem`);
};

export const useWritemeShortcuts = () => {
    const [state, dispatch] = useGlobalStore();
    const navigate = useNavigate();
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
                    bind: "mod+shift+p",
                    type: Type.Shortcut,
                    description: "Commander",
                    action: () => dispatch.commander(true),
                },
                {
                    bind: "mod+t",
                    type: Type.Shortcut,
                    description: "Open Tabs",
                    action: () => dispatch.commander(true, CommanderType.OpenTabs),
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
                    description: "Settings",
                    bind: "mod+,",
                    type: Type.Shortcut,
                    action: () => navigate("/settings"),
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
                            await migrateWebOnlyNotesToDirectory(result.path);
                            await dispatch.switchWorkspace(result.path);
                        } else {
                            const file = await window.electronAPI.fs.readFile(result.path);
                            if (file.success) {
                                if (result.path.endsWith(".json")) {
                                    try {
                                        JSON.parse(file.content); // Validate
                                        const note = Note.new(
                                            result.path.split(/[/\\]/).pop()?.replace(".json", "") || "JSON Inspection",
                                            file.content,
                                            "json" as any,
                                        );
                                        note.filePath = result.path;
                                        await repositories.notes.save(note);
                                        dispatch.notes(await repositories.notes.getAll());
                                        dispatch.setNote(note);
                                        navigate(`/note/${note.id}`);
                                    } catch (e) {
                                        console.error("Invalid JSON file:", e);
                                    }
                                    return;
                                }
                                const noteData = createStandaloneNote(result.path, file.content);
                                const note = Note.parse(noteData);
                                await repositories.notes.save(note);
                                dispatch.setNote(note);
                            }
                        }
                    },
                },
                {
                    description: "AI Assistant",
                    bind: "mod+shift+a",
                    type: Type.Shortcut,
                    action: () => dispatch.setAiDrawer({ isOpen: true, chatId: null }),
                },
            ]
                // Filter out Electron-only shortcuts in browser mode
                .filter((s) => isElectron() || !ELECTRON_ONLY_SHORTCUTS.includes(s.bind))
                .toSorted((a, b) => a.bind.toLocaleLowerCase().localeCompare(b.bind.toLocaleLowerCase())),
        [state.theme, dispatch, navigate],
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

function usesCommandKey(): boolean {
    return /Macintosh|Mac OS X|iPhone|iPad|iPod/.test(navigator.userAgent);
}

const getShortcutKeyLabel = (key: string): string => {
    const normalizedKey = key.toLocaleLowerCase();
    if (normalizedKey === "mod" || normalizedKey === "commandorcontrol") return usesCommandKey() ? "⌘" : "Ctrl";
    if (normalizedKey === "control" || normalizedKey === "ctrl") return "Ctrl";
    if (normalizedKey === "shift") return "Shift";
    if (normalizedKey === "alt") return "Alt";
    if (normalizedKey === "enter") return "Enter";
    if (normalizedKey === "escape") return "Esc";
    if (key.length === 1) return key.toLocaleUpperCase();
    return key;
};

export const mapShortcutOS = (s: string) => s.split("+").map(getShortcutKeyLabel).join(" + ");
