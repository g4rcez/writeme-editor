import { uuid } from "@g4rcez/components";

function joinPath(...segments: string[]): string {
  return segments
    .join("/")
    .replace(/\/+/g, "/") // Collapse multiple slashes
    .replace(/\/$/, ""); // Remove trailing slash
}

export function getDirname(filePath: string): string {
  const lastSlash = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\"),
  );
  if (lastSlash === -1) return ".";
  return filePath.substring(0, lastSlash) || "/";
}

function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  const lastSlash = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\"),
  );
  if (lastDot > lastSlash && lastDot !== -1) {
    return filePath.substring(lastDot);
  }
  return "";
}

export function getRelativePath(from: string, to: string): string {
  const normalizedFrom = from.replace(/\\/g, "/");
  const normalizedTo = to.replace(/\\/g, "/");
  if (normalizedTo.startsWith(normalizedFrom)) {
    return normalizedTo.substring(normalizedFrom.length).replace(/^\//, "");
  }

  return normalizedTo;
}

export function sanitizeFilename(title: string): string {
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g;
  const sanitized = title
    .replace(invalidChars, "") // Remove invalid characters
    .replace(/\s+/g, "-") // Replace whitespace with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .toLowerCase()
    .trim()
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
  const maxLength = 255 - 3; // Reserve space for .md extension
  const truncated = sanitized.substring(0, maxLength);
  return truncated || "untitled";
}

export const mdExtension = (s: string) => (s.endsWith(".md") ? s : `${s}.md`);

export function generateNotePath(rootDir: string, noteTitle: string): string {
  if (noteTitle.startsWith("/")) {
    return mdExtension(noteTitle);
  }
  const segments = noteTitle.split(/[/\\]/);
  const sanitizedSegments = segments
    .map((s) => sanitizeFilename(s))
    .filter(Boolean);
  if (sanitizedSegments.length === 0) {
    return joinPath(rootDir, "untitled.md");
  }
  const filename = sanitizedSegments.pop()!;
  const folderPath = sanitizedSegments.join("/");
  return joinPath(rootDir, folderPath, mdExtension(filename));
}

export async function getUniqueFilePath(
  basePath: string,
  checkExists: (path: string) => Promise<boolean>,
): Promise<string> {
  let counter = 1;
  let testPath = basePath;
  while (await checkExists(testPath)) {
    const ext = getExtension(basePath);
    const base = basePath.slice(0, -ext.length);
    testPath = `${base}-${counter}${ext}`;
    counter++;
  }
  return testPath;
}

export function parseNotePath(
  filePath: string,
  rootDir: string,
): {
  filename: string;
} {
  const relativePath = getRelativePath(rootDir, filePath);
  const parts = relativePath.split(/[/\\]/);
  const filename = parts[parts.length - 1] || "";
  return { filename };
}

export function createStandaloneNote(filePath: string, content: string) {
  const filename = filePath.split(/[/\\]/).pop() || "Untitled";
  const title = filename.replace(/\.md$/i, "");
  const now = new Date();
  return {
    id: uuid(),
    title,
    content,
    project: "",
    filePath,
    createdAt: now,
    updatedAt: now,
    fileSize: content.length,
    lastSynced: now,
    tags: [] as string[],
    createdBy: "user",
    updatedBy: "user",
  };
}

/**
 * Format a relative path for display:
 * - Replaces separators with " / "
 * - Truncates middle segments with "..." if path is too long
 * - Example: "A/B/C/D" -> "A / ... / C / D"
 */
export function formatSimplifiedPath(path: string): string {
  if (!path) return "";

  const segments = path.split("/").filter(Boolean);

  if (segments.length <= 3) {
    return segments.join(" / ");
  }

  // Keep first, ellipsis, second to last, last
  // Spec: "The immediate parent folder should be clearly visible."
  // So: Root / ... / Parent / [Note]
  // But this function receives the path relative to root?
  // If input is "Folder/Sub/File.md", we probably usually strip the filename before calling this?
  // Let's assume input is the folder path.

  // A / B / C / D -> A / ... / C / D

  const first = segments[0];
  const last = segments[segments.length - 1];
  const secondLast = segments[segments.length - 2];

  // If 4 segments: A, B, C, D -> A / ... / C / D ?
  // Or A / B / C / D ?
  // Let's stick to max 3 items displayed.

  return `${first} / ... / ${secondLast} / ${last}`;
}

/**
 * Generate a unique note title by appending -N suffix if needed
 * @param baseTitle - The desired title (e.g., "Untitled")
 * @param existingNotes - Array of notes to check against
 * @returns A unique title (e.g., "Untitled", "Untitled-1", "Untitled-2")
 */
export function getUniqueNoteTitle(
  baseTitle: string,
  existingNotes: { title: string }[],
): string {
  const existingTitles = new Set(existingNotes.map((n) => n.title));

  if (!existingTitles.has(baseTitle)) {
    return baseTitle;
  }

  let counter = 1;
  while (existingTitles.has(`${baseTitle}-${counter}`)) {
    counter++;
  }
  return `${baseTitle}-${counter}`;
}

interface ReadingTimeResult {
  minutes: number;
  words: number;
  formatted: string;
}

export const getReadingTime = (
  text: string,
  wordsPerMinute: number = 225,
): ReadingTimeResult => {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const wordCount = words.length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return {
    minutes,
    words: wordCount,
    formatted: `${minutes} min read`,
  };
};

export const tildaDir = (home: string, path: string): string =>
  home && path.startsWith(home) ? path.replace(home, "~") : path;
