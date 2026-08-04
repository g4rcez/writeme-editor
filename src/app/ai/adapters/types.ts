import type { ToolChoice, ToolSet } from "ai";

export type AuthCredentials = {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    apiKey?: string;
    baseUrl?: string;
    accountId?: string;
    idToken?: string;
};

export type AIFile = {
    id: string;
    name: string;
    mimeType: string;
    data: ArrayBuffer;
    size: number;
};

export const AI_ATTACHMENT_LIMITS = {
    maxCount: 5,
    maxFileSize: 10 * 1024 * 1024,
    maxTotalSize: 20 * 1024 * 1024,
    maxCachedSize: 20 * 1024 * 1024,
    maxCachedTurns: 20,
} as const;

export type AIFileKind = "image" | "pdf" | "text" | "audio" | "video";

export type AIFileCapabilities = {
    kinds: readonly AIFileKind[];
    accept: string;
};

export const AI_FILE_CAPABILITIES = {
    none: { kinds: [], accept: "" },
    rasterImages: { kinds: ["image"], accept: "image/jpeg,image/png,image/gif,image/webp" },
    anthropic: {
        kinds: ["image", "pdf", "text"],
        accept: "image/jpeg,image/png,image/gif,image/webp,application/pdf,text/*,.md,.json,.js,.jsx,.ts,.tsx,.py",
    },
    gemini: {
        kinds: ["image", "pdf", "text", "audio", "video"],
        accept: "image/jpeg,image/png,image/gif,image/webp,application/pdf,text/*,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm,video/mp4,video/webm,.md,.json,.js,.jsx,.ts,.tsx,.py",
    },
} satisfies Record<string, AIFileCapabilities>;

const RASTER_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const GEMINI_AUDIO_TYPES = new Set(["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm"]);
const GEMINI_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const TEXT_APPLICATION_TYPES = new Set([
    "application/json",
    "application/javascript",
    "application/x-javascript",
    "application/typescript",
]);
const TEXT_FILE_EXTENSIONS = new Set(["md", "txt", "json", "js", "jsx", "ts", "tsx", "py"]);

function fileExtension(name: string): string | undefined {
    return name.split(".").pop()?.toLowerCase();
}

export function getAttachmentMimeType(file: Pick<File, "name" | "type">): string {
    if (TEXT_FILE_EXTENSIONS.has(fileExtension(file.name) ?? "")) return "text/plain";
    const declaredType = file.type.trim().toLowerCase();
    return declaredType || "application/octet-stream";
}

function getAIFileKindFromMimeType(mimeType: string): AIFileKind | null {
    if (RASTER_IMAGE_TYPES.has(mimeType)) return "image";
    if (mimeType === "application/pdf") return "pdf";
    if (mimeType.startsWith("text/") || TEXT_APPLICATION_TYPES.has(mimeType)) return "text";
    if (GEMINI_AUDIO_TYPES.has(mimeType)) return "audio";
    if (GEMINI_VIDEO_TYPES.has(mimeType)) return "video";
    return null;
}

export function getAIFileKind(file: Pick<File, "name" | "type">): AIFileKind | null {
    return getAIFileKindFromMimeType(getAttachmentMimeType(file));
}

function startsWithBytes(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
    return signature.every((byte, index) => bytes[offset + index] === byte);
}

function detectedBinaryMimeType(data: ArrayBuffer): string | null {
    const bytes = new Uint8Array(data);
    if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
    if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
    if (
        startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    )
        return "image/gif";
    if (startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWithBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8))
        return "image/webp";
    if (startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
    return null;
}

function decodeUtf8(data: ArrayBuffer): string {
    try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
        if (text.includes("\0")) throw new Error("Text attachments cannot contain binary data.");
        return text;
    } catch (error: unknown) {
        if (error instanceof Error && error.message.includes("binary data")) throw error;
        throw new Error("Text attachments must contain valid UTF-8 text.");
    }
}

function isAsciiWhitespace(byte: number | undefined): boolean {
    return byte === 0x09 || byte === 0x0a || byte === 0x0c || byte === 0x0d || byte === 0x20;
}

function startsWithAscii(bytes: Uint8Array, value: string, offset: number): boolean {
    if (offset + value.length > bytes.length) return false;
    for (let index = 0; index < value.length; index += 1) {
        const byte = bytes[offset + index];
        const lowerByte = byte != null && byte >= 0x41 && byte <= 0x5a ? byte + 0x20 : byte;
        if (lowerByte !== value.charCodeAt(index)) return false;
    }
    return true;
}

function findAscii(bytes: Uint8Array, value: string, offset: number): number {
    for (let index = offset; index <= bytes.length - value.length; index += 1) {
        if (startsWithAscii(bytes, value, index)) return index;
    }
    return -1;
}

function hasMarkupNameBoundary(byte: number | undefined): boolean {
    return byte === undefined || isAsciiWhitespace(byte) || byte === 0x2f || byte === 0x3e;
}

