import { BrowserWindow, Event } from "electron";

export function handleWindowClose(event: Event, window: BrowserWindow, isQuitting: boolean) {
  if (!isQuitting) {
    event.preventDefault();
    window.hide();
  }
}

export function openQuickNote(window: BrowserWindow | null) {
  if (!window) return;
  window.show();
  window.focus();
  window.webContents.send("quicknote:open");
}
