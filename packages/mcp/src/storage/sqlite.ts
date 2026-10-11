import { assertSupportedRuntime } from "../config.js";

export type ReadDatabase = {
    query: (sql: string) => { all: () => Record<string, unknown>[] };
    exec: (sql: string) => void;
    close: () => void;
};

export async function openReadonlyDatabase(location: string): Promise<ReadDatabase> {
    if (process.versions.bun) {
        const { Database } = await import("bun:sqlite");
        return new Database(location, { readonly: true, create: false });
    }
    assertSupportedRuntime();
    const { DatabaseSync } = await import("node:sqlite");
    const database = new DatabaseSync(location, { readOnly: true, allowExtension: false });
    return {
        query: (sql) => database.prepare(sql),
        exec: (sql) => database.exec(sql),
        close: () => database.close(),
    };
}
