import chokidar, { type FSWatcher } from "chokidar";
import type { BrowserWindow } from "electron";
import path from "node:path";

const SUPPRESS_WINDOW_MS = 2000;

class FileWatcherClass {
  private watcher: FSWatcher | null = null;
  private win: BrowserWindow | null = null;
  private lastWrittenByApp = new Map<string, number>();
  private dirChangeTimers = new Map<string, ReturnType<typeof setTimeout>>();

  start(directory: string, win: BrowserWindow) {
    this.stop();
    this.win = win;
    this.watcher = chokidar.watch(directory, {
      depth: 10,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
      ignored: [/(^|[/\\])\.\./, /node_modules/, /\.git/, /dist/, /build/, /\.next/, /\.vite/],
    });
    this.watcher.on("error", (err) => console.error("[FileWatcher] error:", err));

    this.watcher.on("change", (filePath) => {
      const lastWrite = this.lastWrittenByApp.get(filePath);
      if (lastWrite && Date.now() - lastWrite < SUPPRESS_WINDOW_MS) return;
      this.win?.webContents.send("fs:file-changed", { filePath });
    });

    const sendDirChanged = (filePath: string, rootDir: string) => {
      const dirPath =
        path.dirname(filePath) === rootDir
          ? rootDir
          : path.dirname(filePath);
      this.scheduleDirChanged(dirPath);
    };

    this.watcher.on("add", (filePath) => sendDirChanged(filePath, directory));
    this.watcher.on("unlink", (filePath) => sendDirChanged(filePath, directory));
    this.watcher.on("addDir", (filePath) => sendDirChanged(filePath, directory));
    this.watcher.on("unlinkDir", (filePath) => sendDirChanged(filePath, directory));
  }

  stop() {
    const oldWatcher = this.watcher;
    this.watcher = null;
    oldWatcher?.close();
    this.win = null;
    this.lastWrittenByApp.clear();
    for (const timer of this.dirChangeTimers.values()) clearTimeout(timer);
    this.dirChangeTimers.clear();
  }

  suppressNext(filePath: string) {
    this.lastWrittenByApp.set(filePath, Date.now());
  }

  private scheduleDirChanged(dirPath: string) {
    const existing = this.dirChangeTimers.get(dirPath);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.dirChangeTimers.delete(dirPath);
      this.win?.webContents.send("fs:dir-changed", { dirPath });
    }, 300);
    this.dirChangeTimers.set(dirPath, timer);
  }
}

export const FileWatcher = new FileWatcherClass();
