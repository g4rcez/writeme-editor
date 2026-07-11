import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettingsShortcutsPage from "./settings-shortcuts.page";

vi.mock("@g4rcez/components", () => ({
    Button: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock("@/app/components/settings/settings-controls", () => ({
    ShortcutSettingsControls: () => <div>Editable shortcut controls</div>,
}));

vi.mock("@/app/elements/shortcut-items", () => ({
    Type: {
        Shortcut: "shortcut",
        Command: "command",
    },
    useWritemeShortcuts: () => [
        {
            bind: "mod+shift+p",
            description: "Commander",
            type: "shortcut",
            action: vi.fn(),
        },
        {
            bind: "mod+/",
            description: "Shortcut/Help menu",
            type: "shortcut",
            action: vi.fn(),
        },
        {
            bind: ">>copy",
            description: "Start copy watcher mode",
            type: "command",
            action: vi.fn(),
        },
    ],
}));

vi.mock("@/app/settings/save-settings-section", () => ({
    registerGlobalShortcuts: vi.fn(),
    saveSettingsPatch: vi.fn(),
}));

vi.mock("@/app/settings/use-settings-draft", () => ({
    useSettingsDraft: () => ({
        settings: {
            quickNoteShortcut: "CommandOrControl+Alt+N",
            mathNoteShortcut: "CommandOrControl+Alt+M",
        },
        patchSettings: vi.fn(),
    }),
}));

vi.mock("@/store/ui.store", () => ({
    uiDispatch: {
        setAlert: vi.fn(),
    },
}));

describe("SettingsShortcutsPage", () => {
    it("shows available app shortcuts as a readonly reference list", () => {
        render(<SettingsShortcutsPage />);

        expect(screen.getByText("Available shortcuts")).toBeInTheDocument();
        expect(screen.getByText("Editable shortcut controls")).toBeInTheDocument();
        expect(screen.getByText("Commander")).toBeInTheDocument();
        expect(screen.getByText("Go to tab 1-8")).toBeInTheDocument();
        expect(screen.getByText("Go to last tab")).toBeInTheDocument();
        expect(screen.getByText("New note")).toBeInTheDocument();
        expect(screen.getByText("New AI chat")).toBeInTheDocument();
        expect(screen.getByText("Shortcut/Help menu")).toBeInTheDocument();
        expect(screen.getByText("Open the command palette.")).toBeInTheDocument();
        expect(screen.getByText("Switch directly to one of the first eight open tabs.")).toBeInTheDocument();
        expect(screen.getByText("Switch directly to the last open tab.")).toBeInTheDocument();
        expect(screen.getByText("Create a blank note.")).toBeInTheDocument();
        expect(screen.getByText("Create and open a new workspace AI chat.")).toBeInTheDocument();
        expect(screen.getByText("Open the shortcut reference.")).toBeInTheDocument();
        expect(screen.queryByText("Read-only built-in shortcut.")).not.toBeInTheDocument();
        expect(screen.queryByText("Start copy watcher mode")).not.toBeInTheDocument();
    });
});
