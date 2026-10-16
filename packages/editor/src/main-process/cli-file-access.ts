import path from "node:path";

const filePathByRequestId = new Map<string, string>();

export function allowCliEditorFile(requestId: string, filePath: string): void {
    filePathByRequestId.set(requestId, path.resolve(filePath));
}

export function revokeCliEditorFile(requestId: string): void {
    filePathByRequestId.delete(requestId);
}

export function isCliEditorFilePath(filePath: string): boolean {
    const normalizedPath = path.resolve(filePath);
    for (const allowedPath of filePathByRequestId.values()) {
        if (allowedPath === normalizedPath) return true;
    }
    return false;
}
