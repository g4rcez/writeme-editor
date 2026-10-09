import { BashShell } from "@wterm/just-bash";
import { defineCommand } from "just-bash";
import type { ITerminalBackend, TerminalExitEvent } from "./types";

export type CommandHandler = (
    args: string[],
    terminal: { write: (data: string) => void; writeln: (data: string) => void },
) => Promise<void> | void;

const MAX_BUFFERED_INPUT = 64 * 1024;

export class CommandRegistry {
    private commands = new Map<string, CommandHandler>();

    register(name: string, handler: CommandHandler): void {
        this.commands.set(name, handler);
    }

    get(name: string): CommandHandler | undefined {
        return this.commands.get(name);
    }

    getAllNames(): string[] {
        return Array.from(this.commands.keys());
    }
}

export class WebTerminalBackend implements ITerminalBackend {
    private dataListeners: ((data: string) => void)[] = [];
    private shell: BashShell | null = null;
    private startPromise: Promise<void> | null = null;
    private pendingInput: string[] = [];
    private pendingInputSize = 0;
    private ready = false;
    private stopped = false;
    private inputOverflowReported = false;
    private registry = new CommandRegistry();

    public getRegistry(): CommandRegistry {
        return this.registry;
    }

    start(_cwd?: string | null): Promise<void> {
        if (this.startPromise) return this.startPromise;

        this.stopped = false;
        // The browser shell uses a virtual filesystem, never the host workspace path.
        const shell = new BashShell({
            cwd: "/workspace",
            prompt: (cwd) => `\x1b[1;32muser@writeme\x1b[0m:\x1b[1;34m${cwd}\x1b[0m$ `,
        });
        this.shell = shell;

        const startPromise = this.initialize(shell);
        this.startPromise = startPromise.catch((error: unknown) => {
            if (this.shell === shell) {
                this.shell = null;
                this.startPromise = null;
                this.ready = false;
                this.pendingInput = [];
                this.pendingInputSize = 0;
            }
            throw error;
        });
        return this.startPromise;
    }

    private async initialize(shell: BashShell): Promise<void> {
        await shell.attach((data) => {
            if (!this.stopped && this.shell === shell) this.emit(data);
        });
        if (this.stopped || this.shell !== shell) return;

        const bash = shell.bash;
        if (!bash) throw new Error("The browser shell did not initialize");

        for (const name of this.registry.getAllNames()) {
            const handler = this.registry.get(name);
            if (!handler) continue;

            bash.registerCommand(
                defineCommand(
                    name,
                    async (args) => {
                        const output: string[] = [];
                        try {
                            await handler(args, {
                                write: (data) => output.push(data),
                                writeln: (data) => output.push(`${data}\n`),
                            });
                            return { stdout: output.join(""), stderr: "", exitCode: 0 };
                        } catch (error) {
                            const message = error instanceof Error ? error.message : String(error);
                            return { stdout: output.join(""), stderr: `Error: ${message}\n`, exitCode: 1 };
                        }
                    },
                    { trusted: false },
                ),
            );
        }

        while (this.pendingInput.length > 0 && !this.stopped) {
            const input = this.pendingInput.shift();
            if (input === undefined) continue;
            this.pendingInputSize -= input.length;
            await this.handleInput(shell, input);
        }
        this.inputOverflowReported = false;
        this.ready = !this.stopped;
    }

    write(data: string): void {
        if (this.stopped) return;

        const shell = this.shell;
        if (!this.ready || !shell) {
            if (this.pendingInputSize + data.length > MAX_BUFFERED_INPUT) {
                if (!this.inputOverflowReported) {
                    this.emit("\r\n\x1b[31mInput was not accepted while the browser shell was starting.\x1b[0m\r\n");
                    this.inputOverflowReported = true;
                }
                return;
            }
            this.pendingInput.push(data);
            this.pendingInputSize += data.length;
            return;
        }

        void this.handleInput(shell, data);
    }

    private async handleInput(shell: BashShell, data: string): Promise<void> {
        try {
            await shell.handleInput(data);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.emit(`\r\n\x1b[31mShell error: ${message}\x1b[0m\r\n`);
        }
    }

    private emit(data: string): void {
        for (const listener of this.dataListeners) listener(data);
    }

    resize(_cols: number, _rows: number): void {}

    kill(): void {
        const shell = this.shell;
        this.stopped = true;
        this.ready = false;
        this.shell = null;
        this.startPromise = null;
        this.pendingInput = [];
        this.pendingInputSize = 0;

        if (shell) void shell.handleInput("\x03").catch(() => undefined);
        this.dataListeners = [];
    }

    onData(callback: (data: string) => void): { dispose: () => void } {
        this.dataListeners.push(callback);
        return {
            dispose: () => {
                this.dataListeners = this.dataListeners.filter((listener) => listener !== callback);
            },
        };
    }

    onExit(_callback: (event: TerminalExitEvent) => void): { dispose: () => void } {
        return { dispose: () => undefined };
    }
}
