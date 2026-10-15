import type { Page } from "@playwright/test";
import type { NoteCommentThread } from "../../packages/editor/src/store/note-comment";
import { createNote, expect, goHome, test } from "./fixtures";

async function readCommentStorage(page: Page): Promise<{
    comments: NoteCommentThread[];
    notes: { id: string; title: string; metadata?: Record<string, unknown> }[];
}> {
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
            return { comments, notes } as {
                comments: NoteCommentThread[];
                notes: { id: string; title: string; metadata?: Record<string, unknown> }[];
            };
        } finally {
            database.close();
        }
    });
}

async function selectWords(page: Page, words: string, occurrence = 0): Promise<void> {
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

async function addComment(page: Page, body: string): Promise<void> {
    await page.getByRole("button", { name: "Add comment", exact: true }).click();
    const panel = page.getByRole("complementary", { name: "Sentence comments" });
    await panel.getByRole("textbox", { name: "Comment", exact: true }).fill(body);
    await panel.getByRole("button", { name: "Save comment", exact: true }).click();
    await expect(panel.getByRole("list", { name: "Comments on this text" })).toContainText(body);
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 15_000 });
}

test("saves highlighted sentence links, shares reply sections, and separates repeated words", async ({
    cleanPage: page,
}) => {
    await goHome(page);
    const sourceUrl = await createNote(
        page,
        "plans/advisor",
        "Review this sentence. Another thought. Review this sentence.",
    );
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await selectWords(page, "Review this sentence.");
    await addComment(page, "First comment\nMore details");
    const first = editor.getByRole("link", { name: "Review this sentence.", exact: true });
    await expect(first).toHaveAttribute("href", "./comments_advisor.md#review-this-sentence");
    await expect(first.locator("mark")).toHaveText("Review this sentence.");
    await page
        .getByRole("complementary", { name: "Sentence comments" })
        .getByRole("button", { name: "Close comments" })
        .click();
    await selectWords(page, "Review this sentence.", 1);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.type(" More writing after commenting.");
    await page.keyboard.press("Control+s");
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved");
    await page.reload();
    await expect(editor).toContainText("More writing after commenting.");
    await first.click();
    await expect(page).toHaveURL(sourceUrl);
    const panel = page.getByRole("complementary", { name: "Sentence comments" });
    await expect(panel).toContainText("First comment");
    await panel.getByRole("button", { name: "Reply", exact: true }).click();
    await panel.getByRole("textbox", { name: "Comment", exact: true }).fill("Second comment");
    await panel.getByRole("button", { name: "Save comment", exact: true }).click();
    await expect(panel.getByRole("list", { name: "Comments on this text" }).getByRole("listitem")).toHaveCount(2);
    await panel.getByRole("button", { name: "Close comments" }).click();
    await selectWords(page, "Another thought.");
    await addComment(page, "Separate thread");
    await panel.getByRole("button", { name: "Close comments" }).click();
    await selectWords(page, "Review this sentence.", 1);
    await addComment(page, "Repeated sentence");
    await expect(editor.locator('a[href="./comments_advisor.md#review-this-sentence-2"]')).toHaveText(
        "Review this sentence.",
    );
    const stored = await readCommentStorage(page);
    const sourceId = sourceUrl.split("/").pop();
    expect(stored.comments).toHaveLength(3);
    expect(stored.comments.every((thread) => thread.noteId === sourceId)).toBe(true);
    expect(stored.comments.find((thread) => thread.id === "review-this-sentence")?.comments).toEqual([
        "First comment\nMore details",
        "Second comment",
    ]);
    expect(stored.comments.find((thread) => thread.id === "review-this-sentence-2")?.comments).toEqual([
        "Repeated sentence",
    ]);
    const reference = stored.notes.find((note) => note.title === "plans/comments_advisor");
    expect(stored.comments.every((thread) => thread.referenceNoteId === reference?.id)).toBe(true);
    await panel.getByRole("button", { name: "Close comments" }).click();
    await page.getByRole("button", { name: "Comments (3)", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Another thought. (1)", exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Another thought. (1)", exact: true }).click();
    await expect(panel).toContainText("Separate thread");
    await expect(panel).not.toContainText("First comment");
    await panel.getByRole("button", { name: "Close comments" }).click();
    await page
        .getByRole("toolbar", { name: "Note tools" })
        .getByRole("button", { name: "Markdown", exact: true })
        .click();
    await expect(page.getByRole("textbox", { name: "Markdown note editor", exact: true })).toContainText(
        "[==Review this sentence.==](./comments_advisor.md#review-this-sentence)",
    );
    await page
        .getByRole("toolbar", { name: "Note tools" })
        .getByRole("button", { name: "Formatted", exact: true })
        .click();
    await first.first().click();
    await panel.getByRole("button", { name: "Open comments note" }).click();
    await expect(
        page.getByRole("textbox", { name: "Note editor", exact: true })
            .getByRole("heading", { name: "plans/comments_advisor", exact: true }),
    ).toBeVisible();
    await page
        .getByRole("toolbar", { name: "Note tools" })
        .getByRole("button", { name: "Markdown", exact: true })
        .click();
    const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    await expect(raw).toContainText("## review-this-sentence");
    await expect(raw).toContainText("## review-this-sentence-2");
    await expect(raw).toContainText("- Second comment");
    await page.reload();
    await expect(raw).toContainText("- Repeated sentence");
    expect((await readCommentStorage(page)).comments.map((thread) => ({ ...thread, updatedAt: undefined }))).toEqual(
        stored.comments.map((thread) => ({ ...thread, updatedAt: undefined })),
    );
});

