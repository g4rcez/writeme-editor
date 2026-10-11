import { z } from "zod";
import { parseFreehandNote, type FreehandNotebook } from "./freehand-note";

const pdfSourceSchema = z.object({ source: z.string().min(1), filename: z.string().min(1) });
export type PdfNotebook = FreehandNotebook & { pdf: z.infer<typeof pdfSourceSchema> };

export function parsePdfNote(content: string): PdfNotebook {
    const notebook = parseFreehandNote(content);
    const pdf = pdfSourceSchema.parse(notebook.pdf);
    if (notebook.paper !== "blank" || notebook.pages.some((page) => !page.height)) {
        throw new Error("Invalid PDF page data");
    }
    return { ...notebook, pdf };
}

export function buildPdfNoteContent(notebook: PdfNotebook): string {
    return `---\ntype: pdf\nview: pdf\nschemaVersion: 1\n---\n\n\`\`\`json\n${JSON.stringify(notebook)}\n\`\`\`\n`;
}
