import type { Note } from "@/store/note";

type SearchValue = string | null | undefined;
type NoteSearchable = Pick<Note, "title" | "content" | "description" | "tags" | "url" | "filePath">;
type NoteSearchField = {
    value: SearchValue;
    weight: number;
};

const normalizeSearchText = (value: SearchValue): string => {
    if (typeof value !== "string") return "";
    return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
};

const isWordBoundary = (character: string | undefined): boolean =>
    character === undefined || !/[\p{L}\p{N}]/u.test(character);

export function fzfScore(query: string, candidate: SearchValue): number | null {
    const normalizedQuery = normalizeSearchText(query).trim();
    const normalizedCandidate = normalizeSearchText(candidate);
    if (!normalizedQuery) return 0;
    if (!normalizedCandidate) return null;

    const queryCharacters = Array.from(normalizedQuery);
    const candidateCharacters = Array.from(normalizedCandidate);
    let nextCandidateIndex = 0;
    let previousMatchIndex = -2;
    let score = 0;

    for (const queryCharacter of queryCharacters) {
        let matchIndex = -1;
        for (let candidateIndex = nextCandidateIndex; candidateIndex < candidateCharacters.length; candidateIndex++) {
            if (candidateCharacters[candidateIndex] === queryCharacter) {
                matchIndex = candidateIndex;
                break;
            }
        }

        if (matchIndex === -1) return null;

        const startsWord = isWordBoundary(candidateCharacters[matchIndex - 1]);
        const isConsecutive = matchIndex === previousMatchIndex + 1;
        score += 1;
        if (startsWord) score += 8;
        if (isConsecutive) score += 4;
        score -= matchIndex * 0.01;

        previousMatchIndex = matchIndex;
        nextCandidateIndex = matchIndex + 1;
    }

    if (normalizedCandidate.startsWith(normalizedQuery)) score += 16;
    if (queryCharacters.length === candidateCharacters.length) score += 4;
    return score - candidateCharacters.length * 0.001;
}

const getNoteSearchFields = (note: NoteSearchable): NoteSearchField[] => [
    { value: note.title, weight: 30 },
    { value: note.description, weight: 20 },
    { value: note.tags.join(" "), weight: 20 },
    { value: note.content, weight: 10 },
    { value: note.url, weight: 5 },
    { value: note.filePath, weight: 5 },
];

const getNoteSearchScore = (note: NoteSearchable, query: string): number | null => {
    let bestScore: number | null = null;

    for (const field of getNoteSearchFields(note)) {
        const score = fzfScore(query, field.value);
        if (score === null) continue;
        const weightedScore = score + field.weight;
        if (bestScore === null || weightedScore > bestScore) bestScore = weightedScore;
    }

    return bestScore;
};

export function filterNotesByQuery<T extends NoteSearchable>(notes: readonly T[], query: string): T[] {
    if (!query.trim()) return [...notes];

    const matches: Array<{ note: T; score: number; index: number }> = [];
    for (const [index, note] of notes.entries()) {
        const score = getNoteSearchScore(note, query);
        if (score !== null) matches.push({ note, score, index });
    }

    return matches.sort((left, right) => right.score - left.score || left.index - right.index).map(({ note }) => note);
}
