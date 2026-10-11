import { test, expect } from "@playwright/test";

function samplePdf(): Buffer {
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 700] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        "BT /F1 24 Tf 50 600 Td (Mobile PDF) Tj ET",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    objects.forEach((content, index) => {
        offsets.push(Buffer.byteLength(pdf));
        const body =
            index === 4 ? `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream` : content;
        pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
    pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf);
}

test("imports a PDF and reloads its on-device attachment", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Import PDF", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Import PDF", exact: true });
    await dialog.getByLabel("PDF document", { exact: true }).setInputFiles({
        name: "Mobile.pdf",
        mimeType: "application/pdf",
        buffer: samplePdf(),
    });
    await dialog.getByRole("button", { name: "Import PDF", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
    await page.reload();
    await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export original PDF", exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe("Mobile.pdf");
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    if (!stream) throw new Error("Exported PDF is missing.");
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(samplePdf());
});
