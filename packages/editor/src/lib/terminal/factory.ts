import { isElectron } from "@/lib/is-electron";
import { repositories } from "@/store/repositories";
import type { ITerminalBackend } from "./types";
import { ElectronTerminalBackend } from "./electron-backend";
import { WebTerminalBackend } from "./web-backend";

function createWebTerminalBackend(): WebTerminalBackend {
    const backend = new WebTerminalBackend();
    const registry = backend.getRegistry();

    registry.register("list-notes", async (_, term) => {
        try {
            const notes = await repositories.notes.getRecentNotes(50);
            term.writeln(`\u001b[1;36mFound ${notes.length} notes:\u001b[0m`);
            for (const note of notes) {
                term.writeln(`  \u001b[32m${note.id}\u001b[0m: ${note.title}`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            term.writeln(`\u001b[31mFailed to load notes: ${message}\u001b[0m`);
        }
    });

    registry.register("list-templates", (_, term) => {
        term.writeln("\u001b[33mTemplates listing not fully implemented yet in mock.\u001b[0m");
    });

    return backend;
}

export const createTerminalBackend = (sessionId: string): ITerminalBackend => {
    if (isElectron()) {
        return new ElectronTerminalBackend(sessionId);
    }

    return createWebTerminalBackend();
};
