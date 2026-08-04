import { describe, expect, it } from "vitest";
import type { AIFile } from "./types";
import { mapAnthropicMessages } from "./anthropic.adapter";

function attachment(overrides: Partial<AIFile> = {}): AIFile {
    return {
        id: overrides.id ?? "file-1",
        name: overrides.name ?? "photo.png",
        mimeType: overrides.mimeType ?? "image/png",
        data: overrides.data ?? new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer,
        size: overrides.size ?? 4,
    };
}

describe("AnthropicAdapter attachment payloads", () => {
    it("does not append an empty text block to a file-only turn", async () => {
        const [mapped] = await mapAnthropicMessages([
            { role: "user", content: { text: "   ", files: [attachment()] } },
        ]);
        const content = (mapped as { content: Array<{ type: string }> }).content;

        expect(content).toHaveLength(1);
        expect(content[0]).toMatchObject({ type: "image" });
        expect(content).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: "text" })]));
    });

    it("keeps non-empty text alongside a document", async () => {
        const [mapped] = await mapAnthropicMessages([
            {
                role: "user",
                content: {
                    text: "Summarize this",
                    files: [attachment({ name: "report.pdf", mimeType: "application/pdf" })],
                },
            },
        ]);
        const content = (mapped as { content: Array<{ type: string; text?: string }> }).content;

        expect(content.map((part) => part.type)).toEqual(["document", "text"]);
        expect(content[1]).toMatchObject({ text: "Summarize this" });
    });

    it("maps UTF-8 text attachments to text blocks instead of PDF document sources", async () => {
        const data = new TextEncoder().encode("export const answer = 42;\n").buffer;
        const [mapped] = await mapAnthropicMessages([
            {
                role: "user",
                content: {
                    text: "Review this file",
                    files: [attachment({ name: "answer.ts", mimeType: "text/plain", data, size: data.byteLength })],
                },
            },
        ]);
        const content = (mapped as { content: Array<{ type: string; text?: string; source?: unknown }> }).content;

        expect(content.map((part) => part.type)).toEqual(["text", "text"]);
        expect(content[0]).toMatchObject({ text: "Attached file: answer.ts\n\nexport const answer = 42;\n" });
        expect(content[0]?.source).toBeUndefined();
        expect(content[1]).toMatchObject({ text: "Review this file" });
    });
});
