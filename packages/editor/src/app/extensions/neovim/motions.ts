import type { Motion, MotionContext, MotionResult, TextObject } from "./types";
import { currentLine, lines, boundaries, nextCharacter, normalPosition, previousCharacter } from "./document";
import { neovimKey } from "./state";

function result(pos: number, inclusive = false, shape: MotionResult["shape"] = "character"): MotionResult {
    return { pos, inclusive, shape };
}

function wordClass(char: string, big: boolean): number {
    if (/\s/u.test(char)) return 0;
    return big || /[\p{L}\p{N}_]/u.test(char) ? 1 : 2;
}

function wordMotion(context: MotionContext, key: string): MotionResult | null {
    const { state, count } = context;
    const big = key === key.toUpperCase();
    const chars = lines(state.doc).flatMap((line) => {
        const offsets = boundaries(line.text);
        return offsets
            .slice(0, -1)
            .map((offset, index) => ({ pos: line.from + offset, char: line.text.slice(offset, offsets[index + 1]) }))
            .concat({ pos: line.to, char: "\n" });
    });
    let index = chars.findIndex((entry) => entry.pos >= state.selection.head);
    if (index < 0) return null;
    const kind = (at: number): number => wordClass(chars[at]?.char ?? "\n", big);
    for (let step = 0; step < count; step++) {
        switch (key.toLowerCase()) {
            case "w": {
                const current = kind(index);
                while (index < chars.length - 1 && kind(index) === current) index++;
                while (index < chars.length - 1 && kind(index) === 0) index++;
                break;
            }
            case "b": {
                index = Math.max(0, index - 1);
                while (index > 0 && kind(index) === 0) index--;
                const current = kind(index);
                while (index > 0 && kind(index - 1) === current) index--;
                break;
            }
            case "e": {
                index = Math.min(chars.length - 1, index + 1);
                while (index < chars.length - 1 && kind(index) === 0) index++;
                const current = kind(index);
                while (index < chars.length - 1 && kind(index + 1) === current) index++;
                break;
            }
        }
    }
    return result(chars[index]?.pos ?? state.selection.head, key.toLowerCase() === "e");
}

function vertical(context: MotionContext, direction: number): MotionResult | null {
    const all = lines(context.state.doc);
    const pos = context.state.selection.head;
    const index = all.findIndex((line) => pos >= line.from && pos <= line.to);
    const line = all[index];
    if (!line) return null;
    const target = all[Math.max(0, Math.min(all.length - 1, index + direction * context.count))];
    if (!target) return null;
    const column = neovimKey.getState(context.state)?.goalColumn ?? pos - line.from;
    return result(normalPosition(context.state.doc, target.from + Math.min(column, target.text.length)), false, "line");
}

function screenVertical(context: MotionContext, direction: number): MotionResult | null {
    const { view, state, count } = context;
    const coords = view.coordsAtPos(state.selection.head);
    const target = view.posAtCoords({
        left: coords.left,
        top: (coords.top + coords.bottom) / 2 + direction * (coords.bottom - coords.top) * count,
    });
    return target ? result(normalPosition(state.doc, target.pos)) : null;
}

