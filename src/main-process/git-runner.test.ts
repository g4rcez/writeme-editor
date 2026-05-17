import { describe, expect, it } from "vitest";
import {
  buildCommitArgs,
  buildPushUpstreamArgs,
  isNoUpstreamError,
} from "./git-runner";

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
