import { test, expect, type Page } from "@playwright/test";
import { Note, NoteType } from "../../packages/editor/src/store/note";

type DrawingElement = { type: string; width: number; height: number; isDeleted: boolean };
type DrawingScene = { elements: DrawingElement[]; appState?: Record<string, unknown>; title?: string };

async function readDrawing(page: Page, embedded: boolean): Promise<DrawingScene> {
    return page.evaluate(async (embedded) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("writeme");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        const notes = await new Promise<Array<{ content: string; title: string }>>((resolve, reject) => {
            const request = db.transaction("notes").objectStore("notes").getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        db.close();
        const json = notes[0]?.content.match(/```(?:json|excalidraw)\n([\s\S]*?)\n```/)?.[1];
        if (!json) return { elements: [] };
        const data = JSON.parse(json);
        return embedded
            ? { elements: data, title: notes[0]?.title }
            : { elements: data.elements, appState: data.appState };
    }, embedded);
}

for (const embedded of [false, true]) {
    test(`${embedded ? "embedded" : "full-page"} Excalidraw remains responsive on mobile`, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("/");
        const drawingViewport = { scrollX: -800, scrollY: 600, zoom: { value: 0.8 } };
        const content = embedded
            ? "# Embedded drawing\n\n```excalidraw\n[]\n```\n"
            : `---\ntype: excalidraw\nview: excalidraw\nschemaVersion: 1\n---\n\n\`\`\`json\n${JSON.stringify({ elements: [], appState: drawingViewport, files: {} })}\n\`\`\`\n`;
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
        if (embedded) {
            await expect.poll(async () => (await readDrawing(page, true)).title).toBe("Embedded drawing");
        }
        const canvas = page.locator(".excalidraw__canvas.interactive");
        await expect(canvas).toBeVisible();
        expect(errors).toEqual([]);
        await page
            .locator(".excalidraw label")
            .filter({ has: page.getByRole("radio", { name: "Rectangle", exact: true }) })
            .tap();
        await expect(page.getByRole("radio", { name: "Rectangle", exact: true })).toBeChecked();
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
        const pointer = {
            pointerId: 1,
            pointerType: "touch",
            isPrimary: true,
            button: 0,
            buttons: 1,
            clientX: bounds.x + bounds.width / 3,
            clientY: drawingY,
        };
        await canvas.dispatchEvent("pointerdown", pointer);
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
        const end = { ...pointer, clientX: bounds.x + (bounds.width * 2) / 3, clientY: drawingY + 80 };
        await canvas.dispatchEvent("pointermove", end);
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
        await canvas.dispatchEvent("pointerup", { ...end, buttons: 0 });
        if (embedded) {
            await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
            if (mobile) await page.evaluate(() => window.dispatchEvent(new Event("writeme:mobile-pause")));
            await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", {
                timeout: 15_000,
            });
        }
        await expect
            .poll(
                async () => {
                    const { elements } = await readDrawing(page, embedded);
                    return (
                        elements.length === 1 &&
                        elements[0]?.type === "rectangle" &&
                        !elements[0].isDeleted &&
                        elements[0].width > 50 &&
                        elements[0].height >= 70
                    );
                },
                { timeout: 15_000 },
            )
            .toBe(true);
        const saved = await readDrawing(page, embedded);
        if (!embedded) expect(saved.appState).toMatchObject(drawingViewport);
        await page.waitForTimeout(1200);
        expect(await readDrawing(page, embedded)).toEqual(saved);
        await page.reload();
        await expect(canvas).toBeVisible();
        expect(errors).toEqual([]);
        expect(await readDrawing(page, embedded)).toEqual(saved);
        await expect(page.getByRole("button", { name: "Open workspace menu", exact: true })).toBeEnabled();
        await page.getByRole("button", { name: "Open workspace menu", exact: true }).tap();
        expect(errors).toEqual([]);
    });
}
