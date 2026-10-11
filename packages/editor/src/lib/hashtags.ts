export type HashtagMatch = { tag: string; index: number; length: number };

const tagCharacters = "\\p{L}\\p{M}\\p{N}_\\p{Extended_Pictographic}\\u200d\\ufe0f-";
const tagPattern = `[${tagCharacters}]+(?:/[${tagCharacters}]+)*`;
const validTag = new RegExp(`^${tagPattern}$`, "u");
const suffixPattern = new RegExp(`^[/${tagCharacters}]*`, "u");

export function hashtagSuffix(text: string): string {
    return text.match(suffixPattern)?.[0] ?? "";
}

export function normalizeHashtag(value: string): string | null {
    const tag = value.trim().replace(/^#/, "").normalize("NFC");
    return validTag.test(tag) && /[^\p{N}/]/u.test(tag) ? tag : null;
}

export function hashtagKey(value: string): string {
    return value.normalize("NFC").toLocaleLowerCase();
}

export function findHashtags(text: string): HashtagMatch[] {
    const pattern = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_/#\\\\])#(${tagPattern})`, "gu");
    return [...text.matchAll(pattern)].flatMap((match) => {
        const tag = normalizeHashtag(match[1] ?? "");
        return tag ? [{ tag, index: match.index, length: match[0].length }] : [];
    });
}
