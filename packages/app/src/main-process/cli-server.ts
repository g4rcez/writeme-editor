import { app, type BrowserWindow } from "electron";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

type WaitEntry = { socket: net.Socket };

const waitConnections = new Map<string, WaitEntry>();
let server: net.Server | null = null;
let windowRef: BrowserWindow | null = null;

export function getSocketPath(): string {
  if (process.platform === "win32") {
    return "\\\\.\\pipe\\writeme-cli";
  }
  return path.join(app.getPath("userData"), "writeme.sock");
}

export function startCliServer(mainWindow: BrowserWindow): void {
  windowRef = mainWindow;
  const socketPath = getSocketPath();

  if (process.platform !== "win32") {
    try {
      fs.unlinkSync(socketPath);
    } catch {
      // no stale socket
    }
  }

  server = net.createServer((socket) => {
    let buffer = "";

    socket.on("data", (data) => {
      buffer += data.toString();
      const nl = buffer.indexOf("\n");
      if (nl === -1) return;
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      try {
        const msg = JSON.parse(line) as {
          filePath: string | null;
          wait: boolean;
          requestId: string;
        };
        handleMessage(socket, msg);
      } catch {
        socket.end();
      }
    });

    socket.on("error", () => socket.destroy());
  });

  server.listen(socketPath, () => {
    console.log(`CLI server listening on ${socketPath}`);
  });

  server.on("error", (err) => {
    console.error("CLI server error:", err);
  });
}

function handleMessage(
  socket: net.Socket,
  msg: { filePath: string | null; wait: boolean; requestId: string },
): void {
  const { filePath, wait, requestId } = msg;

  if (!windowRef) {
    socket.end();
    return;
  }

  windowRef.show();
  windowRef.focus();

  if (filePath) {
    windowRef.webContents.send("app:open-file", { filePath, wait, requestId });
  }

  if (wait && filePath) {
    waitConnections.set(requestId, { socket });
  } else {
    socket.write(JSON.stringify({ status: "opened" }) + "\n");
    socket.end();
  }
}

export function notifyFileClosed(requestId: string): void {
  const entry = waitConnections.get(requestId);
  if (entry) {
    entry.socket.write(JSON.stringify({ status: "closed" }) + "\n");
    entry.socket.end();
    waitConnections.delete(requestId);
  }
}

export function stopCliServer(): void {
  server?.close();
  if (process.platform !== "win32") {
    try {
      fs.unlinkSync(getSocketPath());
    } catch {
      // ignore
    }
  }
}
