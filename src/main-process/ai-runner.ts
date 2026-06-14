import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

const COMMAND_DENYLIST = /[|&;()$`<>]/;
const ALLOWED_BASENAMES = new Set([
  "openai",
  "claude",
  "gemini",
  "ollama",
  "gptscript",
  "llm",
  "python",
  "node",
  "pnpm",
  "npm",
  "bun",
]);

function splitCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];

    if ((char === "'" || char === '"') && quote === null) {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = null;
      continue;
    }
    if (!quote && char === " ") {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    if (!quote && char === "\\" && i + 1 < command.length) {
      i += 1;
      current += command[i];
      continue;
    }
    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
}

function replaceVariables(
  command: string,
  variables: {
    prompt: string;
    selection: string;
    context: string;
    systemPrompt: string;
  },
) {
  return {
    command: command
      .replace(/{{prompt}}/g, variables.prompt)
      .replace(/{{system_prompt}}/g, variables.systemPrompt),
    hasSelectionPipe: command.includes("{{selection}}"),
    hasContextPipe: command.includes("{{context}}"),
  };
}

export class AIRunner {
  private static activeProcess: ChildProcess | null = null;

  private static validateCommandTokens(tokens: string[]): {
    ok: boolean;
    error?: string;
  } {
    if (tokens.length === 0) {
      return { ok: false, error: "AI command is empty" };
    }

    const executable = path.basename(tokens.at(0) ?? "");
    if (!executable || !ALLOWED_BASENAMES.has(executable)) {
      return {
        ok: false,
        error: `AI command executable '${executable}' is not allowed`,
      };
    }

    return { ok: true };
  }

  public static async run(
    commandTemplate: string,
    variables: {
      prompt: string;
      selection: string;
      context: string;
      systemPrompt: string;
    },
    sender: Electron.WebContents,
  ): Promise<void> {
    // Kill any existing process
    AIRunner.stop();

    const { command, hasSelectionPipe, hasContextPipe } = replaceVariables(
      commandTemplate,
      variables,
    );

    if (COMMAND_DENYLIST.test(command)) {
      sender.send("ai:error", {
        error: "AI command contains disallowed shell metacharacters",
      });
      return;
    }

    const tokens = splitCommand(command)
      .map((token) => token.trim())
      .filter(Boolean);

    const commandValidation = AIRunner.validateCommandTokens(tokens);
    if (!commandValidation.ok) {
      sender.send("ai:error", { error: commandValidation.error });
      return;
    }

    const cleanCommand = tokens
      .map((token) =>
        token.replace("{{selection}}", "").replace("{{context}}", ""),
      )
      .filter(Boolean);

    if (cleanCommand.length === 0) {
      sender.send("ai:error", { error: "AI command is invalid" });
      return;
    }

    console.log("AI Runner executing:", cleanCommand.join(" "));

    try {
      const [executable, ...args] = cleanCommand;

      if (!executable) {
        sender.send("ai:error", { error: "AI command is invalid" });
        return;
      }

      const process = spawn(executable, args, {
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      }) as ChildProcess;
      AIRunner.activeProcess = process;

      if (hasSelectionPipe) {
        process.stdin?.write(variables.selection);
      } else if (hasContextPipe) {
        process.stdin?.write(variables.context);
      }

      process.stdin?.end();

      process.stdout?.on("data", (data: Buffer) => {
        const chunk = data.toString();
        sender.send("ai:chunk", { chunk });
      });

      process.stderr?.on("data", (data: Buffer) => {
        console.error(`AI CLI Error: ${data}`);
      });

      process.on("close", (code: number | null) => {
        AIRunner.activeProcess = null;
        sender.send("ai:done", { code });
      });

      process.on("error", (err: NodeJS.ErrnoException) => {
        console.error("Failed to start AI process:", err);
        sender.send("ai:error", { error: err.message });
        AIRunner.activeProcess = null;
      });
    } catch (error: any) {
      console.error("AI Runner Exception:", error);
      sender.send("ai:error", { error: error.message });
    }
  }

  public static stop(): void {
    if (AIRunner.activeProcess) {
      console.log("Stopping active AI process");
      AIRunner.activeProcess.kill("SIGTERM");
      AIRunner.activeProcess = null;
    }
  }
}
