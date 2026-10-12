import type { AnyExtension } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import StarterKit from "@tiptap/starter-kit";
import { Frontmatter } from "@/app/elements/frontmatter";
import { Subscript } from "@/app/extensions/subscript";
import { Markdown } from "@/app/extensions/tiptap-markdown/Markdown";

export function buildTaskNoteContent(): string {
    return "---\ntype: task\nview: kanban\n---\n\n## Backlog\n\n## Todo\n\n## In Progress\n\n## Done\n";
}

export function taskNoteExtensions(): AnyExtension[] {
    return [StarterKit, TaskList, TaskItem.configure({ nested: true }), Subscript, Frontmatter, Markdown];
}
