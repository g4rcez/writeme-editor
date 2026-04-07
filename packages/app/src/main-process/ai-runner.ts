import { spawn, ChildProcess } from "node:child_process";
import { webContents } from "electron";

export class AIRunner {
  private static activeProcess: ChildProcess | null = null;

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
    this.stop();

    let command = commandTemplate;

    // Simple variable replacement for arguments
    // For stdin variables, we will handle them separately
    command = command.replace(/{{prompt}}/g, variables.prompt);
    command = command.replace(/{{system_prompt}}/g, variables.systemPrompt);

    // Check if we need to pipe to stdin
    const hasSelectionPipe = commandTemplate.includes("{{selection}}");
    const hasContextPipe = commandTemplate.includes("{{context}}");

    // If it has pipe variables, we remove them from the command string before spawning
    // as they will be passed via stdin
    const cleanCommand = command
      .replace(/{{selection}}/g, "")
      .replace(/{{context}}/g, "");

    console.log("AI Runner executing:", cleanCommand);

    try {
      // Use shell: true to support piping and redirections if they are part of the template
      this.activeProcess = spawn(cleanCommand, { shell: true });

      if (hasSelectionPipe) {
        this.activeProcess.stdin?.write(variables.selection);
      } else if (hasContextPipe) {
        this.activeProcess.stdin?.write(variables.context);
      }

      this.activeProcess.stdin?.end();

      this.activeProcess.stdout?.on("data", (data) => {
        const chunk = data.toString();
        sender.send("ai:chunk", { chunk });
      });

      this.activeProcess.stderr?.on("data", (data) => {
        console.error(`AI CLI Error: ${data}`);
      });

      this.activeProcess.on("close", (code) => {
        this.activeProcess = null;
        sender.send("ai:done", { code });
      });

      this.activeProcess.on("error", (err) => {
        console.error("Failed to start AI process:", err);
        sender.send("ai:error", { error: err.message });
        this.activeProcess = null;
      });
    } catch (error: any) {
      console.error("AI Runner Exception:", error);
      sender.send("ai:error", { error: error.message });
    }
  }

  public static stop(): void {
    if (this.activeProcess) {
      console.log("Stopping active AI process");
      this.activeProcess.kill("SIGTERM");
      this.activeProcess = null;
    }
  }
}
