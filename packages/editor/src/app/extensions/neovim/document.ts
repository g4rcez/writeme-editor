import type { Node } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import type { VimRange } from "./types";

export type VimLine = {
    readonly from: number;
    readonly to: number;
    readonly blockFrom: number;
    readonly blockTo: number;
    readonly text: string;
};
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const lineCache = new WeakMap<Node, readonly VimLine[]>();

export function lines(doc: Node): readonly VimLine[] {
    const cached = lineCache.get(doc);
    if (cached) return cached;
    const result: VimLine[] = [];
    doc.descendants((node, pos) => {
        if (!node.isTextblock) return;
        let text = "";
        node.forEach((child) => {
            text += child.isText
                ? child.text
                : child.type.name === "hardBreak"
                  ? "\n"
                  : "\ufffc".repeat(child.nodeSize);
        });
        let from = pos + 1;
        for (const segment of text.split("\n")) {
            result.push({
                from,
                to: from + segment.length,
                blockFrom: pos,
                blockTo: pos + node.nodeSize,
                text: segment,
            });
            from += segment.length + 1;
        }
        return false;
    });
    lineCache.set(doc, result);
    return result;
}

export function currentLine(doc: Node, pos: number): VimLine | undefined {
    return lines(doc).find((line) => pos >= line.from && pos <= line.to);
}

export function boundaries(text: string): readonly number[] {
    return [...segmenter.segment(text)].map((part) => part.index).concat(text.length);
}

export function nextCharacter(doc: Node, pos: number): number {
    const line = currentLine(doc, pos);
    if (!line) return pos;
    return line.from + (boundaries(line.text).find((offset) => offset > pos - line.from) ?? line.text.length);
}

export function previousCharacter(doc: Node, pos: number): number {
    const line = currentLine(doc, pos);
    if (!line) return pos;
    return (
        line.from +
        (boundaries(line.text)
            .filter((offset) => offset < pos - line.from)
            .at(-1) ?? 0)
    );
}

export function normalPosition(doc: Node, pos: number): number {
    const all = lines(doc);
    const line = currentLine(doc, pos) ?? all.find((entry) => entry.from >= pos) ?? all.at(-1);
    if (!line) return pos;
    if (line.from === line.to) return line.from;
    const offset = Math.max(0, Math.min(pos - line.from, line.text.length));
    return (
        line.from +
        (boundaries(line.text)
            .filter((value) => value <= offset && value < line.text.length)
            .at(-1) ?? 0)
    );
}

export function lineRange(doc: Node, start: number, end: number): VimRange | null {
    const all = lines(doc);
    const first = all.find((line) => Math.min(start, end) >= line.from && Math.min(start, end) <= line.to);
    const last = all.find((line) => Math.max(start, end) >= line.from && Math.max(start, end) <= line.to);
    if (!first || !last) return null;
    const fullBlocks = first.from === first.blockFrom + 1 && last.to === last.blockTo - 1;
    return {
        from: fullBlocks ? first.blockFrom : first.from,
        to: fullBlocks ? last.blockTo : Math.min(last.blockTo - 1, last.to + 1),
        shape: "line",
    };
}

export function rangeAllowed(state: EditorState, range: VimRange): boolean {
    const $from = state.doc.resolve(Math.min(range.from + 1, state.doc.content.size));
    const $to = state.doc.resolve(Math.max(range.from, range.to - 1));
    for (let depth = 1; depth <= $from.depth; depth++) {
        if (!$from.node(depth).type.spec.isolating) continue;
        if ($to.depth < depth || $to.start(depth) !== $from.start(depth)) return false;
    }
    for (let depth = 1; depth <= $to.depth; depth++) {
        if (!$to.node(depth).type.spec.isolating) continue;
        if ($from.depth < depth || $from.start(depth) !== $to.start(depth)) return false;
    }
    return true;
}
