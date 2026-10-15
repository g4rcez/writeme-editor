import { createNote, goHome, test, expect } from "./fixtures";

for (const mode of ["formatted", "markdown"] as const) {
    test(`keeps edits made while ${mode} saving is in progress`, async ({ cleanPage: page }) => {
        await goHome(page);
        await createNote(page, "Slow save");
        if (mode === "markdown") await page.getByRole("button", { name: "Markdown", exact: true }).click();
        await page.evaluate(async () => {
            const path = "/packages/editor/src/store/repositories/index.ts";
            const { repositories } = await import(path);
            const updateContent = repositories.notes.updateContent.bind(repositories.notes);
            repositories.notes.updateContent = async (id: string, content: string) => {
                await new Promise((resolve) => setTimeout(resolve, 700));
                return updateContent(id, content);
            };
        });
        const editor = page.locator(mode === "formatted" ? ".ProseMirror" : ".cm-content").first();
        const status = page.locator(".writeme-editor-status-bar output").first();
        await editor.click();
        await page.keyboard.type("First draft");
        await page.keyboard.press("Control+s");
        await expect(status).toHaveText("Saving…");
        await page.keyboard.type(" and later edits");
        await expect(status).toHaveText("Unsaved changes");
        await page.keyboard.press("Control+s");
        await expect(status).toHaveText("Saved", { timeout: 4000 });
        await expect(editor).toContainText("First draft and later edits");
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator(mode === "formatted" ? ".ProseMirror" : ".cm-content").first()).toContainText(
            "First draft and later edits",
        );
    });

    test(`saves ${mode} immediately with Ctrl/Cmd+S and clears the tab dot`, async ({ cleanPage: page }) => {
        await page.goto("/settings/editor", { waitUntil: "domcontentloaded" });
        await page.getByRole("checkbox").first().uncheck();
        await page.getByRole("button", { name: "Save Editor", exact: true }).click();
        const confirmation = page.getByRole("dialog", { name: "Success", exact: true });
        await expect(confirmation).toBeVisible();
        await confirmation.getByRole("button", { name: "OK", exact: true }).click();
        await expect(confirmation).toBeHidden();
        await page.getByRole("button", { name: "Go to home", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        await createNote(page, "Save shortcut");
        if (mode === "markdown") await page.getByRole("button", { name: "Markdown", exact: true }).click();
        const editor = page.locator(mode === "formatted" ? ".ProseMirror" : ".cm-content").first();
        const status = page.locator(".writeme-editor-status-bar output").first();
        for (const modifier of ["Control", "Meta"]) {
            await editor.click();
            await page.keyboard.type(` ${modifier} saved text`);
            await expect(status).toHaveText("Unsaved changes");
            await expect(page.locator('[data-save-status="unsaved"]')).toHaveCount(1);
            await page.keyboard.press(`${modifier}+s`);
            await expect(status).toHaveText("Saved", { timeout: 2000 });
            await expect(page.locator('[data-save-status="unsaved"]')).toHaveCount(0);
        }
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator(mode === "formatted" ? ".ProseMirror" : ".cm-content").first()).toContainText(
            "Meta saved text",
        );
    });
}

test("retains the pending tab dot after a failed save and allows retry", async ({ cleanPage: page }) => {
    await goHome(page);
    await createNote(page, "Save failure");
    const editor = page.locator(".ProseMirror").first();
    await editor.click();
    await page.keyboard.type("Retry this draft");
    await page.evaluate(() => {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function(value: unknown, key?: IDBValidKey): IDBRequest<IDBValidKey> {
            if (this.name === "notes") {
                IDBObjectStore.prototype.put = put;
                throw new DOMException("Unable to save note", "QuotaExceededError");
            }
            return put.call(this, value, key);
        };
    });
    await page.keyboard.press("Control+s");
    const status = page.locator(".writeme-editor-status-bar output").first();
    await expect(status).toHaveText("Save failed");
    await expect(page.locator('[data-save-status="error"]')).toHaveCount(1);
    await editor.click();
    await page.keyboard.press("Control+s");
    await expect(status).toHaveText("Saved", { timeout: 2000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".ProseMirror").first()).toContainText("Retry this draft");
});

test("saves an existing note in the floating editor", async ({ cleanPage: page }) => {
    await goHome(page);
    const noteUrl = await createNote(page, "Floating editor");
    await page.evaluate(() => {
        window.history.pushState({}, "", "/floating-editor");
        window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page).toHaveURL(/\/floating-editor$/);
    // Lazy navigation updates the URL before replacing the outgoing note editor.
    await expect(page.locator(".writeme-editor-page")).toHaveCount(0);
    const noteId = new URL(noteUrl).pathname.slice("/note/".length);
    const editor = page
        .locator(`#editor-container-${noteId}`)
        .getByRole("textbox", { name: "Note editor", exact: true });
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await expect(editor).toHaveAttribute("aria-busy", "false");
    await editor.click();
    await page.keyboard.type("Saved from floating editor");
    await expect(editor).toHaveText("Saved from floating editor");
    const status = page.getByRole("status", { name: "Note save status" });
    await expect(status).toHaveText("Unsaved changes");
    await editor.press("Meta+s");
    await expect(status).toHaveText("Saved", { timeout: 2000 });
    await page.goto(noteUrl);
    await expect(editor).toContainText("Saved from floating editor");
});

for (const route of ["quicknote", "mathnote"]) {
    test(`shows compact save feedback in ${route}`, async ({ cleanPage: page }) => {
        await page.goto(`/${route}`);
        const editor = page.locator(".ProseMirror").first();
        await expect(editor).toBeVisible();
        await editor.click();
        await page.keyboard.type(" floating saved text");
        const status = page.getByRole("status", { name: "Note save status" });
        await expect(status).toHaveText("Unsaved changes");
        await page.keyboard.press("Control+s");
        await expect(status).toHaveText("Saved", { timeout: 2000 });
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator(".ProseMirror").first()).toContainText("floating saved text");
    });
}
