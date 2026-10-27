// @vitest-environment node
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listeners, spawned } = vi.hoisted(() => ({
    listeners: new Map<string, (...args: any[]) => void>(),
    spawned: [] as Array<{
        kill: ReturnType<typeof vi.fn>;
        exit: (code?: number) => void;
        data: (chunk: string) => void;
    }>,
}));

vi.mock("electron", () => ({
    app: { getPath: () => "/tmp" },
    ipcMain: { on: vi.fn((channel: string, listener: (...args: any[]) => void) => void listeners.set(channel, listener)) },
}));
vi.mock("node-pty", () => ({
    spawn: vi.fn(() => {
        let onExit: (event: { exitCode: number; signal?: number }) => void = () => {};
        let onData: (chunk: string) => void = () => {};
        const pty = {
            kill: vi.fn(),
            write: vi.fn(),
            resize: vi.fn(),
            onData: (listener: typeof onData) => void (onData = listener),
            onExit: (listener: typeof onExit) => void (onExit = listener),
        };
        spawned.push({ kill: pty.kill, exit: (exitCode = 0) => onExit({ exitCode }), data: (chunk) => onData(chunk) });
        return pty;
    }),
}));

import { terminalIpcHandler } from "./terminal.ipc";

class Sender extends EventEmitter {
    destroyed = false;
    send = vi.fn();
    isDestroyed = () => this.destroyed;
}

let sender: Sender;
const spawn = (id: string) => listeners.get("terminal:spawn")!({ sender }, id);
const kill = (id: string) => listeners.get("terminal:kill")!({ sender }, id);

beforeEach(() => {
    listeners.clear();
    spawned.length = 0;
    sender = new Sender();
    terminalIpcHandler();
});

describe("terminal sessions", () => {
    it("keeps the new shell tracked when the replaced shell exits late", () => {
        spawn("tab-1");
        spawn("tab-1");
        const [replaced, current] = spawned;
        expect(replaced!.kill).toHaveBeenCalledTimes(1);

        // the old pty reports its exit only after the new one was registered under the same id
        replaced!.exit();
        kill("tab-1");

        expect(current!.kill).toHaveBeenCalledTimes(1);
        expect(sender.send).not.toHaveBeenCalledWith("terminal:exit", expect.anything());
    });

    it("does not announce an exit for a shell that was replaced", () => {
        spawn("tab-1");
        spawn("tab-1");
        spawned[0]!.exit();
        expect(sender.send.mock.calls.filter(([channel]) => channel === "terminal:exit")).toHaveLength(0);

        spawned[1]!.exit(3);
        expect(sender.send).toHaveBeenCalledWith("terminal:exit", { id: "tab-1", exitCode: 3, signal: undefined });
    });

    it("kills the shell when the window that owns it is destroyed", () => {
        spawn("tab-1");
        sender.destroyed = true;
        sender.emit("destroyed");
        expect(spawned[0]!.kill).toHaveBeenCalledTimes(1);
    });

    it("never sends to a destroyed window", () => {
        spawn("tab-1");
        sender.destroyed = true;
        spawned[0]!.data("output");
        spawned[0]!.exit();
        expect(sender.send).not.toHaveBeenCalled();
    });
});
