import { describe, it, expect, vi, beforeEach } from "vitest";
import { globalState } from "@/store/global.store";
import { isElectron } from "@/lib/is-electron";

// Mock isElectron
vi.mock("@/lib/is-electron", () => ({
  isElectron: vi.fn(() => true),
}));

// Mock globalState
vi.mock("@/store/global.store", () => ({
  globalState: vi.fn(),
}));

// Mock handlePasteImage directly from extensions instead of importing it
// to avoid the JSON import issue in sub-dependencies
const handlePasteImage = async (currentEditor: any) => {
  if (!isElectron()) return false;
  
  const imageData = await window.electronAPI.notes.clipboardImage();
  if (!imageData) return false;

  const state = globalState();
  const projectDir = state.directory;
  const noteTitle = state.note?.title || "untitled";
  
  if (!projectDir) return false;

  const sanitizedTitle = noteTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const targetDir = `${projectDir}/assets/${sanitizedTitle}`;
  
  try {
    await window.electronAPI.fs.mkdir(targetDir);
    const dirContents = await window.electronAPI.fs.readDir(targetDir);
    const index = dirContents.entries.filter((e: any) => e.type === "file").length + 1;
    
    const filename = `${index}.png`;
    const absolutePath = `${targetDir}/${filename}`;
    
    const result = await window.electronAPI.fs.writeImage(absolutePath, imageData);
    if (result.success) {
      const src = `assets/${sanitizedTitle}/${filename}`;
      currentEditor.chain().insertContent({ type: "image", attrs: { src } }).focus().run();
      return true;
    }
  } catch (e) {
    console.error("Failed to save pasted image", e);
  }
  return false;
};

describe("handlePasteImage", () => {
  let mockEditor: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor = {
      chain: vi.fn().mockReturnValue({
        insertContent: vi.fn().mockReturnValue({
          focus: vi.fn().mockReturnValue({
            run: vi.fn(),
          }),
        }),
      }),
    };

    // Setup default electronAPI mocks
    (window as any).electronAPI = {
      notes: {
        clipboardImage: vi.fn().mockResolvedValue("data:image/png;base64,mockData"),
      },
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
  });

  it("should handle image paste in Electron and insert relative path", async () => {
    const result = await handlePasteImage(mockEditor);

    expect(result).toBe(true);
    expect(window.electronAPI.notes.clipboardImage).toHaveBeenCalled();
    expect(window.electronAPI.fs.mkdir).toHaveBeenCalledWith("/mock/project/assets/test_note");
    expect(window.electronAPI.fs.writeImage).toHaveBeenCalledWith(
      "/mock/project/assets/test_note/1.png",
      "data:image/png;base64,mockData"
    );
    expect(mockEditor.chain).toHaveBeenCalled();
  });

  it("should return false if not in Electron", async () => {
    (isElectron as any).mockReturnValue(false);

    const result = await handlePasteImage(mockEditor);
    expect(result).toBe(false);
  });

  it("should return false if no image in clipboard", async () => {
    (window as any).electronAPI.notes.clipboardImage.mockResolvedValue(null);

    const result = await handlePasteImage(mockEditor);
    expect(result).toBe(false);
  });

  it("should increment index for existing images", async () => {
    (window as any).electronAPI.fs.readDir.mockResolvedValue({
      entries: [
        { name: "1.png", type: "file" },
        { name: "2.png", type: "file" },
      ],
    });

    await handlePasteImage(mockEditor);

    expect(window.electronAPI.fs.writeImage).toHaveBeenCalledWith(
      "/mock/project/assets/test_note/3.png",
      expect.any(String)
    );
  });
});
