import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShortcutsCommands } from "./shortcuts-commands";

vi.mock("@g4rcez/components", () => ({
    Modal: ({
        children,
        open,
        title,
        type,
    }: {
        children: React.ReactNode;
        open: boolean;
        title: React.ReactNode;
        type: string;
    }) =>
        open ? (
            <div role="dialog" data-type={type}>
                <h1>{title}</h1>
                {children}
            </div>
        ) : null,
}));

vi.mock("@/app/elements/shortcut-items", () => ({
    mapShortcutOS: (shortcut: string) => shortcut,
}));

vi.mock("@/lib/is-electron", () => ({
    isElectron: () => true,
}));

vi.mock("@/store/global.store", () => ({
    useGlobalStore: () => [{ help: true }, { help: vi.fn() }],
}));

vi.mock("@/store/settings", () => ({
    SettingsService: {
        load: () => ({
            quickNoteShortcut: "CommandOrControl+Alt+N",
            mathNoteShortcut: "CommandOrControl+Alt+M",
            floatingEditorShortcut: "CommandOrControl+Alt+P",
        }),
    },
}));

vi.mock("./command-reference", () => ({
    getCommandReference: () => [
        {
            trigger: "Mod+Shift+P",
            description: "Open the command palette.",
            category: "Keyboard",
            context: "App",
        },
        {
            trigger: ">>math 1 + 1=",
            description: "Calculate a math expression.",
            category: "Text command",
            context: "Formatted editor",
        },
    ],
}));

describe("ShortcutsCommands", () => {
    it("renders every shortcut and command as one row in a dialog modal", () => {
        render(<ShortcutsCommands />);

        expect(screen.getByRole("dialog")).toHaveAttribute("data-type", "dialog");
        expect(screen.getByRole("heading", { name: "All shortcuts and commands" })).toBeInTheDocument();
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
        expect(screen.getByText("Mod+Shift+P")).toBeInTheDocument();
        expect(screen.getByText(">>math 1 + 1=")).toBeInTheDocument();
    });
});
