import { BrowserWindow, ipcMain } from "electron";

export function registerAIOAuthHandlers(_mainWindow: BrowserWindow): void {
  ipcMain.handle("ai:oauth-start", (_event, authUrl: string) => {
    return new Promise<{ code: string }>((resolve, reject) => {
      const oauthWindow = new BrowserWindow({
        width: 800,
        height: 600,
        alwaysOnTop: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      const TIMEOUT_MS = 5 * 60 * 1000;
      const timer = setTimeout(() => {
        oauthWindow.close();
        reject(new Error("OAuth timeout"));
      }, TIMEOUT_MS);

      const handleRedirect = (url: string) => {
        if (url.startsWith("writeme://oauth/callback")) {
          clearTimeout(timer);
          try {
            const parsed = new URL(url);
            const code = parsed.searchParams.get("code");
            if (code) {
              resolve({ code });
            } else {
              reject(new Error("No code in OAuth callback"));
            }
          } catch (err) {
            reject(err);
          } finally {
            oauthWindow.close();
          }
        }
      };

      oauthWindow.webContents.on("will-redirect", (_e, url) => {
        handleRedirect(url);
      });

      oauthWindow.webContents.on("will-navigate", (_e, url) => {
        handleRedirect(url);
      });

      oauthWindow.on("closed", () => {
        clearTimeout(timer);
        reject(new Error("OAuth window closed"));
      });

      oauthWindow.loadURL(authUrl);
    });
  });
}
