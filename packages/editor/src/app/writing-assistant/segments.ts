import type { WritingSegment } from "./types";

const MAX_WRITING_SEGMENT_LENGTH = 4000;

export type WritingTextRange = {
    text: string;
    from: number;
    to: number;
};

export function createWritingSegments(ranges: ReadonlyArray<WritingTextRange>): Array<WritingSegment> {
    const segments: Array<WritingSegment> = [];

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
                    if (previous >= 0xd8_00 && previous <= 0xdb_ff && next >= 0xdc_00 && next <= 0xdf_ff) {
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
