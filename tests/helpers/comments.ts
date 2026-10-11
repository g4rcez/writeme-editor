import { expect, type Page } from "@playwright/test";
import type { Note } from "../../packages/editor/src/store/note";
import type { NoteCommentThread } from "../../packages/editor/src/store/note-comment";

export async function readCommentStorage(page: Page): Promise<{ comments: NoteCommentThread[]; notes: Note[] }> {
    return page.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("writeme");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        try {
            const transaction = database.transaction(["comments", "notes"], "readonly");
            const read = (store: string): Promise<unknown[]> =>
                new Promise((resolve, reject) => {
                    const request = transaction.objectStore(store).getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            const [comments, notes] = await Promise.all([read("comments"), read("notes")]);
            return { comments, notes } as { comments: NoteCommentThread[]; notes: Note[] };
        } finally {
            database.close();
        }
    });
}

export async function selectCommentWords(page: Page, words: string, occurrence = 0): Promise<void> {
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.focus();
    await editor.evaluate(
        (element, { words, occurrence }) => {
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            const nodes: Text[] = [];
            let text = "";
            while (walker.nextNode()) {
                const node = walker.currentNode as Text;
                nodes.push(node);
                text += node.data;
            }
            let start = -1;
            for (let index = 0; index <= occurrence; index++) start = text.indexOf(words, start + 1);
            if (start < 0) throw new Error(`Text not found: ${words}`);
            const range = document.createRange();
            let offset = 0;
            for (const node of nodes) {
                if (start >= offset && start < offset + node.length) range.setStart(node, start - offset);
                const end = start + words.length;
                if (end > offset && end <= offset + node.length) {
                    range.setEnd(node, end - offset);
                    break;
                }
                offset += node.length;
            }
            window.getSelection()?.removeAllRanges();
            window.getSelection()?.addRange(range);
            document.dispatchEvent(new Event("selectionchange"));
        },
        { words, occurrence },
    );
    await expect(page.getByRole("toolbar", { name: "Formatting toolbar" })).toBeVisible();
}

export async function addNoteComment(page: Page, body: string): Promise<void> {
    await page.getByRole("button", { name: "Add comment", exact: true }).click();
    const panel = page.getByRole("complementary", { name: "Sentence comments" });
    await panel.getByRole("textbox", { name: "Comment", exact: true }).fill(body);
    await panel.getByRole("button", { name: "Save comment", exact: true }).click();
    await expect(panel.getByRole("list", { name: "Comments on this text" })).toContainText(body);
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 15_000 });
}
