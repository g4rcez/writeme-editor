import { test, expect, type Page } from "@playwright/test";
import { Note, NoteType } from "../../packages/editor/src/store/note";

async function readDrawing(page: Page, embedded: boolean): Promise<unknown[]> {
    return page.evaluate(async (embedded) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("writeme");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        const notes = await new Promise<Array<{ content: string }>>((resolve, reject) => {
            const request = db.transaction("notes").objectStore("notes").getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        db.close();
        const json = notes[0]?.content.match(/```(?:json|excalidraw)\n([\s\S]*?)\n```/)?.[1];
        if (!json) return [];
        const data = JSON.parse(json);
        return embedded ? data : data.elements;
    }, embedded);
}

for (const embedded of [false, true]) {
    test(`${embedded ? "embedded" : "full-page"} Excalidraw remains responsive on mobile`, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("/");
        const content = embedded
            ? "# Embedded drawing\n\n```excalidraw\n[]\n```\n"
            : '---\ntype: excalidraw\nview: excalidraw\nschemaVersion: 1\n---\n\n```json\n{"elements":[],"appState":{},"files":{}}\n```\n';
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        const mobile = await page.locator("html").evaluate((element) => element.classList.contains("platform-mobile"));
        if (mobile) {
            await page.getByLabel("Import Markdown file", { exact: true }).setInputFiles({
                name: "Drawing.md",
                mimeType: "text/markdown",
                buffer: Buffer.from(content),
            });
        } else {
            const note = Note.new("Drawing", content, embedded ? NoteType.note : NoteType.excalidraw);
            await page.evaluate(
                async (note) => {
                    const db = await new Promise<IDBDatabase>((resolve, reject) => {
                        const request = indexedDB.open("writeme");
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error);
                    });
                    await new Promise<void>((resolve, reject) => {
                        const tx = db.transaction("notes", "readwrite");
                        tx.objectStore("notes").put(note);
                        tx.oncomplete = () => resolve();
                        tx.onerror = () => reject(tx.error);
                    });
                    db.close();
                },
                { ...note },
            );
            await page.goto(`/note/${note.id}`);
            await page.reload();
        }
        const canvas = page.locator(".excalidraw__canvas.interactive");
        await expect(canvas).toBeVisible();
        await page
            .locator(".excalidraw label")
            .filter({ has: page.getByRole("radio", { name: "Rectangle", exact: true }) })
            .tap();
        const bounds = await canvas.boundingBox();
        if (!bounds) throw new Error("Drawing canvas is missing.");
        const viewport = page.viewportSize();
        if (!viewport) throw new Error("Mobile viewport is missing.");
        const drawingY = Math.min(bounds.y + bounds.height / 2, viewport.height - 220);
        expect(
            await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.className, {
                x: bounds.x + bounds.width / 3,
                y: drawingY,
            }),
        ).toContain("excalidraw__canvas");
        await page.mouse.move(bounds.x + bounds.width / 3, drawingY);
        await page.mouse.down();
        await page.mouse.move(bounds.x + (bounds.width * 2) / 3, drawingY + 80, { steps: 8 });
        await page.mouse.up();
        if (embedded) {
            await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
            if (mobile) await page.evaluate(() => window.dispatchEvent(new Event("writeme:mobile-pause")));
            await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", {
                timeout: 15_000,
            });
        }
        await expect.poll(async () => (await readDrawing(page, embedded)).length).toBe(1);
        const saved = await readDrawing(page, embedded);
        await page.waitForTimeout(1200);
        expect(await readDrawing(page, embedded)).toEqual(saved);
        await page.reload();
        await expect(canvas).toBeVisible();
        expect(await readDrawing(page, embedded)).toEqual(saved);
        await expect(page.getByRole("button", { name: "Open workspace menu", exact: true })).toBeEnabled();
        await page.getByRole("button", { name: "Open workspace menu", exact: true }).tap();
        expect(errors).toEqual([]);
    });
}
