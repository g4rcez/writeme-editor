import { randomUUID } from "node:crypto";
import path from "node:path";
import { ensureAppRunning } from "../lib/launcher.ts";
import { getSocketPath } from "../lib/paths.ts";
import { sendToSocket } from "../lib/socket-client.ts";
import { OpenFolderArgsSchema } from "../schemas/open.ts";

export async function openFolder(rawFolderPath: string): Promise<void> {
    const folderPath = path.resolve(rawFolderPath);
    const args = OpenFolderArgsSchema.parse({ folderPath });
    const socketPath = getSocketPath();

    try {
        await sendToSocket(socketPath, {
            action: "open-folder",
            folderPath: args.folderPath,
            requestId: randomUUID(),
        });
    } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code === "ECONNREFUSED" || e.code === "ENOENT") {
            await ensureAppRunning(socketPath, ["--workspace", args.folderPath], {
                WRITEME_WORKSPACE: args.folderPath,
            });
            await sendToSocket(socketPath, {
                action: "open-folder",
                folderPath: args.folderPath,
                requestId: randomUUID(),
            });
        } else {
            throw err;
        }
    }
}
