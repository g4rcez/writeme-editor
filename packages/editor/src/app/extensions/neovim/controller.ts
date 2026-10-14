import type { Editor } from "@tiptap/core";
import type { Slice } from "@tiptap/pm/model";
import { closeHistory } from "@tiptap/pm/history";
import { Selection, TextSelection } from "@tiptap/pm/state";
import type {
    Mapping,
    Motion,
    MotionContext,
    NeovimMode,
    NeovimState,
    Operator,
    TextObject,
    VimRange,
    VisualChange,
} from "./types";
import {
    boundaries,
    currentLine,
    lineRange,
    lines,
    nextCharacter,
    normalPosition,
    previousCharacter,
    rangeAllowed,
} from "./document";
import { KeymapRegistry } from "./keymap";
import { builtinMotions, builtinTextObjects, findCharacter } from "./motions";
import { neovimKey } from "./state";

class UnmountedNeovimError extends Error {
    override readonly name = "UnmountedNeovimError";
}

export class NeovimController {
    readonly keymap: KeymapRegistry;
    private readonly motionHandlers = new Map(builtinMotions());
    private readonly objectHandlers = new Map(builtinTextObjects());
    private readonly operatorHandlers = new Map<string, Operator>();
    private timer: ReturnType<typeof setTimeout> | undefined;
    private replaying = false;
    private lastFind: { readonly key: string; readonly char: string } | null = null;
    readonly motions = {
        register: (keys: string, handler: Motion): void => {
            this.motionHandlers.set(keys, handler);
        },
    };
    readonly textObjects = {
        register: (keys: string, handler: TextObject): void => {
            this.objectHandlers.set(keys, handler);
        },
    };
    readonly operators = {
        register: (key: string, handler: Operator): void => {
            if (!/^[^\d\s<>]$/u.test(key)) throw new Error("An operator must be one non-numeric key");
            this.operatorHandlers.set(key, handler);
        },
    };

    private attachedEditor: Editor | undefined;

    constructor(
        leader: string,
        private timeout: number,
    ) {
        this.keymap = new KeymapRegistry(leader);
    }

    configure(options: { readonly leader: string; readonly timeout: number }): void {
        this.flushPending();
        this.keymap.setLeader(options.leader);
        this.timeout = options.timeout;
    }

    attach(editor: Editor): void {
        this.attachedEditor = editor;
    }

    private get editor(): Editor {
        if (!this.attachedEditor) throw new UnmountedNeovimError("Neovim is not attached to an editor");
        return this.attachedEditor;
    }

    getState(): NeovimState | undefined {
        return neovimKey.getState(this.editor.state);
    }

    update(patch: Partial<NeovimState>): void {
        this.editor.view.dispatch(this.editor.state.tr.setMeta(neovimKey, patch).setMeta("addToHistory", false));
    }

    setEnabled(enabled: boolean): void {
        this.flushPending();
        this.update({ enabled, mode: "normal", pending: [], anchor: null, command: "", insertSession: null });
    }

    setMode(mode: NeovimMode, keys: readonly string[] = [], position?: number): void {
        this.cancelTimer();
        const focused = this.editor.view.hasFocus();
        const state = this.getState();
        if (!state) return;
        const doc = this.editor.state.doc;
        let pos = position ?? state.cursor;
        let lastChange = state.lastChange;
        if (state.insertSession && mode !== "insert" && mode !== "replace") {
            const from = state.insertSession.doc.content.findDiffStart(doc.content);
            const end = state.insertSession.doc.content.findDiffEnd(doc.content);
            const inserted = from !== null && end ? doc.slice(from, Math.max(from, end.b)) : undefined;
            if (!this.replaying && (inserted || state.insertSession.keys[0] === "c"))
                lastChange = { keys: state.insertSession.keys, inserted, visual: state.insertSession.visual };
            pos = previousCharacter(doc, this.editor.state.selection.head);
        }
        const inserting = mode === "insert" || mode === "replace";
        const visual = mode === "visual" || mode === "visual-line";
        pos = inserting ? pos : normalPosition(doc, pos);
        const tr = this.editor.state.tr;
        tr.setSelection(Selection.near(doc.resolve(pos)));
        if (inserting && this.editor.state.storedMarks) tr.ensureMarks(this.editor.state.storedMarks);
        tr.setMeta(neovimKey, {
            mode,
            pending: [],
            anchor: visual ? pos : null,
            cursor: pos,
            goalColumn: null,
            lastChange,
            insertSession: inserting
                ? { doc, keys, visual: state.lastChange?.keys === keys ? state.lastChange.visual : undefined }
                : null,
            command: "",
            message: "",
        } satisfies Partial<NeovimState>);
        this.editor.view.dispatch(inserting && ["c", "C", "o", "O"].includes(keys[0] ?? "") ? tr : closeHistory(tr));
        if (focused) {
            // WebKit needs native focus renewed after removing the noneditable cursor widget.
            if (inserting) this.editor.view.dom.blur();
            this.editor.view.focus();
        }
        if (visual) this.move(pos);
    }

