import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AIAdapter, AIFile } from "./adapters/types";
import { AI_FILE_CAPABILITIES } from "./adapters/types";
import { AIFileAttachment, useAIFileAttachments } from "./ai-file-attachment";

function createAdapter(
    prepareFile: AIAdapter["prepareFile"],
    fileCapabilities = AI_FILE_CAPABILITIES.anthropic,
): AIAdapter {
    return {
        id: "test",
        name: "Test provider",
        supportsFiles: true,
        fileCapabilities,
        supportsOAuth: false,
        defaultModel: "test",
        async auth() {
            return {};
        },
        async refresh(credentials) {
            return credentials;
        },
        isExpired() {
            return false;
        },
        async listModels() {
            return [];
        },
        prepareFile,
        async *sendMessage() {
            yield { type: "done" };
        },
    };
}

function Harness({ adapter }: { adapter: AIAdapter }) {
    const [files, setFiles] = useState<AIFile[]>([]);
    const controller = useAIFileAttachments({ files, onFilesChange: setFiles, adapter });
    return <AIFileAttachment files={files} controller={controller} />;
}

describe("AIFileAttachment", () => {
    it("shows preparation, appends concurrent selections, resets input, and removes files", async () => {
        const resolvers: Array<(file: AIFile) => void> = [];
        const adapter = createAdapter(
            vi.fn(
                (_file: File) =>
                    new Promise<AIFile>((resolve) => {
                        resolvers.push((prepared) => resolve(prepared));
                    }),
            ),
        );
        render(<Harness adapter={adapter} />);
        const input = screen.getByLabelText("Choose attachment files");
        const first = new File(["first"], "first.txt", { type: "text/plain" });
        const second = new File(["second"], "second.txt", { type: "text/plain" });

        fireEvent.change(input, { target: { files: [first] } });
        fireEvent.change(input, { target: { files: [second] } });
        expect(screen.getByRole("status")).toHaveTextContent("Preparing attachments");
        expect(input).toHaveValue("");

        await waitFor(() => expect(resolvers).toHaveLength(1));
        resolvers[0]?.({ id: "first", name: "first.txt", mimeType: "text/plain", size: 5, data: new ArrayBuffer(5) });
        await waitFor(() => expect(resolvers).toHaveLength(2));
        resolvers[1]?.({ id: "second", name: "second.txt", mimeType: "text/plain", size: 6, data: new ArrayBuffer(6) });

        await screen.findByText("first.txt");
        await screen.findByText("second.txt");
        fireEvent.click(screen.getByRole("button", { name: "Remove first.txt" }));
        expect(screen.queryByText("first.txt")).not.toBeInTheDocument();
        expect(screen.getByText("second.txt")).toBeInTheDocument();
    });

    it("discards an old provider result when the adapter changes during preparation", async () => {
        let resolvePreparation: ((file: AIFile) => void) | undefined;
        const previousAdapter = createAdapter(
            vi.fn(
                () =>
                    new Promise<AIFile>((resolve) => {
                        resolvePreparation = resolve;
                    }),
            ),
        );
        const nextAdapter = createAdapter(vi.fn());
        const { rerender } = render(<Harness adapter={previousAdapter} />);

        fireEvent.change(screen.getByLabelText("Choose attachment files"), {
            target: { files: [new File(["old"], "old.txt", { type: "text/plain" })] },
        });
        await waitFor(() => expect(resolvePreparation).toBeDefined());
        rerender(<Harness adapter={nextAdapter} />);
        resolvePreparation?.({
            id: "old",
            name: "old.txt",
            mimeType: "text/plain",
            size: 3,
            data: new ArrayBuffer(3),
        });

        await waitFor(() => expect(screen.queryByText("Preparing attachments…")).not.toBeInTheDocument());
        expect(screen.queryByText("old.txt")).not.toBeInTheDocument();
    });

    it("prepares a file selected immediately after switching providers", async () => {
        let resolveOldPreparation: ((file: AIFile) => void) | undefined;
        const previousAdapter = createAdapter(
            vi.fn(
                () =>
                    new Promise<AIFile>((resolve) => {
                        resolveOldPreparation = resolve;
                    }),
            ),
        );
        const nextAdapter = createAdapter(
            vi.fn(async (file) => ({
                id: "new",
                name: file.name,
                mimeType: file.type,
                size: file.size,
                data: await file.arrayBuffer(),
            })),
        );
        const { rerender } = render(<Harness adapter={previousAdapter} />);
        const input = screen.getByLabelText("Choose attachment files");

        fireEvent.change(input, {
            target: { files: [new File(["old"], "old.txt", { type: "text/plain" })] },
        });
        await waitFor(() => expect(resolveOldPreparation).toBeDefined());
        rerender(<Harness adapter={nextAdapter} />);
        fireEvent.change(input, {
            target: { files: [new File(["new"], "new.txt", { type: "text/plain" })] },
        });

        await screen.findByText("new.txt");
        resolveOldPreparation?.({
            id: "old",
            name: "old.txt",
            mimeType: "text/plain",
            size: 3,
            data: new ArrayBuffer(3),
        });
        await waitFor(() => expect(screen.queryByText("Preparing attachments…")).not.toBeInTheDocument());
        expect(screen.queryByText("old.txt")).not.toBeInTheDocument();
        expect(nextAdapter.prepareFile).toHaveBeenCalledTimes(1);
    });

    it("announces rejected files with a dismiss action", () => {
        const adapter = createAdapter(vi.fn(), AI_FILE_CAPABILITIES.rasterImages);
        render(<Harness adapter={adapter} />);

        fireEvent.change(screen.getByLabelText("Choose attachment files"), {
            target: { files: [new File(["doc"], "report.pdf", { type: "application/pdf" })] },
        });

        expect(screen.getByRole("alert")).toHaveTextContent("report.pdf");
        expect(screen.getByRole("alert")).toHaveTextContent("does not support");
        fireEvent.click(screen.getByRole("button", { name: "Dismiss attachment errors" }));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});