function hasActiveMarkupSignature(data: ArrayBuffer): boolean {
    const bytes = new Uint8Array(data);
    let offset = startsWithBytes(bytes, [0xef, 0xbb, 0xbf]) ? 3 : 0;

    while (offset < bytes.length) {
        while (isAsciiWhitespace(bytes[offset])) offset += 1;
        if (startsWithAscii(bytes, "<!--", offset)) {
            const commentEnd = findAscii(bytes, "-->", offset + 4);
            if (commentEnd < 0) return false;
            offset = commentEnd + 3;
            continue;
        }
        if (startsWithAscii(bytes, "<?", offset)) {
            if (startsWithAscii(bytes, "<?xml", offset) && hasMarkupNameBoundary(bytes[offset + 5])) return true;
            const instructionEnd = findAscii(bytes, "?>", offset + 2);
            if (instructionEnd < 0) return false;
            offset = instructionEnd + 2;
            continue;
        }
        break;
    }

    if (startsWithAscii(bytes, "<!doctype", offset) && hasMarkupNameBoundary(bytes[offset + 9])) return true;
    const activeRoots = ["html", "head", "body", "script", "svg", "iframe", "object", "embed"];
    return activeRoots.some(
        (root) => startsWithAscii(bytes, `<${root}`, offset) && hasMarkupNameBoundary(bytes[offset + root.length + 1]),
    );
}

type MediaContainer = "mpeg" | "wav" | "ogg" | "mp4" | "webm";

function readUint32(bytes: Uint8Array, offset: number): number {
    return (
        (((bytes[offset] ?? 0) << 24) |
            ((bytes[offset + 1] ?? 0) << 16) |
            ((bytes[offset + 2] ?? 0) << 8) |
            (bytes[offset + 3] ?? 0)) >>>
        0
    );
}

function hasMpegFrameSignature(bytes: Uint8Array): boolean {
    if (bytes.length < 4 || bytes[0] !== 0xff || ((bytes[1] ?? 0) & 0xe0) !== 0xe0) return false;
    const version = ((bytes[1] ?? 0) >> 3) & 0x03;
    const layer = ((bytes[1] ?? 0) >> 1) & 0x03;
    const bitrate = ((bytes[2] ?? 0) >> 4) & 0x0f;
    const sampleRate = ((bytes[2] ?? 0) >> 2) & 0x03;
    return version !== 0x01 && layer !== 0 && bitrate !== 0 && bitrate !== 0x0f && sampleRate !== 0x03;
}

function hasId3Signature(bytes: Uint8Array): boolean {
    if (!startsWithBytes(bytes, [0x49, 0x44, 0x33]) || bytes.length < 10 || bytes[3] === 0xff || bytes[4] === 0xff) {
        return false;
    }
    const sizeBytes = bytes.subarray(6, 10);
    if (sizeBytes.some((byte) => (byte & 0x80) !== 0)) return false;
    const tagSize = sizeBytes.reduce((size, byte) => (size << 7) | byte, 0);
    return tagSize + 10 <= bytes.length;
}

function detectedMediaContainer(data: ArrayBuffer): MediaContainer | null {
    const bytes = new Uint8Array(data);
    if (hasId3Signature(bytes) || hasMpegFrameSignature(bytes)) return "mpeg";
    if (
        bytes.length >= 12 &&
        startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        startsWithBytes(bytes, [0x57, 0x41, 0x56, 0x45], 8)
    ) {
        return "wav";
    }
    if (bytes.length >= 27 && startsWithBytes(bytes, [0x4f, 0x67, 0x67, 0x53, 0x00])) return "ogg";
    if (bytes.length >= 12 && startsWithBytes(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
        const boxSize = readUint32(bytes, 0);
        if (boxSize >= 12 && boxSize <= bytes.length) return "mp4";
    }
    if (
        startsWithBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3]) &&
        findAscii(bytes.subarray(0, Math.min(bytes.length, 4096)), "webm", 4) >= 0
    ) {
        return "webm";
    }
    return null;
}

function canonicalMediaMimeType(container: MediaContainer, kind: "audio" | "video"): string | null {
    if (container === "mpeg") return kind === "audio" ? "audio/mpeg" : null;
    if (container === "wav") return kind === "audio" ? "audio/wav" : null;
    if (container === "ogg") return kind === "audio" ? "audio/ogg" : null;
    return `${kind}/${container}`;
}

function canonicalizeMimeType(name: string, mimeType: string, data: ArrayBuffer): string {
    if (hasActiveMarkupSignature(data)) throw new Error("SVG, XML, and HTML attachments are not supported.");

    const detected = detectedBinaryMimeType(data);
    const kind = getAIFileKindFromMimeType(mimeType);
    if (kind === "image" || kind === "pdf") {
        if (!detected || getAIFileKindFromMimeType(detected) !== kind) {
            throw new Error(`The contents of ${name || "this file"} do not match its file type.`);
        }
        return detected;
    }
    if (kind === "text") {
        decodeUtf8(data);
        return getAttachmentMimeType({ name, type: mimeType });
    }
    if (kind === "audio" || kind === "video") {
        const container = detectedMediaContainer(data);
        const canonical = container ? canonicalMediaMimeType(container, kind) : null;
        if (!canonical) throw new Error(`The contents of ${name || "this file"} do not match its file type.`);
        return canonical;
    }
    return mimeType;
}

