import { v7 as uuid } from "uuid";
import Database from "better-sqlite3";
import { app } from "electron";
import path from "node:path";

import {
	type DatabaseCollection,
	isDatabaseCollection,
	parseDatabaseRecord,
} from "./database-schema";

export type MigrationCounts = {
	found: number;
	imported: number;
	updated: number;
	identical: number;
	skipped: number;
};

const GENERIC_DELETE_DENYLIST = new Set<DatabaseCollection>([
	"notes",
	"noteGroups",
	"aiChats",
]);

export class DatabaseManager {
	private static instance: DatabaseManager;
	public db: Database.Database;

	public constructor(
		dbPath = path.join(app.getPath("userData"), "writeme.sqlite"),
	) {
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
		// Migration: rename bases table to views (must run BEFORE CREATE TABLE IF NOT EXISTS views)
		try {
			const basesTable = this.db
				.prepare(
					"SELECT name FROM sqlite_master WHERE type='table' AND name='bases'",
				)
				.get();
			if (basesTable) {
				const viewsTable = this.db
					.prepare(
						"SELECT name FROM sqlite_master WHERE type='table' AND name='views'",
					)
					.get();
				if (viewsTable) {
					// Both tables exist — copy rows from bases not already in views, then drop
					console.log("Migrating: merging bases into existing views table...");
					this.db
						.prepare("INSERT OR IGNORE INTO views SELECT * FROM bases")
						.run();
					this.db.prepare("DROP TABLE bases").run();
				} else {
					console.log("Migrating: renaming bases table to views...");
					this.db.prepare("ALTER TABLE bases RENAME TO views").run();
				}
			}
		} catch (e) {
			console.error("Failed to migrate bases to views:", e);
		}

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
        updatedAt TEXT,
        scrollY REAL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS terminalSessions (
        id TEXT PRIMARY KEY,
        type TEXT,
        title TEXT,
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
        adapterId TEXT,
        model TEXT,
        baseUrl TEXT,
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
        baseUrl TEXT,
        accountId TEXT,
        idToken TEXT,
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

      CREATE TABLE IF NOT EXISTS cursorPositions (
        id TEXT PRIMARY KEY,
        noteId TEXT UNIQUE,
        anchor INTEGER DEFAULT 0,
        y REAL DEFAULT 0,
        updatedAt INTEGER
      );
    `);

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
			"aiCredentials",
			"scripts",
			"noteGroups",
			"noteGroupMembers",
			"views",
			"cursorPositions",
			"terminalSessions",
		];
		const commonColumns = ["type", "createdAt", "updatedAt"];
		const noteColumns = [
			"url",
			"description",
			"favicon",
			"metadata",
			"favorite",
			"deletedAt",
			"originalFilePath",
		];
		const aiMessageColumns = ["selectionSlice", "files"];
		const aiConfigColumns = ["adapterId", "model", "baseUrl"];
		const aiCredentialColumns = ["baseUrl", "accountId", "idToken"];

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
							const type =
								col === "favorite" ? "INTEGER DEFAULT 0" : "TEXT DEFAULT NULL";
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
					} catch (error) {
						console.warn("Failed to backfill default AI adapter:", error);
					}
				}

				if (table === "aiCredentials") {
					for (const col of aiCredentialColumns) {
						if (!columns.some((c: any) => c.name === col)) {
							this.db
								.prepare(`ALTER TABLE aiCredentials ADD COLUMN ${col} TEXT`)
								.run();
						}
					}
				}

				if (table === "tabs") {
					const currentColumns = this.db
						.prepare(`PRAGMA table_info(${table})`)
						.all() as any[];
					if (!currentColumns.some((c: any) => c.name === "scrollY")) {
						console.log(`Migrating table ${table}: adding 'scrollY' column`);
						this.db
							.prepare(`ALTER TABLE ${table} ADD COLUMN scrollY REAL DEFAULT 0`)
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
			} catch (error) {
				console.warn("Failed to parse row tags JSON:", error);
			}
		}
		if (row.metadata) {
			try {
				row.metadata = JSON.parse(row.metadata);
			} catch (error) {
				console.warn("Failed to parse row metadata JSON:", error);
			}
		}
		if (row.columns) {
			try {
				row.columns = JSON.parse(row.columns);
			} catch (error) {
				console.warn("Failed to parse row columns JSON:", error);
			}
		}
		if (row.viewConfig) {
			try {
				row.viewConfig = JSON.parse(row.viewConfig);
			} catch (error) {
				console.warn("Failed to parse row view config JSON:", error);
			}
		}
		if (row.selectionSlice) {
			try {
				row.selectionSlice = JSON.parse(row.selectionSlice);
			} catch (error) {
				console.warn("Failed to parse row selection slice JSON:", error);
			}
		}
		if (row.files) {
			try {
				row.files = JSON.parse(row.files);
			} catch (error) {
				console.warn("Failed to parse row files JSON:", error);
			}
		}
		if ("isDefault" in row) {
			row.isDefault = Boolean(row.isDefault);
		}
		if ("favorite" in row) {
			row.favorite = Boolean(row.favorite);
		}
		return row;
	}

	private collection(table: string): DatabaseCollection {
		if (!isDatabaseCollection(table))
			throw new TypeError(`Unknown database collection: ${table}`);
		return table;
	}

	public close(): void {
		this.db.close();
	}

	public migrateCollection(table: string, records: unknown[]): MigrationCounts {
		const collection = this.collection(table);
		const counts: MigrationCounts = {
			found: records.length,
			imported: 0,
			updated: 0,
			identical: 0,
			skipped: 0,
		};
		const find =
			collection === "settings"
				? this.db.prepare("SELECT * FROM settings WHERE name = ?")
				: collection === "cursorPositions"
					? this.db.prepare("SELECT * FROM cursorPositions WHERE noteId = ?")
					: this.db.prepare(`SELECT * FROM ${collection} WHERE id = ?`);

		this.db.transaction(() => {
			for (const record of records) {
				const source = parseDatabaseRecord(collection, record);
				const sourceRecord = source as Record<string, unknown>;
				const identity =
					collection === "settings"
						? sourceRecord.name
						: collection === "cursorPositions"
							? sourceRecord.noteId
							: source.id;
				const destination = find.get(identity) as
					| Record<string, unknown>
					| undefined;
				if (!destination) {
					this.save(collection, source);
					counts.imported++;
					continue;
				}
				if (collection === "settings" || collection === "cursorPositions")
					source.id = String(destination.id);
				const sourceEntries = Object.entries(source).filter(
					([, value]) => value !== undefined,
				);
				const identical = sourceEntries.every(([key, value]) => {
					const serialized =
						value instanceof Date
							? value.toISOString()
							: typeof value === "boolean"
								? Number(value)
								: value;
					const stored = destination[key];
					return (
						JSON.stringify(serialized) === JSON.stringify(stored) ||
						JSON.stringify(serialized) === stored
					);
				});
				if (identical) {
					counts.identical++;
					continue;
				}
				const sourceTime = Date.parse(String(source.updatedAt ?? ""));
				const destinationTime = Date.parse(String(destination.updatedAt ?? ""));
				if (
					(collection === "settings" && !Number.isFinite(destinationTime)) ||
					(Number.isFinite(sourceTime) &&
						Number.isFinite(destinationTime) &&
						sourceTime > destinationTime)
				) {
					this.save(collection, source);
					counts.updated++;
				} else {
					counts.skipped++;
				}
			}
		})();
		return counts;
	}

	public verifyCollection(
		table: string,
		records: unknown[],
	): { sourceCount: number; destinationCount: number; matched: number } {
		const collection = this.collection(table);
		const find =
			collection === "settings"
				? this.db.prepare("SELECT 1 FROM settings WHERE name = ?")
				: collection === "cursorPositions"
					? this.db.prepare("SELECT 1 FROM cursorPositions WHERE noteId = ?")
					: this.db.prepare(`SELECT 1 FROM ${collection} WHERE id = ?`);
		let matched = 0;
		for (const record of records) {
			const source = parseDatabaseRecord(collection, record, () => undefined);
			const sourceRecord = source as Record<string, unknown>;
			const identity =
				collection === "settings"
					? sourceRecord.name
					: collection === "cursorPositions"
						? sourceRecord.noteId
						: source.id;
			if (find.get(identity)) matched++;
		}
		return {
			sourceCount: records.length,
			destinationCount: this.count(collection),
			matched,
		};
	}

	public get<T>(table: string, id: string): T | undefined {
		const collection = this.collection(table);
		const stmt = this.db.prepare(`SELECT * FROM ${collection} WHERE id = ?`);
		const result = stmt.get(id) as any;
		return this.normalizeRow(result) as T;
	}

	public getAll<T>(table: string): T[] {
		const collection = this.collection(table);
		const stmt = this.db.prepare(`SELECT * FROM ${collection}`);
		const results = stmt.all() as any[];
		return results.map((row) => this.normalizeRow(row));
	}

	public save(
		table: string,
		item: unknown,
	): Record<string, unknown> & {
		id: string;
	} {
		const collection = this.collection(table);
		const parsed = parseDatabaseRecord(collection, item);
		const keys = Object.keys(parsed);
		const values = Object.values(parsed).map((v: unknown) => {
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
			`INSERT OR REPLACE INTO ${collection} (${columns}) VALUES (${placeholders})`,
		);
		stmt.run(...values);
		return parsed;
	}

	public delete(table: string, id: string): void {
		const collection = this.collection(table);
		if (GENERIC_DELETE_DENYLIST.has(collection)) {
			throw new TypeError(
				`Generic deletion is not allowed for collection: ${collection}`,
			);
		}
		const stmt = this.db.prepare(`DELETE FROM ${collection} WHERE id = ?`);
		stmt.run(id);
	}

	public count(table: string): number {
		const collection = this.collection(table);
		const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${collection}`);
		const result = stmt.get() as { count: number };
		return result.count;
	}

