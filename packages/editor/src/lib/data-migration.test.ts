import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TERMINAL_TAB_TYPE } from "@/lib/tab-target";

const mocks = vi.hoisted(() => {
    const table = () => ({
        get: vi.fn(),
        add: vi.fn(),
        toArray: vi.fn(),
    });
    const tables = {
        notes: table(),
        tabs: table(),
        hashtags: table(),
        settings: table(),
        scripts: table(),
        noteHistory: table(),
    };
    return {
        tables,
        db: {
            ...tables,
            transaction: vi.fn(),
        },
    };
});

vi.mock("@/store/repositories/browser/dexie-db", () => ({
    db: mocks.db,
}));

const { exportToFile, importFromFile, startMigration } = await import("./data-migration");

const noteRecord = {
    id: "note-1",
    title: "Migration note",
    content: "# Body",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};
const noteTab = {
    id: "note-tab",
    noteId: noteRecord.id,
    order: 0,
    type: "note",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
};
const terminalTab = {
    ...noteTab,
    id: "terminal-tab",
    noteId: "terminal-session",
    type: TERMINAL_TAB_TYPE,
};
const migrationPayload = (overrides: Record<string, unknown> = {}) => ({
    type: "writeme-migration",
    version: 2,
    notes: [],
    tabs: [],
    hashtags: [],
    settings: [],
    scripts: [],
    noteHistory: [],
    ...overrides,
});
const backupFile = (payload: unknown) => ({ text: vi.fn().mockResolvedValue(JSON.stringify(payload)) }) as unknown as File;

beforeEach(() => {
    vi.clearAllMocks();
    for (const table of Object.values(mocks.tables)) {
        table.get.mockResolvedValue(undefined);
        table.add.mockResolvedValue(undefined);
        table.toArray.mockResolvedValue([]);
    }
    mocks.db.transaction.mockImplementation(async (...args: unknown[]) => {
        const work = args.at(-1) as () => Promise<unknown>;
        return work();
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("data migration", () => {
    it("imports valid collection records, restores history dates, and excludes terminal tabs", async () => {
        const hashtag = {
            id: "hashtag-1",
            hashtag: "work",
            filename: "migration.md",
            project: "",
            type: "hashtag",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        };
        const setting = { id: "setting-1", name: "theme", value: '"dark"' };
        const script = {
            id: "script-1",
            name: "Example",
            content: "console.log('migration')",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        };
        const history = { id: "history-1", noteId: "note-1", content: "# Saved", createdAt: "2026-01-01T00:00:00.000Z" };
        const counts = await importFromFile(
            backupFile(
                migrationPayload({
                    notes: [noteRecord],
                    tabs: [noteTab, terminalTab],
                    hashtags: [hashtag],
                    settings: [setting],
                    scripts: [script],
                    noteHistory: [history],
                }),
            ),
        );

        expect(mocks.tables.notes.add).toHaveBeenCalledWith(noteRecord);
        expect(mocks.tables.tabs.add).toHaveBeenCalledWith(noteTab);
        expect(mocks.tables.tabs.add).not.toHaveBeenCalledWith(terminalTab);
        expect(mocks.tables.hashtags.add).toHaveBeenCalledWith(hashtag);
        expect(mocks.tables.settings.add).toHaveBeenCalledWith(setting);
        expect(mocks.tables.scripts.add).toHaveBeenCalledWith(script);
        expect(mocks.tables.noteHistory.add).toHaveBeenCalledWith({
            ...history,
            createdAt: new Date(history.createdAt),
        });
        expect(counts).toMatchObject({ notes: 1, tabs: 1, hashtags: 1, settings: 1, scripts: 1, noteHistory: 1 });
    });


    it("rejects malformed record fields and dates before writing", async () => {
        await expect(
            importFromFile(
                backupFile(
                    migrationPayload({
                        notes: [{ ...noteRecord, title: 42, content: { invalid: true }, createdAt: "not-a-date" }],
                    }),
                ),
            ),
        ).rejects.toThrow("Invalid backup file format.");

        expect(mocks.db.transaction).not.toHaveBeenCalled();
        expect(mocks.tables.notes.add).not.toHaveBeenCalled();
    });

    it("leaves destination records untouched and makes no partial writes on conflicts", async () => {
        const existingTab = { ...noteTab, noteId: "different-note" };
        mocks.tables.tabs.get.mockResolvedValue(existingTab);

        await expect(
            importFromFile(
                backupFile(
                    migrationPayload({
                        notes: [{ ...noteRecord, id: "new-note", title: "New note" }],
                        tabs: [noteTab],
                    }),
                ),
            ),
        ).rejects.toThrow('"tabs" record "note-tab" already exists with different data');

        expect(mocks.tables.notes.add).not.toHaveBeenCalled();
        expect(mocks.tables.tabs.add).not.toHaveBeenCalled();
    });

    it("acknowledges cross-origin migration only after destination import completes", async () => {
        const popup = { postMessage: vi.fn() } as unknown as Window;
        vi.spyOn(window, "open").mockReturnValue(popup);
        const result = startMigration();
        window.dispatchEvent(
            new MessageEvent("message", {
                origin: "https://www.writeme.dev",
                source: popup,
                data: migrationPayload({ notes: [noteRecord] }),
            }),
        );

        await expect(result).resolves.toMatchObject({ notes: 1 });
        expect(popup.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: "writeme-migration-ack", status: "success" }),
            "https://www.writeme.dev",
        );
        expect(mocks.tables.notes.add).toHaveBeenCalledWith(noteRecord);
    });

    it("includes note history in exported backups", async () => {
        const noteHistory = [{ id: "history-1", noteId: "note-1", content: "# Saved", createdAt: new Date("2026-01-01T00:00:00.000Z") }];
        mocks.tables.noteHistory.toArray.mockResolvedValue(noteHistory);
        const createObjectURL = vi.fn((_object: Blob | MediaSource) => "blob:writeme-backup");
        const revokeObjectURL = vi.fn();
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => { });

        await exportToFile();

        const blob = createObjectURL.mock.calls[0]?.[0];
        if (!(blob instanceof Blob)) throw new Error("Expected exportToFile to create a Blob backup");
        const payload = JSON.parse(await blob.text()) as { noteHistory: unknown[] };
        expect(payload.noteHistory).toHaveLength(1);
        expect(click).toHaveBeenCalled();
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:writeme-backup");
    });
});