    private context(count: number): MotionContext {
        const state = this.editor.state;
        const cursor = this.getState()?.cursor ?? state.selection.head;
        return {
            state: state.apply(state.tr.setSelection(Selection.near(state.doc.resolve(cursor)))),
            view: this.editor.view,
            count,
        };
    }

    private move(target: number, vertical = false): void {
        const vim = this.getState();
        if (!vim) return;
        const { doc } = this.editor.state;
        const pos = normalPosition(doc, target);
        const tr = this.editor.state.tr;
        const anchor = vim.anchor ?? vim.cursor;
        switch (vim.mode) {
            case "visual": {
                const from = Math.min(anchor, pos);
                const to = nextCharacter(doc, Math.max(anchor, pos));
                tr.setSelection(TextSelection.create(doc, anchor <= pos ? from : to, anchor <= pos ? to : from));
                break;
            }
            case "visual-line": {
                const range = lineRange(doc, anchor, pos);
                if (range) tr.setSelection(TextSelection.between(doc.resolve(range.from), doc.resolve(range.to)));
                break;
            }
            default:
                tr.setSelection(Selection.near(doc.resolve(pos)));
        }
        const line = currentLine(doc, vim.cursor);
        tr.setMeta(neovimKey, {
            cursor: pos,
            pending: [],
            goalColumn: vertical ? (vim.goalColumn ?? vim.cursor - (line?.from ?? vim.cursor)) : null,
        });
        this.editor.view.dispatch(tr.scrollIntoView());
        if (this.editor.view.hasFocus()) this.editor.view.focus();
    }

    private cancelTimer(): void {
        clearTimeout(this.timer);
        this.timer = undefined;
    }

    destroy(): void {
        this.cancelTimer();
    }

    flushPending(): void {
        this.cancelTimer();
        const vim = this.getState();
        if (!vim?.pending.length) return;
        this.update({ pending: [], ...(vim.mode === "operator-pending" ? { mode: "normal" } : {}) });
        switch (vim.mode) {
            case "insert":
                this.editor.view.dispatch(this.editor.state.tr.insertText(vim.pending.join("")));
                break;
            case "replace":
                for (const key of vim.pending) this.feed(key, false);
                break;
            case "command":
                for (const key of vim.pending) this.commandKey(key);
                break;
            case "normal":
            case "visual":
            case "visual-line":
            case "operator-pending":
                break;
        }
    }

    private pending(keys: readonly string[], mode?: NeovimMode): void {
        this.update({ pending: keys, ...(mode ? { mode } : {}) });
    }

    private mapping(mapping: Mapping, count: number, depth: number, prefix: readonly string[] = []): boolean {
        const state = this.getState();
        if (!state) return false;
        this.cancelTimer();
        this.update({ pending: prefix });
        if (typeof mapping.action === "function")
            return mapping.action({ ...this.context(count), editor: this.editor, mode: state.mode });
        if (depth >= 20) {
            this.update({ message: "Recursive key mapping exceeded 20 expansions" });
            return true;
        }
        for (let repeat = 0; repeat < (prefix.length ? 1 : count); repeat++)
            for (const key of this.keymap.parse(mapping.action)) {
                const handled = this.feed(key, mapping.remap === true, depth + 1);
                const mode = this.getState()?.mode;
                if (!handled && (mode === "insert" || mode === "replace") && !key.startsWith("<"))
                    this.editor.commands.insertContent(key);
            }
        return true;
    }

