import { app, dialog, net, shell } from "electron";
import { updateElectronApp, UpdateSourceType } from "update-electron-app";

export async function startAppUpdater(): Promise<void> {
    if (process.platform !== "linux") {
        updateElectronApp({
            updateSource: { type: UpdateSourceType.ElectronPublicUpdateService, repo: "g4rcez/writeme-editor" },
            updateInterval: "1 hour",
            notifyUser: true,
        });
        return;
    }
    try {
        const response = await net.fetch("https://api.github.com/repos/g4rcez/writeme-editor/releases/latest");
        const release = (await response.json()) as { tag_name: string; html_url: string };
        const latest = release.tag_name.replace(/^v/, "");
        if (latest === app.getVersion()) return;
        const { response: button } = await dialog.showMessageBox({
            type: "info",
            title: "Update available",
            message: `A new version (${latest}) is available. You are running ${app.getVersion()}.`,
            buttons: ["Download", "Later"],
            defaultId: 0,
            cancelId: 1,
        });
        if (button === 0) await shell.openExternal(release.html_url);
    } catch (error) {
        console.debug("Update check unavailable:", error);
    }
}
