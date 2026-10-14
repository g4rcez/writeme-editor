import type { Page } from "@playwright/test";
import { researchPdf, savedContent, selectPdfPhrase } from "../helpers/research";
import { expect, goHome, test } from "./fixtures";

test.setTimeout(120_000);

async function importResearchPdf(page: Page): Promise<string> {
    await goHome(page);
    await page.getByRole("button", { name: "Import PDF", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Import PDF", exact: true });
    await dialog
        .getByLabel("PDF document", { exact: true })
        .setInputFiles({ name: "Research.pdf", mimeType: "application/pdf", buffer: researchPdf() });
    await dialog.getByRole("button", { name: "Import PDF", exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true", {
        timeout: 30_000,
    });
    return new URL(page.url()).pathname.split("/").at(-1)!;
}

async function seedArticle(page: Page): Promise<{ article: string; destination: string }> {
    await goHome(page);
    const ids = await page.evaluate(async () => {
        const { repositories } = (await import(
            String("/packages/editor/src/store/global.store.ts")
        )) as typeof import("../../packages/editor/src/store/global.store");
        const { Note, NoteType } = (await import(
            String("/packages/editor/src/store/note.ts")
        )) as typeof import("../../packages/editor/src/store/note");
        const article = Note.new(
            "Saved research",
            "A saved article phrase.\n\nAnother useful excerpt.",
            NoteType["read-it-later"],
            "https://example.test/research?ref=original",
        );
        const destination = Note.new("My writing", "My original writing.");
        await repositories.notes.save(article);
        await repositories.notes.save(destination);
        return { article: article.id, destination: destination.id };
    });
    await page.goto(`/note/${ids.article}`);
    await expect(page.locator(".ProseMirror")).toContainText("A saved article phrase.");
    return ids;
}

async function selectArticle(page: Page, paragraph = 0): Promise<void> {
    const text = page.locator(".ProseMirror p").nth(paragraph);
    await text.click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+ArrowLeft" : "Home");
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Shift+ArrowRight" : "Shift+End");
    expect(await page.evaluate(() => window.getSelection()?.toString())).not.toBe("");
}

test("captures real PDF text, creates writing, appends another excerpt and returns to its saved page", async ({
    page,
}, testInfo) => {
    const sourceId = await importResearchPdf(page);
    await page.getByRole("button", { name: "Pen", exact: true }).click();
    const canvas = await page.getByLabel("Handwriting canvas", { exact: true }).boundingBox();
    if (!canvas) throw new Error("PDF annotation canvas missing");
    await page.mouse.move(canvas.x + canvas.width * 0.3, canvas.y + canvas.height * 0.45);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width * 0.6, canvas.y + canvas.height * 0.48, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator("[data-ink-stroke]")).toHaveCount(1);
    await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
    await page.getByRole("button", { name: "Read PDF", exact: true }).click();
    const original = await savedContent(page, sourceId);
    await page.getByRole("button", { name: "Send selection to note", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Select text in this source");
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(page.getByLabel("PDF page 2", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
    await selectPdfPhrase(page);
    expect(await page.evaluate(() => window.getSelection()?.toString())).toContain("Landscape research phrase");
    await page.getByRole("button", { name: "Send selection to note", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Send selection to note", exact: true });
    await dialog.getByRole("button", { name: "Create a note", exact: true }).click();
    await dialog.getByLabel("Destination note title", { exact: true }).fill("Research writing");
    await dialog.getByRole("button", { name: "Send excerpt", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(".ProseMirror")).toContainText("Landscape research phrase");
    const destinationId = new URL(page.url()).pathname.split("/").at(-1)!;
    await page.reload();
    await expect(page.locator(".ProseMirror")).toContainText("Research, p. 2");
    const content = await savedContent(page, destinationId);
    expect(content).toContain(`Open source](/note/${sourceId}?research=1`);
    expect(content).toContain("page=2&pdf=");
    await page.getByRole("link", { name: "Open source", exact: true }).click();
    await expect(page.getByLabel("Go to page", { exact: true })).toHaveValue("2");
    await expect(page.getByLabel("PDF page 2", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
    await page.getByRole("button", { name: "Previous page", exact: true }).click();
    await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
    await page.getByRole("button", { name: "Select page text", exact: true }).focus();
    await page.keyboard.press("Enter");
    await dialog.getByLabel("Destination note", { exact: true }).selectOption(destinationId);
    await dialog.getByRole("button", { name: "Send excerpt", exact: true }).click();
    await expect(page.locator(".ProseMirror")).toContainText("Portrait research phrase");
    await page.reload();
    await expect(page.locator(".ProseMirror blockquote")).toHaveCount(2);
    expect(await savedContent(page, sourceId)).toBe(original);
    await page.screenshot({ path: testInfo.outputPath("pdf-excerpts.png") });
});

test("keeps new-note creation retryable without duplicates and refuses a destination's pending edits", async ({
    page,
}) => {
    const ids = await seedArticle(page);
    await selectArticle(page);
    await page.getByRole("button", { name: "Send selection to note", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Send selection to note", exact: true });
    await dialog.getByLabel("Destination note", { exact: true }).selectOption(ids.destination);
    await page.evaluate(async (id) => {
        const { uiDispatch } = (await import(
            String("/packages/editor/src/store/ui.store.ts")
        )) as typeof import("../../packages/editor/src/store/ui.store");
        uiDispatch.setEditorSaveStatus("unsaved", id);
    }, ids.destination);
    await dialog.getByRole("button", { name: "Send excerpt", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("pending edits");
    expect(await savedContent(page, ids.destination)).toBe("My original writing.");
    await dialog.getByRole("button", { name: "Create a note", exact: true }).click();
    await dialog.getByRole("button", { name: "Send excerpt", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Enter a title");
    await dialog.getByLabel("Destination note title", { exact: true }).fill("Retry-safe writing");
    await page.evaluate(async () => {
        const { repositories } = (await import(
            String("/packages/editor/src/store/global.store.ts")
        )) as typeof import("../../packages/editor/src/store/global.store");
        const original = repositories.notes.save.bind(repositories.notes);
        let first = true;
        repositories.notes.save = async (note) => {
            const saved = await original(note);
            if (first) {
                first = false;
                throw new Error("Simulated interrupted response. Retry.");
            }
            return saved;
        };
    });
    await dialog.getByRole("button", { name: "Send excerpt", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Retry");
    await dialog.getByRole("button", { name: "Send excerpt", exact: true }).click();
    await expect(page.locator(".ProseMirror blockquote")).toHaveCount(1);
    expect(
        await page.evaluate(async () => {
            const { repositories } = (await import(
                String("/packages/editor/src/store/global.store.ts")
            )) as typeof import("../../packages/editor/src/store/global.store");
            return (await repositories.notes.getAll()).filter((note) => note.title === "Retry-safe writing").length;
        }),
    ).toBe(1);
});

test.describe("PDF excerpt touch access", () => {
    test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
    test("captures page text on a narrow touch screen and cancels without changing the source", async ({
        page,
    }, testInfo) => {
        const id = await importResearchPdf(page);
        const content = await savedContent(page, id);
        await page.getByRole("button", { name: "Select page text", exact: true }).tap();
        const dialog = page.getByRole("dialog", { name: "Send selection to note", exact: true });
        await expect(dialog).toBeInViewport();
        await expect(dialog.locator("blockquote")).toHaveText("Portrait research phrase");
        await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport({ ratio: 1 });
        await expect(dialog.getByRole("button", { name: "Send excerpt", exact: true })).toBeInViewport({ ratio: 1 });
        await page.screenshot({ path: testInfo.outputPath("pdf-excerpt-touch.png") });
        await dialog.getByRole("button", { name: "Cancel", exact: true }).tap();
        expect(await savedContent(page, id)).toBe(content);
    });
});

test("captures saved article with keyboard, cancels, appends to latest writing and preserves original URL", async ({
    page,
}, testInfo) => {
    const ids = await seedArticle(page);
    const original = await savedContent(page, ids.article);
    await selectArticle(page);
    const send = page.getByRole("button", { name: "Send selection to note", exact: true });
    await send.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Send selection to note", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(send).toBeFocused();
    expect(await savedContent(page, ids.destination)).toBe("My original writing.");
    await selectArticle(page);
    await send.click();
    await dialog.getByLabel("Destination note", { exact: true }).selectOption(ids.destination);
    await page.evaluate(async (id) => {
        const { repositories } = (await import(
            String("/packages/editor/src/store/global.store.ts")
        )) as typeof import("../../packages/editor/src/store/global.store");
        await repositories.notes.updateContent(id, "Concurrent writing kept.");
    }, ids.destination);
    await dialog.getByRole("button", { name: "Send excerpt", exact: true }).click();
    await expect(page.locator(".ProseMirror")).toContainText("Concurrent writing kept.");
    await page.reload();
    await expect(page.locator(".ProseMirror blockquote")).toContainText("A saved article phrase.");
    await expect(page.getByRole("link", { name: "Original article", exact: true })).toHaveAttribute(
        "href",
        "https://example.test/research?ref=original",
    );
    await page.getByRole("link", { name: "Open source", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/note/${ids.article}\\?`));
    await expect(page.locator(".ProseMirror")).toContainText("Another useful excerpt.");
    expect(await savedContent(page, ids.article)).toBe(original);
    await page.setViewportSize({ width: 390, height: 844 });
    await selectArticle(page, 1);
    await send.click();
    await expect(dialog).toBeInViewport();
    await dialog.getByLabel("Destination note", { exact: true }).selectOption(ids.destination);
    await page.screenshot({ path: testInfo.outputPath("article-excerpt-narrow.png") });
    await dialog.getByRole("button", { name: "Send excerpt", exact: true }).click();
    await expect(page.locator(".ProseMirror blockquote")).toHaveCount(2);
});

test("recovers from a conditional-write race and an uncertain success without duplicating an excerpt", async ({
    page,
}) => {
    const ids = await seedArticle(page);
    await selectArticle(page);
    await page.getByRole("button", { name: "Send selection to note", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Send selection to note", exact: true });
    await dialog.getByLabel("Destination note", { exact: true }).selectOption(ids.destination);
    await page.evaluate(async () => {
        const { repositories } = (await import(
            String("/packages/editor/src/store/global.store.ts")
        )) as typeof import("../../packages/editor/src/store/global.store");
        const original = repositories.notes.updateContentIfUnchanged.bind(repositories.notes);
        let attempts = 0;
        repositories.notes.updateContentIfUnchanged = async (id, expected, content) => {
            if (++attempts === 1) {
                await repositories.notes.updateContent(id, "Racing edit retained.");
                return null;
            }
            const updated = await original(id, expected, content);
            if (attempts === 2) throw new Error("Simulated response interruption; retry.");
            return updated;
        };
    });
    await dialog.getByRole("button", { name: "Send excerpt", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("changed");
    await dialog.getByRole("button", { name: "Send excerpt", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("retry");
    await dialog.getByRole("button", { name: "Send excerpt", exact: true }).click();
    await expect(page.locator(".ProseMirror blockquote")).toHaveCount(1);
    await expect(page.locator(".ProseMirror")).toContainText("Racing edit retained.");
});

test("reports missing and replaced PDF assets, allows retry, and reports a removed source note", async ({ page }) => {
    const id = await importResearchPdf(page);
    await page.getByRole("button", { name: "Select page text", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Send selection to note", exact: true });
    await dialog.getByRole("button", { name: "Create a note", exact: true }).click();
    await dialog.getByLabel("Destination note title", { exact: true }).fill("Kept quotation");
    await dialog.getByRole("button", { name: "Send excerpt", exact: true }).click();
    await expect(page.locator(".ProseMirror")).toContainText("Portrait research phrase");
    const destination = page.url();
    const original = await page.evaluate(async (noteId) => {
        const { db } = (await import(
            String("/packages/editor/src/store/repositories/browser/dexie-db.ts")
        )) as typeof import("../../packages/editor/src/store/repositories/browser/dexie-db");
        const asset = await db.pdfAssets.get(noteId);
        if (!asset) throw new Error("PDF asset missing");
        const bytes = asset.data instanceof Uint8Array ? asset.data : new Uint8Array(await asset.data.arrayBuffer());
        await db.pdfAssets.delete(noteId);
        return Array.from(bytes);
    }, id);
    await page.getByRole("link", { name: "Open source", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("original PDF could not be found");
    await page.evaluate(
        async ({ noteId, bytes }) => {
            const { db } = (await import(
                String("/packages/editor/src/store/repositories/browser/dexie-db.ts")
            )) as typeof import("../../packages/editor/src/store/repositories/browser/dexie-db");
            await db.pdfAssets.put({
                id: noteId,
                data: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
            });
        },
        { noteId: id, bytes: original },
    );
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
    await page.goto(destination);
    await page.evaluate(
        async ({ noteId, bytes }) => {
            const { db } = (await import(
                String("/packages/editor/src/store/repositories/browser/dexie-db.ts")
            )) as typeof import("../../packages/editor/src/store/repositories/browser/dexie-db");
            await db.pdfAssets.put({
                id: noteId,
                data: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
            });
        },
        { noteId: id, bytes: Array.from(researchPdf("Replacement phrase")) },
    );
    await page.getByRole("link", { name: "Open source", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("source PDF has been replaced");
    await page.getByRole("button", { name: "Return to writing", exact: true }).click();
    await expect(page.locator(".ProseMirror")).toContainText("Portrait research phrase");
    await page.evaluate(async (noteId) => {
        const { repositories } = (await import(
            String("/packages/editor/src/store/global.store.ts")
        )) as typeof import("../../packages/editor/src/store/global.store");
        await repositories.notes.delete(noteId);
    }, id);
    await page.getByRole("link", { name: "Open source", exact: true }).click();
    await expect(
        page.getByText(
            "The source note is unavailable. Restore it or open its workspace, then try Open source again.",
            { exact: true },
        ),
    ).toBeVisible();
});