export function builtinMotions(): ReadonlyMap<string, Motion> {
    const motions = new Map<string, Motion>();
    for (const key of ["w", "W", "b", "B", "e", "E"]) motions.set(key, (context) => wordMotion(context, key));
    for (const [key, direction] of [
        ["j", 1],
        ["k", -1],
    ] as const)
        motions.set(key, (context) => vertical(context, direction));
    for (const [key, direction] of [
        ["gj", 1],
        ["gk", -1],
    ] as const)
        motions.set(key, (context) => screenVertical(context, direction));
    for (const key of ["h", "l"])
        motions.set(key, ({ state, count }) => {
            let pos = state.selection.head;
            for (let index = 0; index < count; index++)
                pos = key === "h" ? previousCharacter(state.doc, pos) : nextCharacter(state.doc, pos);
            return result(pos);
        });
    motions.set("0", ({ state }) => result(currentLine(state.doc, state.selection.head)?.from ?? state.selection.head));
    motions.set("^", ({ state }) => {
        const line = currentLine(state.doc, state.selection.head);
        return line ? result(line.from + (line.text.search(/\S/u) < 0 ? 0 : line.text.search(/\S/u))) : null;
    });
    motions.set("$", ({ state, count }) => {
        const all = lines(state.doc);
        const index = all.findIndex((line) => state.selection.head >= line.from && state.selection.head <= line.to);
        const line = all[Math.min(all.length - 1, index + count - 1)];
        return line ? result(normalPosition(state.doc, line.to), true) : null;
    });
    motions.set("gg", ({ state, count }) =>
        result(
            lines(state.doc)[Math.min(lines(state.doc).length - 1, count - 1)]?.from ?? state.selection.head,
            false,
            "line",
        ),
    );
    motions.set("G", ({ state, count }) => {
        const all = lines(state.doc);
        const hasCount = neovimKey.getState(state)?.pending.some((key) => /[1-9]/u.test(key));
        return result(
            (hasCount ? all[Math.min(all.length - 1, count - 1)] : all.at(-1))?.from ?? state.selection.head,
            false,
            "line",
        );
    });
    for (const [key, direction] of [
        ["}", 1],
        ["{", -1],
    ] as const)
        motions.set(key, ({ state, count }) => {
            const all = lines(state.doc);
            let index = all.findIndex((line) => state.selection.head >= line.from && state.selection.head <= line.to);
            for (let step = 0; step < count; step++) {
                const block = all[index]?.blockFrom;
                do {
                    index += direction;
                } while (all[index] && all[index]?.blockFrom === block);
                index = Math.max(0, Math.min(all.length - 1, index));
            }
            return result(all[index]?.from ?? state.selection.head, false, "line");
        });
    return motions;
}

export function findCharacter(context: MotionContext, key: string, char: string): MotionResult | null {
    const line = currentLine(context.state.doc, context.state.selection.head);
    if (!line) return null;
    const forward = key === "f" || key === "t";
    let offset = context.state.selection.head - line.from;
    for (let step = 0; step < context.count; step++) {
        offset = forward ? line.text.indexOf(char, offset + 1) : line.text.lastIndexOf(char, offset - 1);
        if (offset < 0) return null;
    }
    let pos = line.from + offset;
    if (key === "t") pos = previousCharacter(context.state.doc, pos);
    if (key === "T") pos = nextCharacter(context.state.doc, pos);
    return result(pos, forward);
}

export function builtinTextObjects(): ReadonlyMap<string, TextObject> {
    const objects = new Map<string, TextObject>();
    for (const key of ["iw", "aw", "iW", "aW"])
        objects.set(key, ({ state, count }) => {
            const line = currentLine(state.doc, state.selection.head);
            if (!line || !line.text) return null;
            const big = key.endsWith("W");
            let from = Math.min(state.selection.head - line.from, line.text.length - 1);
            let to = from;
            const kind = wordClass(line.text[from] ?? "", big);
            while (from > 0 && wordClass(line.text[from - 1] ?? "", big) === kind) from--;
            while (to < line.text.length && wordClass(line.text[to] ?? "", big) === kind) to++;
            for (let step = 1; step < count; step++) {
                while (to < line.text.length && /\s/u.test(line.text[to] ?? "")) to++;
                const next = wordClass(line.text[to] ?? "", big);
                while (to < line.text.length && wordClass(line.text[to] ?? "", big) === next) to++;
            }
            if (key.startsWith("a")) {
                const end = to;
                while (to < line.text.length && /\s/u.test(line.text[to] ?? "")) to++;
                if (end === to) while (from > 0 && /\s/u.test(line.text[from - 1] ?? "")) from--;
            }
            return { from: line.from + from, to: line.from + to, shape: "character" };
        });
    return objects;
}