test("rolls back the reference note when the comments table cannot be written", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "Table retry", "A sentence to store.");
    await selectWords(page, "A sentence to store.");
    await page.getByRole("button", { name: "Add comment", exact: true }).click();
    const panel = page.getByRole("complementary", { name: "Sentence comments" });
    await panel.getByRole("textbox", { name: "Comment", exact: true }).fill("Keep the table draft");
    await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put;
        let failed = false;
        IDBObjectStore.prototype.put = function(...args): IDBRequest<IDBValidKey> {
            if (!failed && this.name === "comments") {
                failed = true;
                throw new DOMException("Comments table is full", "QuotaExceededError");
            }
            return original.apply(this, args);
        };
    });
    await panel.getByRole("button", { name: "Save comment", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("Comments table is full");
    await expect(panel.getByRole("textbox", { name: "Comment", exact: true })).toHaveValue("Keep the table draft");
    const failed = await readCommentStorage(page);
    expect(failed.comments).toHaveLength(0);
    expect(failed.notes.some((note) => note.title === "comments_Table retry")).toBe(false);
    await expect(page.getByRole("textbox", { name: "Note editor", exact: true }).locator("mark")).toHaveCount(0);
    await panel.getByRole("button", { name: "Save comment", exact: true }).click();
    await expect(panel.getByRole("list", { name: "Comments on this text" })).toContainText("Keep the table draft");
    expect((await readCommentStorage(page)).comments[0]?.comments).toEqual(["Keep the table draft"]);
});

test("scopes sentence IDs to their source note in IndexedDB", async ({ cleanPage: page }) => {
    await goHome(page);
    const first = await createNote(page, "First source", "Shared words.");
    await selectWords(page, "Shared words.");
    await addComment(page, "First source comment");
    await goHome(page);
    const second = await createNote(page, "Second source", "Shared words.");
    await selectWords(page, "Shared words.");
    await addComment(page, "Second source comment");
    const stored = await readCommentStorage(page);
    expect(stored.comments).toHaveLength(2);
    expect(stored.comments.every((thread) => thread.id === "shared-words")).toBe(true);
    expect(stored.comments.find((thread) => thread.noteId === first.split("/").pop())?.comments).toEqual([
        "First source comment",
    ]);
    expect(stored.comments.find((thread) => thread.noteId === second.split("/").pop())?.comments).toEqual([
        "Second source comment",
    ]);
    await page.goto(first);
    await page
        .getByRole("textbox", { name: "Note editor", exact: true })
        .getByRole("link", { name: "Shared words." })
        .click();
    const panel = page.getByRole("complementary", { name: "Sentence comments" });
    await expect(panel).toContainText("First source comment");
    await expect(panel).not.toContainText("Second source comment");
});

