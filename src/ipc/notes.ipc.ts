import { clipboard, ipcMain } from "electron";

export const notesIpcHandler = async () => {
  ipcMain.handle("notes:clipboard", async (...args) => {
    const x = clipboard.readText("clipboard");
    return x;
  });

  ipcMain.handle("notes:setup", async (...args) => {
    console.log("HANDLE");
  });

  ipcMain.handle("notes:findAll", async () => {
    return [];
  });

  ipcMain.handle("notes:findById", async (_, id: string) => {
    return {};
  });

  ipcMain.handle("notes:save", async (_, noteData: any) => {
    return undefined;
  });
};
