import type { Page } from "@playwright/test";
import { createNote as createEmptyNote, goHome, test, expect } from "./fixtures";

test.describe.configure({ timeout: 90_000 });

async function createNote(page: Page, title: string, content = ""): Promise<string> {
    const url = await createEmptyNote(page, title);
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await expect(editor).toBeVisible({ timeout: 30_000 });
    await expect(editor).toHaveAttribute("contenteditable", "true");
    if (content) {
        await editor.focus();
        await editor.pressSequentially(content);
        await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", {
            timeout: 15_000,
        });
        await page.reload();
        await expect(editor).toBeVisible({ timeout: 30_000 });
    }
    return url;
}

type StoredNote = {
    id: string;
    title: string;
    content: string;
    metadata: Record<string, unknown>;
    updatedAt: Date;
    deletedAt?: Date;
};

async function storedNotes(page: Page): Promise<StoredNote[]> {
    return page.evaluate(async () => {
        const request = indexedDB.open("writeme");
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        try {
            const read = db.transaction("notes").objectStore("notes").getAll();
            return await new Promise<StoredNote[]>((resolve, reject) => {
                read.onsuccess = () => resolve(read.result);
                read.onerror = () => reject(read.error);
            });
        } finally {
            db.close();
        }
    });
}

async function changeStoredNote(page: Page, id: string, patch: Partial<StoredNote>): Promise<void> {
    await page.evaluate(
        async ({ id, patch }) => {
            const request = indexedDB.open("writeme");
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            const transaction = db.transaction("notes", "readwrite");
            const store = transaction.objectStore("notes");
            const read = store.get(id);
            read.onsuccess = () => store.put({ ...read.result, ...patch, updatedAt: new Date() });
            await new Promise<void>((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
            db.close();
        },
        { id, patch },
    );
}

async function openContext(page: Page) {
    await page.getByRole("button", { name: "Open note context", exact: true }).click();
    return page.locator(".writeme-context-pane, .writeme-context-modal").first();
}

test("creates a missing target once and immediately resolves repeated references", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "Missing source", "See [[New target]] and [[New target]].");
    const context = await openContext(page);
    await context.getByText("Unresolved references", { exact: true }).click();
    await context.getByRole("button", { name: "Create note", exact: true }).first().dblclick();
    await expect(context.getByRole("button", { name: "Create note", exact: true })).toHaveCount(0);
    await expect
        .poll(async () => (await storedNotes(page)).filter((note) => note.title === "New target").length)
        .toBe(1);
    await context.getByText("Linked notes", { exact: true }).click();
    await expect(context.getByRole("link", { name: "New target", exact: true })).toBeVisible();
});

test("rejects escaping targets and creates vault-root references inside the workspace", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "Safe connections", "[[../Outside]] and [[/Folder/New.md]]");
    const context = await openContext(page);
    await context.getByText("Unresolved references", { exact: true }).click();
    const invalid = context.locator("li").filter({ has: page.getByText("[[../Outside]]", { exact: true }) });
    await invalid.getByRole("button", { name: "Create note", exact: true }).click();
    await expect(context.getByRole("status")).toContainText("inside the workspace");
    expect((await storedNotes(page)).map((note) => note.title)).toEqual(["Safe connections"]);
    await context.getByRole("button", { name: "Refresh suggestions", exact: true }).click();
    const valid = context.locator("li").filter({ has: page.getByText("[[/Folder/New.md]]", { exact: true }) });
    await valid.getByRole("button", { name: "Create note", exact: true }).click();
    await expect(valid).toHaveCount(0);
    expect((await storedNotes(page)).some((note) => note.title === "Folder/New")).toBe(true);
});

for (const mode of ["Formatted", "Markdown"] as const) {
    test(`chooses an existing target in ${mode}, preserving labels, undo, and persistence`, async ({
        cleanPage: page,
    }) => {
        await goHome(page);
        await createNote(page, "Existing target");
        await createNote(page, "Repair source", "See [[Missing name#Heading|my label]] and [[Missing name]].");
        if (mode === "Markdown")
            await page
                .getByRole("toolbar", { name: "Note tools" })
                .getByRole("button", { name: "Markdown", exact: true })
                .click();
        const before = (await storedNotes(page)).find((note) => note.title === "Repair source")!;
        const context = await openContext(page);
        await context.getByText("Unresolved references", { exact: true }).click();
        await context.getByRole("button", { name: "Choose existing note", exact: true }).first().click();
        await context.getByLabel("Find a note").fill("Existing");
        await context.getByRole("button", { name: /Existing target/ }).click();
        await expect(context.getByRole("status")).toContainText("Link added");
        const editor = page.getByRole("textbox", {
            name: mode === "Markdown" ? "Markdown note editor" : "Note editor",
            exact: true,
        });
        await expect
            .poll(async () => (await storedNotes(page)).find((note) => note.id === before.id)?.content, {
                timeout: 15_000,
            })
            .not.toBe(before.content);
        await editor.focus();
        await page.keyboard.press("ControlOrMeta+z");
        await expect
            .poll(async () => (await storedNotes(page)).find((note) => note.id === before.id)?.content, {
                timeout: 15_000,
            })
            .toBe(before.content);
        await page.keyboard.press("ControlOrMeta+Shift+z");
        await expect
            .poll(async () => (await storedNotes(page)).find((note) => note.id === before.id)?.content, {
                timeout: 15_000,
            })
            .toContain("#Heading|my label]]");
        await expect
            .poll(async () => (await storedNotes(page)).find((note) => note.id === before.id)?.content, {
                timeout: 15_000,
            })
            .not.toBe(before.content);
        const after = (await storedNotes(page)).find((note) => note.id === before.id)!;
        expect(after.content).toContain("[[Missing name]]");
        await page.reload();
        await expect(editor).toContainText("my label");
        expect((await storedNotes(page)).find((note) => note.id === before.id)?.content).toBe(after.content);
    });
}

