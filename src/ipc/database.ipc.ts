import { ipcMain } from "electron";
import { dbManager } from "../main-process/database";

export const databaseIpcHandler = () => {
  const db = dbManager();

  ipcMain.handle("db:get", (_, table: string, id: string) => {
    return db.get(table, id);
  });

  ipcMain.handle("db:getAll", (_, table: string) => {
    return db.getAll(table);
  });

  ipcMain.handle("db:save", (_, table: string, item: any) => {
    db.save(table, item);
    return item;
  });

  ipcMain.handle("db:delete", (_, table: string, id: string) => {
    db.delete(table, id);
    return true;
  });

  ipcMain.handle("db:count", (_, table: string) => {
    return db.count(table);
  });
  
  // Specialized queries
  ipcMain.handle("db:notes:getLatestQuicknote", () => {
    return db.getLatestQuicknote();
  });

  ipcMain.handle("db:notes:getQuicknoteByDate", (_, start: string, end: string) => {
    return db.getQuicknoteByDate(start, end);
  });

  ipcMain.handle("db:notes:getRecentNotes", (_, limit: number) => {
    return db.getRecentNotes(limit);
  });

  ipcMain.handle("db:tabs:updateOrder", (_, tabs: any[]) => {
      db.updateTabsOrder(tabs);
      return true;
  });

  ipcMain.handle("db:hashtags:sync", (_, filename: string, tags: string[]) => {
      db.syncHashtags(filename, tags);
      return true;
  });
};
