import type { Dirent } from "node:fs";
import { BrowserWindow, Menu, MenuItem, app, clipboard, dialog, ipcMain, shell } from "electron";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { dbManager } from "../main-process/database";
import { searchWorkspaceFiles } from "../main-process/file-search";
import { FileWatcher } from "../main-process/file-watcher";
import {
    DEFAULT_RECURSIVE_DIRECTORY_DEPTH,
    type DirectoryAccessResult,
    type FileSearchEvent,
    type FileSearchStartResult,
    type TreeNode,
} from "../types/tree";

const allowedFilesystemRoots = new Set<string>();
const fileSearchJobs = new Map<string, AbortController>();

type FileSearchRequest = {
    rootPath: string;
    query: string;
    requestId: string;
};

const getFileSearchJobKey = (senderId: number, requestId: string): string => `${senderId}:${requestId}`;

function normalizePath(input: string): string {
    return path.resolve(input);
}

function expandAllowedRoots(): void {
    allowedFilesystemRoots.clear();
    allowedFilesystemRoots.add(app.getPath("userData"));
    const settings = dbManager().getAll<{ name: string; value: string }>("settings");
    const directoryRow = settings.find((row) => row.name === "directory");
    if (directoryRow?.value) {
        try {
            const parsed = JSON.parse(directoryRow.value);
            console.log({ parsed });
            if (typeof parsed === "string" && parsed.trim()) {
                allowedFilesystemRoots.add(normalizePath(parsed));
            }
        } catch {
            // ignore malformed settings value; fallback to userData root only
        }
    }
}