test("previews only unlinked title and alias occurrences from other notes and persists one chosen link", async ({
    cleanPage: page,
}, testInfo) => {
    await goHome(page);
    const targetUrl = await createNote(page, "Café");
    const target = (await storedNotes(page)).find((note) => note.title === "Café")!;
    await changeStoredNote(page, target.id, { metadata: { aliases: ["Coffee plan"] } });
    await createNote(page, "Mention source", "Review Café and Coffee plan, then Café. Ignore `Café` and [[Café]].");
    await page.goto(targetUrl);
    const context = await openContext(page);
    const section = context.locator("details").filter({ has: page.getByText("Unlinked mentions", { exact: true }) });
    await expect(section).not.toHaveAttribute("open");
    await section.locator("summary").click();
    await expect(section.getByRole("button", { name: "Preview link", exact: true })).toHaveCount(3);
    await section.getByRole("button", { name: "Preview link", exact: true }).nth(1).click();
    await expect(section.getByRole("region", { name: "Link preview" }).locator("mark")).toHaveText("Coffee plan");
    await expect(section.getByRole("region", { name: "Link preview" })).not.toContainText(target.id);
    await page.screenshot({ path: testInfo.outputPath("connections-desktop.png") });
    await section.getByRole("button", { name: "Link this mention", exact: true }).click();
    await expect(section.getByRole("button", { name: "Preview link", exact: true })).toHaveCount(2);
    const saved = (await storedNotes(page)).find((note) => note.title === "Mention source")!;
    expect(saved.content).toContain("[Coffee plan](/note/" + target.id);
    expect(saved.content).toContain("Review Café");
    await context.getByRole("button", { name: "Undo link", exact: true }).click();
    await expect(section.getByRole("button", { name: "Preview link", exact: true })).toHaveCount(3);
    await section.getByRole("button", { name: "Preview link", exact: true }).nth(1).click();
    await section.getByRole("button", { name: "Link this mention", exact: true }).click();
    await expect(section.getByRole("button", { name: "Preview link", exact: true })).toHaveCount(2);
    await page.reload();
    expect((await storedNotes(page)).find((note) => note.id === saved.id)?.content).toBe(saved.content);
});

test("shows distinct choices for ambiguous titles", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "Shared");
    const original = (await storedNotes(page)).find((note) => note.title === "Shared")!;
    await createNote(page, "Other");
    const other = (await storedNotes(page)).find((note) => note.title === "Other")!;
    await changeStoredNote(page, other.id, { title: "Shared" });
    await createNote(page, "Ambiguous source", "[[Shared]]");
    const context = await openContext(page);
    await context.getByText("Unresolved references", { exact: true }).click();
    await expect(context.getByText("More than one matching note.")).toBeVisible();
    await context.getByRole("button", { name: "Choose existing note", exact: true }).click();
    const choice = context.locator('button[data-note-id="' + original.id + '"]');
    await expect(choice).toBeVisible();
    await choice.click();
    await expect
        .poll(async () => (await storedNotes(page)).find((note) => note.title === "Ambiguous source")?.content, {
            timeout: 15_000,
        })
        .toContain(original.id);
    await page.locator('.ProseMirror [data-type="mention"]').filter({ hasText: "Shared" }).click();
    await expect(page).toHaveURL(new RegExp("/note/" + original.id + "$"));
});

test("keeps a newer source edit when a preview is stale and lets the user refresh and retry", async ({
    cleanPage: page,
}) => {
    await goHome(page);
    const targetUrl = await createNote(page, "Race target");
    await createNote(page, "Race source", "First Race target.");
    const source = (await storedNotes(page)).find((note) => note.title === "Race source")!;
    await page.goto(targetUrl);
    const context = await openContext(page);
    await context.getByText("Unlinked mentions", { exact: true }).click();
    await context.getByRole("button", { name: "Preview link", exact: true }).click();
    await changeStoredNote(page, source.id, { content: "My newer draft mentions Race target." });
    await context.getByRole("button", { name: "Link this mention", exact: true }).click();
    await expect(context.getByRole("status")).toContainText("source note changed");
    expect((await storedNotes(page)).find((note) => note.id === source.id)?.content).toBe(
        "My newer draft mentions Race target.",
    );
    await context.getByRole("button", { name: "Refresh suggestions", exact: true }).click();
    await context.getByRole("button", { name: "Preview link", exact: true }).click();
    await context.getByRole("button", { name: "Link this mention", exact: true }).click();
    await expect
        .poll(async () => (await storedNotes(page)).find((note) => note.id === source.id)?.content)
        .toContain("My newer draft mentions [Race target]");
});

test("keeps connection controls inside a narrow drawer and supports keyboard preview cancellation", async ({
    cleanPage: page,
}, testInfo) => {
    await goHome(page);
    const targetUrl = await createNote(page, "Mobile target");
    await createNote(page, "Mobile source", "Review Mobile target.");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(targetUrl);
    const context = await openContext(page);
    await context.getByText("Unlinked mentions", { exact: true }).click();
    await context.getByRole("button", { name: "Preview link", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(context.getByRole("region", { name: "Link preview" })).toBeVisible();
    const bounds = await context.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: testInfo.outputPath("connections-mobile.png") });
    await context.getByRole("button", { name: "Cancel preview", exact: true }).click();
    await expect(context.getByRole("region", { name: "Link preview" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open note context", exact: true })).toBeFocused();
});
