import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandRegistry, WebTerminalBackend, type CommandHandler } from "./web-backend";

const mockShell = vi.hoisted(() => ({
    options: null as Record<string, unknown> | null,
    registerCommand: vi.fn(),
    inputs: [] as string[],
    attachGate: null as Promise<void> | null,
    attachError: null as Error | null,
    inputError: null as Error | null,
}));

const mockDefineCommand = vi.hoisted(() =>
    vi.fn((name: string, handler: (args: string[]) => Promise<unknown>, options: { trusted: boolean }) => ({
        name,
        handler,
        options,
    })),
);

vi.mock("@wterm/just-bash", () => ({
    BashShell: class {
        readonly bash = { registerCommand: mockShell.registerCommand };

        constructor(options: Record<string, unknown>) {
            mockShell.options = options;
        }

        async attach(write: (data: string) => void): Promise<void> {
            if (mockShell.attachGate) await mockShell.attachGate;
            if (mockShell.attachError) throw mockShell.attachError;
            write("shell-prompt");
        }

        async handleInput(data: string): Promise<void> {
            mockShell.inputs.push(data);
            if (mockShell.inputError) throw mockShell.inputError;
        }
    },
}));

vi.mock("just-bash", () => ({ defineCommand: mockDefineCommand }));

type RegisteredCommand = {
    name: string;
    handler: (args: string[]) => Promise<unknown>;
    options: { trusted: boolean };
};

function getRegisteredCommand(): RegisteredCommand {
    const command = mockShell.registerCommand.mock.calls[0]?.[0];
    if (!command) throw new Error("Expected a command to be registered");
    return command as RegisteredCommand;
}

describe("CommandRegistry", () => {
    it("replaces duplicate names without adding duplicate entries", () => {
        const registry = new CommandRegistry();
        const firstHandler: CommandHandler = () => undefined;
        const replacementHandler: CommandHandler = () => undefined;

        registry.register("inspect", firstHandler);
        registry.register("inspect", replacementHandler);

        expect(registry.getAllNames()).toStrictEqual(["inspect"]);
        expect(registry.get("inspect")).toBe(replacementHandler);
        expect(registry.get("missing")).toBeUndefined();
    });
});

describe("WebTerminalBackend", () => {
    beforeEach(() => {
        mockShell.options = null;
        mockShell.registerCommand.mockReset();
        mockShell.inputs = [];
        mockShell.attachGate = null;
        mockShell.attachError = null;
        mockShell.inputError = null;
        mockDefineCommand.mockReset();
        mockDefineCommand.mockImplementation((name, handler, options) => ({ name, handler, options }));
    });

    it("uses a virtual workspace and flushes buffered input after startup", async () => {
        const backend = new WebTerminalBackend();
        let output = "";
        const subscription = backend.onData((data) => {
            output += data;
        });
        backend.getRegistry().register("test-command", () => undefined);

        try {
            const startup = backend.start("/Users/example/real-workspace");
            expect(backend.start()).toBe(startup);
            backend.write("test-command");
            backend.write("\r");
            await startup;

            expect(mockShell.options).toMatchObject({ cwd: "/workspace" });
            expect(mockShell.registerCommand).toHaveBeenCalledTimes(1);
            expect(mockShell.inputs).toStrictEqual(["test-command", "\r"]);
            expect(output).toContain("shell-prompt");
            expect(output).not.toContain("/Users/example/real-workspace");
        } finally {
            subscription.dispose();
            backend.kill();
        }
    });

    it("limits startup input to 64 KiB and reports overflow once", async () => {
        let releaseAttach: (() => void) | undefined;
        mockShell.attachGate = new Promise<void>((resolve) => {
            releaseAttach = resolve;
        });

        const backend = new WebTerminalBackend();
        let output = "";
        const subscription = backend.onData((data) => {
            output += data;
        });
        const inputAtLimit = "x".repeat(64 * 1024);
        const startup = backend.start();

        backend.write(inputAtLimit);
        backend.write("x");
        backend.write("x");
        expect(output.match(/Input was not accepted while the browser shell was starting/g)).toHaveLength(1);

        releaseAttach?.();
        try {
            await startup;
            expect(mockShell.inputs).toStrictEqual([inputAtLimit]);
        } finally {
            subscription.dispose();
            backend.kill();
        }
    });

    it("retries startup after shell attachment fails", async () => {
        const backend = new WebTerminalBackend();
        mockShell.attachError = new Error("attach failed");

        await expect(backend.start()).rejects.toThrow("attach failed");

        mockShell.attachError = null;
        await expect(backend.start()).resolves.toBeUndefined();
        expect(mockShell.options).toMatchObject({ cwd: "/workspace" });
    });

    it("registers custom commands as untrusted and forwards their output", async () => {
        const backend = new WebTerminalBackend();
        const handler: CommandHandler = (_args, terminal) => {
            terminal.write("result");
            terminal.writeln("complete");
        };
        backend.getRegistry().register("inspect", handler);

        await backend.start();
        const command = getRegisteredCommand();
        const result = await command.handler(["--recent"]);

        expect(mockDefineCommand).toHaveBeenCalledWith("inspect", expect.any(Function), { trusted: false });
        expect(command.options).toStrictEqual({ trusted: false });
        expect(result).toStrictEqual({ stdout: "resultcomplete\n", stderr: "", exitCode: 0 });
        backend.kill();
    });

    it("returns command handler failures as stderr with a nonzero exit code", async () => {
        const backend = new WebTerminalBackend();
        backend.getRegistry().register("inspect", (_args, terminal) => {
            terminal.write("partial output");
            throw new Error("command failed");
        });

        await backend.start();
        const result = await getRegisteredCommand().handler([]);

        expect(result).toStrictEqual({
            stdout: "partial output",
            stderr: "Error: command failed\n",
            exitCode: 1,
        });
        backend.kill();
    });

    it("surfaces errors from an active shell", async () => {
        const backend = new WebTerminalBackend();
        let output = "";
        const subscription = backend.onData((data) => {
            output += data;
        });

        await backend.start();
        mockShell.inputError = new Error("input failed");
        backend.write("bad input");

        await vi.waitFor(() => {
            expect(output).toContain("Shell error: input failed");
        });
        subscription.dispose();
        backend.kill();
    });
});
