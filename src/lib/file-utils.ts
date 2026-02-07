/**
 * Browser-compatible path utilities
 * Works in both Node.js (main process) and browser (renderer process)
 */

/**
 * Join path segments using forward slashes (cross-platform compatible)
 * @param segments Path segments to join
 * @returns Joined path
 */
function joinPath(...segments: string[]): string {
  return segments
    .join("/")
    .replace(/\/+/g, "/") // Collapse multiple slashes
    .replace(/\/$/, ""); // Remove trailing slash
}

/**
 * Get directory name from path
 * @param filePath File path
 * @returns Directory path
 */
export function getDirname(filePath: string): string {
  const lastSlash = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\")
  );
  if (lastSlash === -1) return ".";
  return filePath.substring(0, lastSlash) || "/";
}

/**
 * Get file extension from path
 * @param filePath File path
 * @returns Extension including the dot (e.g., ".md")
 */
function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  const lastSlash = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\"),
  );

  // Extension must be after the last path separator
  if (lastDot > lastSlash && lastDot !== -1) {
    return filePath.substring(lastDot);
  }
  return "";
}

/**
 * Get relative path from base to target
 * @param from Base path
 * @param to Target path
 * @returns Relative path
 */
export function getRelativePath(from: string, to: string): string {
  // Normalize separators
  const normalizedFrom = from.replace(/\\/g, "/");
  const normalizedTo = to.replace(/\\/g, "/");

  // If target starts with base, return the relative part
  if (normalizedTo.startsWith(normalizedFrom)) {
    return normalizedTo.substring(normalizedFrom.length).replace(/^\//, "");
  }

  return normalizedTo;
}

/**
 * Sanitize note title to valid filename
 * - Remove/replace invalid characters
 * - Convert to lowercase
 * - Replace spaces with hyphens
 * - Limit length to 255 chars (filesystem limit)
 */
export function sanitizeFilename(title: string): string {
  // Characters invalid in filenames across Windows, macOS, and Linux
  // eslint-disable-next-line no-control-regex
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

/**
 * Generate full file path for a note
 * @param rootDir - User-chosen storage directory
 * @param noteTitle - Note title to be sanitized
 * @returns Absolute path to the note file (with forward slashes)
 */
export function generateNotePath(
  rootDir: string,
  noteTitle: string,
): string {
  const filename = sanitizeFilename(noteTitle);
  return joinPath(rootDir, `${filename}.md`);
}

/**
 * Handle duplicate filenames by appending counter
 * Checks if file exists and appends -1, -2, etc. until unique path is found
 * @param basePath - Original file path
 * @param checkExists - Async function to check if path exists
 * @returns Unique file path
 */
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

/**
 * Extract filename from full path relative to root directory
 * @param filePath - Absolute file path
 * @param rootDir - Storage root directory
 * @returns Parsed components of the path
 */
export function parseNotePath(
  filePath: string,
  rootDir: string,
): {
  filename: string;
} {
  const relativePath = getRelativePath(rootDir, filePath);
  const parts = relativePath.split(/[/\\]/);
  const filename = parts[parts.length - 1];
  return { filename };
}

/**
 * Create a standalone note from an external file path
 * Standalone notes are saved directly to their file path, bypassing project structure
 * @param filePath - Absolute path to the .md file
 * @param content - File content
 * @returns Note with filePath set
 */
export function createStandaloneNote(filePath: string, content: string) {
  const filename = filePath.split(/[/\\]/).pop() || "Untitled";
  const title = filename.replace(/\.md$/i, "");
  const now = new Date();
  return {
    id: crypto.randomUUID(),
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

