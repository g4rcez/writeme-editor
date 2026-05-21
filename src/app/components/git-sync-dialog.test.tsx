import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import type { GitStatusResult, GitPushResult } from "@/types/git";

vi.mock("@/store/ui.store", () => ({
  useUIStore: vi.fn(),
}));

vi.mock("@/store/settings", () => ({
  SettingsService: {
    load: vi.fn(),
  },
}));

vi.mock("@g4rcez/components", () => ({
  Modal: ({
    children,
    title,
    open,
  }: {
    children: React.ReactNode;
    title: string;
    open: boolean;
    onChange?: (val: boolean) => void;
  }) =>
    open ? (
      <div data-testid="modal">
        <h1>{title}</h1>
        {children}
      </div>
    ) : null,
  Button: ({
    children,
    type,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    type?: "button" | "submit" | "reset";
    onClick?: () => void;
    disabled?: boolean;
    theme?: string;
  }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/app/notification-ref", () => ({
  notificationRef: { current: vi.fn() },
}));

vi.mock("@/lib/is-electron", () => ({
  isElectron: () => true,
}));

import { useUIStore } from "@/store/ui.store";
import { SettingsService } from "@/store/settings";
import { notificationRef } from "@/app/notification-ref";
import { GitSyncDialog } from "./git-sync-dialog";

const openGitDialog = vi.fn();
const closeGitDialog = vi.fn();

const makeUIStore = (open: boolean) => {
  (useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
    { gitDialog: { open } },
    { openGitDialog, closeGitDialog },
  ]);
};

const okStatus = (
  overrides: Partial<Extract<GitStatusResult, { kind: "ok" }>> = {},
): GitStatusResult => ({
  kind: "ok",
  branch: "main",
  upstream: "origin/main",
  counts: {
    modified: 2,
    added: 1,
    deleted: 0,
    renamed: 0,
    untracked: 3,
    conflicted: 0,
  },
  hasChanges: true,
  ...overrides,
});

