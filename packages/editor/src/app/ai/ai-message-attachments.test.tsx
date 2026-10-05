import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AIMessage } from "@/store/repositories/electron/ai.repository";
import { AIChatMessageItem } from "./ai-message-item";

describe("AIChatMessageItem attachments", () => {
    it("renders persisted attachment metadata for an attachment-only user message", () => {
        const message: AIMessage = {
            id: "message-1",
            chatId: "chat-1",
            role: "user",
            content: "",
            files: [{ id: "file-1", name: "research.pdf", mimeType: "application/pdf", size: 1_572_864 }],
            createdAt: "2026-01-01T00:00:00.000Z",
        };

        render(<AIChatMessageItem message={message} loadingIndex={0} />);

        expect(screen.getByRole("article", { name: "Your message" })).toBeInTheDocument();
        expect(screen.getByRole("list", { name: "Attached files" })).toHaveTextContent("research.pdf");
        expect(screen.getByRole("list", { name: "Attached files" })).toHaveTextContent("1.5 MiB");
        expect(screen.queryByRole("link", { name: "research.pdf" })).not.toBeInTheDocument();
    });
});
