import { spawn } from "node:child_process";
import which from "which";
import type { GitPushResult, GitStatusResult } from "@/types/git";
import { parsePorcelain } from "@/lib/git-porcelain";

export type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

const runGit = (args: string[], gitBin: string): Promise<RunResult> =>
  new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(gitBin, args, {
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("close", (exitCode) => resolve({ stdout, stderr, exitCode }));
    child.on("error", (err) =>
      resolve({ stdout, stderr: stderr + err.message, exitCode: -1 }),
    );
  });

const resolveGit = async (): Promise<string | null> => {
  try {
    return await which("git");
  } catch {
    return null;
  }
};

export const buildCommitArgs = (dir: string, message: string): string[] => [
  "-C",
  dir,
  "commit",
  "-m",
  message,
];

export const buildPushUpstreamArgs = (
  dir: string,
  branch: string,
): string[] => ["-C", dir, "push", "-u", "origin", branch];

export const isNoUpstreamError = (stderr: string): boolean =>
  /has no upstream branch/i.test(stderr);

export const getStatus = async (dir: string): Promise<GitStatusResult> => {
  const gitBin = await resolveGit();
  if (!gitBin) return { kind: "git-missing" };

  const inside = await runGit(
    ["-C", dir, "rev-parse", "--is-inside-work-tree"],
    gitBin,
  );
  if (inside.exitCode !== 0) return { kind: "not-a-repo" };

  const status = await runGit(
    ["-C", dir, "status", "--porcelain=v1", "-b"],
    gitBin,
  );
  if (status.exitCode !== 0)
    return { kind: "error", stderr: status.stderr || "git status failed" };

  const parsed = parsePorcelain(status.stdout);
  return { kind: "ok", ...parsed };
};

export const commitAndPush = async (
  dir: string,
  message: string,
): Promise<GitPushResult> => {
  const gitBin = await resolveGit();
  if (!gitBin) return { kind: "git-missing" };

  const inside = await runGit(
    ["-C", dir, "rev-parse", "--is-inside-work-tree"],
    gitBin,
  );
  if (inside.exitCode !== 0) return { kind: "not-a-repo" };

  const add = await runGit(["-C", dir, "add", "."], gitBin);
  if (add.exitCode !== 0)
    return {
      kind: "error",
      stage: "add",
      stderr: add.stderr || "git add failed",
    };

  const diff = await runGit(["-C", dir, "diff", "--cached", "--quiet"], gitBin);
  if (diff.exitCode === 0) return { kind: "nothing-to-commit" };

  const commit = await runGit(buildCommitArgs(dir, message), gitBin);
  if (commit.exitCode !== 0)
    return {
      kind: "error",
      stage: "commit",
      stderr: commit.stderr || "git commit failed",
    };

  const push = await runGit(["-C", dir, "push"], gitBin);
  if (push.exitCode === 0)
    return { kind: "success", pushedRefs: push.stderr || push.stdout };

  if (isNoUpstreamError(push.stderr)) {
    const branchRes = await runGit(
      ["-C", dir, "rev-parse", "--abbrev-ref", "HEAD"],
      gitBin,
    );
    const branch = branchRes.stdout.trim() || "HEAD";
    const retry = await runGit(buildPushUpstreamArgs(dir, branch), gitBin);
    if (retry.exitCode === 0)
      return { kind: "success", pushedRefs: retry.stderr || retry.stdout };
    return {
      kind: "error",
      stage: "push",
      stderr: retry.stderr || "git push failed",
    };
  }

  return {
    kind: "error",
    stage: "push",
    stderr: push.stderr || "git push failed",
  };
};
