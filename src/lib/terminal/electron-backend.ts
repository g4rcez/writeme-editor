import { type ITerminalBackend } from "./types";

export class ElectronTerminalBackend implements ITerminalBackend {
  private ptyId: string | null = null;
  private onDataCallback: ((data: string) => void) | null = null;
  private removeListener: (() => void) | null = null;

  start(cwd?: string | null): void {
    this.ptyId = Math.random().toString(36).substring(2, 15);
    if (window.electronAPI && window.electronAPI.terminal) {
      this.removeListener = window.electronAPI.terminal.onData((data: { id: string; data: string }) => {
        if (data.id === this.ptyId && this.onDataCallback) {
          this.onDataCallback(data.data);
        }
      });

      // Spawn the pty
      window.electronAPI.terminal.spawn(this.ptyId, cwd || undefined);
    } else {
      console.error("Electron API for terminal not available");
      if (this.onDataCallback) {
        this.onDataCallback("\r\n\x1b[31mError: Terminal IPC not available\x1b[0m\r\n");
      }
    }
  }

  write(data: string): void {
    if (this.ptyId && window.electronAPI && window.electronAPI.terminal) {
      window.electronAPI.terminal.write(this.ptyId, data);
    }
  }

  resize(cols: number, rows: number): void {
    if (this.ptyId && window.electronAPI && window.electronAPI.terminal) {
      window.electronAPI.terminal.resize(this.ptyId, cols, rows);
    }
  }

  kill(): void {
    if (this.ptyId && window.electronAPI && window.electronAPI.terminal) {
      window.electronAPI.terminal.kill(this.ptyId);
    }
    if (this.removeListener) {
      this.removeListener();
      this.removeListener = null;
    }
    this.ptyId = null;
  }

  onData(callback: (data: string) => void): { dispose: () => void } {
    this.onDataCallback = callback;
    return {
      dispose: () => {
        this.onDataCallback = null;
      },
    };
  }
}