test("keeps the comments table synchronized when editing the reference note", async ({ cleanPage: page }) => {
    await goHome(page);
    const sourceUrl = await createNote(page, "Editable comments", "Review these words.");
    await selectWords(page, "Review these words.");
    await addComment(page, "Original comment");
    const panel = page.getByRole("complementary", { name: "Sentence comments" });
    await panel.getByRole("button", { name: "Open comments note" }).click();
    await expect(
        page.getByRole("textbox", { name: "Note editor", exact: true })
            .getByRole("heading", { name: "comments_Editable comments", exact: true }),
    ).toBeVisible();
    await page
        .getByRole("toolbar", { name: "Note tools" })
        .getByRole("button", { name: "Markdown", exact: true })
        .click();
    const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    await expect(raw).toContainText("Original comment");
    const markdown = await raw.innerText();
    await raw.focus();
    await raw.press("ControlOrMeta+a");
    await page.keyboard.insertText(markdown.replace("Original comment", "Edited in the reference note"));
    await expect(raw).toContainText("Edited in the reference note");
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 15_000 });
    await expect
        .poll(async () => (await readCommentStorage(page)).comments[0]?.comments)
        .toEqual(["Edited in the reference note"]);
    await page.goto(sourceUrl);
    await page
        .getByRole("toolbar", { name: "Note tools" })
        .getByRole("button", { name: "Formatted", exact: true })
        .click();
    await page
        .getByRole("textbox", { name: "Note editor", exact: true })
        .getByRole("link", { name: "Review these words." })
        .click();
    await expect(panel.getByRole("list", { name: "Comments on this text" }).getByRole("listitem")).toHaveCount(1);
    await expect(panel).toContainText("Edited in the reference note");
});