    feedKeys(sequence: string): void {
        for (const key of this.keymap.parse(sequence)) {
            const handled = this.feed(key);
            const mode = this.getState()?.mode;
            if (!handled && (mode === "insert" || mode === "replace") && !key.startsWith("<"))
                this.editor.view.dispatch(this.editor.state.tr.insertText(key));
        }
    }

    feed(key: string, mappings = true, depth = 0): boolean {
        const vim = this.getState();
        if (!vim?.enabled || !this.editor.isEditable) return false;
        this.cancelTimer();
        if (key === "<Esc>" || key === "<C-[>") {
            this.flushPending();
            this.setMode("normal");
            return true;
        }
        if (!["insert", "replace", "command"].includes(vim.mode) && key === "<BS>") key = "h";
        const keys = [...vim.pending, key];
        const countMatch = keys.join("").match(/^([1-9]\d*)/u);
        const count = Math.min(9999, Number(countMatch?.[1] ?? 1));
        const mappingKeys = countMatch ? keys.slice(countMatch[1]?.length ?? 0) : keys;
        let prefix: readonly string[] = [];
        let lookupKeys = ["insert", "replace", "command"].includes(vim.mode) ? keys : mappingKeys;
        let mappingCount = count;
        if (vim.mode === "operator-pending") {
            const operatorIndex = countMatch?.[1]?.length ?? 0;
            const motionCount = keys
                .slice(operatorIndex + 1)
                .join("")
                .match(/^([1-9]\d*)/u);
            const end = operatorIndex + 1 + (motionCount?.[1]?.length ?? 0);
            prefix = keys.slice(0, end);
            lookupKeys = keys.slice(end);
            mappingCount = Math.min(9999, count * Number(motionCount?.[1] ?? 1));
        }
        if (mappings) {
            const match = this.keymap.resolve(vim.mode, lookupKeys);
            if (match.prefix && !match.exact?.nowait) {
                this.pending(keys);
                this.timer = setTimeout(() => {
                    if (this.editor.isDestroyed) return;
                    if (match.exact) this.mapping(match.exact, mappingCount, depth, prefix);
                    else {
                        const pending = this.getState()?.pending ?? [];
                        this.update({ pending: [] });
                        for (const buffered of pending) {
                            const handled = this.feed(buffered, false);
                            if (!handled && vim.mode === "insert")
                                this.editor.view.dispatch(this.editor.state.tr.insertText(buffered));
                        }
                    }
                }, this.timeout);
                return true;
            }
            if (match.exact) return this.mapping(match.exact, mappingCount, depth, prefix);
            if (vim.pending.length) {
                const previousKeys = lookupKeys.slice(0, -1);
                const previous = this.keymap.resolve(vim.mode, previousKeys);
                if (previous.exact) {
                    this.mapping(previous.exact, mappingCount, depth, prefix);
                    return this.feed(key, mappings, depth);
                }
            }
        }
        if (key === "<C-c>") {
            if (vim.mode === "normal") this.reset();
            else this.setMode("normal");
            return true;
        }
        if (key === "<C-w>") {
            switch (vim.mode) {
                case "insert":
                case "replace":
                    return this.deletePreviousWord();
                case "normal":
                    this.feed("d", false, depth);
                    this.feed("w", false, depth);
                    return true;
                case "visual":
                case "visual-line":
                    return this.feed("d", false, depth);
                case "operator-pending":
                    return this.feed("w", false, depth);
                case "command": {
                    const command = vim.command;
                    const previousWord = /\S+\s*$/u.exec(command.slice(1))?.[0] ?? "";
                    this.update({ command: command.slice(0, command.length - previousWord.length) });
                    return true;
                }
            }
        }
        if (vim.mode === "command") {
            this.update({ pending: [] });
            for (const buffered of vim.pending) this.commandKey(buffered);
            return this.commandKey(key);
        }
        if (vim.mode === "insert") {
            if (vim.pending.length) {
                this.update({ pending: [] });
                this.editor.view.dispatch(this.editor.state.tr.insertText(vim.pending.join("")));
                return this.feed(key, mappings, depth);
            }
            return false;
        }
        if (vim.mode === "replace") {
            if (vim.pending.length) {
                this.flushPending();
                return this.feed(key, mappings, depth);
            }
            if (!key.startsWith("<")) {
                const { state } = this.editor;
                const tr = state.tr.insertText(
                    key,
                    state.selection.head,
                    nextCharacter(state.doc, state.selection.head),
                );
                tr.setSelection(TextSelection.create(tr.doc, state.selection.head + key.length));
                this.editor.view.dispatch(tr);
                return true;
            }
            return false;
        }
        return this.normalKeys(keys, count, mappingKeys);
    }

