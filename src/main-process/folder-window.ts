import { BrowserWindow } from "electron";
import path from "node:path";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

export function createFolderWindow(preloadPath: string, folderPath: string): BrowserWindow {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        center: true,
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: true,
            contextIsolation: true,
            defaultEncoding: "utf-8",
        },
    });

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        win.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/folder?path=${encodeURIComponent(folderPath)}`);
    } else {
        win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), {
            hash: `folder?path=${encodeURIComponent(folderPath)}`,
        });
    }

    return win;
}
