import { clipboard, dialog, ipcMain } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import type { TreeNode } from "../types/tree";

export const notesIpcHandler = async () => {
  // Existing clipboard handler
  ipcMain.handle("notes:clipboard", async (...args) => {
    const x = clipboard.readText("clipboard");
    return x;
  });

  // File system handlers for hybrid storage

  // Directory selection dialog
  ipcMain.handle("fs:chooseDirectory", async (event) => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Choose Notes Directory",
      message: "Select where to store your notes",
    });

    return result.canceled ? null : result.filePaths[0];
  });

  // Open file or directory dialog (for "Open..." action)
  ipcMain.handle("fs:openFileOrDirectory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "openDirectory"],
      filters: [{ name: "Markdown", extensions: ["md"] }],
      title: "Open",
    });
    if (result.canceled || !result.filePaths[0]) return null;

    const selectedPath = result.filePaths[0];
    const stats = await fs.stat(selectedPath);
    return { path: selectedPath, isDirectory: stats.isDirectory() };
  });

  // Write file with automatic directory creation
  ipcMain.handle(
    "fs:writeFile",
    async (event, filePath: string, content: string) => {
      try {
        // Create parent directory if it doesn't exist
        await fs.mkdir(path.dirname(filePath), { recursive: true });

        // Write file
        await fs.writeFile(filePath, content, "utf-8");

        let stats;
        try {
          stats = await fs.stat(filePath);
        } catch (e) {
          // If stat fails right after write (e.g. file moved), return partial success
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
    },
  );

  // Read file
  ipcMain.handle("fs:readFile", async (event, filePath: string) => {
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

  // Check file exists and get stats
  ipcMain.handle("fs:statFile", async (event, filePath: string) => {
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

  // Create directory
  ipcMain.handle("fs:mkdir", async (event, dirPath: string) => {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return { success: true, path: dirPath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Delete file or directory
  ipcMain.handle("fs:deleteFile", async (event, filePath: string) => {
    try {
      await fs.rm(filePath, { recursive: true, force: true });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Move/rename file
  ipcMain.handle(
    "fs:moveFile",
    async (event, oldPath: string, newPath: string) => {
      try {
        // Create destination directory if needed
        await fs.mkdir(path.dirname(newPath), { recursive: true });

        // Rename/move the file
        await fs.rename(oldPath, newPath);

        return { success: true, newPath };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // Recursive directory walk — collects .md files up to a depth limit
  ipcMain.handle(
    "fs:readDirRecursive",
    async (_event, dirPath: string, maxDepth = 10) => {
      type FileEntry = { name: string; path: string; relativePath: string };
      const results: FileEntry[] = [];

      const walk = async (currentDir: string, depth: number) => {
        if (depth > maxDepth) return;
        let entries;
        try {
          entries = await fs.readdir(currentDir, { withFileTypes: true });
        } catch {
          return; // Skip unreadable directories
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
    },
  );

  // Read directory (single level for lazy loading)
  ipcMain.handle("fs:readDir", async (event, dirPath: string) => {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      const nodes: TreeNode[] = entries
        .filter((entry) => !entry.name.startsWith(".")) // Skip hidden files
        .map((entry): TreeNode => {
          const fullPath = path.join(dirPath, entry.name);
          const isDirectory = entry.isDirectory();
          const ext = isDirectory
            ? undefined
            : path.extname(entry.name).toLowerCase();

          return {
            name: entry.name,
            path: fullPath,
            type: isDirectory ? "directory" : "file",
            extension: ext,
            children: isDirectory ? undefined : undefined, // Directories: undefined means not loaded
          };
        })
        .sort((a, b) => {
          // Folders first, then alphabetical
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
};
