import { spawn } from "node:child_process";
import net from "node:net";
import { getAppBinary } from "./paths.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForSocket(
  socketPath: string,
  retries: number,
  delayMs: number,
): Promise<void> {
  for (let i = 0; i < retries; i++) {
    await sleep(delayMs);
    const connected = await new Promise<boolean>((resolve) => {
      const c = net.createConnection(socketPath);
      c.on("connect", () => {
        c.end();
        resolve(true);
      });
      c.on("error", () => resolve(false));
    });
    if (connected) return;
  }
  throw new Error("Timed out waiting for writeme to start");
}

export async function ensureAppRunning(socketPath: string): Promise<void> {
  const binary = getAppBinary();
  const child = spawn(binary, [], { detached: true, stdio: "ignore" });
  child.unref();
  await waitForSocket(socketPath, 30, 300);
}
