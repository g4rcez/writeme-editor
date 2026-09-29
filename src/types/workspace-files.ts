export const WORKSPACE_DOCUMENT_EXTENSIONS = ["md", "mdx", "tex", "latex"] as const;

const WORKSPACE_DOCUMENT_FILE_PATTERN = /\.(?:md|mdx|tex|latex)$/i;
const LATEX_FILE_PATTERN = /\.(?:tex|latex)$/i;

export function isWorkspaceDocumentFile(filePath: string): boolean {
    return WORKSPACE_DOCUMENT_FILE_PATTERN.test(filePath);
}

export function isLatexFilePath(filePath: string | null | undefined): boolean {
    return typeof filePath === "string" && LATEX_FILE_PATTERN.test(filePath);
}

export function getWorkspaceDocumentTitle(fileName: string): string {
    return fileName.replace(WORKSPACE_DOCUMENT_FILE_PATTERN, "");
}