describe("GitSyncDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (SettingsService.load as ReturnType<typeof vi.fn>).mockReturnValue({
      directory: "/tmp/notes",
    });
    makeUIStore(true);
    (window as Window & typeof globalThis).electronAPI = {
      git: {
        status: vi.fn(),
        commitAndPush: vi.fn(),
      },
    } as unknown as typeof window.electronAPI;
  });

  it("renders branch, upstream and counts label when status loads", async () => {
    window.electronAPI.git.status = vi.fn().mockResolvedValue(okStatus());

    render(<GitSyncDialog />);

    await waitFor(() => expect(screen.getByText("main")).toBeDefined());

    expect(screen.getByText(/origin\/main/)).toBeDefined();
    expect(screen.getByText(/M 2/)).toBeDefined();
    expect(screen.getByText(/A 1/)).toBeDefined();
    expect(screen.getByText(/\?\? 3/)).toBeDefined();

    const commitBtn = screen.getByRole("button", { name: "Commit & push" });
    expect(commitBtn).toHaveProperty("disabled", true);
  });

  it("enables Commit & push when message is typed and pushes successfully", async () => {
    window.electronAPI.git.status = vi.fn().mockResolvedValue(okStatus());
    const pushResult: GitPushResult = {
      kind: "success",
      pushedRefs: "refs/heads/main",
    };
    window.electronAPI.git.commitAndPush = vi
      .fn()
      .mockResolvedValue(pushResult);

    render(<GitSyncDialog />);

    await waitFor(() => screen.getByRole("button", { name: "Commit & push" }));

    const textarea = screen.getByPlaceholderText("Describe your changes");
    fireEvent.change(textarea, { target: { value: "my commit" } });

    const commitBtn = screen.getByRole("button", { name: "Commit & push" });
    expect(commitBtn).toHaveProperty("disabled", false);

    await act(async () => {
      fireEvent.click(commitBtn);
    });

    expect(window.electronAPI.git.commitAndPush).toHaveBeenCalledWith(
      "/tmp/notes",
      "my commit",
    );
    expect(closeGitDialog).toHaveBeenCalled();
    expect(
      (notificationRef.current as ReturnType<typeof vi.fn>).mock.calls[0]![1],
    ).toMatchObject({ theme: "success" });
  });

  it("submits via Cmd/Ctrl+Enter in the textarea", async () => {
    window.electronAPI.git.status = vi.fn().mockResolvedValue(okStatus());
    window.electronAPI.git.commitAndPush = vi
      .fn()
      .mockResolvedValue({ kind: "success", pushedRefs: "refs/heads/main" });

    render(<GitSyncDialog />);

    await waitFor(() => screen.getByRole("button", { name: "Commit & push" }));

    const textarea = screen.getByPlaceholderText("Describe your changes");
    fireEvent.change(textarea, { target: { value: "shortcut commit" } });

    await act(async () => {
      fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    });

    expect(window.electronAPI.git.commitAndPush).toHaveBeenCalledWith(
      "/tmp/notes",
      "shortcut commit",
    );
    expect(closeGitDialog).toHaveBeenCalled();
  });

  it("does not submit on Cmd+Enter when message is empty", async () => {
    window.electronAPI.git.status = vi.fn().mockResolvedValue(okStatus());
    window.electronAPI.git.commitAndPush = vi.fn();

    render(<GitSyncDialog />);

    await waitFor(() => screen.getByRole("button", { name: "Commit & push" }));

    const textarea = screen.getByPlaceholderText("Describe your changes");
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    expect(window.electronAPI.git.commitAndPush).not.toHaveBeenCalled();
  });

  it("shows nothing-to-commit toast and closes when push returns nothing-to-commit", async () => {
    window.electronAPI.git.status = vi.fn().mockResolvedValue(okStatus());
    const pushResult: GitPushResult = { kind: "nothing-to-commit" };
    window.electronAPI.git.commitAndPush = vi
      .fn()
      .mockResolvedValue(pushResult);

    render(<GitSyncDialog />);

    await waitFor(() => screen.getByRole("button", { name: "Commit & push" }));

    fireEvent.change(screen.getByPlaceholderText("Describe your changes"), {
      target: { value: "my commit" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Commit & push" }));
    });

    expect(closeGitDialog).toHaveBeenCalled();
    expect(
      (notificationRef.current as ReturnType<typeof vi.fn>).mock.calls[0]![1],
    ).toMatchObject({ theme: "info" });
  });

  it("renders not-a-repo state with Close button and no Commit button", async () => {
    const result: GitStatusResult = { kind: "not-a-repo" };
    window.electronAPI.git.status = vi.fn().mockResolvedValue(result);

    render(<GitSyncDialog />);

    await waitFor(() =>
      screen.getByText("Not a git repository", { selector: "p.font-medium" }),
    );

    expect(screen.queryByRole("button", { name: "Commit & push" })).toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toBeDefined();
  });

  it("renders git-missing state", async () => {
    const result: GitStatusResult = { kind: "git-missing" };
    window.electronAPI.git.status = vi.fn().mockResolvedValue(result);

    render(<GitSyncDialog />);

    await waitFor(() => screen.getByText("git not found"));
    expect(screen.getByText("git not found")).toBeDefined();
  });

  it("renders error state with stderr on push failure", async () => {
    window.electronAPI.git.status = vi.fn().mockResolvedValue(okStatus());
    const pushResult: GitPushResult = {
      kind: "error",
      stage: "push",
      stderr: "permission denied",
    };
    window.electronAPI.git.commitAndPush = vi
      .fn()
      .mockResolvedValue(pushResult);

    render(<GitSyncDialog />);

    await waitFor(() => screen.getByRole("button", { name: "Commit & push" }));

    fireEvent.change(screen.getByPlaceholderText("Describe your changes"), {
      target: { value: "my commit" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Commit & push" }));
    });

    await waitFor(() => screen.getByText("Git push failed"));

    expect(screen.getByText("Git push failed")).toBeDefined();
    const pre = screen.getByText("permission denied").closest("pre");
    expect(pre).not.toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
    expect(closeGitDialog).not.toHaveBeenCalled();
  });

  it("renders Working tree clean and disables Commit & push when hasChanges is false", async () => {
    window.electronAPI.git.status = vi.fn().mockResolvedValue(
      okStatus({
        hasChanges: false,
        counts: {
          modified: 0,
          added: 0,
          deleted: 0,
          renamed: 0,
          untracked: 0,
          conflicted: 0,
        },
      }),
    );

    render(<GitSyncDialog />);

    await waitFor(() => screen.getByText("Working tree clean"));

    fireEvent.change(screen.getByPlaceholderText("Describe your changes"), {
      target: { value: "some message" },
    });

    const commitBtn = screen.getByRole("button", { name: "Commit & push" });
    expect(commitBtn).toHaveProperty("disabled", true);
  });
});