    private deletePreviousWord(): boolean {
        const state = this.editor.state;
        const position = state.selection.head;
        const line = currentLine(state.doc, position);
        if (!line || position <= line.from) return true;
        const prefix = line.text.slice(0, Math.min(line.text.length, position - line.from));
        const word = /\S+$/u.exec(prefix)?.[0];
        if (!word) return true;
        const from = position - word.length;
        const tr = state.tr.delete(from, position);
        tr.setSelection(TextSelection.create(tr.doc, from));
        this.editor.view.dispatch(closeHistory(tr));
        return true;
    }

    private normalKeys(keys: readonly string[], count: number, commandKeys: readonly string[]): boolean {
        const vim = this.getState();
        if (!vim) return false;
        if (!commandKeys.length) {
            this.pending(keys);
            return true;
        }
        const first = commandKeys[0] ?? "";
        const isOperator = ["d", "c", "y"].includes(first) || this.operatorHandlers.has(first);
        if (isOperator) {
            const visual = vim.mode === "visual" || vim.mode === "visual-line";
            if (visual) {
                const range =
                    vim.mode === "visual-line"
                        ? lineRange(this.editor.state.doc, vim.anchor ?? vim.cursor, vim.cursor)
                        : {
                              from: this.editor.state.selection.from,
                              to: this.editor.state.selection.to,
                              shape: "character" as const,
                          };
                if (range) this.operate(first, range, keys, count);
                return true;
            }
            if (commandKeys.length === 1) {
                this.pending(keys, "operator-pending");
                return true;
            }
            const after = commandKeys.slice(1).join("");
            const motionCount = after.match(/^([1-9]\d*)/u);
            const total = Math.min(9999, count * Number(motionCount?.[1] ?? 1));
            const motionKey = after.slice(motionCount?.[1]?.length ?? 0);
            if (!motionKey) {
                this.pending(keys, "operator-pending");
                return true;
            }
            if (motionKey === first) {
                const all = lines(this.editor.state.doc);
                const index = all.findIndex((line) => vim.cursor >= line.from && vim.cursor <= line.to);
                const range = lineRange(
                    this.editor.state.doc,
                    vim.cursor,
                    all[Math.min(all.length - 1, index + total - 1)]?.from ?? vim.cursor,
                );
                if (range) this.operate(first, range, keys, total);
                return true;
            }
            const object = this.objectHandlers.get(motionKey);
            if (object) {
                const range = object(this.context(total));
                if (range) this.operate(first, range, keys, total);
                else this.reset();
                return true;
            }
            const effectiveKey =
                first === "c" &&
                motionKey === "w" &&
                /\S/u.test(
                    this.editor.state.doc.textBetween(vim.cursor, nextCharacter(this.editor.state.doc, vim.cursor)),
                )
                    ? "e"
                    : motionKey;
            return this.resolveMotion(effectiveKey, total, keys, first);
        }
        const command = commandKeys.join("");
        if (command === "r") {
            this.pending(keys);
            return true;
        }
        if (commandKeys.length === 2 && first === "r") {
            const line = currentLine(this.editor.state.doc, vim.cursor);
            if (line) {
                let to = vim.cursor;
                for (let index = 0; index < count; index++) to = nextCharacter(this.editor.state.doc, to);
                if (to > vim.cursor) {
                    const tr = this.editor.state.tr.insertText((commandKeys[1] ?? "").repeat(count), vim.cursor, to);
                    tr.setMeta(neovimKey, { lastChange: { keys }, pending: [] });
                    this.editor.view.dispatch(closeHistory(tr));
                    this.move(vim.cursor);
                }
            }
            return true;
        }
        if (commandKeys.length === 1) {
            switch (first) {
                case "i":
                case "a":
                case "I":
                case "A":
                case "R": {
                    let pos = vim.cursor;
                    const line = currentLine(this.editor.state.doc, pos);
                    if (first === "a") pos = nextCharacter(this.editor.state.doc, pos);
                    if (first === "I") pos = line ? line.from + Math.max(0, line.text.search(/\S/u)) : pos;
                    if (first === "A") pos = line?.to ?? pos;
                    this.setMode(first === "R" ? "replace" : "insert", keys, pos);
                    return true;
                }
                case "o":
                case "O":
                    return this.openLine(first, keys);
                case "v":
                case "V":
                    this.setMode(
                        vim.mode === (first === "v" ? "visual" : "visual-line")
                            ? "normal"
                            : first === "v"
                              ? "visual"
                              : "visual-line",
                    );
                    return true;
                case "x":
                case "D":
                case "C": {
                    const line = currentLine(this.editor.state.doc, vim.cursor);
                    let to = vim.cursor;
                    for (let index = 0; index < count; index++) to = nextCharacter(this.editor.state.doc, to);
                    if (line)
                        this.operate(
                            first === "C" ? "c" : "d",
                            { from: vim.cursor, to: first === "x" ? to : line.to, shape: "character" },
                            keys,
                            count,
                        );
                    return true;
                }
                case "p":
                case "P":
                    return this.put(first === "p", keys, count);
                case "u":
                    this.reset();
                    for (let index = 0; index < count; index++) this.editor.commands.undo();
                    return true;
                case "<C-r>":
                    this.reset();
                    for (let index = 0; index < count; index++) this.editor.commands.redo();
                    return true;
                case ".":
                    return this.repeat(count);
                case "/":
                case "?":
                case ":":
                    this.update({ mode: "command", command: first, pending: [], anchor: null });
                    return true;
                case "n":
                case "N":
                    this.search(
                        vim.search,
                        first === "N" ? (vim.searchDirection === 1 ? -1 : 1) : vim.searchDirection,
                        count,
                    );
                    return true;
                case ";":
                case ",": {
                    if (this.lastFind) {
                        const reverse: Record<string, string> = { f: "F", F: "f", t: "T", T: "t" };
                        const found = findCharacter(
                            this.context(count),
                            first === "," ? (reverse[this.lastFind.key] ?? "f") : this.lastFind.key,
                            this.lastFind.char,
                        );
                        if (found) this.move(found.pos);
                    }
                    this.reset();
                    return true;
                }
            }
        }
        return this.resolveMotion(command, count, keys);
    }

