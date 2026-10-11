import { type Page } from "@playwright/test";
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

async function draw(page: Page): Promise<void> {
    const canvas = page.getByLabel("Handwriting canvas", { exact: true });
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error("PDF canvas missing");
    await page.mouse.move(bounds.x + 100, bounds.y + 240);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 240, bounds.y + 255, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator(".wm-save-state output")).toHaveText("Saved");
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
