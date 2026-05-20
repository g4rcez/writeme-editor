import {
  Fragment,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { Button, Modal } from "@g4rcez/components";
import { isElectron } from "@/lib/is-electron";
import { notificationRef } from "@/app/notification-ref";
import { SettingsService } from "@/store/settings";
import { useUIStore } from "@/store/ui.store";
import type { GitCounts, GitPushResult, GitStatusResult } from "@/types/git";
import { repositories } from "@/store/repositories";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "not-a-repo" }
  | { status: "git-missing" }
  | {
      status: "ready";
      branch: string;
      upstream: string | null;
      counts: GitCounts;
      hasChanges: boolean;
    }
  | {
      status: "pushing";
      branch: string;
      upstream: string | null;
      counts: GitCounts;
      hasChanges: boolean;
    }
  | { status: "error"; message: string; details: string };

type Action =
  | { type: "load" }
  | { type: "loaded"; result: GitStatusResult }
  | { type: "submit" }
  | { type: "pushed"; result: GitPushResult }
  | { type: "reset" };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "load":
      return { status: "loading" };
    case "loaded": {
      const r = action.result;
      if (r.kind === "git-missing") return { status: "git-missing" };
      if (r.kind === "not-a-repo") return { status: "not-a-repo" };
      if (r.kind === "error")
        return {
          status: "error",
          message: "Failed to read repository status",
          details: r.stderr,
        };
      return {
        status: "ready",
        branch: r.branch,
        upstream: r.upstream,
        counts: r.counts,
        hasChanges: r.hasChanges,
      };
    }
    case "submit":
      if (state.status !== "ready") return state;
      return { ...state, status: "pushing" };
    case "pushed": {
      const r = action.result;
      if (r.kind === "success" || r.kind === "nothing-to-commit") return state;
      if (r.kind === "git-missing") return { status: "git-missing" };
      if (r.kind === "not-a-repo") return { status: "not-a-repo" };
      return {
        status: "error",
        message: `Git ${r.stage} failed`,
        details: r.stderr,
      };
    }
    case "reset":
      return { status: "idle" };
  }
};

const countsLabel = (c: GitCounts): string => {
  const parts: string[] = [];
  if (c.modified) parts.push(`M ${c.modified}`);
  if (c.added) parts.push(`A ${c.added}`);
  if (c.deleted) parts.push(`D ${c.deleted}`);
  if (c.renamed) parts.push(`R ${c.renamed}`);
  if (c.untracked) parts.push(`?? ${c.untracked}`);
  if (c.conflicted) parts.push(`UU ${c.conflicted}`);
  return parts.length ? parts.join(" · ") : "Working tree clean";
};

const countsAriaLabel = (c: GitCounts): string => {
  const segs: string[] = [];
  if (c.modified) segs.push(`${c.modified} modified`);
  if (c.added) segs.push(`${c.added} added`);
  if (c.deleted) segs.push(`${c.deleted} deleted`);
  if (c.renamed) segs.push(`${c.renamed} renamed`);
  if (c.untracked) segs.push(`${c.untracked} untracked`);
  if (c.conflicted) segs.push(`${c.conflicted} conflicted`);
  return segs.length ? segs.join(", ") : "no changes";
};

