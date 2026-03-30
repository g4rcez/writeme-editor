import { uuid } from "@g4rcez/components";
import Database from "better-sqlite3";
import { app } from "electron";
import path from "node:path";

class DatabaseManager {
  private static instance: DatabaseManager;
  public db: Database.Database;

  private constructor() {
    const dbPath = path.join(app.getPath("userData"), "writeme.sqlite");
    console.log(dbPath);
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
        metadata TEXT, -- JSON object
        favorite INTEGER DEFAULT 0
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
        value TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS aiConfigs (
        id TEXT PRIMARY KEY,
        type TEXT,
        name TEXT,
        commandTemplate TEXT,
        systemPrompt TEXT,
        isDefault INTEGER DEFAULT 0,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS aiChats (
        id TEXT PRIMARY KEY,
        type TEXT,
        noteId TEXT,
        title TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS aiMessages (
        id TEXT PRIMARY KEY,
        type TEXT,
        chatId TEXT,
        role TEXT,
        content TEXT,
        diffOriginal TEXT,
        diffNew TEXT,
        selectionSlice TEXT, -- JSON object
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS scripts (
        id TEXT PRIMARY KEY,
        type TEXT,
        name TEXT,
        content TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS aiCredentials (
        adapterId TEXT PRIMARY KEY,
        accessToken TEXT,
        refreshToken TEXT,
        expiresAt INTEGER,
        apiKey TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS noteGroups (
        id TEXT PRIMARY KEY,
        type TEXT,
        title TEXT,
        description TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS noteGroupMembers (
        id TEXT PRIMARY KEY,
        type TEXT,
        groupId TEXT,
        noteId TEXT,
        "order" REAL,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS views (
        id TEXT PRIMARY KEY,
        type TEXT,
        title TEXT,
        query TEXT,
        columns TEXT,
        viewType TEXT,
        sortField TEXT,
        sortDirection TEXT,
        viewConfig TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );
    `);

    // Migration: rename bases table to views
    try {
      const basesTable = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='bases'",
        )
        .get();
      if (basesTable) {
        console.log("Migrating: renaming bases table to views...");
        this.db.prepare("ALTER TABLE bases RENAME TO views").run();
      }
    } catch (e) {
      console.error("Failed to migrate bases to views:", e);
    }

    // Migration for templates to notes
    try {
      const templatesTable = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='templates'",
        )
        .get();
      if (templatesTable) {
        console.log("Migrating templates to notes table...");
        this.db.exec(`
          INSERT OR IGNORE INTO notes (
            id, type, title, content, filePath, createdAt, updatedAt, noteType, 
            project, tags, createdBy, updatedBy, fileSize, favorite
          ) 
          SELECT 
            id, type, name, content, filePath, createdAt, updatedAt, 'template',
            '', '[]', 'system', 'system', length(content), 0
          FROM templates;
        `);
        console.log("Dropping templates table...");
        this.db.exec("DROP TABLE templates;");
      }
    } catch (e) {
      console.error("Failed to migrate templates to notes:", e);
    }

    // Migration for missing 'type' column if tables existed without it
    const tables = [
      "notes",
      "projects",
      "tabs",
      "hashtags",
      "settings",
      "aiConfigs",
      "aiChats",
      "aiMessages",
      "scripts",
      "noteGroups",
      "noteGroupMembers",
      "views",
    ];
    const commonColumns = ["type", "createdAt", "updatedAt"];
    const noteColumns = [
      "url",
      "description",
      "favicon",
      "metadata",
      "favorite",
    ];
    const aiMessageColumns = ["selectionSlice", "files"];
    const aiConfigColumns = ["adapterId", "model"];

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
              const type = col === "favorite" ? "INTEGER DEFAULT 0" : "TEXT";
              this.db
                .prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`)
                .run();
            }
          }
        }

        if (table === "aiMessages") {
          for (const col of aiMessageColumns) {
            if (!columns.some((c: any) => c.name === col)) {
              console.log(`Migrating table ${table}: adding '${col}' column`);
              this.db
                .prepare(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT`)
                .run();
            }
          }
        }

        if (table === "aiConfigs") {
          for (const col of aiConfigColumns) {
            if (!columns.some((c: any) => c.name === col)) {
              console.log(`Migrating table ${table}: adding '${col}' column`);
              this.db
                .prepare(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT`)
                .run();
            }
          }
          // Ensure existing CLI configs keep working
          try {
            this.db
              .prepare(
                `UPDATE aiConfigs SET adapterId = 'cli' WHERE adapterId IS NULL`,
              )
              .run();
          } catch (e) {
            // Column may not exist yet on first run — handled by migration above
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
      insertSetting.run(uuid(), "setting", def.name, def.value);
    }
  }

  public normalizeRow(row: any) {
    if (!row) return row;
    if (row.tags) {
      try {
        row.tags = JSON.parse(row.tags);
      } catch (e) {}
    }
    if (row.metadata) {
      try {
        row.metadata = JSON.parse(row.metadata);
      } catch (e) {}
    }
    if (row.columns) {
      try {
        row.columns = JSON.parse(row.columns);
      } catch (e) {}
    }
    if (row.viewConfig) {
      try {
        row.viewConfig = JSON.parse(row.viewConfig);
      } catch (e) {}
    }
    if (row.selectionSlice) {
      try {
        row.selectionSlice = JSON.parse(row.selectionSlice);
      } catch (e) {}
    }
    if ("isDefault" in row) {
      row.isDefault = Boolean(row.isDefault);
    }
    if ("favorite" in row) {
      row.favorite = Boolean(row.favorite);
    }
    return row;
  }

  public get<T>(table: string, id: string): T | undefined {
    const stmt = this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`);
    const result = stmt.get(id) as any;
    return this.normalizeRow(result) as T;
  }

  public getAll<T>(table: string): T[] {
    const stmt = this.db.prepare(`SELECT * FROM ${table}`);
    const results = stmt.all() as any[];
    return results.map((row) => this.normalizeRow(row));
  }

  public save<T extends { id: string }>(table: string, item: T): void {
    const keys = Object.keys(item);
    const values = Object.values(item).map((v: any) => {
      if (typeof v === "boolean") {
        return v ? 1 : 0;
      }
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
    return this.normalizeRow(result);
  }

  public getQuicknoteByDate(start: string, end: string): any {
    const stmt = this.db.prepare(
      `SELECT * FROM notes WHERE noteType = 'quick' AND updatedAt >= ? AND updatedAt <= ? LIMIT 1`,
    );
    const result = stmt.get(start, end) as any;
    return this.normalizeRow(result);
  }

  public getRecentNotes(limit: number): any[] {
    const stmt = this.db.prepare(
      `SELECT * FROM notes WHERE noteType != 'template' ORDER BY updatedAt DESC LIMIT ?`,
    );
    const results = stmt.all(limit) as any[];
    return results.map((row) => this.normalizeRow(row));
  }

  public getTemplates(): any[] {
    const stmt = this.db.prepare(
      `SELECT * FROM notes WHERE noteType = 'template' ORDER BY updatedAt DESC`,
    );
    const results = stmt.all() as any[];
    return results.map((row) => this.normalizeRow(row));
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

  public deleteTabsByNoteId(noteId: string): void {
    const stmt = this.db.prepare("DELETE FROM tabs WHERE noteId = ?");
    stmt.run(noteId);
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
        insertStmt.run(uuid(), tag, filename, "default");
      }
    });
    transaction();
  }

  public updateNoteContent(
    id: string,
    content: string,
    fileSize: number,
    updatedAt: string,
    updatedBy: string,
  ): void {
    const stmt = this.db.prepare(
      "UPDATE notes SET content = ?, fileSize = ?, updatedAt = ?, updatedBy = ? WHERE id = ?",
    );
    stmt.run(content, fileSize, updatedAt, updatedBy, id);
  }

  public getNoteGroupsByNoteId(noteId: string): any[] {
    const stmt = this.db.prepare(
      `SELECT g.* FROM noteGroups g
       INNER JOIN noteGroupMembers m ON m.groupId = g.id
       WHERE m.noteId = ?`,
    );
    return (stmt.all(noteId) as any[]).map((row) => this.normalizeRow(row));
  }

  public getNoteGroupMembersByGroupId(groupId: string): any[] {
    const stmt = this.db.prepare(
      `SELECT * FROM noteGroupMembers WHERE groupId = ? ORDER BY "order" ASC`,
    );
    return (stmt.all(groupId) as any[]).map((row) => this.normalizeRow(row));
  }

  public reorderNoteGroupMembers(
    members: { id: string; order: number }[],
  ): void {
    const updateStmt = this.db.prepare(
      `UPDATE noteGroupMembers SET "order" = ? WHERE id = ?`,
    );
    const transaction = this.db.transaction((ms) => {
      for (const m of ms) {
        updateStmt.run(m.order, m.id);
      }
    });
    transaction(members);
  }

  public deleteNoteGroupMembersByNoteId(noteId: string): void {
    const stmt = this.db.prepare(
      "DELETE FROM noteGroupMembers WHERE noteId = ?",
    );
    stmt.run(noteId);
  }

  public deleteNoteGroupMembersByGroupId(groupId: string): void {
    const stmt = this.db.prepare(
      "DELETE FROM noteGroupMembers WHERE groupId = ?",
    );
    stmt.run(groupId);
  }

  public getNoteByFilePath(filePath: string): any {
    const stmt = this.db.prepare(
      "SELECT * FROM notes WHERE filePath = ? LIMIT 1",
    );
    const result = stmt.get(filePath) as any;
    return this.normalizeRow(result);
  }
}

export const dbManager = DatabaseManager.getInstance;
