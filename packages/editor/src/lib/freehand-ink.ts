import { getStroke, type StrokeOptions } from "perfect-freehand";
import { inkPath, type InkStroke, type PenStyle } from "./freehand-note";

const penOptions = {
    fountain: { thinning: 0.5, smoothing: 0.5, streamline: 0.5 },
    ball: { thinning: 0, smoothing: 0.5, streamline: 0.5, simulatePressure: false },
    brush: { thinning: 0.9, smoothing: 0.6, streamline: 0.4, easing: (pressure: number) => pressure ** 1.5 },
    pencil: { thinning: 0.3, smoothing: 0.3, streamline: 0.35 },
} satisfies Record<PenStyle, StrokeOptions>;

export function inkStrokePath(stroke: InkStroke): string {
    const options: StrokeOptions = {
        size: stroke.size,
        thinning: stroke.tool === "highlighter" ? 0 : 0.5,
        simulatePressure: stroke.simulatePressure,
        smoothing: 0.5,
        streamline: 0.5,
    };
    if (stroke.tool === "pen" && stroke.penStyle) Object.assign(options, penOptions[stroke.penStyle]);
    if (stroke.tool === "pen" && stroke.penStyle === "brush") {
        const length = stroke.points.reduce((total, point, index) => {
            const previous = stroke.points[index - 1];
            return previous ? total + Math.hypot(point[0] - previous[0], point[1] - previous[1]) : total;
        }, 0);
        options.start = { taper: Math.min(stroke.size * 2, length * 0.2) };
        options.end = { taper: Math.min(stroke.size * 3, length * 0.3) };
    }
    return inkPath(getStroke(stroke.points, options));
}

export function pencilOpacity(stroke: InkStroke): number {
    if (stroke.simulatePressure) return 0.8;
    const pressure = stroke.points.reduce((total, point) => total + point[2], 0) / stroke.points.length;
    return 0.4 + pressure * 0.6;
}