test("migrates existing web comments when upgrading IndexedDB", async ({ cleanPage: page }) => {
    await page.route("**/seed-comments", (route) =>
        route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Seed</title>" }),
    );
    await page.goto("/seed-comments");
    const sourceId = await page.evaluate(async () => {
        const databaseModule = "/packages/editor/src/store/repositories/browser/dexie-db.ts";
        const noteModule = "/packages/editor/src/store/note.ts";
        const { db } = await import(databaseModule);
        const { Note } = await import(noteModule);
        const schemas = db.tables
            .filter((table: { name: string }) => table.name !== "comments")
            .map(
                (table: {
                    name: string;
                    schema: {
                        primKey: { keyPath: string | string[]; auto: boolean };
                        indexes: { name: string; keyPath: string | string[]; unique: boolean; multi: boolean }[];
                    };
                }) => ({ name: table.name, ...table.schema }),
            );
        db.close();
        const source = Note.new(
            "Legacy advisor",
            "[==Legacy sentence.==](./comments_Legacy%20advisor.md#legacy-sentence)",
        );
        const companion = Note.new(
            "comments_Legacy advisor",
            "# Legacy comments\n\n## legacy-sentence\n\n> Legacy sentence.\n\n- First legacy comment\n\n- Legacy reply\n",
        );
        companion.metadata = { commentSourceId: source.id };
        await new Promise<void>((resolve, reject) => {
            const request = indexedDB.open("writeme", 250);
            request.onupgradeneeded = () => {
                for (const schema of schemas) {
                    const store = request.result.createObjectStore(schema.name, {
                        keyPath: schema.primKey.keyPath,
                        autoIncrement: schema.primKey.auto,
                    });
                    for (const index of schema.indexes)
                        store.createIndex(index.name, index.keyPath, { unique: index.unique, multiEntry: index.multi });
                }
                request.transaction!.objectStore("notes").put(source);
                request.transaction!.objectStore("notes").put(companion);
                request
                    .transaction!.objectStore("settings")
                    .put({ id: "retained", name: "retained", value: "preserved" });
            };
            request.onsuccess = () => {
                request.result.close();
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
        return source.id as string;
    });
    await page.goto(`/note/${sourceId}`);
    await page
        .getByRole("textbox", { name: "Note editor", exact: true })
        .getByRole("link", { name: "Legacy sentence." })
        .click();
    const panel = page.getByRole("complementary", { name: "Sentence comments" });
    await expect(panel.getByRole("list", { name: "Comments on this text" }).getByRole("listitem")).toHaveCount(2);
    const stored = await readCommentStorage(page);
    expect(stored.notes).toHaveLength(2);
    expect(stored.comments).toHaveLength(1);
    expect(stored.comments[0]).toMatchObject({
        noteId: sourceId,
        id: "legacy-sentence",
        quote: "Legacy sentence.",
        comments: ["First legacy comment", "Legacy reply"],
    });
    await page.reload();
    expect((await readCommentStorage(page)).comments.map((thread) => ({ ...thread, updatedAt: undefined }))).toEqual(
        stored.comments.map((thread) => ({ ...thread, updatedAt: undefined })),
    );
});

test("supports keyboard creation and cancellation without saving empty comments", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "Keyboard comments", "Select these words.");
    await selectWords(page, "Select these words.");
    await page.keyboard.press("ControlOrMeta+Alt+m");
    const panel = page.getByRole("complementary", { name: "Sentence comments" });
    await expect(panel.getByRole("textbox", { name: "Comment", exact: true })).toBeFocused();
    await expect(panel.getByRole("button", { name: "Save comment", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(page.getByRole("textbox", { name: "Note editor", exact: true }).locator("mark")).toHaveCount(0);
});

test("keeps the draft after a failed write and retries without duplicate comments", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "Retry comments", "A sentence to review.");
    await selectWords(page, "A sentence to review.");
    await page.getByRole("button", { name: "Add comment", exact: true }).click();
    const panel = page.getByRole("complementary", { name: "Sentence comments" });
    await panel.getByRole("textbox", { name: "Comment", exact: true }).fill("Keep my draft");
    await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put;
        let failed = false;
        IDBObjectStore.prototype.put = function(...args): IDBRequest<IDBValidKey> {
            const value = args[0];
            if (!failed && this.name === "notes" && value?.metadata?.commentSourceId) {
                failed = true;
                throw new DOMException("Comment write failed", "QuotaExceededError");
            }
            return original.apply(this, args);
        };
    });
    await panel.getByRole("button", { name: "Save comment", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("Comment write failed");
    await expect(panel.getByRole("textbox", { name: "Comment", exact: true })).toHaveValue("Keep my draft");
    await expect(page.getByRole("textbox", { name: "Note editor", exact: true }).locator("mark")).toHaveCount(0);
    await panel.getByRole("button", { name: "Save comment", exact: true }).click();
    await expect(panel.getByRole("list", { name: "Comments on this text" }).getByRole("listitem")).toHaveCount(1);
    await page.reload();
    await page
        .getByRole("textbox", { name: "Note editor", exact: true })
        .getByRole("link", { name: "A sentence to review." })
        .click();
    await expect(panel.getByRole("list", { name: "Comments on this text" }).getByRole("listitem")).toHaveCount(1);
});

test("rolls back source and comment together after a failed source write", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "Source retry", "Comment this sentence.");
    await selectWords(page, "Comment this sentence.");
    await page.getByRole("button", { name: "Add comment", exact: true }).click();
    const panel = page.getByRole("complementary", { name: "Sentence comments" });
    await panel.getByRole("textbox", { name: "Comment", exact: true }).fill("Only once");
    await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put;
        let failed = false;
        IDBObjectStore.prototype.put = function(...args): IDBRequest<IDBValidKey> {
            const value = args[0];
            if (!failed && this.name === "notes" && value?.title === "Source retry" && value?.content?.includes("==")) {
                failed = true;
                throw new DOMException("Source write failed", "QuotaExceededError");
            }
            return original.apply(this, args);
        };
    });
    await panel.getByRole("button", { name: "Save comment", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("Source write failed");
    expect((await readCommentStorage(page)).comments).toHaveLength(0);
    await expect(page.getByRole("textbox", { name: "Note editor", exact: true }).locator("mark")).toHaveCount(0);
    await panel.getByRole("button", { name: "Save comment", exact: true }).click();
    await expect(panel.getByRole("list", { name: "Comments on this text" }).getByRole("listitem")).toHaveCount(1);
    await page.reload();
    await page
        .getByRole("textbox", { name: "Note editor", exact: true })
        .getByRole("link", { name: "Comment this sentence." })
        .click();
    await expect(panel.getByRole("list", { name: "Comments on this text" }).getByRole("listitem")).toHaveCount(1);
});