	// Specific query for quicknotes
	public getLatestQuicknote(): any {
		const stmt = this.db.prepare(
			`SELECT * FROM notes WHERE noteType = 'quick' AND deletedAt IS NULL ORDER BY updatedAt DESC LIMIT 1`,
		);
		const result = stmt.get() as any;
		return this.normalizeRow(result);
	}

	public getQuicknoteByDate(start: string, end: string): any {
		const stmt = this.db.prepare(
			`SELECT * FROM notes WHERE noteType = 'quick' AND deletedAt IS NULL AND updatedAt >= ? AND updatedAt <= ? LIMIT 1`,
		);
		const result = stmt.get(start, end) as any;
		return this.normalizeRow(result);
	}

	public getRecentNotes(limit: number, workspacePath: string | null): any[] {
		const workspacePrefix = workspacePath
			? `${workspacePath.replace(/[\\/]+$/, "")}${path.sep}`
			: null;
		const stmt = this.db.prepare(
			`SELECT * FROM notes
			 WHERE noteType != 'template'
			   AND deletedAt IS NULL
			   AND (? IS NULL OR filePath IS NULL OR filePath = ? OR substr(filePath, 1, length(?)) = ?)
			 ORDER BY updatedAt DESC
			 LIMIT ?`,
		);
		const results = stmt.all(
			workspacePath,
			workspacePath,
			workspacePrefix,
			workspacePrefix,
			limit,
		) as any[];
		return results.map((row) => this.normalizeRow(row));
	}

