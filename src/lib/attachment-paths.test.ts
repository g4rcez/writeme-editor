import { describe, expect, it } from "vitest";

import { resolveLocalAssetCandidates } from "./attachment-paths";

describe("resolveLocalAssetCandidates", () => {
  it("resolves note-relative parent paths without leaving the project root", () => {
    expect(
      resolveLocalAssetCandidates({
        src: "../assets/pic.png",
        projectDir: "/vault",
        noteFilePath: "/vault/folder/note.md",
      }),
    ).toEqual(["/vault/assets/pic.png"]);
  });

  it("rejects traversal outside the project root", () => {
    expect(
      resolveLocalAssetCandidates({
        src: "../../secret.png",
        projectDir: "/vault",
        noteFilePath: "/vault/folder/note.md",
      }),
    ).toEqual([]);
  });

  it("strips query and hash before resolving local files", () => {
    expect(
      resolveLocalAssetCandidates({
        src: "attachments/pic.png?size=small#preview",
        projectDir: "/vault",
        noteFilePath: "/vault/note.md",
      }),
    ).toEqual(["/vault/attachments/pic.png"]);
  });
});
