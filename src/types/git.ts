export type GitCounts = {
  modified: number;
  added: number;
  deleted: number;
  renamed: number;
  untracked: number;
  conflicted: number;
};

export type ParsedStatus = {
  branch: string;
  upstream: string | null;
  counts: GitCounts;
  hasChanges: boolean;
};

export type GitStatusResult =
  | { kind: "not-a-repo" }
  | { kind: "git-missing" }
  | ({ kind: "ok" } & ParsedStatus)
  | { kind: "error"; stderr: string };

export type GitPushStage = "add" | "commit" | "push";

export type GitPushResult =
  | { kind: "success"; pushedRefs: string }
  | { kind: "nothing-to-commit" }
  | { kind: "not-a-repo" }
  | { kind: "git-missing" }
  | { kind: "error"; stage: GitPushStage; stderr: string };
