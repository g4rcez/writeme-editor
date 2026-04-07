import { isElectron } from "@/lib/is-electron";
import { repositories } from "@/store/repositories";
import { ElectronTerminalBackend } from "./electron-backend";
import { type ITerminalBackend } from "./types";
import { WebTerminalBackend } from "./web-backend";

let webBackendInstance: WebTerminalBackend | null = null;

export const createTerminalBackend = (): ITerminalBackend => {
  if (isElectron()) {
    return new ElectronTerminalBackend();
  } else {
    if (!webBackendInstance) {
      webBackendInstance = new WebTerminalBackend();
      
      // Register application specific commands
      const registry = webBackendInstance.getRegistry();
      
      registry.register("list-notes", async (_, term) => {
        try {
          const notes = await repositories.notes.getAll({ limit: 50 });
          term.writeln(`\x1b[1;36mFound ${notes.length} notes:\x1b[0m`);
          notes.forEach(note => {
            term.writeln(`  \x1b[32m${note.id}\x1b[0m: ${note.title}`);
          });
        } catch (e: any) {
          term.writeln(`\x1b[31mFailed to load notes: ${e.message}\x1b[0m`);
        }
      });
      
      registry.register("list-templates", async (_, term) => {
        try {
          // This requires adding getTemplates to repository interface if not present,
          // or finding a way to fetch them. Assuming notes has templates via ai config or similar
          term.writeln("\x1b[33mTemplates listing not fully implemented yet in mock.\x1b[0m");
        } catch (e: any) {
          term.writeln(`\x1b[31mError: ${e.message}\x1b[0m`);
        }
      });
    }
    return webBackendInstance;
  }
};