test("keeps concurrent replies and refreshes an open sentence panel", async ({ cleanPage: page, context }) => {
    await goHome(page);
    const url = await createNote(page, "Concurrent source", "Reply to these words.");
    await selectWords(page, "Reply to these words.");
    await addComment(page, "First reply");
    const other = await context.newPage();
    try {
        await other.goto(url);
        await other.evaluate(async (id) => {
            const repositoryModule = "/packages/editor/src/store/repositories/index.ts";
            const commentModule = "/packages/editor/src/app/comments/comment-repository.ts";
            const { repositories } = await import(repositoryModule);
            const { saveNoteComment } = await import(commentModule);
            const source = await repositories.notes.getOne(id);
            await Promise.all([
                saveNoteComment(
                    source,
                    "Reply to these words.",
                    "Concurrent second",
                    "reply-to-these-words",
                    [],
                    () => source.content,
                ),
                saveNoteComment(
                    source,
                    "Reply to these words.",
                    "Concurrent third",
                    "reply-to-these-words",
                    [],
                    () => source.content,
                ),
            ]);
        }, url.split("/").pop());
        await expect.poll(async () => (await readCommentStorage(page)).comments[0]?.comments.length).toBe(3);
        const panel = page.getByRole("complementary", { name: "Sentence comments" });
        await expect(panel.getByRole("list", { name: "Comments on this text" }).getByRole("listitem")).toHaveCount(3);
        await expect(panel).toContainText("Concurrent second");
        await expect(panel).toContainText("Concurrent third");
    } finally {
        await other.close();
    }
});

