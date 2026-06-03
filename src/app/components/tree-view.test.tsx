import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TreeNode } from "@/types/tree";
import { TreeView } from "./tree-view";

vi.mock("@/lib/is-electron", () => ({
  isElectron: () => true,
}));

type ContextMenuAction = {
  action: string;
  filePath: string;
  isDirectory: boolean;
};

describe("TreeView", () => {
  let contextMenuAction: ((action: ContextMenuAction) => void) | null = null;
  let directoryEntries: Record<string, TreeNode[]>;
  let readDir: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    contextMenuAction = null;
    directoryEntries = {
      "/workspace": [
        {
          name: "existing.md",
          path: "/workspace/existing.md",
          type: "file",
          extension: ".md",
        },
      ],
    };
    readDir = vi.fn(async (path: string) => ({
      entries: directoryEntries[path] ?? [],
    }));

    Object.assign(window, {
      electronAPI: {
        fs: {
          readDir,
          onDirChanged: vi.fn(() => vi.fn()),
        },
        contextMenu: {
          showExplorer: vi.fn(),
        },
        onContextMenuAction: vi.fn((callback) => {
          contextMenuAction = callback;
          return vi.fn();
        }),
      },
    });
  });

  it("creates a root file on Enter and refreshes the tree", async () => {
    const onNewFile = vi.fn(async (targetPath: string) => {
      directoryEntries["/workspace"] = [
        ...directoryEntries["/workspace"]!,
        {
          name: "draft.md",
          path: targetPath,
          type: "file",
          extension: ".md",
        },
      ];
      return true;
    });

    render(
      <TreeView
        rootPath="/workspace"
        map={new Map()}
        onFileSelect={vi.fn()}
        onNewFile={onNewFile}
      />,
    );

    expect(await screen.findByText("existing.md")).toBeInTheDocument();

    act(() => {
      contextMenuAction?.({
        action: "new-file",
        filePath: "/workspace",
        isDirectory: true,
      });
    });

    const input = await screen.findByRole("textbox");
    fireEvent.change(input, { target: { value: "draft" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(onNewFile).toHaveBeenCalledTimes(1);
      expect(onNewFile).toHaveBeenCalledWith("/workspace/draft.md");
      expect(readDir).toHaveBeenCalledTimes(2);
      expect(screen.getByText("draft.md")).toBeInTheDocument();
    });
  });

  it("indents a pending file input under the parent folder", async () => {
    directoryEntries["/workspace"] = [
      {
        name: "docs",
        path: "/workspace/docs",
        type: "directory",
      },
    ];
    directoryEntries["/workspace/docs"] = [];

    render(
      <TreeView
        rootPath="/workspace"
        map={new Map()}
        onFileSelect={vi.fn()}
        onNewFile={vi.fn()}
      />,
    );

    expect(await screen.findByText("docs")).toBeInTheDocument();

    act(() => {
      contextMenuAction?.({
        action: "new-file",
        filePath: "/workspace/docs",
        isDirectory: true,
      });
    });

    const input = await screen.findByRole("textbox");
    const pendingRow = input.parentElement;

    expect(pendingRow).toHaveStyle({ paddingLeft: "28px" });
    expect(pendingRow?.firstElementChild).toHaveClass("w-4");
  });
});
