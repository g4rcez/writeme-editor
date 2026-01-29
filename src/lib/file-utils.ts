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
function getRelativePath(from: string, to: string): string {
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
 * @param projectId - Project UUID or default project ID
 * @param noteTitle - Note title to be sanitized
 * @returns Absolute path to the note file (with forward slashes)
 */
export function generateNotePath(
  rootDir: string,
  projectId: string,
  noteTitle: string,
): string {
  const filename = sanitizeFilename(noteTitle);

  // Default project gets special "default" folder name
  const isDefaultProject =
    projectId === "00000000-0000-0000-0000-000000000000";
  const projectFolder = isDefaultProject ? "default" : projectId;

  return joinPath(rootDir, projectFolder, `${filename}.md`);
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
 * Extract project folder and filename from full path
 * @param filePath - Absolute file path
 * @param rootDir - Storage root directory
 * @returns Parsed components of the path
 */
export function parseNotePath(
  filePath: string,
  rootDir: string,
): {
  projectFolder: string;
  filename: string;
  isDefaultProject: boolean;
} {
  const relativePath = getRelativePath(rootDir, filePath);
  const parts = relativePath.split(/[/\\]/); // Handle both forward and back slashes

  const projectFolder = parts[0] || "default";
  const filename = parts[parts.length - 1];
  const isDefaultProject = projectFolder === "default";

  return { projectFolder, filename, isDefaultProject };
}
