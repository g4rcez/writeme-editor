import { stat } from "node:fs/promises";
import path from "node:path";

export type OpenTarget =
  | { type: "file"; filePath: string | null; wait: boolean }
  | { type: "folder"; folderPath: string };

export async function resolveOpenTarget(
  rawPath: string | null,
  wait: boolean,
): Promise<OpenTarget> {
  if (!rawPath) {
    return { type: "file", filePath: null, wait };
  }

  const absolutePath = path.resolve(rawPath);

  try {
    const pathStats = await stat(absolutePath);

    if (pathStats.isDirectory()) {
      return { type: "folder", folderPath: absolutePath };
    }
  } catch {
    // Preserve the existing CLI behavior when the path cannot be statted.
  }

  return { type: "file", filePath: absolutePath, wait };
}
