import { useEffect, useState, useRef } from "react";
import { useGlobalStore } from "../../store/global.store";
import { Project } from "../../store/project";
import { SettingsRepository } from "../../store/settings";
import { FolderOpen } from "lucide-react";

export const OpenProjectDialog = () => {
  const [state, dispatch] = useGlobalStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Load projects when dialog opens
  useEffect(() => {
    if (state.openProjectDialog) {
      dispatch.loadProjects();
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [state.openProjectDialog, dispatch]);

  // Filter projects by title and folderPath
  const filteredProjects = state.projects.filter((project) => {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();
    const titleMatch = project.title.toLowerCase().includes(lowerQuery);
    const pathMatch = project.folderPath.toLowerCase().includes(lowerQuery);
    return titleMatch || pathMatch;
  });

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.openProjectDialog) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredProjects.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredProjects[selectedIndex]) {
          openProject(filteredProjects[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.openProjectDialog, filteredProjects, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredProjects.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, filteredProjects]);

  const openProject = (project: Project) => {
    SettingsRepository.save({ storageDirectory: project.folderPath });
    window.location.reload();
  };

  const closeDialog = () => {
    dispatch.openProjectDialog(false);
  };

  if (!state.openProjectDialog) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm"
      onClick={closeDialog}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <FolderOpen className="w-5 h-5 text-gray-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-none text-lg placeholder-gray-400 dark:text-white"
            placeholder="Search projects..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <div className="text-xs text-gray-400 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded">
            Esc to close
          </div>
        </div>

        <ul ref={listRef} className="overflow-y-auto flex-1 p-2 scrollbar-thin">
          {filteredProjects.map((project, index) => (
            <li
              key={project.id}
              className={`flex flex-col px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                index === selectedIndex
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
              }`}
              onClick={() => openProject(project)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-medium ${
                    index === selectedIndex
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-900 dark:text-gray-100"
                  }`}
                >
                  {project.title}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(project.updatedAt).toLocaleDateString()}
                </span>
              </div>

              <div className="text-xs text-gray-500 mt-0.5 truncate">
                {project.folderPath}
              </div>
            </li>
          ))}

          {filteredProjects.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No projects found. Use <kbd className="px-1.5 py-0.5 mx-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">⌘ O</kbd> to open a folder first.
            </div>
          )}
        </ul>
      </div>
    </div>
  );
};
