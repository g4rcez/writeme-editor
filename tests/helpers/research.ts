import type { Page } from "@playwright/test";

export function researchPdf(secondPage = "Landscape research phrase"): Buffer {
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 700] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 700 500] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        "BT /F1 24 Tf 50 600 Td (Portrait research phrase) Tj ET",
        `BT /F1 24 Tf 50 400 Td (${secondPage}) Tj ET`,
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

export async function selectPdfPhrase(page: Page): Promise<void> {
    const text = await page.locator(".wm-pdf-text-layer span").first().boundingBox();
    if (!text) throw new Error("Selectable PDF text missing");
    await page.mouse.move(text.x + 1, text.y + text.height / 2);
    await page.mouse.down();
    await page.mouse.move(text.x + text.width - 1, text.y + text.height / 2, { steps: 10 });
    await page.mouse.up();
}

export async function savedContent(page: Page, id: string): Promise<string> {
    return page.evaluate(async (noteId) => {
        const { repositories } = (await import(
            String("/packages/editor/src/store/global.store.ts")
        )) as typeof import("../../packages/editor/src/store/global.store");
        return (await repositories.notes.getOne(noteId))?.content ?? "";
    }, id);
}
