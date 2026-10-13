import { afterEach, describe, expect, it, vi } from "vitest";
import { compileVimConfiguration } from "./compile";

class WorkerStub {
    static last: WorkerStub | undefined;
    onmessage: ((event: { data: unknown }) => void) | undefined;
    onerror: ((event: { message: string }) => void) | undefined;
    terminate = vi.fn();
    postMessage = vi.fn();
    constructor() {
        WorkerStub.last = this;
    }
}

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("Vim configuration worker", () => {
    it("terminates an endless script and rejects the pending validation", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("Worker", WorkerStub);
        const result = compileVimConfiguration("while (true) {}");
        const rejection = expect(result).rejects.toThrow("too long");
        await vi.advanceTimersByTimeAsync(3000);
        await rejection;
        expect(WorkerStub.last?.terminate).toHaveBeenCalledOnce();
    });

    it("validates the worker reply before returning settings", async () => {
        vi.stubGlobal("Worker", WorkerStub);
        const result = compileVimConfiguration("");
        WorkerStub.last?.onmessage?.({ data: { ok: true, configuration: { options: { timeout: -1 }, mappings: [] } } });
        await expect(result).rejects.toThrow("Invalid");
        expect(WorkerStub.last?.terminate).toHaveBeenCalledOnce();
    });
});
