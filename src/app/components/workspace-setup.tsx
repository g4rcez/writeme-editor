import { useState } from "react";
import { SettingsRepository } from "../../store/settings";

interface WorkspaceSetupProps {
  onComplete: () => void;
}

/**
 * Workspace setup component shown on first launch
 * Prompts user to choose a directory for storing markdown files
 */
export const WorkspaceSetup = ({ onComplete }: WorkspaceSetupProps) => {
  const [directory, setDirectory] = useState<string | null>(null);
  const [author, setAuthor] = useState("");
  const [isSelecting, setIsSelecting] = useState(false);

  const handleChooseDirectory = async () => {
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

  const handleComplete = () => {
    if (!directory) return;

    // Save settings
    SettingsRepository.save({
      storageDirectory: directory,
      defaultAuthor: author || "user",
    });

    onComplete();
  };

  return (
    <div className="flex flex-col gap-6 p-8 max-w-lg mx-auto my-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Welcome to Writeme</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Choose where to store your notes as markdown files. This folder will
          contain all your notes organized by projects.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Storage Directory *</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={directory || ""}
              placeholder="No directory selected"
              readOnly
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-gray-100 dark:bg-gray-800 text-sm"
            />
            <button
              onClick={handleChooseDirectory}
              disabled={isSelecting}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSelecting ? "Selecting..." : "Choose Folder"}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Your notes will be saved as .md files that you can edit with any
            text editor
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">
            Your Name <span className="text-gray-500">(optional)</span>
          </label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="e.g., John Doe"
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Used to track who created and modified notes
          </p>
        </div>
      </div>

      <button
        onClick={handleComplete}
        disabled={!directory}
        className="px-6 py-3 bg-green-500 text-white font-medium rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Complete Setup
      </button>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        <p>
          <strong>Note:</strong> You can change these settings later in the
          app.
        </p>
      </div>
    </div>
  );
};
