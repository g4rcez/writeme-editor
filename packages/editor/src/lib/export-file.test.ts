import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportFile, sanitizeFilename } from "./export-file";

const mocks = vi.hoisted(() => ({
    native: vi.fn(() => true),
    write: vi.fn(async () => ({ uri: "file:///cache/exports/note.md" })),
    share: vi.fn(async () => undefined),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: mocks.native } }));
vi.mock("@capacitor/filesystem", () => ({ Filesystem: { writeFile: mocks.write }, Directory: { Cache: "CACHE" } }));
vi.mock("@capacitor/share", () => ({ Share: { share: mocks.share } }));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("native file export", () => {
    it("writes a UTF-8 file to app cache and shares its native URI", async () => {
        await exportFile("note.md", new Blob(["hello"], { type: "text/markdown" }));
        expect(mocks.write).toHaveBeenCalledWith({
            path: "exports/note.md",
            directory: "CACHE",
            data: "aGVsbG8=",
            recursive: true,
        });
        expect(mocks.share).toHaveBeenCalledWith({
            title: "note.md",
            files: ["file:///cache/exports/note.md"],
            dialogTitle: "Export from Writeme",
        });
    });
    it("prevents titles from escaping the export directory", () => {
        expect(sanitizeFilename("../../secret.md")).toBe("-..-secret.md");
        expect(sanitizeFilename("/notes\\test\u0000.md")).toBe("-notes-test-.md");
    });
    it("propagates filesystem failures without opening the share sheet", async () => {
        mocks.write.mockRejectedValueOnce(new Error("Disk full"));
        await expect(exportFile("note.md", new Blob(["hello"]))).rejects.toThrow("Disk full");
        expect(mocks.share).not.toHaveBeenCalled();
    });
});
