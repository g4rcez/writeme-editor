import { Database } from "bun:sqlite";
import type { Hashtag, Note, Project, Setting } from "../types.ts";
import { getDbPath } from "./paths.ts";

export type QueryNotesOptions = {
    tag?: string;
    type?: string;
    search?: string;
    limit: number;
};

export type QueryTagsOptions = {
    note?: string;
};

export function queryNotes(opts: QueryNotesOptions, dbPath = getDbPath()): Note[] {
    const db = new Database(dbPath, { readonly: true });
    try {
        const limit = Math.min(opts.limit, 1000);
        const conditions: string[] = [];
        const bindParams: (string | number)[] = [];

        if (opts.type) {
            conditions.push("noteType = ?");
            bindParams.push(opts.type);
        }
        if (opts.search) {
            conditions.push("(title LIKE ? OR content LIKE ?)");
            bindParams.push(`%${opts.search}%`, `%${opts.search}%`);
        }

        if (opts.tag) {
            const whereClause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
            const sql = `
        SELECT DISTINCT n.id, n.title, n.content, n.noteType, n.filePath,
          n.tags, n.project, n.createdAt, n.updatedAt, n.favorite, n.url, n.description
        FROM notes n
        INNER JOIN hashtags h ON h.filename = n.filePath
        WHERE h.hashtag = ? ${whereClause}
        ORDER BY n.updatedAt DESC
        LIMIT ?
      `;
            return db.prepare(sql).all(opts.tag, ...bindParams, limit) as Note[];
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const sql = `
      SELECT id, title, content, noteType, filePath, tags, project,
        createdAt, updatedAt, favorite, url, description
      FROM notes
      ${whereClause}
      ORDER BY updatedAt DESC
      LIMIT ?
    `;
        return db.prepare(sql).all(...bindParams, limit) as Note[];
    } finally {
        db.close();
    }
}

export function queryTags(opts: QueryTagsOptions, dbPath = getDbPath()): Hashtag[] {
    const db = new Database(dbPath, { readonly: true });
    try {
        if (opts.note) {
            const noteRow = db.prepare("SELECT filePath FROM notes WHERE id = ? LIMIT 1").get(opts.note) as {
                filePath: string | null;
            } | null;
            const filePath = noteRow?.filePath ?? null;
            if (!filePath) return [];
            return db
                .prepare("SELECT * FROM hashtags WHERE filename = ? ORDER BY hashtag ASC")
                .all(filePath) as Hashtag[];
        }
        return db.prepare("SELECT * FROM hashtags ORDER BY hashtag ASC").all() as Hashtag[];
    } finally {
        db.close();
    }
}

export function querySettings(dbPath = getDbPath()): Setting[] {
    const db = new Database(dbPath, { readonly: true });
    try {
        return db.prepare("SELECT * FROM settings ORDER BY name ASC").all() as Setting[];
    } finally {
        db.close();
    }
}

export function queryProjects(dbPath = getDbPath()): Project[] {
    const db = new Database(dbPath, { readonly: true });
    try {
        return db.prepare("SELECT * FROM projects ORDER BY title ASC").all() as Project[];
    } finally {
        db.close();
    }
}
