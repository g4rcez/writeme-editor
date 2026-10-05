import type { EditorMentionItem } from "@/lib/editor-storage";

const MAX_MENTION_RESULTS = 40;

type ScoredMention = { item: EditorMentionItem; score: number };

function scoreField(value: string, query: string, fieldIndex: number): number | undefined {
    const normalizedValue = value.toLocaleLowerCase();
    const startIndex = normalizedValue.indexOf(query);
    if (startIndex >= 0) return 10_000 - startIndex * 10 - fieldIndex * 100;

    let cursor = 0;
    let firstIndex = -1;
    let previousIndex = -1;
    let gaps = 0;
    let consecutiveMatches = 0;

    for (const character of query) {
        const matchIndex = normalizedValue.indexOf(character, cursor);
        if (matchIndex < 0) return undefined;
        if (firstIndex < 0) firstIndex = matchIndex;
        if (matchIndex === previousIndex + 1) consecutiveMatches += 1;
        else if (previousIndex >= 0) gaps += matchIndex - previousIndex - 1;
        previousIndex = matchIndex;
        cursor = matchIndex + 1;
    }

    return 1_000 + consecutiveMatches * 20 - firstIndex * 5 - gaps * 10 - fieldIndex * 25;
}

export function filterMentionItems(items: EditorMentionItem[], query: string): EditorMentionItem[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return items.slice(0, MAX_MENTION_RESULTS);

    const scoredItems: ScoredMention[] = [];
    for (const item of items) {
        const fields = [item.label, item.searchText ?? item.filePath ?? item.path];
        let bestScore: number | undefined;
        for (const [fieldIndex, field] of fields.entries()) {
            const score = scoreField(field, normalizedQuery, fieldIndex);
            if (score !== undefined && (bestScore === undefined || score > bestScore)) bestScore = score;
        }
        if (bestScore !== undefined) scoredItems.push({ item, score: bestScore });
    }

    scoredItems.sort((left, right) => right.score - left.score || left.item.label.localeCompare(right.item.label));
    return scoredItems.slice(0, MAX_MENTION_RESULTS).map(({ item }) => item);
}