    private resolveMotion(key: string, count: number, keys: readonly string[], operator?: string): boolean {
        const vim = this.getState();
        if (!vim) return false;
        const motion = this.motionHandlers.get(key);
        const find = /^[fFtT][^]$/u.test(key) ? findCharacter(this.context(count), key[0] ?? "f", key.slice(1)) : null;
        const target = motion?.(this.context(count)) ?? find;
        if (find) this.lastFind = { key: key[0] ?? "f", char: key.slice(1) };
        if (target) {
            if (operator) {
                const from = Math.min(vim.cursor, target.pos);
                const to = Math.max(vim.cursor, target.pos);
                const range =
                    target.shape === "line"
                        ? lineRange(this.editor.state.doc, from, to)
                        : {
                              from,
                              to: target.inclusive ? nextCharacter(this.editor.state.doc, to) : to,
                              shape: "character" as const,
                          };
                if (range) this.operate(operator, range, keys, count);
            } else this.move(target.pos, ["j", "k"].includes(key));
            return true;
        }
        const prefix =
            [...this.motionHandlers.keys(), ...this.objectHandlers.keys()].some(
                (entry) => entry.startsWith(key) && entry !== key,
            ) || ["f", "F", "t", "T"].includes(key);
        if (prefix) {
            this.pending(keys);
            return true;
        }
        this.reset();
        return !key.startsWith("<") || key === "<Tab>" || key === "<CR>";
    }

    private reset(): void {
        const mode = this.getState()?.mode;
        this.update({ pending: [], ...(mode === "operator-pending" ? { mode: "normal" } : {}) });
    }