function isPathUnderRoot(candidatePath: string): boolean {
    expandAllowedRoots();
    const normalizedCandidate = normalizePath(candidatePath);

    if (allowedFilesystemRoots.has(normalizedCandidate)) return true;

    for (const root of allowedFilesystemRoots) {
        const normalizedRoot = normalizePath(root);
        if (normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`)) {
            return true;
        }
    }
    return false;
}

function getRevealLabel(): string {
    if (process.platform === "darwin") return "Reveal in Finder";
    if (process.platform === "win32") return "Show in Explorer";
    return "Open in File Manager";
}

function validatePaths(...inputPaths: string[]) {
    for (const inputPath of inputPaths) {
        const candidate = normalizePath(inputPath);
        if (!isPathUnderRoot(candidate)) {
            return {
                success: false as const,
                error: "Path is outside the allowed workspace",
                filePath: candidate,
            };
        }
    }
    return { success: true as const };
}

export const notesIpcHandler = async () => {
    ipcMain.handle("notes:clipboard", async () => clipboard.readText());
    ipcMain.handle("notes:clipboardImage", async () => {
        try {
            const items = await clipboard.read();
            for (const item of items) {
                const imageType = item.types.find((type) => type.startsWith("image/"));
                if (!imageType) continue;

                const image = await item.getType(imageType);
                if (!("arrayBuffer" in image)) continue;

                const imageBuffer = Buffer.from(await image.arrayBuffer());
                return `data:${imageType};base64,${imageBuffer.toString("base64")}`;
            }
        } catch (error) {
            console.error("Failed to read image from clipboard:", error);
        }
        return null;
    });

    ipcMain.handle("context-menu:edit", async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return;
        const menu = new Menu();
        menu.append(new MenuItem({ role: "undo" }));
        menu.append(new MenuItem({ role: "redo" }));
        menu.append(new MenuItem({ type: "separator" }));
        menu.append(new MenuItem({ role: "cut" }));
        menu.append(new MenuItem({ role: "copy" }));
        menu.append(new MenuItem({ role: "paste" }));
        menu.append(new MenuItem({ role: "delete" }));
        menu.append(new MenuItem({ type: "separator" }));
        menu.append(new MenuItem({ role: "selectAll" }));
        menu.popup({ window: win });
    });

    ipcMain.handle("context-menu:link", async (event, text: string, url: string, x?: number, y?: number) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return;

        const menu = new Menu();
        menu.append(
            new MenuItem({
                label: "Copy text",
                click: () => {
                    clipboard.writeText(text);
                },
            }),
        );
        menu.append(
            new MenuItem({
                label: "Copy url",
                click: () => {
                    clipboard.writeText(url);
                },
            }),
        );
        menu.popup({ window: win, x, y });
    });

    ipcMain.handle("fs:chooseDirectory", async () => {
        const result = await dialog.showOpenDialog({
            properties: ["openDirectory", "createDirectory"],
            title: "Choose Notes Directory",
            message: "Select where to store your notes",
        });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle("fs:requestDirectoryAccess", async (_, dirPath: string): Promise<DirectoryAccessResult> => {
        const access = validatePaths(dirPath);
        if (!access.success) {
            return { granted: false, error: access.error };
        }

        try {
            await fs.readdir(dirPath);
            return { granted: true };
        } catch {
            // Selecting the folder again records explicit user intent and can restore macOS folder access.
        }

        const result = await dialog.showOpenDialog({
            defaultPath: dirPath,
            properties: ["openDirectory"],
            title: "Allow Writeme to access this folder",
            message: "Select the current workspace folder to grant access",
            buttonLabel: "Grant Access",
        });
        if (result.canceled || !result.filePaths[0]) {
            return { granted: false, error: "Folder access was not granted" };
        }
        if (normalizePath(result.filePaths[0]) !== normalizePath(dirPath)) {
            return { granted: false, error: `Select the current workspace folder: ${dirPath}` };
        }

        try {
            await fs.readdir(dirPath);
            return { granted: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Folder access was not granted";
            if (process.platform === "darwin") {
                await shell.openExternal(
                    "x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders",
                );
                return {
                    granted: false,
                    error: `${message}. Enable Documents Folder access for Writeme in System Settings, then retry.`,
                };
            }
            return { granted: false, error: message };
        }
    });

    ipcMain.handle("fs:openFileOrDirectory", async () => {
        const result = await dialog.showOpenDialog({
            properties: ["openFile", "openDirectory"],
            filters: [
                { name: "All Supported", extensions: ["md", "mdx", "json"] },
                { name: "Markdown", extensions: ["md", "mdx"] },
                { name: "JSON", extensions: ["json"] },
            ],
            title: "Open",
        });
        if (result.canceled || !result.filePaths[0]) return null;
        const selectedPath = result.filePaths[0];
        const stats = await fs.stat(selectedPath);
        return { path: selectedPath, isDirectory: stats.isDirectory() };
    });

    ipcMain.handle("fs:writeFile", async (_, filePath: string, content: string) => {
        const access = validatePaths(filePath, path.dirname(filePath));
        if (!access.success) {
            return access;
        }

        try {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            FileWatcher.suppressNext(filePath);
            await fs.writeFile(filePath, content, "utf-8");
            try {
                const stats = await fs.stat(filePath);
                return {
                    success: true,
                    filePath,
                    fileSize: stats.size,
                    lastModified: stats.mtime,
                };
            } catch {
                return {
                    success: true,
                    filePath,
                    fileSize: content.length,
                    lastModified: new Date(),
                };
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("fs:writeImage", async (_, filePath: string, base64Data: string) => {
        const access = validatePaths(filePath, path.dirname(filePath));
        if (!access.success) {
            return access;
        }

        try {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            const base64Content = base64Data.split(",")[1];
            if (!base64Content) {
                throw new Error("Invalid base64 data");
            }
            await fs.writeFile(filePath, Buffer.from(base64Content, "base64"));
            return { success: true, filePath };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle("fs:readFile", async (_, filePath: string) => {
        const access = validatePaths(filePath);
        if (!access.success) {
            return access;
        }

        try {
            const content = await fs.readFile(filePath, "utf-8");
            const stats = await fs.stat(filePath);
            return {
                success: true,
                content,
                fileSize: stats.size,
                lastModified: stats.mtime,
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
            };
        }
    });

    ipcMain.handle("fs:readBinaryFile", async (_, filePath: string) => {
        const access = validatePaths(filePath);
        if (!access.success) {
            return access;
        }

        try {
            const buffer = await fs.readFile(filePath);
            return { success: true, data: buffer };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle("fs:statFile", async (_, filePath: string) => {
        const access = validatePaths(filePath);
        if (!access.success) {
            return access;
        }

        try {
            const stats = await fs.stat(filePath);
            return {
                success: true,
                exists: true,
                fileSize: stats.size,
                lastModified: stats.mtime,
                created: stats.birthtime,
            };
        } catch (error: any) {
            if (error.code === "ENOENT") {
                return { success: true, exists: false };
            }
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle("fs:mkdir", async (_, dirPath: string) => {
        const access = validatePaths(dirPath);
        if (!access.success) {
            return access;
        }

        try {
            await fs.mkdir(dirPath, { recursive: true });
            return { success: true, path: dirPath };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle("fs:deleteFile", async (_, filePath: string) => {
        const access = validatePaths(filePath);
        if (!access.success) {
            return access;
        }

        try {
            await fs.rm(filePath, { recursive: true, force: true });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle("fs:moveFile", async (_, oldPath: string, newPath: string) => {
        const access = validatePaths(oldPath, newPath, path.dirname(newPath));
        if (!access.success) {
            return access;
        }

        try {
            await fs.mkdir(path.dirname(newPath), { recursive: true });
            await fs.rename(oldPath, newPath);
            return { success: true, newPath };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle("fs:searchFiles:start", (event, request: FileSearchRequest): FileSearchStartResult => {
        if (
            !request ||
            typeof request.rootPath !== "string" ||
            typeof request.query !== "string" ||
            typeof request.requestId !== "string" ||
            request.requestId.trim() === ""
        ) {
            return { success: false, error: "Invalid file search request" };
        }

        const access = validatePaths(request.rootPath);
        if (!access.success) {
            return { success: false, error: access.error };
        }

        const jobKey = getFileSearchJobKey(event.sender.id, request.requestId);
        fileSearchJobs.get(jobKey)?.abort();
        const controller = new AbortController();
        fileSearchJobs.set(jobKey, controller);

        const isCurrentJob = (): boolean => fileSearchJobs.get(jobKey) === controller;
        const sendEvent = (data: FileSearchEvent): void => {
            if (!event.sender.isDestroyed() && isCurrentJob()) {
                event.sender.send("fs:file-search", data);
            }
        };
        const onDestroyed = (): void => controller.abort();
        event.sender.once("destroyed", onDestroyed);

        void searchWorkspaceFiles({
            onBatch: (entries) => sendEvent({ requestId: request.requestId, type: "batch", entries }),
            query: request.query,
            rootPath: request.rootPath,
            signal: controller.signal,
        })
            .then(({ cancelled, truncated }) => {
                if (!cancelled && !controller.signal.aborted) {
                    sendEvent({ requestId: request.requestId, type: "complete", truncated });
                }
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted || !isCurrentJob()) return;
                const message = error instanceof Error ? error.message : "Failed to search workspace files";
                sendEvent({ requestId: request.requestId, type: "error", error: message });
            })
            .finally(() => {
                event.sender.removeListener("destroyed", onDestroyed);
                if (isCurrentJob()) fileSearchJobs.delete(jobKey);
            });

        return { success: true };
    });

    ipcMain.handle("fs:searchFiles:cancel", (event, requestId: string): { success: true } => {
        if (typeof requestId === "string") {
            const jobKey = getFileSearchJobKey(event.sender.id, requestId);
            fileSearchJobs.get(jobKey)?.abort();
            fileSearchJobs.delete(jobKey);
        }
        return { success: true };
    });

    ipcMain.handle(
        "fs:readDirRecursive",
        async (_event, dirPath: string, maxDepth = DEFAULT_RECURSIVE_DIRECTORY_DEPTH) => {
            const access = validatePaths(dirPath);
            if (!access.success) {
                return access;
            }

            const depthLimit =
                Number.isInteger(maxDepth) && maxDepth >= 0 ? maxDepth : DEFAULT_RECURSIVE_DIRECTORY_DEPTH;
            type FileEntry = { name: string; path: string; relativePath: string };
            const results: FileEntry[] = [];
            const walk = async (currentDir: string, depth: number) => {
                if (depth > depthLimit) return;
                let entries: Dirent[];
                try {
                    entries = await fs.readdir(currentDir, { withFileTypes: true });
                } catch {
                    return;
                }
                for (const entry of entries) {
                    if (entry.name.startsWith(".")) continue;
                    const fullPath = path.join(currentDir, entry.name);
                    if (entry.isDirectory()) {
                        if (["node_modules", ".git", "dist", "build", ".next", ".vite"].includes(entry.name)) continue;
                        await walk(fullPath, depth + 1);
                    } else if (/\.(?:md|mdx)$/i.test(entry.name)) {
                        results.push({
                            name: entry.name,
                            path: fullPath,
                            relativePath: path.relative(dirPath, fullPath),
                        });
                    }
                }
            };
            try {
                await walk(dirPath, 0);
                return { success: true, files: results };
            } catch (error: unknown) {
                return {
                    success: false,
                    files: [],
                    error: error instanceof Error ? error.message : "Failed to read directory",
                };
            }
        },
    );

    ipcMain.handle("fs:readDir", async (_, dirPath: string) => {
        const access = validatePaths(dirPath);
        if (!access.success) {
            return access;
        }
        try {
            const entries = (await fs.readdir(dirPath, { withFileTypes: true })).slice(0, 200);
            const nodes: TreeNode[] = entries
                .filter((entry) => !entry.name.startsWith("."))
                .map((entry): TreeNode => {
                    const fullPath = path.join(dirPath, entry.name);
                    const isDirectory = entry.isDirectory();
                    const ext = isDirectory ? undefined : path.extname(entry.name).toLowerCase();
                    return {
                        extension: ext,
                        path: fullPath,
                        name: entry.name,
                        type: isDirectory ? "directory" : "file",
                        children: isDirectory ? undefined : undefined,
                    };
                })
                .sort((a, b) => {
                    if (a.type !== b.type) {
                        return a.type === "directory" ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
                });
            return { entries: nodes };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to read directory";
            const errorCode =
                error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : undefined;
            return { entries: [], error: message, errorCode };
        }
    });

    ipcMain.handle("context-menu:explorer", async (event, filePath: string, isDirectory: boolean) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return;

        const revealLabel = getRevealLabel();

        const menu = new Menu();
        menu.append(
            new MenuItem({
                label: "New file",
                click: () => {
                    win.webContents.send("context-menu:action", {
                        action: "new-file",
                        filePath,
                        isDirectory,
                    });
                },
            }),
        );
        menu.append(
            new MenuItem({
                label: "New folder",
                click: () => {
                    win.webContents.send("context-menu:action", {
                        action: "new-folder",
                        filePath,
                        isDirectory,
                    });
                },
            }),
        );
        menu.append(new MenuItem({ type: "separator" }));
        menu.append(
            new MenuItem({
                label: "Copy path",
                click: () => {
                    clipboard.writeText(filePath);
                },
            }),
        );
        menu.append(
            new MenuItem({
                label: "Copy relative path",
                click: () => {
                    win.webContents.send("context-menu:action", {
                        action: "copy-relative-path",
                        filePath,
                        isDirectory,
                    });
                },
            }),
        );
        menu.append(new MenuItem({ type: "separator" }));
        menu.append(
            new MenuItem({
                label: "Rename",
                click: () => {
                    win.webContents.send("context-menu:action", {
                        action: "rename",
                        filePath,
                    });
                },
            }),
        );
        menu.append(new MenuItem({ type: "separator" }));
        menu.append(
            new MenuItem({
                label: revealLabel,
                click: () => {
                    shell.showItemInFolder(filePath);
                },
            }),
        );
        menu.append(new MenuItem({ type: "separator" }));
        menu.append(
            new MenuItem({
                label: "Delete",
                click: () => {
                    win.webContents.send("context-menu:action", {
                        action: "delete",
                        filePath,
                    });
                },
            }),
        );
        menu.popup({ window: win });
    });
};
