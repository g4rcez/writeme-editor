import { describe, expect, it, vi } from "vitest";
import { createWorkspaceCompletionFileCache } from "./workspace-completion-files";

describe("workspace completion file cache", () => {
    it("shares pending scans and reuses results until filesystem changes", async () => {
        const cache = createWorkspaceCompletionFileCache();
        let changed: ((event: { dirPath: string }) => void) | undefined;
        const unsubscribe = vi.fn();
        const api = {
            readDirRecursive: vi.fn(async () => ({
                success: true,
                files: [{ name: "note.md", path: "/workspace/note.md", relativePath: "note.md" }],
            })),
            onDirChanged: (callback: (event: { dirPath: string }) => void) => {
                changed = callback;
                return unsubscribe;
            },
        };
        const first = cache.load("/workspace", api);
        const concurrent = cache.load("/workspace", api);
        expect(concurrent).toBe(first);
        await first;
        await cache.load("/workspace", api);
        expect(api.readDirRecursive).toHaveBeenCalledTimes(1);
        changed?.({ dirPath: "/workspace" });
        await cache.load("/workspace", api);
        expect(api.readDirRecursive).toHaveBeenCalledTimes(2);
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        cache.clear();
    });

    it("retries failures and keeps workspace roots isolated", async () => {
        const cache = createWorkspaceCompletionFileCache();
        const api = {
            readDirRecursive: vi
                .fn()
                .mockResolvedValueOnce({ success: false, files: [], error: "Disk unavailable" })
                .mockResolvedValue({ success: true, files: [] }),
        };
        await expect(cache.load("/one", api)).rejects.toThrow("Disk unavailable");
        await cache.load("/one", api);
        await cache.load("/two", api);
        expect(api.readDirRecursive).toHaveBeenCalledTimes(3);
        cache.clear();
    });

    it("refreshes expired results", async () => {
        const cache = createWorkspaceCompletionFileCache();
        const clock = vi.spyOn(Date, "now");
        const api = { readDirRecursive: vi.fn(async () => ({ success: true, files: [] })) };
        try {
            clock.mockReturnValue(0);
            await cache.load("/workspace", api);
            clock.mockReturnValue(30_001);
            await cache.load("/workspace", api);
            expect(api.readDirRecursive).toHaveBeenCalledTimes(2);
        } finally {
            cache.clear();
            clock.mockRestore();
        }
    });
});