    private operate(operator: string, range: VimRange, keys: readonly string[], count: number): void {
        const state = this.editor.state;
        const vim = this.getState();
        const visual =
            vim && (vim.mode === "visual" || vim.mode === "visual-line") ? this.visualChange(range) : undefined;
        if (!rangeAllowed(state, range)) {
            this.update({ mode: "normal", pending: [], message: "This operation crosses an isolated editor boundary" });
            return;
        }
        const tr = state.tr;
        const register = { slice: state.doc.slice(range.from, range.to), shape: range.shape };
        switch (operator) {
            case "y":
                break;
            case "d":
                tr.deleteRange(range.from, range.to);
                break;
            case "c": {
                const from =
                    range.shape === "line" && !state.doc.resolve(range.from).parent.isTextblock
                        ? range.from + 1
                        : range.from;
                const to =
                    range.shape === "line" && !state.doc.resolve(range.to).parent.isTextblock ? range.to - 1 : range.to;
                const contentTo =
                    range.shape === "line" &&
                    to > from &&
                    state.doc.resolve(range.to).parent.isTextblock &&
                    state.doc.textBetween(to - 1, to, "", "\n") === "\n"
                        ? to - 1
                        : to;
                tr.deleteRange(from, Math.max(from, contentTo));
                break;
            }
            default: {
                const handler = this.operatorHandlers.get(operator);
                if (!handler?.({ ...this.context(count), range, tr })) {
                    this.reset();
                    return;
                }
            }
        }
        tr.setSelection(Selection.near(tr.doc.resolve(Math.min(tr.mapping.map(range.from), tr.doc.content.size))));
        tr.setMeta(neovimKey, {
            register,
            pending: [],
            anchor: null,
            mode: "normal",
            lastChange: operator === "y" || this.replaying ? vim?.lastChange : { keys, visual },
        });
        this.editor.view.dispatch(operator === "y" ? tr : closeHistory(tr));
        if (operator === "c") this.setMode("insert", keys);
        else this.move(this.editor.state.selection.head);
    }

    private openLine(key: string, keys: readonly string[]): boolean {
        const state = this.editor.state;
        const $pos = state.doc.resolve(this.getState()?.cursor ?? state.selection.head);
        if (!$pos.parent.isTextblock) return true;
        const at = key === "o" ? $pos.after() : $pos.before();
        const paragraph = state.schema.nodes.paragraph?.create();
        if (
            !paragraph ||
            !$pos
                .node($pos.depth - 1)
                .canReplaceWith(
                    $pos.index($pos.depth - 1) + (key === "o" ? 1 : 0),
                    $pos.index($pos.depth - 1) + (key === "o" ? 1 : 0),
                    paragraph.type,
                )
        )
            return true;
        const tr = state.tr.insert(at, paragraph);
        tr.setSelection(TextSelection.create(tr.doc, at + 1));
        this.editor.view.dispatch(closeHistory(tr));
        this.setMode("insert", keys);
        return true;
    }

    private put(after: boolean, keys: readonly string[], count: number): boolean {
        const vim = this.getState();
        if (!vim?.register) {
            this.reset();
            return true;
        }
        const state = this.editor.state;
        const line = currentLine(state.doc, vim.cursor);
        const inlineLine = vim.register.shape === "line" && vim.register.slice.content.firstChild?.isInline;
        const at =
            vim.register.shape === "line"
                ? inlineLine
                    ? after
                        ? Math.min((line?.to ?? vim.cursor) + 1, (line?.blockTo ?? state.doc.content.size) - 1)
                        : line?.from
                    : after
                      ? line?.blockTo
                      : line?.blockFrom
                : after
                  ? nextCharacter(state.doc, vim.cursor)
                  : vim.cursor;
        if (at === undefined) return true;
        const tr = state.tr;
        let pos = at;
        for (let index = 0; index < count; index++) {
            tr.replaceRange(pos, pos, vim.register.slice);
            pos = tr.mapping.map(at, 1);
        }
        tr.setSelection(
            Selection.near(tr.doc.resolve(Math.min(at + (vim.register.shape === "line" ? 1 : 0), tr.doc.content.size))),
        );
        tr.setMeta(neovimKey, { pending: [], lastChange: this.replaying ? vim.lastChange : { keys } });
        this.editor.view.dispatch(closeHistory(tr));
        this.move(this.editor.state.selection.head);
        return true;
    }

