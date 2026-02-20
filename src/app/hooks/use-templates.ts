import { useEffect, useState, useCallback } from "react";
import { repositories } from "@/store/repositories";
import { Note } from "@/store/note";
import { SettingsService } from "@/store/settings";
import { isElectron } from "@/lib/is-electron";

export const useTemplates = () => {
  const [templates, setTemplates] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const allTemplates = await repositories.notes.getTemplates();
      setTemplates(allTemplates);
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncTemplates = useCallback(async () => {
    if (!isElectron()) {
      await loadTemplates();
      return;
    }

    try {
      const settings = SettingsService.load();
      let templatesDir = settings.templatesDirectory;

      // Fallback logic
      if (!templatesDir) {
        if (settings.directory) {
          templatesDir = `${settings.directory}/.templates`;
        } else {
          const home = await window.electronAPI.env.getHome();
          templatesDir = `${home}/.templates`;
        }
      }

      // Ensure directory exists
      await window.electronAPI.fs.mkdir(templatesDir);

      // Read files
      let result = await window.electronAPI.fs.readDir(templatesDir);

      if (!result.error) {
        // If empty, create a default template
        if (result.entries.length === 0) {
          const defaultTemplatePath = `${templatesDir}/Meeting Notes.md`;
          const defaultContent = `# Meeting: {{Title}}\n\n**Date**: {{DATE}}\n**Participants**: {{Participants}}\n\n## Agenda\n- {{Agenda}}\n\n## Notes\n- \n\n## Action Items\n- [ ] `;
          await window.electronAPI.fs.writeFile(
            defaultTemplatePath,
            defaultContent,
          );
          // Refresh entries
          result = await window.electronAPI.fs.readDir(templatesDir);
        }

        if (!result.error) {
          const files = result.entries.filter(
            (f) => f.type === "file" && f.name.endsWith(".md"),
          );
          const currentTemplates = await repositories.notes.getTemplates();

          for (const file of files) {
            const filePath = file.path;

            const fileContent = await window.electronAPI.fs.readFile(filePath);

            if (fileContent.success) {
              const name = file.name.replace(/\.md$/, "");
              const existing = currentTemplates.find(
                (t) => t.filePath === filePath,
              );

              if (existing) {
                if (existing.content !== fileContent.content) {
                  existing.content = fileContent.content;
                  existing.title = name;
                  existing.updatedAt = new Date();
                  await repositories.notes.update(existing.id, existing);
                }
              } else {
                const newTemplate = Note.new(
                  name,
                  fileContent.content,
                  "template"
                );
                newTemplate.filePath = filePath;
                await repositories.notes.save(newTemplate);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to sync templates:", error);
    } finally {
      // Always reload after sync attempt to clear loading state
      await loadTemplates();
    }
  }, [loadTemplates]);

  useEffect(() => {
    syncTemplates();

    const handleUpdate = () => {
      loadTemplates();
    };

    window.addEventListener("templates:updated", handleUpdate);
    return () => window.removeEventListener("templates:updated", handleUpdate);
  }, [syncTemplates, loadTemplates]);

  return { templates, loading, refresh: syncTemplates };
};
