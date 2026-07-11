export type ExcalidrawNotePayload = {
    elements: unknown[];
    appState: Record<string, unknown>;
    files: Record<string, unknown>;
};

const EXCALIDRAW_FRONTMATTER = `---
type: excalidraw
view: excalidraw
schemaVersion: 1
---`;

const JSON_CODE_FENCE_PATTERN = /```json[^\n]*\n([\s\S]*?)\n```/i;

export const EMPTY_EXCALIDRAW_PAYLOAD: ExcalidrawNotePayload = {
    elements: [],
    appState: {},
    files: {},
};

const NON_PORTABLE_APP_STATE_KEYS = new Set(["collaborators"]);

export function sanitizeExcalidrawAppState(appState: unknown): Record<string, unknown> {
    if (!appState || typeof appState !== "object") return {};

    return Object.fromEntries(
        Object.entries(appState as Record<string, unknown>).filter(
            ([key, value]) =>
                !NON_PORTABLE_APP_STATE_KEYS.has(key) &&
                value !== undefined &&
                typeof value !== "function" &&
                !(value instanceof Map) &&
                !(value instanceof Set),
        ),
    );
}

export function normalizeExcalidrawPayload(value: unknown): ExcalidrawNotePayload {
    if (Array.isArray(value)) {
        return {
            ...EMPTY_EXCALIDRAW_PAYLOAD,
            elements: value,
        };
    }

    if (!value || typeof value !== "object") return EMPTY_EXCALIDRAW_PAYLOAD;

    const record = value as Record<string, unknown>;
    return {
        elements: Array.isArray(record.elements) ? record.elements : [],
        appState: sanitizeExcalidrawAppState(record.appState),
        files: record.files && typeof record.files === "object" ? (record.files as Record<string, unknown>) : {},
    };
}

export function buildExcalidrawNoteContent(payload: ExcalidrawNotePayload = EMPTY_EXCALIDRAW_PAYLOAD): string {
    const normalizedPayload = normalizeExcalidrawPayload(payload);
    return `${EXCALIDRAW_FRONTMATTER}\n\n\`\`\`json\n${JSON.stringify(normalizedPayload, null, 2)}\n\`\`\`\n`;
}

export function parseExcalidrawNoteContent(content: string): {
    payload: ExcalidrawNotePayload;
    rawJson: string;
} {
    const match = content.match(JSON_CODE_FENCE_PATTERN);
    if (!match?.[1]) {
        return {
            payload: EMPTY_EXCALIDRAW_PAYLOAD,
            rawJson: JSON.stringify(EMPTY_EXCALIDRAW_PAYLOAD, null, 2),
        };
    }

    const rawJson = match[1].trim();
    return {
        payload: normalizeExcalidrawPayload(JSON.parse(rawJson)),
        rawJson,
    };
}

export function replaceExcalidrawNotePayload(content: string, payload: ExcalidrawNotePayload): string {
    const normalizedPayload = normalizeExcalidrawPayload(payload);
    const nextFence = `\`\`\`json\n${JSON.stringify(normalizedPayload, null, 2)}\n\`\`\``;
    if (JSON_CODE_FENCE_PATTERN.test(content)) {
        return content.replace(JSON_CODE_FENCE_PATTERN, nextFence);
    }

    const trimmedContent = content.trimEnd();
    if (trimmedContent.length === 0) return buildExcalidrawNoteContent(payload);
    return `${trimmedContent}\n\n${nextFence}\n`;
}
