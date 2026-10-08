import { ipcMain } from "electron";

export function registerAIProxyHandlers(desktopToken: string, rendererUrl: string): void {
    let trustedUrl: URL;
    try {
        trustedUrl = new URL(rendererUrl);
    } catch {
        throw new Error("Invalid app renderer URL.");
    }
    trustedUrl.hash = "";

    ipcMain.handle("ai:proxy-token", (event) => {
        const frame = event.senderFrame;
        if (!frame || frame !== event.sender.mainFrame) {
            throw new Error("AI proxy access denied.");
        }

        let senderUrl: URL;
        try {
            senderUrl = new URL(frame.url);
        } catch {
            throw new Error("AI proxy access denied.");
        }
        senderUrl.hash = "";
        if (senderUrl.href !== trustedUrl.href) {
            throw new Error("AI proxy access denied.");
        }

        return desktopToken;
    });
}
