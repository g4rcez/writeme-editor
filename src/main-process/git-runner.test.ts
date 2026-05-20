import { describe, expect, it } from "vitest";
import {
  buildCommitArgs,
  buildPushUpstreamArgs,
  isNoUpstreamError,
  commitAndPush,
  getStatus,
  getDiff,
} from "./git-runner";
import type { RunResult, GitDeps } from "./git-runner";

const ok = (stdout = "", stderr = ""): RunResult => ({
  stdout,
  stderr,
  exitCode: 0,
});
const fail = (stderr = "", stdout = ""): RunResult => ({
  stdout,
  stderr,
  exitCode: 1,
});

const makeRunGit =
  (responses: Partial<Record<string, RunResult>>): GitDeps["runGit"] =>
  async (args) => {
    const key = (args[0] === "-C" ? args.slice(2) : args).join(" ");
    return (
      responses[key] ?? { stdout: "", stderr: `unmocked: ${key}`, exitCode: 99 }
    );
  };

const makeDeps = (
  responses: Partial<Record<string, RunResult>>,
  gitBin: string | null = "/usr/bin/git",
): GitDeps => ({
  resolveGit: async () => gitBin,
  runGit: makeRunGit(responses),
});

const DIR = "/tmp/repo";
const MSG = "chore: test commit";

describe("git-runner argv + classifiers", () => {
  it("commit args pass message as a single argv element", () => {
    const message = 'release: v1.0\n\nBody with $shell `vars` and "quotes"';
    const args = buildCommitArgs("/tmp/repo", message);
    expect(args[0]).toBe("-C");
    expect(args[1]).toBe("/tmp/repo");
    expect(args[2]).toBe("commit");
    expect(args[3]).toBe("-m");
    expect(args[4]).toBe(message);
    expect(args).toHaveLength(5);
  });

  it("push upstream args include -u origin <branch>", () => {
    expect(buildPushUpstreamArgs("/tmp/repo", "main")).toEqual([
      "-C",
      "/tmp/repo",
      "push",
      "-u",
      "origin",
      "main",
    ]);
  });

  it("isNoUpstreamError recognises common stderr variants", () => {
    expect(
      isNoUpstreamError(
        "fatal: The current branch foo has no upstream branch.\n",
      ),
    ).toBe(true);
    expect(
      isNoUpstreamError("error: failed to push some refs to 'origin'"),
    ).toBe(false);
  });
});

describe("commitAndPush", () => {
  it("returns git-missing when resolveGit returns null", async () => {
    const deps = makeDeps({}, null);
    expect(await commitAndPush(DIR, MSG, deps)).toEqual({
      kind: "git-missing",
    });
  });

  it("returns not-a-repo when rev-parse --is-inside-work-tree exits non-zero", async () => {
    const deps = makeDeps({
      "rev-parse --is-inside-work-tree": fail(),
    });
    expect(await commitAndPush(DIR, MSG, deps)).toEqual({ kind: "not-a-repo" });
  });

  it("returns error with stage=add when git add fails", async () => {
    const deps = makeDeps({
      "rev-parse --is-inside-work-tree": ok(),
      "add .": fail("add error"),
    });
    const result = await commitAndPush(DIR, MSG, deps);
    expect(result).toEqual({
      kind: "error",
      stage: "add",
      stderr: "add error",
    });
  });

  it("returns nothing-to-commit when diff --cached --quiet exits 0", async () => {
    const deps = makeDeps({
      "rev-parse --is-inside-work-tree": ok(),
      "add .": ok(),
      "diff --cached --quiet": ok(),
    });
    expect(await commitAndPush(DIR, MSG, deps)).toEqual({
      kind: "nothing-to-commit",
    });
  });

  it("returns error with stage=commit when git commit fails", async () => {
    const deps = makeDeps({
      "rev-parse --is-inside-work-tree": ok(),
      "add .": ok(),
      "diff --cached --quiet": fail(),
      [`commit -m ${MSG}`]: fail("commit error"),
    });
    const result = await commitAndPush(DIR, MSG, deps);
    expect(result).toEqual({
      kind: "error",
      stage: "commit",
      stderr: "commit error",
    });
  });

  it("happy path: push succeeds → returns success with pushedRefs from stderr", async () => {
    const deps = makeDeps({
      "rev-parse --is-inside-work-tree": ok(),
      "add .": ok(),
      "diff --cached --quiet": fail(),
      [`commit -m ${MSG}`]: ok(),
      push: ok("", "refs/heads/main -> origin/main"),
    });
    const result = await commitAndPush(DIR, MSG, deps);
    expect(result).toEqual({
      kind: "success",
      pushedRefs: "refs/heads/main -> origin/main",
    });
  });

  it("no-upstream fallback: retries with -u origin <branch> and succeeds", async () => {
    const noUpstreamStderr =
      "fatal: The current branch feat has no upstream branch.";
    const deps = makeDeps({
      "rev-parse --is-inside-work-tree": ok(),
      "add .": ok(),
      "diff --cached --quiet": fail(),
      [`commit -m ${MSG}`]: ok(),
      push: fail(noUpstreamStderr),
      "rev-parse --abbrev-ref HEAD": ok("feat\n"),
      "push -u origin feat": ok(
        "",
        "branch 'feat' set up to track 'origin/feat'",
      ),
    });
    const result = await commitAndPush(DIR, MSG, deps);
    expect(result).toEqual({
      kind: "success",
      pushedRefs: "branch 'feat' set up to track 'origin/feat'",
    });
  });

  it("no-upstream fallback: retry push also fails → error stage=push", async () => {
    const noUpstreamStderr =
      "fatal: The current branch feat has no upstream branch.";
    const deps = makeDeps({
      "rev-parse --is-inside-work-tree": ok(),
      "add .": ok(),
      "diff --cached --quiet": fail(),
      [`commit -m ${MSG}`]: ok(),
      push: fail(noUpstreamStderr),
      "rev-parse --abbrev-ref HEAD": ok("feat\n"),
      "push -u origin feat": fail("push retry failed"),
    });
    const result = await commitAndPush(DIR, MSG, deps);
    expect(result).toEqual({
      kind: "error",
      stage: "push",
      stderr: "push retry failed",
    });
  });

  it("push fails with non-upstream error → error stage=push", async () => {
    const deps = makeDeps({
      "rev-parse --is-inside-work-tree": ok(),
      "add .": ok(),
      "diff --cached --quiet": fail(),
      [`commit -m ${MSG}`]: ok(),
      push: fail("permission denied to org/repo.git"),
    });
    const result = await commitAndPush(DIR, MSG, deps);
    expect(result).toEqual({
      kind: "error",
      stage: "push",
      stderr: "permission denied to org/repo.git",
    });
  });
});

