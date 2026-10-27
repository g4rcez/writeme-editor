import { describe, expect, it, vi } from "vitest";
import { createTabPersistenceQueue } from "./tab-persistence";

function deferred() {
    let resolve = (): void => {};
    const promise = new Promise<void>((done) => { resolve = done; });
    return { promise, resolve };
}

describe("tab persistence queue", () => {
    it("returns immediately and writes in order while flush waits for completion", async () => {
        const started = deferred();
        const gate = deferred();
        const calls: string[] = [];
        const queue = createTabPersistenceQueue(vi.fn());
        queue.enqueue(async () => {
            calls.push("save");
            started.resolve();
            await gate.promise;
        });
        queue.enqueue(async () => { calls.push("delete"); });
        expect(calls).toEqual([]);
        expect(queue.hasPending()).toBe(true);
        await started.promise;
        expect(calls).toEqual(["save"]);
        const flushed = vi.fn();
        const flushing = queue.flush().then(flushed);
        expect(flushed).not.toHaveBeenCalled();
        gate.resolve();
        await flushing;
        expect(calls).toEqual(["save", "delete"]);
        expect(queue.hasPending()).toBe(false);
    });

    it("retains failed writes and blocks later writes until an explicit retry", async () => {
        const report = vi.fn();
        const queue = createTabPersistenceQueue(report);
        const failure = new Error("Storage unavailable");
        const first = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
        const second = vi.fn().mockResolvedValue(undefined);
        queue.enqueue(first);
        queue.enqueue(second);
        await expect(queue.flush()).rejects.toBe(failure);
        expect(report).toHaveBeenCalledTimes(1);
        expect(queue.hasPending()).toBe(true);
        expect(second).not.toHaveBeenCalled();
        queue.retry();
        await queue.flush();
        expect(first).toHaveBeenCalledTimes(2);
        expect(second).toHaveBeenCalledTimes(1);
        expect(queue.hasPending()).toBe(false);
    });

    it("reports pending failures again when another tab action is queued", async () => {
        const report = vi.fn();
        const queue = createTabPersistenceQueue(report);
        queue.enqueue(async () => { throw new Error("offline"); });
        await expect(queue.flush()).rejects.toThrow("offline");
        const later = vi.fn().mockResolvedValue(undefined);
        queue.enqueue(later);
        expect(report).toHaveBeenCalledTimes(2);
        expect(later).not.toHaveBeenCalled();
    });

    it("includes writes queued while a flush is in progress", async () => {
        const queue = createTabPersistenceQueue(vi.fn());
        const later = vi.fn().mockResolvedValue(undefined);
        queue.enqueue(async () => { queue.enqueue(later); });
        await queue.flush();
        expect(later).toHaveBeenCalledTimes(1);
        expect(queue.hasPending()).toBe(false);
    });

    it("flushes an idle queue without writing", async () => {
        const report = vi.fn();
        const queue = createTabPersistenceQueue(report);
        await queue.flush();
        expect(queue.hasPending()).toBe(false);
        expect(report).not.toHaveBeenCalled();
    });
});
