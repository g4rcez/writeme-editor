import { devices } from "@playwright/test";
import { Note } from "../../packages/editor/src/store/note";
import { expect, goHome, test } from "./fixtures";

const phone = devices["Pixel 7"]!;
test.use({
    userAgent: phone.userAgent,
    viewport: phone.viewport,
    hasTouch: true,
    video: { mode: "on", size: phone.viewport },
});

test("initial mobile focus preserves a trailing code block through reload and editing", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await goHome(page);
    const note = Note.new("Focus regression", "# Focus regression\n\n```javascript\nconst saved = true;\n```\n");
    await page.evaluate(
        async (note) => {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = indexedDB.open("writeme");
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction("notes", "readwrite");
                transaction.objectStore("notes").put(note);
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
            db.close();
        },
        { ...note },
    );
    await page.goto(`/note/${note.id}`, { waitUntil: "domcontentloaded" });
    const editor = page
        .locator(`#editor-container-${note.id}`)
        .getByRole("textbox", { name: "Note editor", exact: true });
    for (let index = 0; index < 2; index++) {
        await expect(editor).toBeVisible({ timeout: 30_000 });
        await expect(editor).toHaveAttribute("aria-busy", "false");
        await expect(editor).toHaveAttribute("contenteditable", "true");
        await expect(editor).toBeFocused();
        await expect(editor).toContainText("const saved = true;");
        await expect(editor.locator(":scope > p")).toHaveCount(1);
        expect(errors).toEqual([]);
        if (index === 0) await page.reload({ waitUntil: "domcontentloaded" });
    }
    await editor.locator(":scope > p").click();
    await page.keyboard.type("Text after the code block");
    await editor.press("ControlOrMeta+s");
    await expect(page.locator('output[aria-label="Note save status"]').first()).toHaveText("Saved");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(editor).toBeVisible({ timeout: 30_000 });
    await expect(editor).toHaveAttribute("aria-busy", "false");
    await expect(editor).toContainText("const saved = true;");
    await expect(editor).toContainText("Text after the code block");
    expect(errors).toEqual([]);
    await testInfo.attach("mobile-editor-focus", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
    });
});
