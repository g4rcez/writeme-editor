import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObsidianImporter } from "./obsidian-importer";

const markdownFixture = [
    "---",
    "aliases: [Project Plan]",
    "tags: [research]",
    "---",
    "# Research plan",
    "",
    "[[Project|Roadmap]] and [[Project#Next steps]]",
    "",
    "- [ ] Review the source",
    "",
    "| Item | Status |",
    "| --- | --- |",
    "| Draft | Ready |",
    "",
    "$$",
    "x^2 + y^2 = z^2",
    "$$",
    "",
    "```ts",
    "const answer = 42;",
    "```",
    "",
    "![Diagram](./assets/diagram.svg)",
].join("\n");

const mocks = vi.hoisted(() => ({
    chooseObsidianVault: vi.fn(),
    readDirRecursive: vi.fn(),
    statFile: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    copyFile: vi.fn(),
    save: vi.fn(),
    getAll: vi.fn(),
    dispatchNotes: vi.fn(),
}));

vi.mock("@/store/global.store", () => ({
    repositories: { notes: { save: mocks.save, getAll: mocks.getAll } },
    useGlobalStore: () => [{}, { notes: mocks.dispatchNotes }],
}));

describe("ObsidianImporter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.chooseObsidianVault.mockResolvedValue("/vault");
        mocks.readDirRecursive.mockResolvedValue({
            success: true,
            files: [
                { name: "Idea.md", path: "/vault/Projects/Idea.md", relativePath: "Projects/Idea.md" },
                { name: "image.png", path: "/vault/assets/image.png", relativePath: "assets/image.png" },
                { name: "Existing.md", path: "/vault/Existing.md", relativePath: "Existing.md" },
            ],
        });
        mocks.statFile.mockImplementation(async (filePath: string) => ({
            success: true,
            exists: filePath === "/workspace/Existing.md",
        }));
        mocks.readFile.mockResolvedValue({
            success: true,
            content: "# Idea\n\n[[Other note]]",
            fileSize: 23,
            lastModified: "2026-01-01T00:00:00.000Z",
        });
        mocks.writeFile.mockResolvedValue({
            success: true,
            fileSize: 23,
            lastModified: "2026-01-01T00:00:00.000Z",
        });
        mocks.copyFile.mockResolvedValue({ success: true });
        mocks.save.mockResolvedValue(undefined);
        mocks.getAll.mockResolvedValue([]);

        Object.defineProperty(window, "electronAPI", {
            configurable: true,
            value: {
                fs: {
                    chooseObsidianVault: mocks.chooseObsidianVault,
                    readDirRecursive: mocks.readDirRecursive,
                    statFile: mocks.statFile,
                    readFile: mocks.readFile,
                    writeFile: mocks.writeFile,
                    copyFile: mocks.copyFile,
                },
            },
        });
    });

    it("copies notes and assets, preserves note content, and skips collisions", async () => {
        const user = userEvent.setup();
        render(<ObsidianImporter destinationDirectory="/workspace" />);

        await user.click(screen.getByRole("button", { name: "Choose vault" }));

        expect(await screen.findByText(/Imported 1 note and 1 asset/)).toBeInTheDocument();
        expect(screen.getByText(/Skipped 1 existing file/)).toBeInTheDocument();
        expect(mocks.readDirRecursive).toHaveBeenCalledWith("/vault", 32, true);
        expect(mocks.writeFile).toHaveBeenCalledWith("/workspace/Projects/Idea.md", "# Idea\n\n[[Other note]]");
        expect(mocks.copyFile).toHaveBeenCalledWith("/vault/assets/image.png", "/workspace/assets/image.png");
        expect(mocks.save).toHaveBeenCalledOnce();
        expect(mocks.dispatchNotes).toHaveBeenCalledWith([]);
    });

    it("copies Markdown constructs and relative asset links without rewriting them", async () => {
        mocks.readDirRecursive.mockResolvedValueOnce({
            success: true,
            files: [
                { name: "Plan.md", path: "/vault/Research/Plan.md", relativePath: "Research/Plan.md" },
                {
                    name: "diagram.svg",
                    path: "/vault/Research/assets/diagram.svg",
                    relativePath: "Research/assets/diagram.svg",
                },
            ],
        });
        mocks.readFile.mockResolvedValueOnce({
            success: true,
            content: markdownFixture,
            fileSize: markdownFixture.length,
            lastModified: "2026-01-01T00:00:00.000Z",
        });
        const user = userEvent.setup();
        render(<ObsidianImporter destinationDirectory="/workspace" />);

        await user.click(screen.getByRole("button", { name: "Choose vault" }));

        expect(await screen.findByText(/Imported 1 note and 1 asset/)).toBeInTheDocument();
        expect(mocks.writeFile).toHaveBeenCalledWith("/workspace/Research/Plan.md", markdownFixture);
        expect(mocks.copyFile).toHaveBeenCalledWith(
            "/vault/Research/assets/diagram.svg",
            "/workspace/Research/assets/diagram.svg",
        );
        expect(mocks.save.mock.calls[0]?.[0].content).toBe(markdownFixture);
    });

    it("rejects a destination inside the source vault before scanning", async () => {
        const user = userEvent.setup();
        render(<ObsidianImporter destinationDirectory="/vault/imported" />);

        await user.click(screen.getByRole("button", { name: "Choose vault" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("destination outside the Obsidian vault");
        expect(mocks.readDirRecursive).not.toHaveBeenCalled();
        expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    it("shows a chooser error and prevents a second concurrent import", async () => {
        const user = userEvent.setup();
        let resolveChooser: (value: string | null) => void = () => undefined;
        mocks.chooseObsidianVault.mockImplementation(
            () =>
                new Promise<string | null>((resolve) => {
                    resolveChooser = resolve;
                }),
        );
        render(<ObsidianImporter destinationDirectory="/workspace" />);

        const button = screen.getByRole("button", { name: "Choose vault" });
        await user.click(button);
        await waitFor(() => expect(button).toBeDisabled());
        expect(mocks.chooseObsidianVault).toHaveBeenCalledOnce();

        resolveChooser(null);
        await waitFor(() => expect(button).not.toBeDisabled());
    });
});
