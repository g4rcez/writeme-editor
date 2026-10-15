import { type CDPSession, type Page } from "@playwright/test";
import { expectCanvasZoomShortcuts, expectCanvasZoomWheel } from "../helpers/canvas-zoom";
import { expect, goHome, test } from "./fixtures";

function samplePdf(): Buffer {
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 700] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 700 500] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        "BT /F1 24 Tf 50 600 Td (Portrait page) Tj ET",
        "BT /F1 24 Tf 50 400 Td (Landscape page) Tj ET",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((content, index) => {
        offsets.push(Buffer.byteLength(pdf));
        const body =
            index >= 5 ? `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream` : content;
        pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 8\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
        .join("")}trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf);
}

async function importPdf(page: Page): Promise<void> {
    await goHome(page);
    await page.getByRole("button", { name: "Import PDF", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Import PDF", exact: true });
    await dialog
        .getByLabel("PDF document", { exact: true })
        .setInputFiles({ name: "Book.pdf", mimeType: "application/pdf", buffer: samplePdf() });
    await dialog.getByRole("button", { name: "Import PDF", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("region", { name: "PDF notebook", exact: true })).toBeVisible();
    await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
}

test("scrolls both PDF zoom percentages up and down without scrolling the page", async ({ page }) => {
    await importPdf(page);
    await expectCanvasZoomWheel(page);
});

for (const modifier of ["Control", "Meta"] as const) {
    test(`${modifier} plus/minus zooms only the PDF canvas`, async ({ page }) => {
        await importPdf(page);
        await page.locator(".wm-pdf-text-layer").click();
        await expectCanvasZoomShortcuts(page, page.getByRole("button", { name: "Reset zoom" }), modifier, "115%");
        await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
        await expect(page.locator("[data-ink-stroke]")).toHaveCount(0);
    });
}

test("turns PDF pages with all four arrow keys and keeps page input keys local", async ({ page }) => {
    await importPdf(page);
    const notebook = page.getByRole("region", { name: "PDF notebook", exact: true });
    const pageInput = page.getByLabel("Go to page", { exact: true });
    await notebook.focus();

    for (const key of ["ArrowLeft", "ArrowUp"]) {
        await notebook.press(key);
        await expect(pageInput).toHaveValue("1");
    }
    for (const [next, previous] of [
        ["ArrowRight", "ArrowLeft"],
        ["ArrowDown", "ArrowUp"],
    ] as const) {
        await notebook.press(next);
        await expect(pageInput).toHaveValue("2");
        await notebook.press(next);
        await expect(pageInput).toHaveValue("2");
        await notebook.press(previous);
        await expect(pageInput).toHaveValue("1");
    }

    await notebook.press("Alt+ArrowDown");
    await expect(pageInput).toHaveValue("1");
    await pageInput.press("ArrowRight");
    await expect(pageInput).toHaveValue("1");
    await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
});

async function draw(page: Page): Promise<void> {
    const canvas = page.getByLabel("Handwriting canvas", { exact: true });
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error("PDF canvas missing");
    await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.45);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.48, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
}

async function expectPageFits(page: Page): Promise<void> {
    const metrics = await page.locator(".wm-paper-viewport").evaluate((viewport) => {
        const paper = viewport.querySelector(".wm-paper")!.getBoundingClientRect();
        const bounds = viewport.getBoundingClientRect();
        return {
            overflow: viewport.scrollHeight - viewport.clientHeight,
            top: paper.top - bounds.top,
            bottom: bounds.bottom - paper.bottom,
            left: paper.left - bounds.left,
            right: bounds.right - paper.right,
        };
    });
    expect(metrics.overflow).toBeLessThanOrEqual(1);
    expect(metrics.top).toBeGreaterThanOrEqual(0);
    expect(metrics.bottom).toBeGreaterThanOrEqual(0);
    expect(metrics.left).toBeGreaterThanOrEqual(0);
    expect(metrics.right).toBeGreaterThanOrEqual(0);
}

test("fits PDF book pages without scrolling", async ({ page }) => {
    test.skip(
        process.env.WRITEME_E2E_FAST === "1",
        "Skipped in the fast PR gate after hosted run 38749307895; retained in full and local runs.",
    );
    await importPdf(page);
    await expectPageFits(page);
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(page.getByLabel("PDF page 2", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
    await expectPageFits(page);
    for (const viewport of [
        { width: 390, height: 844 },
        { width: 844, height: 390 },
        { width: 1024, height: 768 },
    ]) {
        await page.setViewportSize(viewport);
        await expect(page.getByLabel("PDF page 2", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
        await expectPageFits(page);
        await page.getByRole("button", { name: "Previous page", exact: true }).click();
        await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
        await expectPageFits(page);
        await page.getByRole("button", { name: "Next page", exact: true }).click();
        await expect(page.getByLabel("PDF page 2", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
    }
});

async function dragOrigin(page: Page): Promise<{ x: number; y: number }> {
    const bounds = await page.getByLabel("Handwriting canvas", { exact: true }).boundingBox();
    const viewport = await page.locator(".wm-paper-viewport").boundingBox();
    if (!bounds || !viewport) throw new Error("PDF canvas missing");
    return {
        x: Math.min(bounds.x + bounds.width / 2, viewport.x + viewport.width / 2),
        y: Math.min(bounds.y + bounds.height * 0.55, viewport.y + viewport.height * 0.55),
    };
}

async function mouseDrag(page: Page, dx: number, dy = 0): Promise<void> {
    const { x, y } = await dragOrigin(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
}

test("turns book pages with mouse drags and keeps selection, ink, zoom and keyboard navigation", async ({ page }) => {
    await importPdf(page);
    await mouseDrag(page, 120);
    await expect(page.getByLabel("Go to page", { exact: true })).toHaveValue("1");
    await mouseDrag(page, -30);
    await mouseDrag(page, -100, 130);
    await expect(page.getByLabel("Go to page", { exact: true })).toHaveValue("1");
    const text = await page.locator(".wm-pdf-text-layer span").first().boundingBox();
    if (!text) throw new Error("PDF text missing");
    await page.mouse.move(text.x + 1, text.y + text.height / 2);
    await page.mouse.down();
    await page.mouse.move(text.x + text.width - 1, text.y + text.height / 2, { steps: 8 });
    await page.mouse.up();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toContain("Portrait");
    await expect(page.getByLabel("Go to page", { exact: true })).toHaveValue("1");

    await mouseDrag(page, -140);
    await expect(page.getByLabel("PDF page 2", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
    await mouseDrag(page, -140);
    await expect(page.getByLabel("Go to page", { exact: true })).toHaveValue("2");
    await mouseDrag(page, 140);
    await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
    await page.getByRole("button", { name: "Pen", exact: true }).click();
    await mouseDrag(page, -140);
    await expect(page.locator("[data-ink-stroke]")).toHaveCount(1);
    await expect(page.getByLabel("Go to page", { exact: true })).toHaveValue("1");
    await page.getByRole("button", { name: "Read PDF", exact: true }).click();
    await page.getByRole("button", { name: "Notebook options", exact: true }).click();
    for (let index = 0; index < 4; index++) await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.getByRole("button", { name: "Close options", exact: true }).click();
    await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
    await mouseDrag(page, -140, -120);
    await expect(page.getByLabel("Go to page", { exact: true })).toHaveValue("1");
    expect(await page.locator(".wm-paper-viewport").evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
    const notebook = page.getByRole("region", { name: "PDF notebook", exact: true });
    await notebook.focus();
    await notebook.press("ArrowRight");
    await expect(page.getByLabel("Go to page", { exact: true })).toHaveValue("2");
    await notebook.press("PageUp");
    await expect(page.getByLabel("Go to page", { exact: true })).toHaveValue("1");
});

async function touchDrag(session: CDPSession, page: Page, dx: number, dy = 0, cancelled = false): Promise<void> {
    const start = { ...(await dragOrigin(page)), id: 1 };
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
    for (let step = 1; step <= 8; step++) {
        await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ ...start, x: start.x + (dx * step) / 8, y: start.y + (dy * step) / 8 }],
        });
    }
    await session.send("Input.dispatchTouchEvent", { type: cancelled ? "touchCancel" : "touchEnd", touchPoints: [] });
}

for (const viewport of [
    { width: 390, height: 844 },
    { width: 1024, height: 768 },
]) {
    test.describe(`PDF book touch ${viewport.width}`, () => {
        test.use({ hasTouch: true, viewport });

        test("swipes in both directions and cancels vertical, interrupted and multi-finger gestures", async ({
            page,
        }) => {
            await importPdf(page);
            await expectPageFits(page);
            const session = await page.context().newCDPSession(page);
            await touchDrag(session, page, 120);
            await touchDrag(session, page, -30);
            await touchDrag(session, page, -100, 130);
            await touchDrag(session, page, -140, 0, true);
            await expect(page.getByLabel("Go to page", { exact: true })).toHaveValue("1");
            await touchDrag(session, page, -140);
            await expect(page.getByLabel("PDF page 2", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
            await touchDrag(session, page, -140);
            await expect(page.getByLabel("Go to page", { exact: true })).toHaveValue("2");
            await touchDrag(session, page, 140);
            await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true");

            const bounds = await page.getByLabel("Handwriting canvas", { exact: true }).boundingBox();
            if (!bounds) throw new Error("PDF canvas missing");
            const first = { x: bounds.x + bounds.width * 0.3, y: bounds.y + bounds.height * 0.55, id: 1 };
            const second = { ...first, x: first.x + 60, id: 2 };
            await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first, second] });
            await session.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: [first, { ...second, x: second.x + 60 }],
            });
            await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
            await expect(page.getByRole("button", { name: "Reset zoom", exact: true })).toHaveText("200%");
            await expect(page.getByLabel("Go to page", { exact: true })).toHaveValue("1");
            await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
            await touchDrag(session, page, -100, -100);
            await expect(page.getByLabel("Go to page", { exact: true })).toHaveValue("1");
            expect(await page.locator(".wm-paper-viewport").evaluate((element) => element.scrollTop)).toBeGreaterThan(
                0,
            );
            await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
            await page.evaluate(
                () =>
                    new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
            );
            await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
            await expectPageFits(page);
            await expect(page.locator("[data-ink-stroke]")).toHaveCount(0);
            await page.screenshot({ path: `artifacts/playwright/pdf-note/book-touch-${viewport.width}.png` });
            await session.detach();
        });
    });
}

test("imports one PDF note and saves independent page annotations across zoom and reload", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await importPdf(page);
    await expect(page.locator(".ProseMirror")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add page", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Previous page", exact: true })).toBeDisabled();
    await expect(page.locator(".wm-pdf-text-layer")).toContainText("Portrait page");
    await expect(page.getByRole("button", { name: "Read PDF", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Pen", exact: true }).click();
    await draw(page);
    await expect(page.locator("[data-ink-stroke]")).toHaveCount(1);

    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(page.getByLabel("PDF page 2", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
    await expect(page.getByRole("button", { name: "Next page", exact: true })).toBeDisabled();
    await expect(page.locator("[data-ink-stroke]")).toHaveCount(0);
    const box = await page.getByLabel("Handwriting canvas", { exact: true }).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width / box!.height).toBeCloseTo(1.4, 1);
    await page.getByRole("button", { name: "Highlighter", exact: true }).click();
    await draw(page);
    await expect(page.locator('[data-ink-stroke="highlighter"]')).toHaveCount(1);
    await page.getByRole("button", { name: "Undo drawing", exact: true }).click();
    await expect(page.locator("[data-ink-stroke]")).toHaveCount(0);
    await page.getByRole("button", { name: "Redo drawing", exact: true }).click();
    await expect(page.locator("[data-ink-stroke]")).toHaveCount(1);
    await expect(page.locator(".wm-save-state output")).toHaveText("Saved");

    await page.getByRole("button", { name: "Notebook options", exact: true }).click();
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.getByRole("button", { name: "Close options", exact: true }).click();
    await expect(page.getByLabel("PDF page 2", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
    await expect(page.getByLabel("Handwriting canvas", { exact: true })).toHaveAttribute(
        "viewBox",
        "0 0 1000 714.2857142857143",
    );
    await expect(page.locator("[data-ink-stroke]")).toHaveCount(1);
    await page.screenshot({ path: "artifacts/playwright/pdf-note/landscape-annotated.png" });

    await page.reload();
    await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
    await expect(page.locator('[data-ink-stroke="pen"]')).toHaveCount(1);
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(page.getByLabel("PDF page 2", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
    await expect(page.locator('[data-ink-stroke="highlighter"]')).toHaveCount(1);
    expect(errors).toEqual([]);
});

test("rejects a malformed PDF without creating a note", async ({ page }) => {
    await goHome(page);
    await page.getByRole("button", { name: "Import PDF", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Import PDF", exact: true });
    await dialog
        .getByLabel("PDF document", { exact: true })
        .setInputFiles({ name: "Broken.pdf", mimeType: "application/pdf", buffer: Buffer.from("invalid pdf") });
    await dialog.getByRole("button", { name: "Import PDF", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Import PDF", exact: true })).toBeEnabled();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
});
