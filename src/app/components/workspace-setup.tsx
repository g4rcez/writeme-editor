import { Modal } from "@g4rcez/components";
import { DatabaseIcon } from "@phosphor-icons/react/dist/csr/Database";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useState } from "react";
import { isElectron } from "@/lib/is-electron";
import { SettingsService } from "@/store/settings";
import { globalDispatch } from "@/store/global.store";

interface StorageConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Optional storage configuration dialog
 * Users can configure filesystem sync or continue with IndexedDB-only mode
 */
export const StorageConfigDialog = ({
  open,
  onOpenChange,
}: StorageConfigDialogProps) => {
  const settings = SettingsService.load();
  const [directory, setDirectory] = useState<string | null>(settings.directory);
  const [author, setAuthor] = useState(settings.defaultAuthor || "");
  const [isSelecting, setIsSelecting] = useState(false);

  const handleChooseDirectory = async () => {
    if (!isElectron()) return;
    setIsSelecting(true);
    try {
      const dir = await window.electronAPI.fs.chooseDirectory();
      if (dir) {
        setDirectory(dir);
      }
    } catch (error) {
      console.error("Failed to choose directory:", error);
    } finally {
      setIsSelecting(false);
    }
  };

  const handleSaveWithSync = async () => {
    if (!directory) return;
    await SettingsService.save({
      defaultAuthor: author || "user",
    });
    await globalDispatch.switchWorkspace(directory);
    onOpenChange(false);
  };

  const handleUseLocalOnly = async () => {
    await SettingsService.save({
      defaultAuthor: author || "user",
    });
    await globalDispatch.switchWorkspace(null);
    onOpenChange(false);
  };

  const handleClearSync = async () => {
    setDirectory(null);
    await SettingsService.save({
      directory: null,
    });
  };

  const currentMode = settings.directory ? "Folder Sync" : "Local Storage";

  return (
    <Modal open={open} onChange={onOpenChange} title="Storage Configuration">
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
          {settings.directory ? (
            <ArrowsClockwiseIcon className="w-5 h-5 text-green-500" />
          ) : (
            <DatabaseIcon className="w-5 h-5 text-blue-500" />
          )}
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              Current Mode: {currentMode}
            </span>
            <span className="text-xs text-foreground/60">
              {settings.directory
                ? `Syncing to: ${settings.directory}`
                : "Notes stored in browser IndexedDB"}
            </span>
          </div>
        </div>

        {/* Folder Sync Configuration (Electron only) */}
        {isElectron() && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">
                Sync Folder
                <span className="ml-2 text-xs text-foreground/50">
                  (optional)
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={directory || ""}
                  placeholder="No folder selected (local only)"
                  readOnly
                  className="flex-1 py-2 px-3 text-sm bg-muted/50 rounded border border-border"
                />
                {directory && (
                  <button
                    onClick={handleClearSync}
                    className="p-2 text-foreground/60 hover:text-foreground rounded border border-border hover:bg-muted/50 transition-colors"
                    title="Clear folder sync"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleChooseDirectory}
                  disabled={isSelecting}
                  className="py-2 px-4 text-sm font-medium text-white bg-blue-500 rounded transition-colors hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSelecting ? "Selecting..." : "Choose Folder"}
                </button>
              </div>
              <p className="text-xs text-foreground/50">
                When enabled, notes are also saved as .md files you can edit
                with any text editor
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">
                Your Name
                <span className="ml-2 text-xs text-foreground/50">
                  (optional)
                </span>
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g., John Doe"
                className="py-2 px-3 text-sm bg-muted/50 rounded border border-border"
              />
              <p className="text-xs text-foreground/50">
                Used to track who created and modified notes
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {isElectron() && directory && (
            <button
              onClick={handleSaveWithSync}
              className="flex-1 py-2.5 px-4 font-medium text-white bg-green-500 rounded transition-colors hover:bg-green-600"
            >
              <span className="flex items-center justify-center gap-2">
                <ArrowsClockwiseIcon className="w-4 h-4" />
                Enable Folder Sync
              </span>
            </button>
          )}
          <button
            onClick={handleUseLocalOnly}
            className={`${directory ? "" : "flex-1"} py-2.5 px-4 font-medium rounded transition-colors border border-border hover:bg-muted/50`}
          >
            <span className="flex items-center justify-center gap-2">
              <DatabaseIcon className="w-4 h-4" />
              {settings.directory ? "Switch to Local Only" : "Keep Local Only"}
            </span>
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="py-2.5 px-4 text-foreground/70 rounded transition-colors hover:bg-muted/50"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-foreground/50 text-center">
          Local storage keeps your notes in the browser's IndexedDB database.
          {isElectron() &&
            " Folder sync additionally saves them as markdown files."}
        </p>
      </div>
    </Modal>
  );
};

// Legacy export for backward compatibility during migration
export const WorkspaceSetup = StorageConfigDialog;
