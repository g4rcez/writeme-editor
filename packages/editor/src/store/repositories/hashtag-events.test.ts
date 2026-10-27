import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HASHTAGS_CHANGED_EVENT } from "@/lib/hashtag-events";
import { HashtagsRepository as BrowserHashtags } from "./browser/hashtags.repository";
import { HashtagsRepository as ElectronHashtags } from "./electron/hashtags.repository";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), sync: vi.fn() }));
vi.mock("./browser/dexie-db", () => ({ db: { transaction: mocks.transaction, hashtags: {} } }));

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("electronAPI", { db: { hashtags: { sync: mocks.sync } } });
});
afterEach(() => vi.unstubAllGlobals());

describe.each([
    { name: "browser", repository: new BrowserHashtags(), write: mocks.transaction },
    { name: "Electron", repository: new ElectronHashtags(), write: mocks.sync },
])("$name hashtag invalidation", ({ repository, write }) => {
    it("notifies readers only after a successful commit", async () => {
        let finish = (): void => {};
        const pending = new Promise<void>((resolve) => { finish = resolve; });
        write.mockReturnValueOnce(pending);
        const listener = vi.fn();
        window.addEventListener(HASHTAGS_CHANGED_EVENT, listener);
        try {
            const syncing = repository.sync("note", ["tag"]);
            expect(listener).not.toHaveBeenCalled();
            finish();
            await syncing;
            expect(listener).toHaveBeenCalledTimes(1);
        } finally {
            window.removeEventListener(HASHTAGS_CHANGED_EVENT, listener);
        }
    });

    it("does not notify readers when persistence fails", async () => {
        write.mockRejectedValueOnce(new Error("Storage unavailable"));
        const listener = vi.fn();
        window.addEventListener(HASHTAGS_CHANGED_EVENT, listener);
        try {
            await expect(repository.sync("note", ["tag"])).rejects.toThrow("Storage unavailable");
            expect(listener).not.toHaveBeenCalled();
        } finally {
            window.removeEventListener(HASHTAGS_CHANGED_EVENT, listener);
        }
    });
});