export const GitSyncDialog = () => {
  const [ui, uiActions] = useUIStore();
  const [state, dispatch] = useReducer(reducer, { status: "idle" });
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const genRef = useRef(0);

  const open = ui.gitDialog.open;

  const handleClose = useCallback(() => {
    uiActions.closeGitDialog();
    dispatch({ type: "reset" });
    setMessage("");
    setGenerating(false);
  }, [uiActions]);

  useEffect(() => {
    if (!open) return;
    if (!isElectron()) return;
    const dir = SettingsService.load().directory;
    if (!dir) return;
    dispatch({ type: "load" });
    const myGen = ++genRef.current;
    window.electronAPI.git
      .status(dir)
      .then((result) => {
        if (genRef.current === myGen) dispatch({ type: "loaded", result });
      })
      .catch((err: unknown) => {
        if (genRef.current === myGen)
          dispatch({
            type: "loaded",
            result: {
              kind: "error",
              stderr: err instanceof Error ? err.message : String(err),
            },
          });
      });
    return () => {
      genRef.current++;
    };
  }, [open]);

  const submit = useCallback(async () => {
    if (state.status !== "ready") return;
    const dir = SettingsService.load().directory;
    if (!dir) return;
    const trimmed = message.trim();
    if (!trimmed) return;

    dispatch({ type: "submit" });
    let result: GitPushResult;
    try {
      result = await window.electronAPI.git.commitAndPush(dir, trimmed);
    } catch (err) {
      result = {
        kind: "error",
        stage: "push",
        stderr: err instanceof Error ? err.message : String(err),
      };
    }
    dispatch({ type: "pushed", result });

    if (result.kind === "success") {
      notificationRef.current?.(<span>Pushed to git.</span>, {
        theme: "success",
        closable: true,
        timeout: 4000,
      });
      handleClose();
      return;
    }
    if (result.kind === "nothing-to-commit") {
      notificationRef.current?.(<span>Nothing to commit.</span>, {
        theme: "info",
        closable: true,
        timeout: 4000,
      });
      handleClose();
      return;
    }
  }, [handleClose, message, state.status]);

  const generateMessage = useCallback(async () => {
    if (state.status !== "ready" || !state.hasChanges) return;
    if (!isElectron()) return;
    const dir = SettingsService.load().directory;
    if (!dir) return;

    const configs = await repositories.ai.getConfigs();
    const config = configs.find((c) => c.isDefault) ?? configs[0];
    if (!config) return;

    const diff = await window.electronAPI.git.diff(dir);
    if (!diff) return;

    const context = [
      "Generate a concise git commit message.",
      "Rules: subject line only, max 72 characters, imperative mood, no trailing period.",
      "Output ONLY the commit message — no explanation, no quotes, no markdown.",
      "",
      "Changes:",
      diff,
    ].join("\n");

    setGenerating(true);
    setMessage("");
    window.electronAPI.ai.query({
      commandTemplate: config.commandTemplate ?? "",
      prompt: "",
      selection: "",
      context,
      systemPrompt: "",
    });
  }, [state]);

  useEffect(() => {
    if (!generating) return;
    if (!isElectron()) return;
    let buf = "";
    const unChunk = window.electronAPI.ai.onChunk(({ chunk }) => {
      buf += chunk;
      setMessage(buf);
    });
    const unDone = window.electronAPI.ai.onDone(() => {
      setMessage(buf.trim().replace(/^["'\n]+|["'\n]+$/g, ""));
      setGenerating(false);
    });
    const unError = window.electronAPI.ai.onError(() => {
      setGenerating(false);
    });
    return () => {
      unChunk();
      unDone();
      unError();
    };
  }, [generating]);

  const retry = useCallback(() => {
    if (!isElectron()) return;
    const dir = SettingsService.load().directory;
    if (!dir) return;
    dispatch({ type: "load" });
    const myGen = ++genRef.current;
    window.electronAPI.git
      .status(dir)
      .then((result) => {
        if (genRef.current === myGen) dispatch({ type: "loaded", result });
      })
      .catch((err: unknown) => {
        if (genRef.current === myGen)
          dispatch({
            type: "loaded",
            result: {
              kind: "error",
              stderr: err instanceof Error ? err.message : String(err),
            },
          });
      });
  }, []);

  const srStatus =
    state.status === "loading"
      ? "Reading repository status"
      : state.status === "pushing"
        ? "Committing and pushing"
        : state.status === "error"
          ? `Error: ${state.message}`
          : state.status === "ready"
            ? `Ready on branch ${state.branch}`
            : state.status === "not-a-repo"
              ? "Not a git repository"
              : state.status === "git-missing"
                ? "Git not installed"
                : "";

  return (
    <Modal
      open={open}
      onChange={(val) => (val ? uiActions.openGitDialog() : handleClose())}
      title="Git sync"
    >
      <div className="flex flex-col gap-4 min-w-[28rem]">
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {srStatus}
        </p>

        {state.status === "idle" || state.status === "loading" ? (
          <p className="text-sm text-foreground/50">
            Reading repository status…
          </p>
        ) : null}

        {state.status === "git-missing" ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-medium">git not found</p>
            <p className="text-foreground/50">
              Install git and make sure it is on your PATH.
            </p>
            <div className="flex justify-end">
              <Button type="button" theme="ghost-muted" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        ) : null}

        {state.status === "not-a-repo" ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-medium">Not a git repository</p>
            <p className="text-foreground/50">
              Initialise the folder with <code>git init</code> and add a remote,
              then try again.
            </p>
            <div className="flex justify-end">
              <Button type="button" theme="ghost-muted" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        ) : null}

        {state.status === "ready" || state.status === "pushing" ? (
          <Fragment>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span>
                <span className="font-medium">{state.branch}</span>
                {state.upstream ? (
                  <span className="text-foreground/50">
                    {" "}
                    → {state.upstream}
                  </span>
                ) : (
                  <span className="text-foreground/50"> (no upstream)</span>
                )}
              </span>
              <span
                className="text-foreground/50"
                aria-label={countsAriaLabel(state.counts)}
              >
                {countsLabel(state.counts)}
              </span>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span>Commit message</span>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    (e.metaKey || e.ctrlKey) &&
                    state.status === "ready" &&
                    state.hasChanges &&
                    message.trim().length > 0
                  ) {
                    e.preventDefault();
                    submit();
                  }
                }}
                disabled={state.status === "pushing" || generating}
                className="border border-border rounded p-2 bg-background"
                placeholder="Describe your changes"
                autoFocus
              />
            </label>
            <div className="flex justify-end gap-2">
              {isElectron() ? (
                <Button
                  type="button"
                  theme="ghost-muted"
                  onClick={generateMessage}
                  disabled={
                    state.status === "pushing" ||
                    !state.hasChanges ||
                    generating
                  }
                >
                  <SparkleIcon className="mr-1.5 size-4" />
                  {generating ? "Generating…" : "Generate with AI"}
                </Button>
              ) : null}
              <Button
                type="button"
                theme="ghost-muted"
                onClick={handleClose}
                disabled={state.status === "pushing"}
              >
                Cancel
              </Button>
              <Button
                type="button"
                theme="primary"
                onClick={submit}
                disabled={
                  state.status === "pushing" ||
                  !state.hasChanges ||
                  message.trim().length === 0
                }
              >
                {state.status === "pushing" ? "Pushing…" : "Commit & push"}
              </Button>
            </div>
          </Fragment>
        ) : null}

        {state.status === "error" ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-medium">{state.message}</p>
            <pre className="bg-muted/50 border border-border rounded p-2 text-xs whitespace-pre-wrap break-all max-h-64 overflow-auto">
              {state.details}
            </pre>
            <div className="flex justify-end gap-2">
              <Button type="button" theme="ghost-muted" onClick={handleClose}>
                Close
              </Button>
              <Button type="button" theme="primary" onClick={retry}>
                Retry
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};