	public getTemplates(): any[] {
		const stmt = this.db.prepare(
			`SELECT * FROM notes WHERE noteType = 'template' AND deletedAt IS NULL ORDER BY updatedAt DESC`,
		);
		const results = stmt.all() as any[];
		return results.map((row) => this.normalizeRow(row));
	}

	public softDeleteNote(id: string, deletedAt: string): void {
		this.db.transaction(() => {
			this.db
				.prepare("UPDATE notes SET deletedAt = ? WHERE id = ?")
				.run(deletedAt, id);
			this.db
				.prepare(
					"DELETE FROM tabs WHERE noteId = ? AND (type IS NULL OR type != 'ai-chat-tab')",
				)
				.run(id);
		})();
	}

	public hardDeleteNote(id: string): void {
		this.db.transaction(() => {
			this.db
				.prepare(
					"DELETE FROM aiMessages WHERE chatId IN (SELECT id FROM aiChats WHERE noteId = ?)",
				)
				.run(id);
			this.db.prepare("DELETE FROM aiChats WHERE noteId = ?").run(id);
			this.db.prepare("DELETE FROM tabs WHERE noteId = ?").run(id);
			this.db.prepare("DELETE FROM noteGroupMembers WHERE noteId = ?").run(id);
			this.db.prepare("DELETE FROM cursorPositions WHERE noteId = ?").run(id);
			this.db.prepare("DELETE FROM notes WHERE id = ?").run(id);
		})();
	}

	public restoreNote(id: string): void {
		this.db.prepare("UPDATE notes SET deletedAt = NULL WHERE id = ?").run(id);
	}

	public getTrashedNotes(): any[] {
		const stmt = this.db.prepare(
			`SELECT * FROM notes WHERE deletedAt IS NOT NULL ORDER BY deletedAt DESC`,
		);
		return (stmt.all() as any[]).map((row) => this.normalizeRow(row));
	}

	public emptyTrash(): void {
		this.db.prepare("DELETE FROM notes WHERE deletedAt IS NOT NULL").run();
	}

	public purgeTrashedNotesBefore(cutoff: string): void {
		this.db
			.prepare(
				"DELETE FROM notes WHERE deletedAt IS NOT NULL AND deletedAt < ?",
			)
			.run(cutoff);
	}

	public moveNoteToTrash(
		id: string,
		trashPath: string,
		originalFilePath: string | null,
		deletedAt: string,
	): void {
		this.db
			.prepare(
				"UPDATE notes SET filePath = ?, originalFilePath = ?, deletedAt = ? WHERE id = ?",
			)
			.run(trashPath, originalFilePath, deletedAt, id);
	}

	public restoreNoteFromTrash(id: string): void {
		this.db
			.prepare(
				"UPDATE notes SET filePath = originalFilePath, originalFilePath = NULL, deletedAt = NULL WHERE id = ? AND originalFilePath IS NOT NULL",
			)
			.run(id);
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
		const stmt = this.db.prepare(
			"DELETE FROM tabs WHERE noteId = ? AND (type IS NULL OR type != 'ai-chat-tab')",
		);
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

	public deleteNoteGroup(id: string): void {
		this.db.transaction(() => {
			this.db.prepare("DELETE FROM noteGroupMembers WHERE groupId = ?").run(id);
			this.db.prepare("DELETE FROM noteGroups WHERE id = ?").run(id);
		})();
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
			"SELECT * FROM notes WHERE filePath = ? AND deletedAt IS NULL LIMIT 1",
		);
		const result = stmt.get(filePath) as any;
		return this.normalizeRow(result);
	}
}

export const dbManager = DatabaseManager.getInstance;
