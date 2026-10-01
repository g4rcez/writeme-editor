import type { Node as ProseMirrorNode, Mark as ProseMirrorMark } from "@tiptap/pm/model";
import type { WritingTextRange } from "./segments";

export type TiptapWritingSelection = { from: number; to: number };

const PROSE_TEXTBLOCKS = new Set(["paragraph", "heading"]);
const EXCLUDED_MARKS = new Set(["code", "link", "domainLink"]);

export function hasExcludedTiptapWritingMark(node: ProseMirrorNode): boolean {
    return node.marks.some((mark) => EXCLUDED_MARKS.has(mark.type.name));
}
export function isEligibleTiptapWritingText(
    node: ProseMirrorNode,
    parent: ProseMirrorNode | null,
): boolean {
    return (
        node.isText &&
        Boolean(node.text) &&
        parent !== null &&
        PROSE_TEXTBLOCKS.has(parent.type.name) &&
        !hasExcludedTiptapWritingMark(node)
    );
}

export function sameTiptapMarks(left: readonly ProseMirrorMark[], right: readonly ProseMirrorMark[]): boolean {
    return left.length === right.length && left.every((mark, index) => {
        const other = right[index];
        return other !== undefined && mark.eq(other);
    });
}

export function getTiptapWritingTextRanges(
    doc: ProseMirrorNode,
    selection?: TiptapWritingSelection,
): WritingTextRange[] {
    if (selection && (selection.from < 0 || selection.to <= selection.from)) return [];

    const ranges: WritingTextRange[] = [];
    let activeRange: { parts: string[]; from: number; to: number; marks: readonly ProseMirrorMark[] } | null = null;
    const flush = (): void => {
        if (!activeRange) return;
        ranges.push({ text: activeRange.parts.join(""), from: activeRange.from, to: activeRange.to });
        activeRange = null;
    };

    doc.descendants((node, position, parent) => {
        if (!isEligibleTiptapWritingText(node, parent)) return;

        const text = node.text;
        if (!text) return;
        const from = selection ? Math.max(position, selection.from) : position;
        const to = selection ? Math.min(position + text.length, selection.to) : position + text.length;
        if (from >= to) return;

        const clippedText = text.slice(from - position, to - position);
        if (activeRange && activeRange.to === from && sameTiptapMarks(activeRange.marks, node.marks)) {
            activeRange.parts.push(clippedText);
            activeRange.to = to;
            return;
        }

        flush();
        activeRange = { parts: [clippedText], from, to, marks: node.marks };
    });
    flush();
    return ranges;
}
