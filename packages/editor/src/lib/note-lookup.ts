import { type Note } from "@/store/note";

export type CompatibleNoteTarget = {
    id?: string | null;
    label?: string | null;
    path?: string | null;
    target?: string | null;
};

export function findCompatibleNote(notes: readonly Note[], target: CompatibleNoteTarget | string): Note | undefined {
    return findCompatibleNotes(notes, target)[0];
}

export function findCompatibleNotes(notes: readonly Note[], target: CompatibleNoteTarget | string): Note[] {
    const idTargets = typeof target === "string" ? [target] : [target.id, target.path, target.target];
    for (const value of idTargets) {
        if (!value) continue;
        const decoded = decodeLookupValue(value);
        for (const id of [decoded, stripSubpath(decoded), extractNoteIdFromPath(decoded)]) {
            if (!id) continue;
            const match = notes.find((note) => note.id === id);
            if (match) return [match];
        }
    }
    const rawValues = getRawTargetValues(target);
    const hasQualifiedTarget = rawValues.some((value) =>
        stripSubpath(decodeLookupValue(value)).replace(/\\/g, "/").includes("/"),
    );

    if (hasQualifiedTarget) {
        const qualifiedLookupValues = createNormalizedValueSet(rawValues, {
            includeBasename: false,
        });
        const qualifiedMatches = findByLookupValues(notes, qualifiedLookupValues);
        if (qualifiedMatches.length > 0) return qualifiedMatches;
    }

    const lookupValues = createNormalizedValueSet(rawValues, {
        includeBasename: true,
    });
    return findByLookupValues(notes, lookupValues);
}

function findByLookupValues(notes: readonly Note[], lookupValues: Set<string>): Note[] {
    if (lookupValues.size === 0) return [];

    return notes.filter((note) => {
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
        ...getNoteAliases(note),
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

export function getNoteAliases({ metadata }: Pick<Note, "metadata">): string[] {
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
    return stripSubpath(value)
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\.\/+/, "")
        .replace(/^\/+/, "")
        .normalize("NFC")
        .toLowerCase();
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
