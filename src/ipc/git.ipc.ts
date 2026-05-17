import { ipcMain } from "electron";
import { existsSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";
import { z } from "zod";
import { commitAndPush, getStatus } from "../main-process/git-runner";
import type { GitPushResult, GitStatusResult } from "../types/git";

const DirSchema = z
  .string()
  .min(1)
  .refine((p) => isAbsolute(p), "must be absolute")
  .refine(
    (p) => existsSync(p) && statSync(p).isDirectory(),
    "must exist and be a directory",
  );

const MessageSchema = z.string().min(1).max(2048);

export const gitIpcHandler = () => {
  ipcMain.handle(
    "git:status",
    async (_, dir: unknown): Promise<GitStatusResult> => {
      const parsed = DirSchema.safeParse(dir);
      if (!parsed.success)
        return {
          kind: "error",
          stderr: parsed.error.issues[0]?.message ?? "invalid dir",
        };
      return getStatus(parsed.data);
    },
  );

  ipcMain.handle(
    "git:commitAndPush",
    async (_, dir: unknown, message: unknown): Promise<GitPushResult> => {
      const dirParsed = DirSchema.safeParse(dir);
      if (!dirParsed.success) {
        return {
          kind: "error",
          stage: "add",
          stderr: dirParsed.error.issues[0]?.message ?? "invalid dir",
        };
      }
      const msgParsed = MessageSchema.safeParse(message);
      if (!msgParsed.success) {
        return {
          kind: "error",
          stage: "commit",
          stderr: msgParsed.error.issues[0]?.message ?? "invalid message",
        };
      }
      return commitAndPush(dirParsed.data, msgParsed.data);
    },
  );
};