export function validateFileForCapabilities(file: File, capabilities: AIFileCapabilities): string | null {
    if (file.size === 0) return "The file is empty.";
    if (file.size > AI_ATTACHMENT_LIMITS.maxFileSize) return "The file exceeds the 10 MiB limit.";
    if (file.type.toLowerCase() === "image/svg+xml" || fileExtension(file.name) === "svg") {
        return "SVG images are not supported.";
    }
    const kind = getAIFileKind(file);
    if (!kind || !capabilities.kinds.includes(kind)) return "This provider does not support this file type.";
    return null;
}

export async function prepareFileForCapabilities(
    file: File,
    capabilities: AIFileCapabilities,
    createId: () => string,
): Promise<AIFile> {
    const error = validateFileForCapabilities(file, capabilities);
    if (error) throw new Error(error);
    const data = await file.arrayBuffer();
    if (data.byteLength !== file.size) throw new Error("The file changed while it was being read.");
    const mimeType = canonicalizeMimeType(file.name, getAttachmentMimeType(file), data);
    return { id: createId(), name: file.name, mimeType, data, size: data.byteLength };
}

export function validateAIFileBatch(files: readonly AIFile[], capabilities: AIFileCapabilities): string | null {
    if (files.length > AI_ATTACHMENT_LIMITS.maxCount) return "Only 5 attachments can be sent at once.";
    let totalSize = 0;
    for (const file of files) {
        if (file.size <= 0 || file.data.byteLength <= 0) return `${file.name}: The file is empty.`;
        if (file.size !== file.data.byteLength) return `${file.name}: The attachment size is invalid.`;
        if (file.data.byteLength > AI_ATTACHMENT_LIMITS.maxFileSize)
            return `${file.name}: The file exceeds the 10 MiB limit.`;
        totalSize += file.data.byteLength;
        if (totalSize > AI_ATTACHMENT_LIMITS.maxTotalSize) return "Attachments cannot exceed 20 MiB in total.";
        const kind = getAIFileKindFromMimeType(file.mimeType);
        if (!kind || !capabilities.kinds.includes(kind))
            return `${file.name}: This provider does not support this file type.`;
        try {
            if (canonicalizeMimeType(file.name, file.mimeType, file.data) !== file.mimeType) {
                return `${file.name}: The attachment MIME type is not canonical.`;
            }
        } catch (error: unknown) {
            return `${file.name}: ${error instanceof Error ? error.message : "The attachment is invalid."}`;
        }
    }
    return null;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            if (typeof reader.result !== "string") {
                reject(new Error("The attachment could not be encoded."));
                return;
            }
            const separator = reader.result.indexOf(",");
            if (separator < 0) {
                reject(new Error("The attachment could not be encoded."));
                return;
            }
            resolve(reader.result.slice(separator + 1));
        });
        reader.addEventListener("error", () =>
            reject(reader.error ?? new Error("The attachment could not be encoded.")),
        );
        reader.addEventListener("abort", () => reject(new Error("Attachment encoding was cancelled.")));
        reader.readAsDataURL(new Blob([buffer]));
    });
}

export type AIMessageContent = { text: string; files?: AIFile[] };
export type AIStreamEvent = { type: "text"; delta: string } | { type: "done" } | { type: "error"; message: string };
export type AIModel = { id: string; name: string; contextWindow?: number; supportsVision?: boolean };
export type SendOptions = {
    model?: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    baseUrl?: string;
    commandTemplate?: string;
    credentials: AuthCredentials;
    tools?: ToolSet;
    toolChoice?: ToolChoice<ToolSet>;
};
export type MessageRole = "user" | "assistant" | "system";
export type AIConversationMessage = { role: MessageRole; content: AIMessageContent };

export interface AIAdapter {
    readonly id: string;
    readonly name: string;
    readonly supportsFiles: boolean;
    readonly fileCapabilities: AIFileCapabilities;
    readonly supportsOAuth: boolean;
    readonly defaultModel: string;
    auth(method: "oauth" | "api-key", apiKey?: string): Promise<AuthCredentials>;
    refresh(credentials: AuthCredentials): Promise<AuthCredentials>;
    isExpired(credentials: AuthCredentials): boolean;
    listModels(credentials: AuthCredentials): Promise<AIModel[]>;
    prepareFile(file: File): Promise<AIFile>;
    sendMessage(
        messages: AIConversationMessage[],
        options: SendOptions,
        signal?: AbortSignal,
    ): AsyncIterable<AIStreamEvent>;
}
