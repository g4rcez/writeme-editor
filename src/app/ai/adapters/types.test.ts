import { describe, expect, it, vi } from "vitest";
import {
    AI_ATTACHMENT_LIMITS,
    AI_FILE_CAPABILITIES,
    arrayBufferToBase64,
    getAIFileKind,
    prepareFileForCapabilities,
    validateAIFileBatch,
    validateFileForCapabilities,
} from "./types";

function fileWithBytes(name: string, bytes: Uint8Array, type: string) {
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const file = new File([data], name, { type });
    const read = vi.fn(async () => data);
    Object.defineProperty(file, "arrayBuffer", { value: read });
    return { file, read, data };
}

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const pdfBytes = new TextEncoder().encode("%PDF-1.7\n");
const mp3Bytes = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
const wavBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x04, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
const oggBytes = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, ...new Array(22).fill(0)]);
const mp4Bytes = new Uint8Array([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
const webmBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]);

describe("AI attachment capabilities", () => {
    it("represents provider media contracts without treating SVG as raster media", () => {
        expect(getAIFileKind(new File([pngBytes.buffer as ArrayBuffer], "photo.png", { type: "image/png" }))).toBe(
            "image",
        );
        expect(getAIFileKind(new File(["svg"], "vector.svg", { type: "image/svg+xml" }))).toBeNull();
        expect(
            validateFileForCapabilities(
                new File(["notes"], "notes.txt", { type: "text/plain" }),
                AI_FILE_CAPABILITIES.rasterImages,
            ),
        ).toBe("This provider does not support this file type.");
        expect(
            validateFileForCapabilities(
                new File(["audio"], "clip.mp3", { type: "audio/mpeg" }),
                AI_FILE_CAPABILITIES.gemini,
            ),
        ).toBeNull();
        expect(
            validateFileForCapabilities(
                new File(["audio"], "clip.flac", { type: "audio/flac" }),
                AI_FILE_CAPABILITIES.gemini,
            ),
        ).toBe("This provider does not support this file type.");
        expect(AI_FILE_CAPABILITIES.gemini.accept).not.toContain("audio/*");
        expect(AI_FILE_CAPABILITIES.gemini.accept).not.toContain("video/*");
    });

    it("rejects oversized files before reading their bytes", async () => {
        const file = new File(["x"], "too-large.pdf", { type: "application/pdf" });
        const read = vi.fn();
        Object.defineProperties(file, {
            size: { value: AI_ATTACHMENT_LIMITS.maxFileSize + 1 },
            arrayBuffer: { value: read },
        });

        await expect(prepareFileForCapabilities(file, AI_FILE_CAPABILITIES.anthropic, () => "file-1")).rejects.toThrow(
            "10 MiB",
        );
        expect(read).not.toHaveBeenCalled();
    });

    it("normalizes misleading source MIME types and validates UTF-8 text", async () => {
        const bytes = new TextEncoder().encode("export const value = 1;\n");
        const { file } = fileWithBytes("example.ts", bytes, "video/mp2t");
        const prepared = await prepareFileForCapabilities(file, AI_FILE_CAPABILITIES.anthropic, () => "file-1");

        expect(prepared).toMatchObject({
            id: "file-1",
            name: "example.ts",
            mimeType: "text/plain",
            size: bytes.length,
        });
    });

    it("canonicalizes verified signatures and rejects spoofed active content", async () => {
        const { file: mislabeledPng } = fileWithBytes("photo.jpg", pngBytes, "image/jpeg");
        const prepared = await prepareFileForCapabilities(
            mislabeledPng,
            AI_FILE_CAPABILITIES.rasterImages,
            () => "file-1",
        );
        expect(prepared.mimeType).toBe("image/png");

        const { file: spoofedImage } = fileWithBytes(
            "payload.png",
            new TextEncoder().encode("<svg><script>alert(1)</script></svg>"),
            "image/png",
        );
        await expect(
            prepareFileForCapabilities(spoofedImage, AI_FILE_CAPABILITIES.rasterImages, () => "file-2"),
        ).rejects.toThrow("SVG, XML, and HTML");
    });

    it.each([
        "<html><body>bad</body></html>",
        "<head><title>bad</title></head>",
        "<body>bad</body>",
        "<script>alert(1)</script>",
        "<svg><circle /></svg>",
        "<iframe src='bad'></iframe>",
        "<object data='bad'></object>",
        "<embed src='bad'>",
        "<!DOCTYPE html><html></html>",
        "<!-- leading comment -->\n<script>alert(1)</script>",
        "<?xml-stylesheet href='bad'?>\n<object data='bad'></object>",
        `${" ".repeat(2_048)}<!-- comment -->\n<svg></svg>`,
    ])("rejects active markup when the first effective content is %s", async (content) => {
        const { file } = fileWithBytes("notes.txt", new TextEncoder().encode(content), "text/plain");
        await expect(
            prepareFileForCapabilities(file, AI_FILE_CAPABILITIES.anthropic, () => "file-markup"),
        ).rejects.toThrow("SVG, XML, and HTML");
    });

    it("does not reject markup text after ordinary first content", async () => {
        const content = 'const example = "<script>alert(1)</script>";';
        const { file } = fileWithBytes("example.ts", new TextEncoder().encode(content), "text/plain");
        await expect(
            prepareFileForCapabilities(file, AI_FILE_CAPABILITIES.anthropic, () => "file-text"),
        ).resolves.toMatchObject({ mimeType: "text/plain" });
    });

    it.each([
        ["clip.mp3", "audio/mpeg", mp3Bytes, "audio/mpeg"],
        ["clip.wav", "audio/mpeg", wavBytes, "audio/wav"],
        ["clip.ogg", "audio/ogg", oggBytes, "audio/ogg"],
        ["clip.m4a", "audio/mp4", mp4Bytes, "audio/mp4"],
        ["movie.mp4", "video/mp4", mp4Bytes, "video/mp4"],
        ["clip.webm", "audio/webm", webmBytes, "audio/webm"],
        ["movie.webm", "video/webm", webmBytes, "video/webm"],
    ])("verifies and canonicalizes %s media", async (name, declaredType, bytes, expectedType) => {
        const { file } = fileWithBytes(name, bytes, declaredType);
        await expect(
            prepareFileForCapabilities(file, AI_FILE_CAPABILITIES.gemini, () => "file-media"),
        ).resolves.toMatchObject({ mimeType: expectedType });
    });

    it("rejects malformed and family-ambiguous media during preparation and send validation", async () => {
        const malformed = new Uint8Array([0, 1, 2, 3]);
        const { file } = fileWithBytes("clip.mp3", malformed, "audio/mpeg");
        await expect(prepareFileForCapabilities(file, AI_FILE_CAPABILITIES.gemini, () => "file-media")).rejects.toThrow(
            "do not match",
        );

        const mp3Data = mp3Bytes.buffer.slice(
            mp3Bytes.byteOffset,
            mp3Bytes.byteOffset + mp3Bytes.byteLength,
        ) as ArrayBuffer;
        expect(
            validateAIFileBatch(
                [{ id: "video", name: "movie.mp4", mimeType: "video/mp4", size: mp3Data.byteLength, data: mp3Data }],
                AI_FILE_CAPABILITIES.gemini,
            ),
        ).toContain("do not match");
    });

    it("revalidates prepared file batches at the send boundary", () => {
        const data = pdfBytes.buffer.slice(
            pdfBytes.byteOffset,
            pdfBytes.byteOffset + pdfBytes.byteLength,
        ) as ArrayBuffer;
        expect(
            validateAIFileBatch(
                [{ id: "pdf", name: "report.pdf", mimeType: "application/pdf", size: data.byteLength, data }],
                AI_FILE_CAPABILITIES.anthropic,
            ),
        ).toBeNull();
        expect(
            validateAIFileBatch(
                [{ id: "bad", name: "bad.pdf", mimeType: "application/pdf", size: data.byteLength + 1, data }],
                AI_FILE_CAPABILITIES.anthropic,
            ),
        ).toContain("size is invalid");
    });

    it("encodes buffers asynchronously without changing bytes", async () => {
        const bytes = Uint8Array.from({ length: 70_000 }, (_, index) => index % 251);
        const encodedPromise = arrayBufferToBase64(bytes.buffer);
        expect(encodedPromise).toBeInstanceOf(Promise);
        const encoded = await encodedPromise;
        const decoded = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
        expect(decoded).toEqual(bytes);
    });
});
