import { z } from "zod";

export const PAPER_WIDTH = 1000;
export const PAPER_HEIGHT = 1400;

const coordinateSchema = z.number().finite().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const pointSchema = z.tuple([coordinateSchema, coordinateSchema, z.number().min(0).max(1)]);
const penStyleSchema = z.enum(["fountain", "ball", "brush", "pencil"]);
const strokeSchema = z.looseObject({
    points: z.array(pointSchema).min(1),
    color: z.string().regex(/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i),
    size: z.number().positive().max(100),
    tool: z.enum(["pen", "highlighter"]).default("pen"),
    simulatePressure: z.boolean().default(true),
    penStyle: penStyleSchema.optional(),
});
const noteLinkSchema = z.looseObject({
    id: z.string().min(1),
    noteId: z.string().min(1),
    title: z.string(),
    x: z.number().finite().min(0).max(PAPER_WIDTH),
    y: z.number().finite().min(0),
});
const paperAppearanceSchema = z.looseObject({
    background: z.string().regex(/^#[\da-f]{6}$/i),
    color: z.string().regex(/^#[\da-f]{6}$/i),
    spacing: z.number().finite().min(16).max(64),
    weight: z.number().finite().min(0.5).max(3),
});
const notebookSchema = z.looseObject({
    version: z.literal(1),
    paper: z.enum(["blank", "lined", "grid", "dotted"]),
    appearance: paperAppearanceSchema.optional(),
    pages: z
        .array(
            z.looseObject({
                strokes: z.array(strokeSchema),
                links: z.array(noteLinkSchema).optional(),
                height: z.number().finite().positive().optional(),
            }),
        )
        .min(1),
});

export type InkPoint = z.infer<typeof pointSchema>;
export type InkStroke = z.infer<typeof strokeSchema>;
export type PenStyle = z.infer<typeof penStyleSchema>;
export type FreehandNoteLink = z.infer<typeof noteLinkSchema>;
export type FreehandNotebook = z.infer<typeof notebookSchema>;
export type PaperStyle = FreehandNotebook["paper"];
export type PaperAppearance = z.infer<typeof paperAppearanceSchema>;
export const DEFAULT_PAPER_APPEARANCE: PaperAppearance = {
    background: "#ffffff",
    color: "#d7deea",
    spacing: 32,
    weight: 1,
};

export function emptyFreehandNotebook(): FreehandNotebook {
    return { version: 1, paper: "lined", pages: [{ strokes: [] }] };
}

const JSON_FENCE = /```(?:json|freehand)[^\n]*\n([\s\S]*?)\n```/i;

export function parseFreehandNote(content: string): FreehandNotebook {
    if (!content.trim()) return emptyFreehandNotebook();
    const raw: unknown = JSON.parse(content.match(JSON_FENCE)?.[1] ?? content);
    if (typeof raw === "object" && raw !== null && "version" in raw) return notebookSchema.parse(raw);
    const legacy = z.looseObject({ strokes: z.array(strokeSchema) }).parse(raw);
    return { version: 1, paper: "blank", pages: [legacy] };
}

export function buildFreehandNoteContent(notebook: FreehandNotebook = emptyFreehandNotebook()): string {
    return `---\ntype: freehand\nview: freehand\nschemaVersion: 1\n---\n\n\`\`\`json\n${JSON.stringify(notebook)}\n\`\`\`\n`;
}

export function replaceFreehandNoteContent(content: string, notebook: FreehandNotebook): string {
    if (JSON_FENCE.test(content)) {
        return content.replace(JSON_FENCE, () => `\`\`\`json\n${JSON.stringify(notebook)}\n\`\`\``);
    }
    return buildFreehandNoteContent(notebook);
}

function distanceToSegment(point: InkPoint, from: InkPoint, to: InkPoint): number {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const lengthSquared = dx * dx + dy * dy;
    const t =
        lengthSquared === 0
            ? 0
            : Math.max(0, Math.min(1, ((point[0] - from[0]) * dx + (point[1] - from[1]) * dy) / lengthSquared));
    return Math.hypot(point[0] - from[0] - t * dx, point[1] - from[1] - t * dy);
}

export function strokeIntersects(stroke: InkStroke, from: InkPoint, to: InkPoint, radius: number): boolean {
    const threshold = radius + stroke.size / 2;
    if (stroke.points.some((point) => distanceToSegment(point, from, to) <= threshold)) return true;
    return stroke.points.some((point, index) => {
        const next = stroke.points[index + 1];
        if (!next) return false;
        if (distanceToSegment(from, point, next) <= threshold || distanceToSegment(to, point, next) <= threshold)
            return true;
        const inkX = next[0] - point[0];
        const inkY = next[1] - point[1];
        const eraserX = to[0] - from[0];
        const eraserY = to[1] - from[1];
        const determinant = inkX * eraserY - inkY * eraserX;
        if (determinant !== 0) {
            const offsetX = from[0] - point[0];
            const offsetY = from[1] - point[1];
            const inkT = (offsetX * eraserY - offsetY * eraserX) / determinant;
            const eraserT = (offsetX * inkY - offsetY * inkX) / determinant;
            if (inkT >= 0 && inkT <= 1 && eraserT >= 0 && eraserT <= 1) return true;
        }
        return false;
    });
}

export function inkPath(outline: number[][]): string {
    const first = outline[0];
    if (!first) return "";
    return `M ${first[0]} ${first[1]} Q ${outline
        .map((point, index) => {
            const next = outline[(index + 1) % outline.length]!;
            return `${point[0]} ${point[1]} ${(point[0]! + next[0]!) / 2} ${(point[1]! + next[1]!) / 2}`;
        })
        .join(" ")} Z`;
}
