import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AIMessage } from "@/store/repositories/electron/ai.repository";
import { AIChatMessageItem, AIChatMessageList } from "./ai-message-item";

function createMessage(overrides: Partial<AIMessage>): AIMessage {
  return {
    id: overrides.id ?? "message-1",
    chatId: overrides.chatId ?? "chat-1",
    role: overrides.role ?? "assistant",
    content: overrides.content ?? "Hello",
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt,
    diffOriginal: overrides.diffOriginal,
    diffNew: overrides.diffNew,
    selectionSlice: overrides.selectionSlice,
    files: overrides.files,
  };
}

describe("AIChatMessageItem", () => {
  it("renders user and assistant messages as chat messages", () => {
    render(
      <AIChatMessageList
        messages={[
          createMessage({ id: "user-1", role: "user", content: "Hello AI" }),
          createMessage({
            id: "assistant-1",
            role: "assistant",
            content: "Hello **human**",
          }),
        ]}
        isStreaming={false}
        loadingMessageIndex={0}
      />,
    );

    expect(screen.getByLabelText("Your message")).toHaveTextContent("Hello AI");
    expect(screen.getByLabelText("Assistant message")).toHaveTextContent(
      "Hello human",
    );
  });

  it("renders system errors as alerts", () => {
    render(
      <AIChatMessageItem
        message={createMessage({
          role: "system",
          content: "Error: No adapter",
        })}
        loadingIndex={0}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Chat error");
    expect(screen.getByRole("alert")).toHaveTextContent("No adapter");
  });

  it("renders assistant markdown tables", () => {
    render(
      <AIChatMessageItem
        message={createMessage({
          role: "assistant",
          content: "| Topic | Count |\n| --- | ---: |\n| Notes | 3 |",
        })}
        loadingIndex={0}
      />,
    );

    expect(screen.getByRole("table")).toHaveTextContent("Notes");
  });

  it("renders an empty assistant fallback", () => {
    render(
      <AIChatMessageItem
        message={createMessage({ role: "assistant", content: "" })}
        loadingIndex={0}
      />,
    );

    expect(
      screen.getByText("No assistant response was returned."),
    ).toBeInTheDocument();
  });
});
