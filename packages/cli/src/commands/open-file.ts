import { randomUUID } from "node:crypto";
import path from "node:path";
import { OpenFileArgsSchema } from "../schemas/open.ts";
import { getSocketPath } from "../lib/paths.ts";
import { sendToSocket } from "../lib/socket-client.ts";
import { ensureAppRunning } from "../lib/launcher.ts";

export async function openFile(
  rawFilePath: string | null,
  rawWait: boolean,
): Promise<void> {
  const filePath = rawFilePath ? path.resolve(rawFilePath) : null;
  const args = OpenFileArgsSchema.parse({ filePath, wait: rawWait });
  const socketPath = getSocketPath();

  try {
    await sendToSocket(socketPath, {
      action: "open-file",
      filePath: args.filePath,
      wait: args.wait,
      requestId: randomUUID(),
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ECONNREFUSED" || e.code === "ENOENT") {
      await ensureAppRunning(socketPath);
      await sendToSocket(socketPath, {
        action: "open-file",
        filePath: args.filePath,
        wait: args.wait,
        requestId: randomUUID(),
      });
    } else {
      throw err;
    }
  }
}
