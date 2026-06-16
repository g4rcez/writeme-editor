import type { ITerminalBackend, TerminalExitEvent } from "./types";

export class ElectronTerminalBackend implements ITerminalBackend {
	private onDataCallback: ((data: string) => void) | null = null;
	private onExitCallback: ((event: TerminalExitEvent) => void) | null = null;
	private removeDataListener: (() => void) | null = null;
	private removeExitListener: (() => void) | null = null;

	constructor(private readonly ptyId: string) {}

	start(cwd?: string | null): void {
		if (window.electronAPI?.terminal) {
			this.registerListeners();
			window.electronAPI.terminal.spawn(this.ptyId, cwd || undefined);
			return;
		}

		console.error("Electron API for terminal not available");
		this.onDataCallback?.(
			"\r\n\x1b[31mError: Terminal IPC not available\x1b[0m\r\n",
		);
	}

	write(data: string): void {
		window.electronAPI?.terminal?.write(this.ptyId, data);
	}

	resize(cols: number, rows: number): void {
		window.electronAPI?.terminal?.resize(this.ptyId, cols, rows);
	}

	kill(): void {
		window.electronAPI?.terminal?.kill(this.ptyId);
		this.removeDataListener?.();
		this.removeExitListener?.();
		this.removeDataListener = null;
		this.removeExitListener = null;
	}

	onData(callback: (data: string) => void): { dispose: () => void } {
		this.onDataCallback = callback;
		return {
			dispose: () => {
				this.onDataCallback = null;
			},
		};
	}

	onExit(callback: (event: TerminalExitEvent) => void): {
		dispose: () => void;
	} {
		this.onExitCallback = callback;
		return {
			dispose: () => {
				this.onExitCallback = null;
			},
		};
	}

	private registerListeners(): void {
		if (!window.electronAPI?.terminal || this.removeDataListener) return;

		this.removeDataListener = window.electronAPI.terminal.onData((data) => {
			if (data.id === this.ptyId) {
				this.onDataCallback?.(data.data);
			}
		});
		this.removeExitListener = window.electronAPI.terminal.onExit(
			(data: { id: string; exitCode?: number; signal?: number }) => {
				if (data.id === this.ptyId) {
					this.onExitCallback?.({
						exitCode: data.exitCode,
						signal: data.signal,
					});
				}
			},
		);
	}
}
