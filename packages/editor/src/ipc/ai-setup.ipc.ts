import { app, clipboard, ipcMain, safeStorage, type IpcMainInvokeEvent } from "electron";
import { prepareCredentialStorage } from "../main-process/credential-storage";
import { createSecureStorage } from "../main-process/safe-storage";

export type AICredentialStorageStatus = {
    ready: boolean;
    electronVersion: string;
    platform: NodeJS.Platform;
    synchronousEncryptionAvailable: boolean | null;
    asynchronousEncryptionAvailable: boolean | null;
};

async function getCredentialStorageStatus(): Promise<AICredentialStorageStatus> {
    const status: AICredentialStorageStatus = {
        ready: app.isReady(),
        electronVersion: process.versions.electron ?? "unknown",
        platform: process.platform,
        synchronousEncryptionAvailable: false,
        asynchronousEncryptionAvailable: false,
    };
    if (!status.ready) return status;
    try {
        status.asynchronousEncryptionAvailable = await safeStorage.isAsyncEncryptionAvailable();
    } catch {
        status.asynchronousEncryptionAvailable = null;
    }
    try {
        status.synchronousEncryptionAvailable = safeStorage.isEncryptionAvailable();
    } catch {
        status.synchronousEncryptionAvailable = null;
    }
    return status;
}

export function registerAISetupHandlers(rendererUrl: string): void {
    let trustedUrl: URL;
    try {
        trustedUrl = new URL(rendererUrl);
    } catch {
        throw new Error("Invalid app renderer URL.");
    }
    trustedUrl.hash = "";

    const assertTrustedSender = (event: IpcMainInvokeEvent): void => {
        const frame = event.senderFrame;
        if (!frame || frame !== event.sender.mainFrame) {
            throw new Error("AI setup access denied.");
        }
        let senderUrl: URL;
        try {
            senderUrl = new URL(frame.url);
        } catch {
            throw new Error("AI setup access denied.");
        }
        senderUrl.hash = "";
        if (senderUrl.href !== trustedUrl.href) {
            throw new Error("AI setup access denied.");
        }
    };

    ipcMain.handle("ai:prepare-credential-storage", (event) => {
        assertTrustedSender(event);
        return prepareCredentialStorage(createSecureStorage(safeStorage));
    });

    ipcMain.handle("ai:credential-storage-status", (event) => {
        assertTrustedSender(event);
        return getCredentialStorageStatus();
    });

    ipcMain.handle("ai:copy-device-code", (event, value: unknown) => {
        assertTrustedSender(event);
        if (typeof value !== "string" || !/^[A-Za-z0-9-]{1,64}$/.test(value)) {
            throw new Error("Invalid device authorization code.");
        }
        clipboard.writeText(value);
    });
}
