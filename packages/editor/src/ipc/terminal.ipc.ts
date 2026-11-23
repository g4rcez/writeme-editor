import { ipcMain, type IpcMainEvent } from "electron";
import { app } from "electron";
import * as pty from "node-pty";
import * as os from "node:os";

// Store active pty sessions by ID
const activeSessions = new Map<string, pty.IPty>();

export const terminalIpcHandler = () => {
    ipcMain.on("terminal:spawn", (event: IpcMainEvent, id: string, providedCwd?: string) => {
        try {
            const existingSession = activeSessions.get(id);
            if (existingSession) {
                existingSession.kill();
                activeSessions.delete(id);
            }

            // Determine shell
            const shell = os.platform() === "win32" ? "powershell.exe" : process.env.SHELL || "bash";

            // Get a safe working directory
            const cwd = providedCwd || process.env.HOME || app.getPath("userData");

            const ptyProcess = pty.spawn(shell, [], {
                name: "xterm-color",
                cols: 80,
                rows: 24,
                cwd,
                env: process.env as any,
                useConpty: false, // Needed for older node-pty versions on some macs, but false is fine
            });

            ptyProcess.onData((data) => {
                if (!event.sender.isDestroyed()) {event.sender.send("terminal:data", { id, data });}
            });

            event.sender.once("destroyed", () => {
                if (activeSessions.get(id) !== ptyProcess) {return;}
                activeSessions.delete(id);
                ptyProcess.kill();
            });

            ptyProcess.onExit(({ exitCode, signal }) => {
                if (activeSessions.get(id) !== ptyProcess) {return;}
                activeSessions.delete(id);
                if (event.sender.isDestroyed()) {return;}
                event.sender.send("terminal:data", {
                    id,
                    data: "\r\n\u001b[31m[Process exited]\u001b[0m\r\n",
                });
                event.sender.send("terminal:exit", { id, exitCode, signal });
            });

            activeSessions.set(id, ptyProcess);
        } catch (error: any) {
            console.error("Failed to spawn terminal:", error);
            event.sender.send("terminal:data", {
                id,
                data: `\r\n\u001b[31mError spawning terminal: ${error.message}\u001b[0m\r\n`,
            });
        }
    });

    ipcMain.on("terminal:write", (_, id: string, data: string) => {
        const session = activeSessions.get(id);
        if (session) {
            try {
                session.write(data);
            } catch (error) {
                console.error("Failed to write to terminal:", error);
            }
        }
    });

    ipcMain.on("terminal:resize", (_, id: string, cols: number, rows: number) => {
        const session = activeSessions.get(id);
        if (session) {
            try {
                session.resize(cols, rows);
            } catch (error) {
                console.error("Failed to resize terminal:", error);
            }
        }
    });

    ipcMain.on("terminal:kill", (_, id: string) => {
        const session = activeSessions.get(id);
        if (session) {
            try {
                session.kill();
                activeSessions.delete(id);
            } catch (error) {
                console.error("Failed to kill terminal:", error);
            }
        }
    });
};
