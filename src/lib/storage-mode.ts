import { isElectron } from "./is-electron";

export type StorageMode = "filesystem" | "indexeddb";

/**
 * Determines the current storage mode based on environment and settings.
 * - Web mode (non-Electron): Always uses IndexedDB for full note storage
 * - Electron without directory: Uses IndexedDB (no project folder configured)
 * - Electron with directory: Uses filesystem for content, IndexedDB for metadata
 */
export const getStorageMode = (directory?: string | null): StorageMode => {
  if (!isElectron()) return "indexeddb";
  return directory ? "filesystem" : "indexeddb";
};

/**
 * Convenience helper to check if filesystem storage is available.
 * Useful for conditionally showing filesystem-related UI.
 */
export const hasFilesystemAccess = (directory?: string | null) =>
  getStorageMode(directory) === "filesystem";
