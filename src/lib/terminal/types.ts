export type TerminalExitEvent = {
	exitCode?: number;
	signal?: number;
};

export interface ITerminalBackend {
	/** Starts the backend process */
	start(cwd?: string | null): void;

	/** Writes data to the backend */
	write(data: string): void;

	/** Resizes the backend terminal */
	resize(cols: number, rows: number): void;

	/** Kills the backend process */
	kill(): void;

	/** Registers a callback for data from the backend */
	onData(callback: (data: string) => void): { dispose: () => void };

	/** Registers a callback for process exit events */
	onExit(callback: (event: TerminalExitEvent) => void): { dispose: () => void };
}
