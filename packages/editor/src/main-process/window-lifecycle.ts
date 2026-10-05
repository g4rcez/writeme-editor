import type { Event } from "electron";

type CloseableWindow = {
    hide(): void;
};

type QuickNoteWindow = {
    show(): void;
    focus(): void;
    webContents: {
        send(channel: string): void;
    };
};

export function handleWindowClose(event: Event, window: CloseableWindow, isQuitting: boolean) {
    if (!isQuitting) {
        event.preventDefault();
        window.hide();
    }
}

export function openQuickNote(window: QuickNoteWindow | null) {
    if (!window) return;
    window.show();
    window.focus();
    window.webContents.send("quicknote:open");
}
