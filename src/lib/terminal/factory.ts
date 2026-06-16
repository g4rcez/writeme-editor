import { isElectron } from "@/lib/is-electron";
import { repositories } from "@/store/repositories";
import { ElectronTerminalBackend } from "./electron-backend";
import type { ITerminalBackend } from "./types";
import { WebTerminalBackend } from "./web-backend";

function createWebTerminalBackend(): WebTerminalBackend {
	const backend = new WebTerminalBackend();
	const registry = backend.getRegistry();

	registry.register("list-notes", async (_, term) => {
		try {
			const notes = await repositories.notes.getAll({ limit: 50 });
			term.writeln(`\x1b[1;36mFound ${notes.length} notes:\x1b[0m`);
			for (const note of notes) {
				term.writeln(`  \x1b[32m${note.id}\x1b[0m: ${note.title}`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			term.writeln(`\x1b[31mFailed to load notes: ${message}\x1b[0m`);
		}
	});

	registry.register("list-templates", (_, term) => {
		term.writeln(
			"\x1b[33mTemplates listing not fully implemented yet in mock.\x1b[0m",
		);
	});

	return backend;
}

export const createTerminalBackend = (sessionId: string): ITerminalBackend => {
	if (isElectron()) {
		return new ElectronTerminalBackend(sessionId);
	}

	return createWebTerminalBackend();
};
