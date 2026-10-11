import type { CommandItemTypes } from "@g4rcez/components";
import type { FeatureName } from "../../../../build/profiles.mts";
import { FEATURES } from "./build-features";
import { isMobile } from "./platform";

const COMMAND_FEATURES: Record<string, FeatureName> = {
    "New Terminal": "terminal",
    "AI Assistant": "ai",
    "Open chat": "ai",
    "New meeting note": "meetingNotes",
    "Install CLI": "cli",
    "[git] Commit & push": "git",
};

const DESKTOP_COMMANDS = new Set([
    "New Terminal",
    "AI Assistant",
    "Open chat",
    "New meeting note",
    "Print/Export current note",
    "Share content",
]);

export function availableCommands(commands: CommandItemTypes[]): CommandItemTypes[] {
    return commands.flatMap((command): CommandItemTypes[] => {
        if (command.type === "group") {
            const items = availableCommands(command.items);
            return items.length ? [{ ...command, items }] : [];
        }
        if (typeof command.title !== "string") return [command];
        const feature = COMMAND_FEATURES[command.title];
        if (feature && !FEATURES[feature]) return [];
        return isMobile() && DESKTOP_COMMANDS.has(command.title) ? [] : [command];
    });
}
