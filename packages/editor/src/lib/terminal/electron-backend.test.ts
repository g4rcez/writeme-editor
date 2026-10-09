import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElectronTerminalBackend } from "./electron-backend";

type TerminalAPI = NonNullable<Window["electronAPI"]>["terminal"];
type TerminalDataCallback = Parameters<TerminalAPI["onData"]>[0];
type TerminalExitCallback = Parameters<TerminalAPI["onExit"]>[0];

function createTerminalAPI() {
    let dataListener: TerminalDataCallback | null = null;
    let exitListener: TerminalExitCallback | null = null;
    const removeDataListener = vi.fn();
    const removeExitListener = vi.fn();
    const terminal = {
        spawn: vi.fn(),
        write: vi.fn(),
        resize: vi.fn(),
        kill: vi.fn(),
        onData: vi.fn((callback: TerminalDataCallback) => {
            dataListener = callback;
            return removeDataListener;
        }),
        onExit: vi.fn((callback: TerminalExitCallback) => {
            exitListener = callback;
            return removeExitListener;
        }),
    } satisfies TerminalAPI;

    return {
        terminal,
        removeDataListener,
        removeExitListener,
        emitData: (event: Parameters<TerminalDataCallback>[0]) => dataListener?.(event),
        emitExit: (event: Parameters<TerminalExitCallback>[0]) => exitListener?.(event),
    };
}

function installTerminalAPI(terminal: TerminalAPI | undefined): void {
    Object.defineProperty(window, "electronAPI", {
        configurable: true,
        value: terminal ? { terminal } : undefined,
    });
}

describe("ElectronTerminalBackend", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        Reflect.deleteProperty(window, "electronAPI");
        vi.restoreAllMocks();
    });

    it("spawns the requested session and routes only matching PTY events", async () => {
        const api = createTerminalAPI();
        installTerminalAPI(api.terminal);
        const backend = new ElectronTerminalBackend("session-1");
        const onData = vi.fn();
        const onExit = vi.fn();
        backend.onData(onData);
        backend.onExit(onExit);

        await backend.start("/workspace");

        expect(api.terminal.onData).toHaveBeenCalledOnce();
        expect(api.terminal.onExit).toHaveBeenCalledOnce();
        expect(api.terminal.spawn).toHaveBeenCalledWith("session-1", "/workspace");

        api.emitData({ id: "other-session", data: "ignored" });
        api.emitExit({ id: "other-session", exitCode: 1 });
        expect(onData).not.toHaveBeenCalled();
        expect(onExit).not.toHaveBeenCalled();

        api.emitData({ id: "session-1", data: "shell output" });
        api.emitExit({ id: "session-1", exitCode: 2, signal: 9 });
        expect(onData).toHaveBeenCalledWith("shell output");
        expect(onExit).toHaveBeenCalledWith({ exitCode: 2, signal: 9 });
    });

    it("forwards input and resize requests and removes IPC listeners when killed", async () => {
        const api = createTerminalAPI();
        installTerminalAPI(api.terminal);
        const backend = new ElectronTerminalBackend("session-2");
        await backend.start(null);

        backend.write("echo test\r");
        backend.resize(100, 40);
        backend.kill();

        expect(api.terminal.spawn).toHaveBeenCalledWith("session-2", undefined);
        expect(api.terminal.write).toHaveBeenCalledWith("session-2", "echo test\r");
        expect(api.terminal.resize).toHaveBeenCalledWith("session-2", 100, 40);
        expect(api.terminal.kill).toHaveBeenCalledWith("session-2");
        expect(api.removeDataListener).toHaveBeenCalledOnce();
        expect(api.removeExitListener).toHaveBeenCalledOnce();
    });

    it("reports a missing Electron terminal bridge through the data callback", async () => {
        installTerminalAPI(undefined);
        const backend = new ElectronTerminalBackend("session-3");
        const onData = vi.fn();
        backend.onData(onData);

        await expect(backend.start()).resolves.toBeUndefined();

        expect(onData).toHaveBeenCalledWith(expect.stringContaining("Terminal IPC not available"));
    });
});
