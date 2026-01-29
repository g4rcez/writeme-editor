import { isElectron } from "./is-electron";
import { SettingsRepository } from "../store/settings";

export type StorageMode = "filesystem" | "indexeddb";

/**
 * Determines the current storage mode based on environment and settings.
 * - Web mode (non-Electron): Always uses IndexedDB for full note storage
 * - Electron without storageDirectory: Uses IndexedDB (no project folder configured)
 * - Electron with storageDirectory: Uses filesystem for content, IndexedDB for metadata
 */
export const getStorageMode = (): StorageMode => {
  if (!isElectron()) return "indexeddb";
  const settings = SettingsRepository.load();
  return settings.storageDirectory ? "filesystem" : "indexeddb";
};

/**
 * Convenience helper to check if filesystem storage is available.
 * Useful for conditionally showing filesystem-related UI.
 */
export const hasFilesystemAccess = () => getStorageMode() === "filesystem";
