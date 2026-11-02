import type { IpcMainEvent, IpcMainInvokeEvent } from "electron";

// Only the top-level frame of the window may run commands. A sub frame, or a frame that is already gone, may not.
export const isMainFrameSender = (event: IpcMainEvent | IpcMainInvokeEvent): boolean =>
    event.senderFrame !== null && event.senderFrame === event.sender.mainFrame;
