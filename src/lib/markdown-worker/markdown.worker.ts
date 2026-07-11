/// <reference lib="webworker" />
import { Marked } from "marked";
import { linkify } from "@/lib/link-utils";
import { dedent } from "./dedent";

const md = new Marked({ gfm: true, breaks: true });

export function processMarkdown(text: string): string {
    const dedented = dedent(text);
    const linkified = linkify(dedented);
    return md.parse(linkified, { async: false }) as string;
}

const CHUNK_LINES = 200;

function splitIntoChunks(text: string): string[] {
    const lines = text.split("\n");
    if (lines.length <= CHUNK_LINES) return [text];

    const chunks: string[] = [];
    let currentLines: string[] = [];
    let inFence = false;

    for (const line of lines) {
        const trimmed = line.trimStart();

        if (!inFence) {
            if (/^(`{3,}|~{3,})/.test(trimmed)) {
                inFence = true;
            }
        } else {
            if (/^(`{3,}|~{3,})\s*$/.test(trimmed)) {
                inFence = false;
            }
        }

        const isHeadingBoundary = !inFence && /^#{1,6}\s/.test(trimmed) && currentLines.length >= CHUNK_LINES;

        if (isHeadingBoundary) {
            chunks.push(currentLines.join("\n"));
            currentLines = [];
        }

        currentLines.push(line);

        // Force split when no heading found within 2x the chunk size
        if (!inFence && currentLines.length >= CHUNK_LINES * 2) {
            chunks.push(currentLines.join("\n"));
            currentLines = [];
        }
    }

    if (currentLines.length > 0) {
        chunks.push(currentLines.join("\n"));
    }

    return chunks.filter((c) => c.trim().length > 0);
}

export type WorkerInMessage = { text: string; gen: number };

export type WorkerOutMessage =
    | { type: "start"; gen: number; totalChunks: number }
    | {
          type: "chunk";
          gen: number;
          html: string;
          chunkIndex: number;
          totalChunks: number;
      }
    | { type: "error"; gen: number; error: string };

if (typeof DedicatedWorkerGlobalScope !== "undefined" && self instanceof DedicatedWorkerGlobalScope) {
    self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
        const { text, gen } = e.data;
        try {
            const chunks = splitIntoChunks(text);
            const totalChunks = chunks.length;
            self.postMessage({
                type: "start",
                gen,
                totalChunks,
            } satisfies WorkerOutMessage);
            for (let i = 0; i < chunks.length; i++) {
                const html = processMarkdown(chunks[i]!);
                self.postMessage({
                    type: "chunk",
                    gen,
                    html,
                    chunkIndex: i,
                    totalChunks,
                } satisfies WorkerOutMessage);
            }
        } catch (err) {
            self.postMessage({
                type: "error",
                gen,
                error: String(err),
            } satisfies WorkerOutMessage);
        }
    };
}
