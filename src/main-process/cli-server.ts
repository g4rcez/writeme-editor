import { app, type BrowserWindow, type WebContents } from "electron";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

type CliMessage =
  | {
      action: "open-file";
      filePath: string | null;
      wait: boolean;
      requestId: string;
    }
  | { action: "open-folder"; folderPath: string; requestId: string };

type WaitEntry = { socket: net.Socket };
type CliServerOptions = {
  getCurrentWorkspacePath?: () => string | null;
  openWorkspaceInNewInstance?: (folderPath: string) => void;
};
type PendingRendererSend = {
  webContentsId: number;
  send: () => void;
};

const waitConnections = new Map<string, WaitEntry>();
const readyWebContentsIds = new Set<number>();
const workspacePathByWebContentsId = new Map<number, string | null>();
const pendingRendererSends: PendingRendererSend[] = [];
let server: net.Server | null = null;
let windowRef: BrowserWindow | null = null;
let cliServerOptions: CliServerOptions = {};

export function getSocketPath(): string {
  if (process.platform === "win32") {
    return "\\\\.\\pipe\\writeme-cli";
  }
  return path.join(app.getPath("userData"), "writeme.sock");
}

export function startCliServer(
  mainWindow: BrowserWindow,
  options: CliServerOptions = {},
): void {
  windowRef = mainWindow;
  cliServerOptions = options;
  mainWindow.webContents.on("did-start-loading", () => {
    readyWebContentsIds.delete(mainWindow.webContents.id);
  });
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
        const msg = JSON.parse(line) as CliMessage;
        handleCliMessage(socket, msg);
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

export function markCliRendererReady(
  webContents: WebContents,
  workspacePath: string | null,
): void {
  readyWebContentsIds.add(webContents.id);
  workspacePathByWebContentsId.set(webContents.id, workspacePath);
  for (let index = pendingRendererSends.length - 1; index >= 0; index--) {
    const pending = pendingRendererSends[index];
    if (!pending) continue;
    if (pending.webContentsId === webContents.id) {
      pendingRendererSends.splice(index, 1);
      pending.send();
    }
  }
}

export function sendToRendererWhenReady(
  targetWindow: BrowserWindow,
  channel: string,
  payload: Record<string, unknown>,
): void {
  const webContentsId = targetWindow.webContents.id;
  const send = () => targetWindow.webContents.send(channel, payload);
  if (
    !readyWebContentsIds.has(webContentsId) ||
    targetWindow.webContents.isLoading()
  ) {
    pendingRendererSends.push({ webContentsId, send });
    return;
  }
  send();
}

function finishOpenFolderSocket(
  socket: net.Socket | null,
  response: Record<string, string> = { status: "opened" },
): void {
  if (!socket || socket.destroyed) return;
  socket.write(JSON.stringify(response) + "\n");
  socket.end();
}

function handleOpenFolderMessage(
  socket: net.Socket | null,
  folderPath: string,
): void {
  if (!windowRef) {
    finishOpenFolderSocket(socket, { status: "error", message: "no window" });
    return;
  }

  const webContentsId = windowRef.webContents.id;
  const currentWorkspacePath =
    workspacePathByWebContentsId.get(webContentsId) ??
    cliServerOptions.getCurrentWorkspacePath?.() ??
    null;

  if (
    currentWorkspacePath &&
    path.resolve(currentWorkspacePath) === path.resolve(folderPath)
  ) {
    windowRef.show();
    windowRef.focus();
    finishOpenFolderSocket(socket);
    return;
  }

  if (cliServerOptions.openWorkspaceInNewInstance) {
    cliServerOptions.openWorkspaceInNewInstance(folderPath);
    finishOpenFolderSocket(socket);
    return;
  }

  windowRef.show();
  windowRef.focus();
  sendToRendererWhenReady(windowRef, "app:open-folder", {
    folderPath,
  });
  finishOpenFolderSocket(socket);
}

function handleCliMessage(socket: net.Socket, msg: CliMessage): void {
  if (msg.action === "open-file") {
    const { filePath, wait, requestId } = msg;

    if (!windowRef) {
      socket.end();
      return;
    }

    windowRef.show();
    windowRef.focus();

    if (filePath) {
      sendToRendererWhenReady(windowRef, "app:open-file", {
        filePath,
        wait,
        requestId,
      });
    }

    if (wait && filePath) {
      waitConnections.set(requestId, { socket });
    } else {
      socket.write(JSON.stringify({ status: "opened" }) + "\n");
      socket.end();
    }
  } else if (msg.action === "open-folder") {
    handleOpenFolderMessage(socket, msg.folderPath);
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
  const activeServer = server;
  server = null;
  activeServer?.close();
  if (!activeServer) return;
  if (process.platform !== "win32") {
    try {
      fs.unlinkSync(getSocketPath());
    } catch {
      // ignore
    }
  }
}
