import { generateNotePath, getUniqueFilePath } from "@/lib/file-utils";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";

export async function migrateWebOnlyNotesToDirectory(directoryPath: string): Promise<void> {
    const allNotes = await repositories.notes.getAll();
    const webOnlyNotes = allNotes.filter((note) => !note.filePath && note.content);

    for (const noteData of webOnlyNotes) {
        try {
            const note = Note.parse(noteData);
            const filePath = generateNotePath(directoryPath, note.title);
            const uniquePath = await getUniqueFilePath(filePath, async (p) => {
                const result = await window.electronAPI.fs.statFile(p);
                return result.exists;
            });

            const writeResult = await window.electronAPI.fs.writeFile(uniquePath, note.content);
            if (writeResult.success) {
                const updatedNote = {
                    ...note,
                    filePath: uniquePath,
                    fileSize: writeResult.fileSize,
                    lastSynced: new Date(writeResult.lastModified),
                    content: undefined,
                };
                // @ts-expect-error Existing repository update accepts persisted note data.
                await repositories.notes.update(note.id, updatedNote);
                console.log(`Migrated note "${note.title}" to ${uniquePath}`);
            }
        } catch (err) {
            console.error("Failed to migrate note:", noteData.title, err);
        }
    }
}
