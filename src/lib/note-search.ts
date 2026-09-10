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

const getFzfRawScore = (query: string, candidate: SearchValue): number | null => {
    const normalizedQuery = normalizeSearchText(query).trim();
    const normalizedCandidate = normalizeSearchText(candidate);
    if (!normalizedQuery) return 0;
    if (!normalizedCandidate) return null;

    const queryCharacters = Array.from(normalizedQuery);
    const candidateCharacters = Array.from(normalizedCandidate);
    const scoreCharacter = (candidateIndex: number): number => {
        let score = 1;
        if (isWordBoundary(candidateCharacters[candidateIndex - 1])) score += 8;
        return score - candidateIndex * 0.01;
    };

    let scores = Array<number | null>(candidateCharacters.length).fill(null);
    for (let candidateIndex = 0; candidateIndex < candidateCharacters.length; candidateIndex++) {
        if (candidateCharacters[candidateIndex] === queryCharacters[0]) {
            scores[candidateIndex] = scoreCharacter(candidateIndex);
        }
    }

    for (let queryIndex = 1; queryIndex < queryCharacters.length; queryIndex++) {
        const nextScores = Array<number | null>(candidateCharacters.length).fill(null);
        let bestPreviousScore: number | null = null;

        for (let candidateIndex = 0; candidateIndex < candidateCharacters.length; candidateIndex++) {
            const previousScore = candidateIndex > 0 ? (scores[candidateIndex - 1] ?? null) : null;
            if (previousScore !== null) {
                bestPreviousScore =
                    bestPreviousScore === null ? previousScore : Math.max(bestPreviousScore, previousScore);
            }
            if (candidateCharacters[candidateIndex] !== queryCharacters[queryIndex]) continue;

            const consecutiveScore = candidateIndex > 0 ? (scores[candidateIndex - 1] ?? null) : null;
            let bestScore = bestPreviousScore;
            if (consecutiveScore !== null) {
                const consecutiveMatchScore = consecutiveScore + 4;
                if (bestScore === null || consecutiveMatchScore > bestScore) bestScore = consecutiveMatchScore;
            }
            if (bestScore !== null) nextScores[candidateIndex] = bestScore + scoreCharacter(candidateIndex);
        }
        scores = nextScores;
    }

    const score = scores.reduce<number | null>((best, current) => {
        if (current === null) return best;
        if (best === null) return current;
        return Math.max(best, current);
    }, null);
    if (score === null) return null;

    let totalScore = score;
    if (normalizedCandidate.startsWith(normalizedQuery)) totalScore += 16;
    if (queryCharacters.length === candidateCharacters.length) totalScore += 4;
    return totalScore - candidateCharacters.length * 0.001;
};

export function fzfScore(query: string, candidate: SearchValue): number | null {
    return getFzfRawScore(query, candidate);
}

const MIN_FZF_ACCURACY = 80;

const fzfAccuracy = (
    query: string,
    candidate: SearchValue,
    score = fzfScore(query, candidate),
    perfectScore = fzfScore(query, query),
): number => {
    const normalizedQuery = normalizeSearchText(query).trim();
    const normalizedCandidate = normalizeSearchText(candidate);
    if (!normalizedQuery || !normalizedCandidate) return 0;
    if (score === null || perfectScore === null || perfectScore <= 0) return 0;

    const relativeScore = Math.max(0, Math.min(100, (score / perfectScore) * 100));
    // A contiguous term is an intentional match even when it appears in a longer field.
    return normalizedCandidate.includes(normalizedQuery) ? Math.max(MIN_FZF_ACCURACY, relativeScore) : relativeScore;
};

const getNoteSearchFields = (note: NoteSearchable): NoteSearchField[] => [
    { value: note.title, weight: 30 },
    { value: note.description, weight: 20 },
    { value: note.tags.join(" "), weight: 20 },
    { value: note.content, weight: 10 },
    { value: note.url, weight: 5 },
    { value: note.filePath, weight: 5 },
];

const getNoteSearchScore = (note: NoteSearchable, query: string): number | null => {
    const normalizedQuery = normalizeSearchText(query).trim();
    if (!normalizedQuery) return 0;

    let bestScore: number | null = null;
    const perfectScore = fzfScore(normalizedQuery, normalizedQuery);

    for (const field of getNoteSearchFields(note)) {
        const score = fzfScore(query, field.value);
        const accuracy = fzfAccuracy(query, field.value, score, perfectScore);
        if (score === null || accuracy < MIN_FZF_ACCURACY) continue;

        const weightedScore = accuracy + field.weight;
        if (bestScore === null || weightedScore > bestScore) bestScore = weightedScore;
    }

    return bestScore;
};

export function filterNotesByQuery<T extends NoteSearchable>(notes: readonly T[], query: string): T[] {
    if (!normalizeSearchText(query).trim()) return [...notes];

    const matches: Array<{ note: T; score: number; index: number }> = [];
    for (const [index, note] of notes.entries()) {
        const score = getNoteSearchScore(note, query);
        if (score !== null) matches.push({ note, score, index });
    }

    return matches.sort((left, right) => right.score - left.score || left.index - right.index).map(({ note }) => note);
}
