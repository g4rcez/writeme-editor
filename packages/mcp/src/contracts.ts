export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type Row = Record<string, JsonValue>;

export type ReaderOptions = {
    profile: "production" | "development";
    dataDir: string;
    workspace?: string;
};

export type SavedNote = {
    id: string | null;
    ref: string;
    path: string | null;
    root: "workspace" | "templates" | "quicknotes" | null;
    title: string;
    noteType: string;
    tags: string[];
    favorite: boolean;
    project: string;
    createdAt: string | null;
    updatedAt: string | null;
    metadata: Row;
    content: string | null;
    source: "sqlite" | "filesystem";
    revision: string | null;
    error?: string;
};

export type CollectionName = "projects" | "noteGroups" | "noteGroupMembers" | "views" | "tabs";

export type WorkspaceSnapshot = {
    observedAt: string;
    profile: ReaderOptions["profile"];
    dataDir: string;
    workspace: string | null;
    roots: { kind: "workspace" | "templates" | "quicknotes"; path: string }[];
    storageMode: "database" | "filesystem";
    notes: SavedNote[];
    settings: Row;
    collections: Record<CollectionName, Row[]>;
    capabilities: Record<string, boolean>;
    complete: boolean;
    warnings: string[];
};

export type WorkspaceReader = {
    snapshot: () => Promise<WorkspaceSnapshot>;
    close: () => void;
};

export class ReaderError extends Error {
    public constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = "ReaderError";
    }
}
