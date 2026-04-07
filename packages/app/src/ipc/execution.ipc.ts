import { ipcMain } from "electron";
import { spawn } from "child_process";
import which from "which";

export const executionIpcHandler = () => {
  ipcMain.handle("execution:resolve", async (_, command: string) => {
    try {
      return await which(command);
    } catch {
      return null;
    }
  });

  ipcMain.handle(
    "execution:run",
    async (_, command: string, args: string[] = [], code: string) => {
      return new Promise<{
        stdout: string;
        stderr: string;
        exitCode: number | null;
      }>((resolve) => {
        let stdout = "";
        let stderr = "";

        const child = spawn(command, args);

        child.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (exitCode) => {
          resolve({ stdout, stderr, exitCode });
        });

        child.on("error", (err) => {
          stderr += `Execution failed: ${err.message}`;
          resolve({ stdout, stderr, exitCode: -1 });
        });

        child.stdin.write(code);
        child.stdin.end();
      });
    },
  );
};
