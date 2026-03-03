import { ipcMain, IpcMainEvent } from "electron";
import * as pty from "node-pty";
import * as os from "os";
import { app } from "electron";
import * as path from "path";

// Store active pty sessions by ID
const activeSessions = new Map<string, pty.IPty>();

export const terminalIpcHandler = () => {
  ipcMain.on("terminal:spawn", (event: IpcMainEvent, id: string) => {
    try {
      if (activeSessions.has(id)) {
        return;
      }

      // Determine shell
      const shell = os.platform() === "win32" ? "powershell.exe" : process.env.SHELL || "bash";
      
      // Get a safe working directory
      const cwd = process.env.HOME || app.getPath('userData');

      const ptyProcess = pty.spawn(shell, [], {
        name: "xterm-color",
        cols: 80,
        rows: 24,
        cwd: cwd,
        env: process.env as any,
        useConpty: false // Needed for older node-pty versions on some macs, but false is fine
      });

      ptyProcess.onData((data) => {
        event.sender.send("terminal:data", { id, data });
      });

      ptyProcess.onExit(() => {
        activeSessions.delete(id);
        event.sender.send("terminal:data", { id, data: "\r\n\x1b[31m[Process exited]\x1b[0m\r\n" });
      });

      activeSessions.set(id, ptyProcess);
    } catch (e: any) {
      console.error("Failed to spawn terminal:", e);
      event.sender.send("terminal:data", { 
        id, 
        data: `\r\n\x1b[31mError spawning terminal: ${e.message}\x1b[0m\r\n` 
      });
    }
  });

  ipcMain.on("terminal:write", (_, id: string, data: string) => {
    const session = activeSessions.get(id);
    if (session) {
      try {
        session.write(data);
      } catch (e) {
        console.error("Failed to write to terminal:", e);
      }
    }
  });

  ipcMain.on("terminal:resize", (_, id: string, cols: number, rows: number) => {
    const session = activeSessions.get(id);
    if (session) {
      try {
        session.resize(cols, rows);
      } catch (e) {
        console.error("Failed to resize terminal:", e);
      }
    }
  });

  ipcMain.on("terminal:kill", (_, id: string) => {
    const session = activeSessions.get(id);
    if (session) {
      try {
        session.kill();
        activeSessions.delete(id);
      } catch (e) {
        console.error("Failed to kill terminal:", e);
      }
    }
  });
};
