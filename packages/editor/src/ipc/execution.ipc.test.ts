// @vitest-environment node
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { handlers } = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => Promise<any>>() }));

vi.mock("electron", () => ({
    ipcMain: { handle: vi.fn((channel: string, handler: (...args: any[]) => Promise<any>) => void handlers.set(channel, handler)) },
}));

import { executionIpcHandler } from "./execution.ipc";

const run = (command: string, args: string[], sender: EventEmitter = new EventEmitter()) =>
    handlers.get("execution:run")!({ sender }, command, args, "");

beforeEach(() => {
    handlers.clear();
    executionIpcHandler();
});

afterEach(() => vi.useRealTimers());

describe("execution:run", () => {
    it("caps the captured output instead of buffering everything", async () => {
        const result = await run(process.execPath, ["-e", "process.stdout.write('x'.repeat(5_000_000))"]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout.length).toBe(1_000_000);
    });

    it("kills a process that outlives the timeout", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const pending = run(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
        await vi.advanceTimersByTimeAsync(60_000);
        const result = await pending;
        expect(result.exitCode).toBeNull();
        expect(result.stderr).toContain("timed out");
    });

    it("kills the process when the window that started it is destroyed", async () => {
        const sender = new EventEmitter();
        const pending = run(process.execPath, ["-e", "setInterval(() => {}, 1000)"], sender);
        await new Promise((resolve) => setTimeout(resolve, 300));
        sender.emit("destroyed");
        const result = await pending;
        expect(result.exitCode).toBeNull();
        expect(sender.listenerCount("destroyed")).toBe(0);
    });

    it("leaves no listener on the window after a normal run", async () => {
        const sender = new EventEmitter();
        const result = await run(process.execPath, ["-e", "console.log('ok')"], sender);
        expect(result.stdout).toBe("ok\n");
        expect(sender.listenerCount("destroyed")).toBe(0);
    });
});
