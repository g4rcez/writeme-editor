import Database from "better-sqlite3";
import { app } from "electron";
import path from "node:path";

class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database.Database;

  private constructor() {
    const dbPath = path.join(app.getPath("userData"), "writeme.sqlite");
    console.log("Initializing SQLite database at:", dbPath);
    this.db = new Database(dbPath);
    this.init();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        type TEXT,
        title TEXT,
        project TEXT,
        filePath TEXT,
        tags TEXT, -- JSON array
        createdAt TEXT,
        updatedAt TEXT,
        createdBy TEXT,
        updatedBy TEXT,
        content TEXT,
        noteType TEXT,
        fileSize INTEGER,
        lastSynced TEXT,
        url TEXT,
        description TEXT,
        favicon TEXT,
        metadata TEXT -- JSON object
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        type TEXT,
        title TEXT,
        folderPath TEXT,
        description TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS tabs (
        id TEXT PRIMARY KEY,
        type TEXT,
        noteId TEXT,
        "order" INTEGER,
        project TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS hashtags (
        id TEXT PRIMARY KEY,
        type TEXT,
        hashtag TEXT,
        filename TEXT,
        project TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        type TEXT,
        name TEXT UNIQUE,
        value TEXT
      );
    `);

    // Migration for missing 'type' column if tables existed without it
    const tables = ["notes", "projects", "tabs", "hashtags", "settings"];
    const commonColumns = ["type"];
    const noteColumns = ["url", "description", "favicon", "metadata"];

    for (const table of tables) {
      try {
        const columns = this.db
          .prepare(`PRAGMA table_info(${table})`)
          .all() as any[];

        for (const col of commonColumns) {
          if (!columns.some((c: any) => c.name === col)) {
            console.log(`Migrating table ${table}: adding '${col}' column`);
            this.db
              .prepare(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT`)
              .run();
          }
        }

        if (table === "notes") {
          for (const col of noteColumns) {
            if (!columns.some((c: any) => c.name === col)) {
              console.log(`Migrating table ${table}: adding '${col}' column`);
              this.db
                .prepare(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT`)
                .run();
            }
          }
        }

        if (table === "tabs") {
          if (!columns.some((c: any) => c.name === "updatedAt")) {
            console.log(`Migrating table ${table}: adding 'updatedAt' column`);
            this.db
              .prepare(`ALTER TABLE ${table} ADD COLUMN updatedAt TEXT`)
              .run();
          }
        }
      } catch (e) {
        console.error(`Failed to migrate table ${table}:`, e);
      }
    }

    // Default settings
    const defaults = [
      { name: "autosave", value: "true" },
      { name: "autosaveDelay", value: "5000" },
      { name: "theme", value: '"dark"' },
    ];

    const insertSetting = this.db.prepare(`
      INSERT OR IGNORE INTO settings (id, type, name, value) VALUES (?, ?, ?, ?)
    `);

    for (const def of defaults) {
      insertSetting.run(crypto.randomUUID(), "setting", def.name, def.value);
    }
  }

  public get<T>(table: string, id: string): T | undefined {
    const stmt = this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`);
    const result = stmt.get(id) as any;
    if (result && result.tags) {
      result.tags = JSON.parse(result.tags);
    }
    if (result && result.metadata) {
      result.metadata = JSON.parse(result.metadata);
    }
    return result as T;
  }

  public getAll<T>(table: string): T[] {
    const stmt = this.db.prepare(`SELECT * FROM ${table}`);
    const results = stmt.all() as any[];
    return results.map((row) => {
      if (row.tags) {
        row.tags = JSON.parse(row.tags);
      }
      if (row.metadata) {
        row.metadata = JSON.parse(row.metadata);
      }
      return row;
    });
  }

  public save<T extends { id: string }>(table: string, item: T): void {
    const keys = Object.keys(item);
    const values = Object.values(item).map((v: any) => {
      if (
        Array.isArray(v) ||
        (v !== null && typeof v === "object" && !(v instanceof Date))
      ) {
        return JSON.stringify(v);
      }
      if (v instanceof Date) return v.toISOString();
      return v;
    });

    const placeholders = keys.map(() => "?").join(",");
    const columns = keys.map((k) => `"${k}"`).join(","); // Quote columns for safety/reserved words

    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${placeholders})`,
    );
    stmt.run(...values);
  }

  public delete(table: string, id: string): void {
    const stmt = this.db.prepare(`DELETE FROM ${table} WHERE id = ?`);
    stmt.run(id);
  }

  public count(table: string): number {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
    const result = stmt.get() as { count: number };
    return result.count;
  }

  // Specific query for quicknotes
  public getLatestQuicknote(): any {
    const stmt = this.db.prepare(
      `SELECT * FROM notes WHERE noteType = 'quick' ORDER BY updatedAt DESC LIMIT 1`,
    );
    const result = stmt.get() as any;
    if (result && result.tags) {
      result.tags = JSON.parse(result.tags);
    }
    if (result && result.metadata) {
      result.metadata = JSON.parse(result.metadata);
    }
    return result;
  }

  public getQuicknoteByDate(start: string, end: string): any {
    const stmt = this.db.prepare(
      `SELECT * FROM notes WHERE noteType = 'quick' AND updatedAt >= ? AND updatedAt <= ? LIMIT 1`,
    );
    const result = stmt.get(start, end) as any;
    if (result && result.tags) {
      result.tags = JSON.parse(result.tags);
    }
    if (result && result.metadata) {
      result.metadata = JSON.parse(result.metadata);
    }
    return result;
  }

  public getRecentNotes(limit: number): any[] {
    const stmt = this.db.prepare(
      `SELECT * FROM notes ORDER BY updatedAt DESC LIMIT ?`,
    );
    const results = stmt.all(limit) as any[];
    return results.map((row) => {
      if (row.tags) {
        row.tags = JSON.parse(row.tags);
      }
      if (row.metadata) {
        row.metadata = JSON.parse(row.metadata);
      }
      return row;
    });
  }

  public updateTabsOrder(tabs: { id: string; order: number }[]): void {
    const updateStmt = this.db.prepare(
      'UPDATE tabs SET "order" = ? WHERE id = ?',
    );
    const transaction = this.db.transaction((tabs) => {
      for (const tab of tabs) {
        updateStmt.run(tab.order, tab.id);
      }
    });
    transaction(tabs);
  }

  public syncHashtags(filename: string, tags: string[]): void {
    const getExistingStmt = this.db.prepare(
      "SELECT * FROM hashtags WHERE filename = ?",
    );
    const deleteStmt = this.db.prepare("DELETE FROM hashtags WHERE id = ?");
    const insertStmt = this.db.prepare(
      "INSERT INTO hashtags (id, hashtag, filename, project) VALUES (?, ?, ?, ?)",
    );

    const transaction = this.db.transaction(() => {
      const existing = getExistingStmt.all(filename) as any[];
      const existingTags = existing.map((e) => e.hashtag);

      const added = tags.filter((t) => !existingTags.includes(t));
      const removed = existingTags.filter((t) => !tags.includes(t));

      if (added.length === 0 && removed.length === 0) return;

      const idsToRemove = existing
        .filter((e) => removed.includes(e.hashtag))
        .map((e) => e.id);
      for (const id of idsToRemove) {
        deleteStmt.run(id);
      }

      for (const tag of added) {
        insertStmt.run(crypto.randomUUID(), tag, filename, "default");
      }
    });
    transaction();
  }
}

export const dbManager = DatabaseManager.getInstance;
