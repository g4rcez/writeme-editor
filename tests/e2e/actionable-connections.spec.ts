import type { Locator, Page } from "@playwright/test";
import { createNote as createEmptyNote, goHome, test, expect } from "./fixtures";

test.describe.configure({ timeout: 90_000 });

async function createNote(
    page: Page,
    title: string,
    content = "",
    mode: "Formatted" | "Markdown" = "Formatted",
): Promise<string> {
    let url: string;
    if (mode === "Markdown") {
        const previousUrl = page.url();
        await page
            .getByRole("main")
            .getByRole("button", { name: /^New note/ })
            .first()
            .click();
        const dialog = page.getByRole("dialog", { name: /Create new note/i });
        await dialog.getByTitle("Note title").fill(title);
        await dialog.getByRole("button", { name: /^Create/ }).click();
        await expect(dialog).toBeHidden();
        await expect(page).toHaveURL(
            (currentUrl) => /\/note\/[^/]+$/.test(currentUrl.pathname) && currentUrl.href !== previousUrl,
        );
        url = page.url();
    } else {
        url = await createEmptyNote(page, title);
    }
    const editor = page.getByRole("textbox", {
        name: mode === "Markdown" ? "Markdown note editor" : "Note editor",
        exact: true,
    });
    await expect(editor).toBeVisible({ timeout: 30_000 });
    if (mode === "Formatted") await expect(editor).toHaveAttribute("contenteditable", "true");
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
    noteType?: string;
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

function contextSurface(page: Page): Locator {
    const role = (page.viewportSize()?.width ?? 1280) <= 959 ? "dialog" : "complementary";
    return page.getByRole(role, { name: "Context", exact: true });
}

async function openContext(page: Page): Promise<Locator> {
    await page.getByRole("button", { name: "Open note context", exact: true }).click();
    const surface = contextSurface(page);
    await expect(surface).toBeVisible();
    return surface;
}
async function closeContext(page: Page): Promise<void> {
    const surface = contextSurface(page);
    for (let attempt = 0; attempt < 2; attempt++) {
        if ((await surface.count()) === 0) return;
        await page.keyboard.press("Escape");
    }
    await expect(surface).toHaveCount(0);
}

function captureDuplicateKeyWarnings(page: Page): string[] {
    const warnings: string[] = [];
    page.on("console", function collectDuplicateKeyWarnings(message) {
        if (message.type() === "error" && message.text().includes("Encountered two children with the same key")) {
            warnings.push(message.text());
        }
    });
    return warnings;
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
        await page.goto("/settings/editor");
        const settings = page.getByRole("main", { name: "Settings" });
        await settings
            .getByRole("combobox", { name: "Default editor mode", exact: true })
            .selectOption(mode === "Markdown" ? "markdown" : "formatted");
        await settings.getByRole("button", { name: "Save Editor", exact: true }).click();
        await page
            .getByRole("dialog", { name: "Success", exact: true })
            .getByRole("button", { name: "OK", exact: true })
            .click();
        await goHome(page);
        await createNote(page, "Existing target", "", mode);
        await createNote(page, "Repair source", "See [[Missing name#Heading|my label]] and [[Missing name]].", mode);
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
        await closeContext(page);
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

test("repairs complete Markdown references while preserving labels, titles, anchors and file mentions", async ({
    cleanPage: page,
}) => {
    await goHome(page);
    await page.goto("/settings/editor");
    const settings = page.getByRole("main", { name: "Settings" });
    await settings.getByRole("combobox", { name: "Default editor mode", exact: true }).selectOption("markdown");
    await settings.getByRole("button", { name: "Save Editor", exact: true }).click();
    await page
        .getByRole("dialog", { name: "Success", exact: true })
        .getByRole("button", { name: "OK", exact: true })
        .click();
    await createNote(page, "Markdown target", "", "Markdown");
    const sourceUrl = await createNote(page, "Markdown source", "", "Markdown");
    const notes = await storedNotes(page);
    const target = notes.find((note) => note.title === "Markdown target")!;
    const source = notes.find((note) => note.title === "Markdown source")!;
    const file = '[README](docs/README.md "writeme-mention:file:docs/README.md")';
    const content = `${file}\n\n[**Visible**](app://note/missing#section "tooltip") and [Linked][ref]\n\n[ref]: app://note/other`;
    await changeStoredNote(page, source.id, { content });
    await page.goto(sourceUrl);
    await expect(page.getByRole("textbox", { name: "Markdown note editor", exact: true })).toContainText(
        "app://note/missing",
    );
    const context = await openContext(page);
    await context.getByText("Unresolved references", { exact: true }).click();
    const choose = context.getByRole("button", { name: "Choose existing note", exact: true });
    await expect(choose).toHaveCount(2);
    for (const remaining of [1, 0]) {
        await choose.first().click();
        await context.getByLabel("Find a note").fill("Markdown target");
        await context.getByRole("button", { name: /Markdown target/ }).click();
        await expect(choose).toHaveCount(remaining, { timeout: 15_000 });
    }
    const expected = `${file}\n\n[**Visible**](/note/${target.id}#section "tooltip") and [Linked](/note/${target.id})\n\n[ref]: app://note/other`;
    await expect
        .poll(async () => (await storedNotes(page)).find((note) => note.id === source.id)?.content, { timeout: 15_000 })
        .toBe(expected);
    await page.reload();
    expect((await storedNotes(page)).find((note) => note.id === source.id)?.content).toBe(expected);
});

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
    await closeContext(page);
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

test("keeps structured source content out of Markdown link suggestions", async ({ cleanPage: page }) => {
    await goHome(page);
    const targetUrl = await createNote(page, "Format target");
    await createNote(page, "Data source");
    const source = (await storedNotes(page)).find((note) => note.title === "Data source")!;
    const content = JSON.stringify({ text: "Format target [[Missing]]" });
    await changeStoredNote(page, source.id, { noteType: "json", content });
    await createNote(page, "HTML source");
    const html = (await storedNotes(page)).find((note) => note.title === "HTML source")!;
    await changeStoredNote(page, html.id, {
        content: 'Text <a href="https://example.com">Format target</a> and <code>Format target</code>.',
    });
    await page.goto(targetUrl);
    const context = await openContext(page);
    await context.getByText("Unlinked mentions", { exact: true }).click();
    await expect(context.getByRole("button", { name: "Preview link", exact: true })).toHaveCount(0);
    expect((await storedNotes(page)).find((note) => note.id === source.id)?.content).toBe(content);
});

for (const mode of ["Formatted", "Markdown"] as const) {
    test(`preserves unsaved source drafts across duplicate ${mode} panes`, async ({ cleanPage: page }) => {
        await page.setViewportSize({ width: 1800, height: 1000 });
        await goHome(page);
        const targetUrl = await createNote(page, "Draft target");
        await createNote(page, "Draft source", "See Draft target.");
        const source = (await storedNotes(page)).find((note) => note.title === "Draft source")!;
        await page.goto("/settings/editor");
        const settings = page.getByRole("main", { name: "Settings" });
        await settings.getByRole("checkbox", { name: "Autosave", exact: true }).uncheck();
        await settings
            .getByRole("combobox", { name: "Default editor mode", exact: true })
            .selectOption(mode === "Markdown" ? "markdown" : "formatted");
        await settings.getByRole("button", { name: "Save Editor", exact: true }).click();
        const confirmation = page.getByRole("dialog", { name: "Success", exact: true });
        await confirmation.getByRole("button", { name: "OK", exact: true }).click();
        await expect(confirmation).toBeHidden();
        await page.goto(targetUrl);
        await page.getByRole("button", { name: "Open pane mode", exact: true }).click();
        const second = page.getByRole("region", { name: "Editor group 2", exact: true });
        await second.getByRole("combobox", { name: "Select note for pane 2" }).selectOption(source.id);
        await page.getByRole("button", { name: "Add editor pane", exact: true }).first().click();
        const third = page.getByRole("region", { name: "Editor group 3", exact: true });
        await third.getByRole("combobox", { name: "Select note for pane 3" }).selectOption(source.id);
        const editorName = mode === "Markdown" ? "Markdown note editor" : "Note editor";
        const clean = second.getByRole("textbox", { name: editorName, exact: true });
        const draft = third.getByRole("textbox", { name: editorName, exact: true });
        await expect(clean).toContainText("See Draft target.");
        await expect(draft).toContainText("See Draft target.");
        await draft.focus();
        await page.keyboard.press("ControlOrMeta+a");
        await page.keyboard.insertText("My unsaved draft mentions Draft target.");
        await expect(draft).toContainText("My unsaved draft");
        const context = await openContext(page);
        await context.getByText("Unlinked mentions", { exact: true }).click();
        await context.getByRole("button", { name: "Preview link", exact: true }).click();
        await context.getByRole("button", { name: "Link this mention", exact: true }).click();
        await expect(context.getByRole("status")).toContainText("unsaved changes");
        await closeContext(page);
        await expect(clean).toHaveText("See Draft target.");
        await expect(draft).toContainText("My unsaved draft");
        expect((await storedNotes(page)).find((note) => note.id === source.id)?.content).toBe(source.content);
    });
}

for (const mode of ["Formatted", "Markdown"] as const) {
    test(`rejects Undo link without overwriting a newly opened unsaved ${mode} draft`, async ({ cleanPage: page }) => {
        await page.setViewportSize({ width: 1800, height: 1000 });
        await goHome(page);
        const targetUrl = await createNote(page, "Undo target");
        await createNote(page, "Undo source", "See Undo target.");
        const source = (await storedNotes(page)).find((note) => note.title === "Undo source")!;
        await page.goto("/settings/editor");
        const settings = page.getByRole("main", { name: "Settings" });
        await settings.getByRole("checkbox", { name: "Autosave", exact: true }).uncheck();
        await settings
            .getByRole("combobox", { name: "Default editor mode", exact: true })
            .selectOption(mode === "Markdown" ? "markdown" : "formatted");
        await settings.getByRole("button", { name: "Save Editor", exact: true }).click();
        await page
            .getByRole("dialog", { name: "Success", exact: true })
            .getByRole("button", { name: "OK", exact: true })
            .click();
        await page.goto(targetUrl);
        let context = await openContext(page);
        const surface = contextSurface(page);
        await expect(surface).toBeVisible();
        if ((page.viewportSize()?.width ?? 1280) <= 959) {
            await expect(surface).toHaveAttribute("aria-modal", "true");
        } else {
            await expect(surface).not.toHaveAttribute("aria-modal", "true");
        }
        await context.getByText("Unlinked mentions", { exact: true }).click();
        await context.getByRole("button", { name: "Preview link", exact: true }).click();
        await context.getByRole("button", { name: "Link this mention", exact: true }).click();
        await expect(context.getByRole("button", { name: "Undo link", exact: true })).toBeVisible();
        const saved = (await storedNotes(page)).find((note) => note.id === source.id)!;
        expect(saved.content).toContain("writeme-mention:");
        await page.keyboard.press("Escape");
        await expect(surface).toHaveCount(0);
        await page.getByRole("button", { name: "Open pane mode", exact: true }).click();
        const second = page.getByRole("region", { name: "Editor group 2", exact: true });
        await second.getByRole("combobox", { name: "Select note for pane 2" }).selectOption(source.id);
        const draft = second.getByRole("textbox", {
            name: mode === "Markdown" ? "Markdown note editor" : "Note editor",
            exact: true,
        });
        await expect(draft).toContainText("Undo target");
        await draft.focus();
        await page.keyboard.press("ControlOrMeta+a");
        await page.keyboard.insertText("My unsaved draft must survive Undo link.");
        context = await openContext(page);
        await expect(context.getByRole("button", { name: "Undo link", exact: true })).toBeVisible();
        await context.getByRole("button", { name: "Undo link", exact: true }).click();
        await expect(context.getByRole("status")).toContainText("unsaved changes");
        await page.keyboard.press("Escape");
        await expect(surface).toHaveCount(0);
        await expect(draft).toContainText("My unsaved draft must survive Undo link.");
        expect((await storedNotes(page)).find((note) => note.id === source.id)?.content).toBe(saved.content);
        await draft.focus();
        await page.keyboard.press("ControlOrMeta+z");
        if (mode === "Markdown") await expect(draft).toHaveText(saved.content);
        else await expect(draft).toContainText("See Undo target.");
        context = await openContext(page);
        await context.getByRole("button", { name: "Undo link", exact: true }).click();
        await expect(context.getByRole("button", { name: "Undo link", exact: true })).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(surface).toHaveCount(0);
        await expect(draft).toHaveText(source.content);
        for (let iteration = 0; iteration < 2; iteration++) {
            await draft.focus();
            await page.keyboard.press("ControlOrMeta+z");
            if (mode === "Markdown") await expect(draft).toHaveText(saved.content);
            else await expect(draft.locator('[data-type="mention"]')).toHaveCount(1);
            await page.keyboard.press("ControlOrMeta+Shift+z");
            await expect(draft).toHaveText(source.content);
        }
        expect((await storedNotes(page)).find((note) => note.id === source.id)?.content).toBe(saved.content);
    });

    test(`roundtrips precise repeated repairs in ${mode} without changing literal labels or unrelated whitespace`, async ({
        cleanPage: page,
    }) => {
        test.setTimeout(180_000);
        const duplicateKeyWarnings = captureDuplicateKeyWarnings(page);
        await page.goto("/settings/editor");
        const settings = page.getByRole("main", { name: "Settings" });
        await settings
            .getByRole("combobox", { name: "Default editor mode", exact: true })
            .selectOption(mode === "Markdown" ? "markdown" : "formatted");
        await settings.getByRole("button", { name: "Save Editor", exact: true }).click();
        await page
            .getByRole("dialog", { name: "Success", exact: true })
            .getByRole("button", { name: "OK", exact: true })
            .click();
        await goHome(page);
        await createNote(page, "Roundtrip target", "", mode);
        const sourceUrl = await createNote(page, "Roundtrip source", "", mode);
        await expect(page.getByRole("status", { name: "Note save status", exact: true })).toHaveText("Saved");
        const source = (await storedNotes(page)).find((note) => note.title === "Roundtrip source")!;
        await page.getByRole("button", { name: "Close Roundtrip source", exact: true }).click();
        await goHome(page);
        await expect(page.locator(`#editor-container-${source.id}`)).toHaveCount(0);
        const content = [
            '[README.md](docs/README.md "writeme-mention:file:docs/README.md")',
            "[API_v2](/note/deleted)",
            String.raw`[bracket \[one\] and \*star\*](/note/deleted)`,
            '[Old name](app://note/deleted "writeme-mention:deleted") and app://note/deleted',
            "[[Missing#Heading|wiki label]] and [[Missing#Heading|wiki label]]",
            '[**Visible**](app://note/deleted#Heading "tooltip")',
            "[Reference][ref]\n\n[ref]: app://note/deleted",
            "Keep  this",
        ].join("\n\n");
        await changeStoredNote(page, source.id, { content });
        await page.goto(sourceUrl);
        const editor = page.getByRole("textbox", {
            name: mode === "Markdown" ? "Markdown note editor" : "Note editor",
            exact: true,
        });
        await expect(editor).toContainText("Keep");
        await editor.focus();
        await page.keyboard.press("ControlOrMeta+s");
        await expect(page.getByRole("status", { name: "Note save status", exact: true })).toHaveText("Saved");
        if (mode === "Formatted")
            await expect
                .poll(async () => (await storedNotes(page)).find((note) => note.id === source.id)?.content)
                .not.toContain("[ref]:");
        const context = await openContext(page);
        await context.getByText("Unresolved references", { exact: true }).click();
        const choose = context.getByRole("button", { name: "Choose existing note", exact: true });
        await expect(choose).toHaveCount(8);
        for (let remaining = 7; remaining >= 0; remaining--) {
            const before = (await storedNotes(page)).find((note) => note.id === source.id)!.content;
            await choose.first().click();
            await context.getByLabel("Find a note").fill("Roundtrip target");
            await context.getByRole("button", { name: /Roundtrip target/ }).click();
            await expect(context.getByRole("status")).toContainText("Link added");
            await closeContext(page);
            await editor.focus();
            await page.keyboard.press("ControlOrMeta+s");
            await openContext(page);
            await context.getByText("Unresolved references", { exact: true }).click();
            await expect(choose).toHaveCount(remaining, { timeout: 15_000 });
            await expect
                .poll(async () => (await storedNotes(page)).find((note) => note.id === source.id)?.content, {
                    timeout: 15_000,
                })
                .not.toBe(before);
            const after = (await storedNotes(page)).find((note) => note.id === source.id)!.content;
            expect(after).toContain("Keep  this");
            expect(after).toContain("writeme-mention:file:docs/README.md");
            await closeContext(page);
            for (let roundtrip = 0; roundtrip < 2; roundtrip++) {
                await editor.focus();
                await page.keyboard.press("ControlOrMeta+z");
                await page.keyboard.press("ControlOrMeta+s");
                await expect
                    .poll(async () => (await storedNotes(page)).find((note) => note.id === source.id)?.content, {
                        timeout: 15_000,
                    })
                    .toBe(before);
                await page.keyboard.press("ControlOrMeta+Shift+z");
                await page.keyboard.press("ControlOrMeta+s");
                await expect
                    .poll(async () => (await storedNotes(page)).find((note) => note.id === source.id)?.content, {
                        timeout: 15_000,
                    })
                    .toBe(after);
            }
            if (remaining > 0) {
                await openContext(page);
                await context.getByText("Unresolved references", { exact: true }).click();
            }
        }
        const after = (await storedNotes(page)).find((note) => note.id === source.id)!.content;
        await page.reload();
        await expect(editor).toContainText(mode === "Markdown" ? "API" : "API_v2");
        if (mode === "Formatted") await expect(editor).toContainText("bracket [one] and *star*");
        expect((await storedNotes(page)).find((note) => note.id === source.id)?.content).toBe(after);
        expect(duplicateKeyWarnings).toEqual([]);
    });
}

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