    private repeat(count: number): boolean {
        const change = this.getState()?.lastChange;
        if (!change) {
            this.reset();
            return true;
        }
        this.reset();
        this.replaying = true;
        try {
            for (let index = 0; index < count; index++) {
                if (change.visual) {
                    const range = this.repeatedRange(change.visual);
                    if (range) this.operate(change.keys.at(-1) ?? "d", range, change.keys, 1);
                } else for (const key of change.keys) this.feed(key, false);
                if (change.inserted) this.insertSlice(change.inserted);
                const mode = this.getState()?.mode;
                if (mode === "insert" || mode === "replace") this.setMode("normal");
            }
        } finally {
            this.replaying = false;
        }
        this.update({ lastChange: change });
        return true;
    }

    private insertSlice(slice: Slice): void {
        const state = this.editor.state;
        const tr = state.tr;
        if (this.getState()?.mode === "replace") {
            let to = state.selection.head;
            const count = boundaries(slice.content.textBetween(0, slice.content.size)).length - 1;
            for (let index = 0; index < count; index++) to = nextCharacter(state.doc, to);
            tr.setSelection(TextSelection.create(state.doc, state.selection.head, to));
        }
        this.editor.view.dispatch(tr.replaceSelection(slice));
    }

    private visualChange(range: VimRange): VisualChange {
        const selected = lines(this.editor.state.doc).filter((line) => line.to >= range.from && line.from < range.to);
        const size =
            range.shape === "line"
                ? selected.length
                : selected.reduce(
                      (total, line) => {
                          const text = line.text.slice(
                              Math.max(0, range.from - line.from),
                              Math.max(0, Math.min(line.text.length, range.to - line.from)),
                          );
                          return total + boundaries(text).length - 1;
                      },
                      Math.max(0, selected.length - 1),
                  );
        return { shape: range.shape, size };
    }

    private repeatedRange(visual: VisualChange): VimRange | null {
        const doc = this.editor.state.doc;
        const from = this.getState()?.cursor ?? this.editor.state.selection.head;
        const all = lines(doc);
        const index = all.findIndex((line) => from >= line.from && from <= line.to);
        if (visual.shape === "line")
            return lineRange(doc, from, all[Math.min(all.length - 1, index + visual.size - 1)]?.from ?? from);
        const positions = all
            .flatMap((line) => boundaries(line.text).map((offset) => line.from + offset))
            .filter((pos) => pos >= from);
        return { from, to: positions[Math.min(positions.length - 1, visual.size)] ?? from, shape: "character" };
    }

    private commandKey(key: string): boolean {
        const command = this.getState()?.command ?? "";
        if (key === "<BS>") {
            this.update({ command: command.slice(0, -1) || command[0] || "/" });
            return true;
        }
        if (key === "<CR>") {
            const query = command.slice(1);
            this.update({ mode: "normal", command: "" });
            if (command.startsWith("/")) this.search(query || this.getState()?.search || "", 1, 1);
            else if (command.startsWith("?")) this.search(query || this.getState()?.search || "", -1, 1);
            else if (/^\d+$/u.test(query))
                this.move(
                    lines(this.editor.state.doc)[
                        Math.max(0, Math.min(lines(this.editor.state.doc).length - 1, Number(query) - 1))
                    ]?.from ?? 1,
                );
            else if (query === "noh" || query === "nohlsearch") this.update({ search: "", message: "" });
            else this.update({ message: `Unsupported command: ${query}` });
            return true;
        }
        if (!key.startsWith("<")) this.update({ command: command + key });
        return true;
    }

    private search(query: string, direction: 1 | -1, count: number): void {
        if (!query) {
            this.reset();
            return;
        }
        const matches: number[] = [];
        for (const line of lines(this.editor.state.doc)) {
            let offset = line.text.indexOf(query);
            while (offset >= 0) {
                matches.push(line.from + offset);
                offset = line.text.indexOf(query, offset + Math.max(1, query.length));
            }
        }
        let pos = this.getState()?.cursor ?? 1;
        for (let index = 0; index < count; index++)
            pos =
                direction === 1
                    ? (matches.find((match) => match > pos) ?? matches[0] ?? pos)
                    : (matches.filter((match) => match < pos).at(-1) ?? matches.at(-1) ?? pos);
        this.move(pos);
        this.update({
            search: query,
            searchDirection: direction,
            message: matches.length ? "" : `Pattern not found: ${query}`,
        });
    }
}
