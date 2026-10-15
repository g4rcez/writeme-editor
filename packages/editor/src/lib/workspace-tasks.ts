import type { RootContent } from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { Note, NoteType } from "@/store/note";

export type WorkspaceTask = {
    id: string;
    title: string;
    noteId: string;
    noteTitle: string;
    heading: string | null;
    taskIndex: number;
    line: number;
};

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter);

function visibleText(node: RootContent): string {
    if (node.type === "text" || node.type === "inlineCode") return node.value;
    if (node.type === "image") return node.alt ?? "";
    if ("children" in node) return node.children.map(visibleText).join("");
    return "";
}

export function parseOpenWorkspaceTasks(notes: readonly Note[]): WorkspaceTask[] {
    const tasks: WorkspaceTask[] = [];
    const seen = new Set<string>();
    for (const note of notes) {
        if (note.deletedAt || seen.has(note.id)) continue;
        seen.add(note.id);
        if (![NoteType.note, NoteType.quick, NoteType["meeting-note"], NoteType.task].includes(note.noteType)) continue;
        const tree = parser.parse(note.content);
        let heading: string | null = null;
        let taskIndex = 0;
        const collect = (items: RootContent[]): void => {
            for (const node of items) {
                if (node.type === "heading") {
                    heading = visibleText(node).trim() || null;
                }
                if (node.type === "listItem" && typeof node.checked === "boolean") {
                    const index = taskIndex++;
                    const title = node.children
                        .filter((child) => child.type === "paragraph")
                        .map(visibleText)
                        .join(" ")
                        .trim();
                    if (!node.checked && title) {
                        tasks.push({
                            id: `${note.id}:${node.position?.start.offset ?? index}`,
                            title,
                            noteId: note.id,
                            noteTitle: note.title,
                            heading,
                            taskIndex: index,
                            line: node.position?.start.line ?? 1,
                        });
                    }
                }
                if ("children" in node) collect(node.children);
            }
        };
        collect(tree.children);
    }
    return tasks;
}
