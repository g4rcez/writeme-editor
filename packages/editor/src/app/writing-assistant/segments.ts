import type { WritingSegment } from "./types";

export const MAX_WRITING_SEGMENT_LENGTH = 4_000;

export type WritingTextRange = {
    text: string;
    from: number;
    to: number;
};

export function createWritingSegments(ranges: readonly WritingTextRange[]): WritingSegment[] {
    const segments: WritingSegment[] = [];

    for (const range of ranges) {
        let start = 0;
        while (start < range.text.length) {
            let end = Math.min(start + MAX_WRITING_SEGMENT_LENGTH, range.text.length);
            if (end < range.text.length) {
                let whitespace = -1;
                for (let index = end - 1; index >= start; index -= 1) {
                    if (/\s/.test(range.text[index] ?? "")) {
                        whitespace = index;
                        break;
                    }
                }
                if (whitespace >= start) {
                    end = whitespace + 1;
                } else {
                    const previous = range.text.charCodeAt(end - 1);
                    const next = range.text.charCodeAt(end);
                    if (previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
                        end -= 1;
                    }
                }
            }

            segments.push({
                id: String(segments.length),
                text: range.text.slice(start, end),
                from: range.from + start,
                to: range.from + end,
            });
            start = end;
        }
    }

    return segments;
}
