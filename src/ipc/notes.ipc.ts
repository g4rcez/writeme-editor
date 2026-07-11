import { BrowserWindow, Menu, MenuItem, app, clipboard, dialog, ipcMain, shell } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import type { TreeNode } from "../types/tree";
import { dbManager } from "../main-process/database";
import { FileWatcher } from "../main-process/file-watcher";

const allowedFilesystemRoots = new Set<string>();

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
    ipcMain.handle("notes:clipboard", async () => {
        const x = clipboard.readText("clipboard");
        return x;
    });
    ipcMain.handle("notes:clipboardImage", async () => {
        const image = clipboard.readImage();
        if (image.isEmpty()) return null;
        return image.toDataURL();
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

    ipcMain.handle("fs:openFileOrDirectory", async () => {
        const result = await dialog.showOpenDialog({
            properties: ["openFile", "openDirectory"],
            filters: [
                { name: "All Supported", extensions: ["md", "json"] },
                { name: "Markdown", extensions: ["md"] },
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
            let stats;
            try {
                stats = await fs.stat(filePath);
            } catch (e) {
                return {
                    success: true,
                    filePath,
                    fileSize: content.length,
                    lastModified: new Date(),
                };
            }
            return {
                success: true,
                filePath,
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

    ipcMain.handle("fs:readDirRecursive", async (_event, dirPath: string, maxDepth = 10) => {
        const access = validatePaths(dirPath);
        if (!access.success) {
            return access;
        }

        type FileEntry = { name: string; path: string; relativePath: string };
        const results: FileEntry[] = [];
        const walk = async (currentDir: string, depth: number) => {
            if (depth > maxDepth) return;
            let entries;
            try {
                entries = await fs.readdir(currentDir, { withFileTypes: true });
            } catch {
                return;
            }
            for (const entry of entries) {
                if (entry.name.startsWith(".")) continue;
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory()) {
                    await walk(fullPath, depth + 1);
                } else if (entry.name.endsWith(".md")) {
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
        } catch (error: any) {
            return { success: false, files: [], error: error.message };
        }
    });

    ipcMain.handle("fs:readDir", async (_, dirPath: string) => {
        const access = validatePaths(dirPath);
        if (!access.success) {
            return access;
        }

        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
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
        } catch (error: any) {
            return { entries: [], error: error.message };
        }
    });

    ipcMain.handle("context-menu:explorer", async (event, filePath: string, isDirectory: boolean) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return;

        const revealLabel =
            process.platform === "darwin"
                ? "Reveal in Finder"
                : process.platform === "win32"
                  ? "Show in Explorer"
                  : "Open in File Manager";

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
