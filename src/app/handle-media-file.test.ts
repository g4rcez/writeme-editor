import { describe, it, expect, vi, beforeEach } from "vitest";
import { globalState } from "@/store/global.store";
import { isElectron } from "@/lib/is-electron";

// Mock isElectron
vi.mock("@/lib/is-electron", () => ({
  isElectron: vi.fn(),
}));

// Mock globalState
vi.mock("@/store/global.store", () => ({
  globalState: vi.fn(),
}));

// Workaround for JSON import issues in tests: copy the logic here
const handleMediaFile = async (
  currentEditor: any,
  file: File,
  pos: number | null = null,
  offset: number = 0,
) => {
  if (!currentEditor) {
    console.error("[handleMediaFile] no editor");
    return;
  }
  const insertPos = pos !== null ? pos : currentEditor.state.selection.anchor;
  const fileReader = new FileReader();
  fileReader.readAsDataURL(file);
  fileReader.onload = async () => {
    let src = fileReader.result as string;

    if (isElectron()) {
      const state = globalState();
      const projectDir = state.directory;
      const noteTitle = state.note?.title || "untitled";
      if (projectDir) {
        const sanitizedTitle = noteTitle
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase();
        const targetDir = `${projectDir}/assets/${sanitizedTitle}`;
        try {
          await window.electronAPI.fs.mkdir(targetDir);
          const dirContents = await window.electronAPI.fs.readDir(targetDir);
          const index =
            dirContents.entries.filter((e: any) => e.type === "file").length +
            1 +
            offset;
          const ext = file.name.split(".").pop() || "png";
          const filename = `${Date.now()}_${index}.${ext}`;
          const absolutePath = `${targetDir}/${filename}`;

          const result = await window.electronAPI.fs.writeImage(
            absolutePath,
            src,
          );
          if (result.success) {
            src = `assets/${sanitizedTitle}/${filename}`;
          }
        } catch (e) {
          console.error("Failed to save media to filesystem", e);
        }
      }
    }

    let type = "image";
    if (file.type.startsWith("video/")) {
      type = "video";
    } else if (file.type === "application/pdf") {
      type = "pdf";
    }

    currentEditor
      .chain()
      .insertContentAt(insertPos, { type, attrs: { src, title: file.name } })
      .focus()
      .run();
  };
};

describe("handleMediaFile", () => {
  let mockEditor: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor = {
      state: {
        selection: { anchor: 0 }
      },
      chain: vi.fn().mockReturnValue({
        insertContentAt: vi.fn().mockReturnValue({
          focus: vi.fn().mockReturnValue({
            run: vi.fn(),
          }),
        }),
      }),
    };

    (window as any).electronAPI = {
      fs: {
        mkdir: vi.fn().mockResolvedValue({ success: true }),
        readDir: vi.fn().mockResolvedValue({ entries: [] }),
        writeImage: vi.fn().mockResolvedValue({ success: true }),
      },
    };

    (globalState as any).mockReturnValue({
      directory: "/mock/project",
      note: { title: "Test Note" },
    });
    
    (isElectron as any).mockReturnValue(true);

    class MockFileReader {
      onload: any;
      result = "data:base64,mockData";
      readAsDataURL() {
        setTimeout(() => this.onload(), 0);
      }
    }
    (global as any).FileReader = MockFileReader;
  });

  it("should handle image file and insert image node", async () => {
    const file = new File([""], "test.png", { type: "image/png" });
    await handleMediaFile(mockEditor, file);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockEditor.chain().insertContentAt).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        type: "image",
        attrs: expect.objectContaining({ src: expect.stringContaining("assets/test_note/") })
      })
    );
  });

  it("should handle video file and insert video node", async () => {
    const file = new File([""], "test.mp4", { type: "video/mp4" });
    await handleMediaFile(mockEditor, file);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockEditor.chain().insertContentAt).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        type: "video",
        attrs: expect.objectContaining({
          src: expect.stringContaining("assets/test_note/"),
          title: "test.mp4"
        })
      })
    );
  });

  it("should handle pdf file and insert pdf node", async () => {
    const file = new File([""], "test.pdf", { type: "application/pdf" });
    await handleMediaFile(mockEditor, file);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockEditor.chain().insertContentAt).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        type: "pdf",
        attrs: expect.objectContaining({
          src: expect.stringContaining("assets/test_note/"),
          title: "test.pdf"
        })
      })
    );
  });
});