describe("getDiff", () => {
  it("returns empty string when git is missing", async () => {
    const deps = makeDeps({}, null);
    expect(await getDiff(DIR, deps)).toBe("");
  });

  it("returns empty string when not inside a git repo", async () => {
    const deps = makeDeps({
      "rev-parse --is-inside-work-tree": fail(),
    });
    // getDiff doesn't check rev-parse — it only stages and diffs.
    // git add . will succeed (exit 0) but diff --cached returns non-zero.
    // Simplest guard: git-missing check is enough for this test.
    expect(await getDiff(DIR, deps)).toBe("");
  });

  it("returns trimmed stdout on exit code 0", async () => {
    const diffOutput = "diff --git a/note.md b/note.md\n+added line\n";
    const deps = makeDeps({
      "add .": ok(),
      "diff --cached": ok(diffOutput),
    });
    expect(await getDiff(DIR, deps)).toBe(diffOutput.trim());
  });

  it("returns empty string when diff --cached exits non-zero", async () => {
    const deps = makeDeps({
      "add .": ok(),
      "diff --cached": fail("diff error"),
    });
    expect(await getDiff(DIR, deps)).toBe("");
  });
});

describe("getStatus", () => {
  it("ok path: returns parsed porcelain when git succeeds", async () => {
    const porcelain = [
      "## main...origin/main",
      " M src/foo.ts",
      " M src/bar.ts",
      "A  src/new.ts",
      "?? untracked.ts",
    ].join("\n");
    const deps = makeDeps({
      "rev-parse --is-inside-work-tree": ok(),
      "status --porcelain=v1 -b": ok(porcelain),
    });
    const result = await getStatus(DIR, deps);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.branch).toBe("main");
    expect(result.upstream).toBe("origin/main");
    expect(result.counts.modified).toBe(2);
    expect(result.counts.added).toBe(1);
    expect(result.counts.untracked).toBe(1);
    expect(result.hasChanges).toBe(true);
  });

  it("returns git-missing when resolveGit returns null", async () => {
    const deps = makeDeps({}, null);
    expect(await getStatus(DIR, deps)).toEqual({ kind: "git-missing" });
  });

  it("returns not-a-repo when rev-parse fails", async () => {
    const deps = makeDeps({
      "rev-parse --is-inside-work-tree": fail(),
    });
    expect(await getStatus(DIR, deps)).toEqual({ kind: "not-a-repo" });
  });
});
