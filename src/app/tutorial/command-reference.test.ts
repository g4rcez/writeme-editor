import { describe, expect, it } from "vitest";
import { SettingsSchema } from "@/store/settings.schema";
import { getCommandReference } from "./command-reference";

const settings = SettingsSchema.parse({});

describe("getCommandReference", () => {
    it("includes app, editor, text, and slash commands in one reference", () => {
        const commands = getCommandReference({ isDesktopApp: true, settings });

        expect(commands).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ trigger: "Mod+/", description: expect.stringContaining("click hints") }),
                expect.objectContaining({ trigger: "Mod+Shift+P", description: "Open the command palette." }),
                expect.objectContaining({ trigger: ">>math 1 + 1=", category: "Text command" }),
                expect.objectContaining({ trigger: ">>uuid", category: "Text command" }),
                expect.objectContaining({ trigger: "/heading 1", category: "Slash command" }),
                expect.objectContaining({ trigger: "/mermaid", category: "Slash command" }),
            ]),
        );
        expect(commands.some((command) => command.description.includes("shortcut reference"))).toBe(false);
    });

    it("uses configured desktop shortcuts and the platform-specific tab binding", () => {
        const desktopCommands = getCommandReference({
            isDesktopApp: true,
            settings: {
                quickNoteShortcut: "CommandOrControl+Alt+Q",
                mathNoteShortcut: "CommandOrControl+Alt+M",
                floatingEditorShortcut: "CommandOrControl+Alt+F",
            },
        });
        const webCommands = getCommandReference({ isDesktopApp: false, settings });

        expect(desktopCommands).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ trigger: "CommandOrControl+Alt+Q", context: "Desktop global" }),
                expect.objectContaining({ trigger: "Mod+1–8" }),
            ]),
        );
        expect(webCommands).toEqual(expect.arrayContaining([expect.objectContaining({ trigger: "Mod+Shift+1–8" })]));
        expect(webCommands.some((command) => command.context === "Desktop global")).toBe(false);
    });
});
