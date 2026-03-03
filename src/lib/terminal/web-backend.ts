import { type ITerminalBackend } from "./types";

export type CommandHandler = (
  args: string[],
  terminal: { write: (data: string) => void; writeln: (data: string) => void }
) => Promise<void> | void;

export class CommandRegistry {
  private commands = new Map<string, CommandHandler>();

  register(name: string, handler: CommandHandler) {
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
  private currentInput = "";
  private cwd = "/workspace";
  private registry = new CommandRegistry();

  constructor() {
    this.registerBuiltins();
  }

  private registerBuiltins() {
    this.registry.register("help", (_, term) => {
      term.writeln("Available commands:");
      term.writeln("  help      - Show this help message");
      term.writeln("  clear     - Clear the terminal");
      term.writeln("  echo      - Echo the arguments");
      term.writeln("  date      - Show current date and time");
      const customs = this.registry.getAllNames().filter(
        c => !["help", "clear", "echo", "date"].includes(c)
      );
      if (customs.length > 0) {
        term.writeln("  " + customs.join(", "));
      }
    });

    this.registry.register("clear", (_, term) => {
      // CSI 2 J clears the screen, CSI H moves cursor to top left
      term.write("\x1b[2J\x1b[H");
    });

    this.registry.register("echo", (args, term) => {
      term.writeln(args.join(" "));
    });

    this.registry.register("date", (_, term) => {
      term.writeln(new Date().toString());
    });
  }

  public getRegistry(): CommandRegistry {
    return this.registry;
  }

  start(cwd?: string | null): void {
    if (cwd) {
      this.cwd = cwd;
    }
    this.emit("\r\n\x1b[1;34mWriteme Web Terminal (Mock)\x1b[0m\r\n");
    this.prompt();
  }

  private prompt() {
    this.emit(`\r\n\x1b[1;32muser@writeme\x1b[0m:\x1b[1;34m${this.cwd}\x1b[0m$ `);
  }

  private emit(data: string) {
    for (const listener of this.dataListeners) {
      listener(data);
    }
  }

  write(data: string): void {
    // Basic terminal emulation
    switch (data) {
      case "\r": // Enter
        this.emit("\r\n");
        this.processCommand(this.currentInput.trim());
        this.currentInput = "";
        this.prompt();
        break;
      case "\x7f": // Backspace
      case "\b":
        if (this.currentInput.length > 0) {
          this.currentInput = this.currentInput.slice(0, -1);
          this.emit("\b \b");
        }
        break;
      case "\x03": // Ctrl+C
        this.emit("^C\r\n");
        this.currentInput = "";
        this.prompt();
        break;
      default:
        // Ignore control characters
        if (data >= String.fromCharCode(0x20) && data !== "\x7f") {
          this.currentInput += data;
          this.emit(data);
        }
    }
  }

  private async processCommand(input: string) {
    if (!input) return;
    const parts = input.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    if (parts.length === 0) return;
    const command = parts[0];
    const args = parts.slice(1).map(p => p.replace(/^"|"$/g, '')); // Strip surrounding quotes
    const handler = this.registry.get(command!);
    
    const termInterface = {
      write: (d: string) => this.emit(d),
      writeln: (d: string) => this.emit(d + "\r\n")
    };

    if (handler) {
      try {
        await handler(args, termInterface);
      } catch (err: any) {
        termInterface.writeln(`\x1b[31mError: ${err.message}\x1b[0m`);
      }
    } else {
      termInterface.writeln(`\x1b[31mCommand not found: ${command}\x1b[0m. Type 'help' for a list of commands.`);
    }
  }

  resize(cols: number, rows: number): void {
    // Web backend doesn't really need to do anything on resize
  }

  kill(): void {
    this.dataListeners = [];
  }

  onData(callback: (data: string) => void): { dispose: () => void } {
    this.dataListeners.push(callback);
    return {
      dispose: () => {
        this.dataListeners = this.dataListeners.filter((cb) => cb !== callback);
      },
    };
  }
}
