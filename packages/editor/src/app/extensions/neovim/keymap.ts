import type { Mapping, MappingOptions, NeovimMode } from "./types";

export class InvalidKeySequenceError extends Error {
    override readonly name = "InvalidKeySequenceError";
}

export function parseKeys(sequence: string, leader = " "): readonly string[] {
    const expanded = sequence.replace(/<leader>/gi, leader);
    const keys = expanded.match(/<[^>]+>|[^]/gu) ?? [];
    return keys.map((key) => {
        switch (key.toLowerCase()) {
            case "<esc>":
                return "<Esc>";
            case "<cr>":
            case "<enter>":
                return "<CR>";
            case "<bs>":
            case "<backspace>":
                return "<BS>";
            case "<space>":
                return " ";
            case "<tab>":
                return "<Tab>";
            default:
                return key.replace(/^<c-/i, "<C-").replace(/^<s-/i, "<S-");
        }
    });
}

export function eventKey(event: KeyboardEvent): string | null {
    if (event.metaKey || event.altKey || ["Shift", "Control", "Alt", "Meta", "Dead", "Process"].includes(event.key))
        return null;
    if (event.ctrlKey) return `<C-${event.key.toLowerCase()}>`;
    switch (event.key) {
        case "Escape":
            return "<Esc>";
        case "Enter":
            return "<CR>";
        case "Backspace":
            return "<BS>";
        case "Tab":
            return "<Tab>";
        case "ArrowLeft":
            return "h";
        case "ArrowRight":
            return "l";
        case "ArrowUp":
            return "k";
        case "ArrowDown":
            return "j";
        default:
            return event.key.length === 1 || [...event.key].length === 1 ? event.key : null;
    }
}

export class KeymapRegistry {
    private mappings: Mapping[] = [];
    constructor(private leader: string) {}

    setLeader(leader: string): void {
        this.leader = leader;
    }
    parse(sequence: string): readonly string[] {
        return parseKeys(sequence, this.leader);
    }

    set(
        modes: NeovimMode | readonly NeovimMode[],
        sequence: string,
        action: Mapping["action"],
        options: MappingOptions = {},
    ): void {
        const keys = parseKeys(sequence, this.leader);
        if (!keys.length) throw new InvalidKeySequenceError("A mapping needs at least one key");
        for (const mode of typeof modes === "string" ? [modes] : modes) {
            this.del(mode, sequence);
            this.mappings.push({ mode, keys, action, ...options });
        }
    }

    del(modes: NeovimMode | readonly NeovimMode[], sequence: string): void {
        const keys = parseKeys(sequence, this.leader);
        const selected = typeof modes === "string" ? [modes] : modes;
        this.mappings = this.mappings.filter(
            (mapping) => !selected.includes(mapping.mode) || mapping.keys.join("\0") !== keys.join("\0"),
        );
    }

    list(): readonly Mapping[] {
        return this.mappings.map((mapping) => ({ ...mapping, keys: [...mapping.keys] }));
    }

    resolve(mode: NeovimMode, keys: readonly string[]): { readonly exact?: Mapping; readonly prefix: boolean } {
        const candidates = this.mappings.filter(
            (mapping) => mapping.mode === mode && keys.every((key, index) => mapping.keys[index] === key),
        );
        return {
            exact: candidates.find((mapping) => mapping.keys.length === keys.length),
            prefix: candidates.some((mapping) => mapping.keys.length > keys.length),
        };
    }
}
