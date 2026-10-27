import { spawn } from "child_process";
import { ipcMain } from "electron";
import which from "which";

const EXECUTION_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_CHARS = 1_000_000;

export const executionIpcHandler = () => {
    ipcMain.handle("execution:resolve", async (_, command: string) => {
        try {
            return await which(command);
        } catch {
            return null;
        }
    });

    ipcMain.handle("execution:run", async (event, command: string, args: string[] = [], code: string) => {
        return new Promise<{
            stdout: string;
            stderr: string;
            exitCode: number | null;
        }>((resolve) => {
            let stdout = "";
            let stderr = "";

            const child = spawn(command, args);

            const append = (current: string, data: Buffer) =>
                current.length >= MAX_OUTPUT_CHARS ? current : (current + data.toString()).slice(0, MAX_OUTPUT_CHARS);

            const timeout = setTimeout(() => {
                stderr += `\nExecution timed out after ${EXECUTION_TIMEOUT_MS / 1000}s`;
                child.kill("SIGKILL");
            }, EXECUTION_TIMEOUT_MS);
            const killOnDestroy = () => child.kill("SIGKILL");
            event.sender.once("destroyed", killOnDestroy);
            const cleanup = () => {
                clearTimeout(timeout);
                event.sender.removeListener("destroyed", killOnDestroy);
            };

            child.stdout.on("data", (data) => {
                stdout = append(stdout, data);
            });

            child.stderr.on("data", (data) => {
                stderr = append(stderr, data);
            });

            child.on("close", (exitCode) => {
                cleanup();
                resolve({ stdout, stderr, exitCode });
            });

            child.on("error", (err) => {
                cleanup();
                stderr += `Execution failed: ${err.message}`;
                resolve({ stdout, stderr, exitCode: -1 });
            });

            child.stdin.write(code);
            child.stdin.end();
        });
    });
};