test("preserves another editor's source changes when a comment draft is stale", async ({ cleanPage: page }) => {
    await goHome(page);
    const url = await createNote(page, "Stale source", "Original words.");
    await selectWords(page, "Original words.");
    await page.getByRole("button", { name: "Add comment", exact: true }).click();
    const panel = page.getByRole("complementary", { name: "Sentence comments" });
    await panel.getByRole("textbox", { name: "Comment", exact: true }).fill("Keep the draft");
    await page.evaluate(async (id) => {
        const modulePath = "/packages/editor/src/store/repositories/index.ts";
        const { repositories } = await import(modulePath);
        await repositories.notes.updateContent(id, "Changed in another editor.");
    }, url.split("/").pop());
    await panel.getByRole("button", { name: "Save comment", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("source note changed");
    await expect(panel.getByRole("textbox", { name: "Comment", exact: true })).toHaveValue("Keep the draft");
    const stored = await readCommentStorage(page);
    expect(stored.comments).toHaveLength(0);
    expect(stored.notes.find((note) => note.id === url.split("/").pop())).toMatchObject({
        content: "Changed in another editor.",
    });
});

test("retains comments through trash and restore and removes their rows on permanent deletion", async ({
    cleanPage: page,
}) => {
    await goHome(page);
    const url = await createNote(page, "Lifecycle source", "Keep these words.");
    await selectWords(page, "Keep these words.");
    await addComment(page, "Retained comment");
    const sourceId = url.split("/").pop()!;
    const reference = (await readCommentStorage(page)).comments[0]!.referenceNoteId;
    await page.evaluate(
        async ({ sourceId, reference }) => {
            const modulePath = "/packages/editor/src/store/repositories/index.ts";
            const { repositories } = await import(modulePath);
            await repositories.notes.delete(sourceId);
            await repositories.notes.restore(sourceId);
            await repositories.notes.delete(reference);
        },
        { sourceId, reference },
    );
    await page.reload();
    await page
        .getByRole("textbox", { name: "Note editor", exact: true })
        .getByRole("link", { name: "Keep these words." })
        .click();
    await expect(page.getByRole("complementary", { name: "Sentence comments" }).getByRole("alert")).toContainText(
        "in Trash",
    );
    expect((await readCommentStorage(page)).comments).toHaveLength(1);
    await page.evaluate(async (reference) => {
        const modulePath = "/packages/editor/src/store/repositories/index.ts";
        const { repositories } = await import(modulePath);
        await repositories.notes.restore(reference);
    }, reference);
    const retry = page.getByRole("button", { name: "Retry loading comments" });
    if (await retry.isVisible()) await retry.click();
    await expect(page.getByRole("complementary", { name: "Sentence comments" })).toContainText("Retained comment");
    await expect(page.getByRole("complementary", { name: "Sentence comments" }).getByRole("alert")).toBeHidden();
    await page.evaluate(
        async ({ sourceId, reference }) => {
            const modulePath = "/packages/editor/src/store/repositories/index.ts";
            const { repositories } = await import(modulePath);
            await repositories.notes.hardDelete(sourceId);
            await repositories.notes.updateContent(
                reference,
                "## keep-these-words\n\n> Keep these words.\n\n- Retained orphan reference\n",
            );
        },
        { sourceId, reference },
    );
    expect((await readCommentStorage(page)).comments).toHaveLength(0);
});

test("preserves literal highlight delimiters and renders comment HTML as text", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "Literal source", "Price == value.");
    await selectWords(page, "Price == value.");
    const body = '<img src=x onerror="window.commentXss=true">';
    await addComment(page, body);
    const panel = page.getByRole("complementary", { name: "Sentence comments" });
    await expect(panel.locator("img")).toHaveCount(0);
    await page.reload();
    await page
        .getByRole("textbox", { name: "Note editor", exact: true })
        .getByRole("link", { name: "Price == value." })
        .click();
    await expect(panel).toContainText(body);
    await expect(panel.locator("img")).toHaveCount(0);
    expect(await page.evaluate(() => Reflect.get(window, "commentXss"))).toBeUndefined();
    await page.getByRole("textbox", { name: "Note editor", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
});

test("preserves sentence comments after renaming their source note", async ({ cleanPage: page }) => {
    await goHome(page);
    const sourceUrl = await createNote(page, "Rename source", "Words that stay linked.");
    await selectWords(page, "Words that stay linked.");
    await addComment(page, "Survives a rename");
    const noteId = sourceUrl.split("/").pop()!;
    await page.evaluate(async (id) => {
        const modulePath = "/packages/editor/src/store/repositories/index.ts";
        const { repositories } = await import(modulePath);
        const source = await repositories.notes.getOne(id);
        source.title = "Renamed source";
        await repositories.notes.save(source);
    }, noteId);
    await page.reload();
    await expect(page.getByRole("button", { name: "Comments (1)", exact: true })).toBeVisible();
    await page
        .getByRole("textbox", { name: "Note editor", exact: true })
        .getByRole("link", { name: "Words that stay linked." })
        .click();
    await expect(page.getByRole("complementary", { name: "Sentence comments" })).toContainText("Survives a rename");
});

for (const theme of ["dark", "light"]) {
    test(`keeps sentence comments within the viewport on narrow screens (${theme})`, async ({
        cleanPage: page,
    }, testInfo) => {
        await goHome(page);
        await createNote(page, "Mobile comments", "A sentence with a comment.");
        await page.evaluate((theme) => {
            document.documentElement.className = theme;
        }, theme);
        await page.setViewportSize({ width: 375, height: 812 });
        await selectWords(page, "A sentence with a comment.");
        await addComment(page, "Visible on a small screen.");
        const panel = page.getByRole("complementary", { name: "Sentence comments" });
        const bounds = await panel.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(812);
        const sentence = await page
            .getByRole("textbox", { name: "Note editor", exact: true })
            .getByRole("link", { name: "A sentence with a comment." })
            .boundingBox();
        expect(sentence).not.toBeNull();
        await expect
            .poll(async () => (await panel.boundingBox())?.y ?? -1)
            .toBeGreaterThanOrEqual(sentence!.y + sentence!.height);
        expect(await panel.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
            "rgba(0, 0, 0, 0)",
        );
        await page.screenshot({ path: testInfo.outputPath(`note-comments-${theme}-mobile.png`) });
    });
}
