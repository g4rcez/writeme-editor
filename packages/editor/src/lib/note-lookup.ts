import { type Note } from "@/store/note";

export type CompatibleNoteTarget = {
    id?: string | null;
    label?: string | null;
    path?: string | null;
    target?: string | null;
};

export function findCompatibleNote(notes: Note[], target: CompatibleNoteTarget | string): Note | undefined {
    const rawValues = getRawTargetValues(target);
    const hasQualifiedTarget = rawValues.some((value) => stripSubpath(value).includes("/"));

    if (hasQualifiedTarget) {
        const qualifiedLookupValues = createNormalizedValueSet(rawValues, {
            includeBasename: false,
        });
        const qualifiedMatch = findByLookupValues(notes, qualifiedLookupValues);
        if (qualifiedMatch) return qualifiedMatch;
    }

    const lookupValues = createNormalizedValueSet(rawValues, {
        includeBasename: true,
    });
    return findByLookupValues(notes, lookupValues);
}

export function createLookupValues(target: CompatibleNoteTarget | string): Set<string> {
    return createNormalizedValueSet(getRawTargetValues(target), {
        includeBasename: true,
    });
}

function findByLookupValues(notes: Note[], lookupValues: Set<string>): Note | undefined {
    if (lookupValues.size === 0) return undefined;

    return notes.find((note) => {
        const candidates = createNoteCandidateValues(note);
        return candidates.some((candidate) => lookupValues.has(normalizeLookupValue(candidate)));
    });
}

function getRawTargetValues(target: CompatibleNoteTarget | string): string[] {
    if (typeof target === "string") {
        return [target];
    }
    return [target.id ?? "", target.label ?? "", target.path ?? "", target.target ?? ""];
}

function createNoteCandidateValues(note: Note): string[] {
    return [
        note.id,
        note.title,
        note.filePath ?? "",
        ...createPathSuffixes(note.filePath ?? ""),
        basename(note.filePath ?? ""),
        removeMarkdownExtension(basename(note.filePath ?? "")),
        ...extractAliases(note.metadata),
    ];
}

function createNormalizedValueSet(values: string[], { includeBasename }: { includeBasename: boolean }): Set<string> {
    const normalizedValues = new Set<string>();
    values.forEach((value) => {
        const decodedValue = decodeLookupValue(value);
        const variants = [
            decodedValue,
            removeMarkdownExtension(decodedValue),
            stripSubpath(decodedValue),
            removeMarkdownExtension(stripSubpath(decodedValue)),
        ];
        if (includeBasename) {
            variants.push(basename(decodedValue), removeMarkdownExtension(basename(decodedValue)));
        }
        const noteId = extractNoteIdFromPath(decodedValue);
        if (noteId) {
            variants.push(noteId, `/note/${noteId}`, `@mention/note/${noteId}`);
        }

        variants.forEach((variant) => {
            const normalizedValue = normalizeLookupValue(variant);
            if (normalizedValue) normalizedValues.add(normalizedValue);
        });
    });
    return normalizedValues;
}

function extractAliases(metadata: Record<string, unknown> | null | undefined): string[] {
    if (!metadata) return [];
    const aliases = metadata.aliases ?? metadata.alias;
    if (Array.isArray(aliases)) return aliases.map(String);
    if (typeof aliases === "string") {
        return aliases
            .split(",")
            .map((alias) => alias.trim())
            .filter(Boolean);
    }
    return [];
}

function extractNoteIdFromPath(value: string): string | null {
    const innerMentionMatch = value.match(/(?:^|\/)@mention\/note\/([^/?#]+)/);
    const notePathMatch = value.match(/(?:^|\/)note\/([^/?#]+)/);
    return innerMentionMatch?.[1] ?? notePathMatch?.[1] ?? null;
}

function decodeLookupValue(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function normalizeLookupValue(value: string): string {
    return stripSubpath(value).trim().toLowerCase();
}

function stripSubpath(value: string): string {
    return value.replace(/[#^].*$/, "");
}

function basename(value: string): string {
    return stripSubpath(value).split(/[\\/]/).pop() ?? value;
}

function createPathSuffixes(value: string): string[] {
    const cleanValue = stripSubpath(value).replace(/\\/g, "/");
    const parts = cleanValue.split("/").filter(Boolean);
    return parts.flatMap((_, index) => {
        const suffix = parts.slice(index).join("/");
        return [suffix, removeMarkdownExtension(suffix)];
    });
}

function removeMarkdownExtension(value: string): string {
    return value.replace(/\.md$/i, "");
}
