import { z } from "zod";

const MeetingSegmentSchema = z
    .object({
        id: z.string().min(1),
        start: z.number().finite().nonnegative(),
        end: z.number().finite().nonnegative(),
        speaker: z.string(),
        speakerId: z.string().min(1).optional(),
        text: z.string().trim().min(1),
        source: z.enum(["microphone", "system", "import"]),
    })
    .refine((segment) => segment.end >= segment.start, "A segment cannot end before it starts.");

const MeetingTranscriptSchema = z.object({ segments: z.array(MeetingSegmentSchema) });
const MeetingPlatformSchema = z.enum(["google-meet", "zoom", "teams", "other"]);
const TranscriptInputSchema = z.string().trim().min(1, "The transcript is empty.").max(10_000_000);

export type MeetingSegment = z.infer<typeof MeetingSegmentSchema>;
export type MeetingTranscript = z.infer<typeof MeetingTranscriptSchema>;
export type MeetingPlatform = z.infer<typeof MeetingPlatformSchema>;

export function meetingSpeakerKey(segment: MeetingSegment): string {
    return segment.speakerId ?? JSON.stringify([segment.source, segment.speaker]);
}

export function identifyMeetingSpeakers(segments: MeetingSegment[]): MeetingSegment[] {
    const identities = new Map<string, string>();
    return segments.map((segment) => {
        if (segment.speakerId) return segment;
        const key = meetingSpeakerKey(segment);
        const speakerId = identities.get(key) ?? crypto.randomUUID();
        identities.set(key, speakerId);
        return { ...segment, speakerId };
    });
}

export function parseMeetingTranscript(value: unknown): MeetingTranscript {
    if (value === undefined || value === null) return { segments: [] };
    return MeetingTranscriptSchema.parse(typeof value === "string" ? JSON.parse(value) : value);
}

export function serializeMeetingTranscript(transcript: MeetingTranscript): string {
    return JSON.stringify(MeetingTranscriptSchema.parse(transcript));
}

function parseTimestamp(value: string): number {
    const parts = value.replace(",", ".").split(":").map(Number);
    if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) {
        throw new Error(`Invalid transcript timestamp: ${value}`);
    }
    const seconds = parts.at(-1) ?? 0;
    const minutes = parts.at(-2) ?? 0;
    if (seconds >= 60 || (parts.length === 3 && minutes >= 60)) {
        throw new Error(`Invalid transcript timestamp: ${value}`);
    }
    return parts.length === 3 ? (parts[0] ?? 0) * 3600 + minutes * 60 + seconds : minutes * 60 + seconds;
}

function decodeText(value: string): string {
    const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
    return value
        .replace(/<[^>]*>/g, "")
        .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity: string, key: string) => {
            if (!key.startsWith("#")) return entities[key.toLowerCase()] ?? entity;
            const point = key.toLowerCase().startsWith("#x") ? Number.parseInt(key.slice(2), 16) : Number(key.slice(1));
            return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
        })
        .trim();
}

function parseSpeakerText(value: string): Pick<MeetingSegment, "speaker" | "text"> {
    const match = value.match(/^([^:\n]{1,200}):\s*([\s\S]*)$/);
    return match?.[1] && match[2] !== undefined
        ? { speaker: decodeText(match[1]), text: decodeText(match[2]) }
        : { speaker: "", text: decodeText(value) };
}

function createSegment(start: number, end: number, speaker: string, text: string): MeetingSegment {
    return { id: crypto.randomUUID(), start, end, speaker, text, source: "import" };
}

function parseCueText(value: string, start: number, end: number): MeetingSegment[] {
    const voices = [...value.matchAll(/<v(?:\.[\w.-]+)?\s+([^>]+)>([\s\S]*?)(?=<v(?:\.[\w.-]+)?\s|$)/g)];
    const firstVoice = voices[0];
    if (!firstVoice) {
        const { speaker, text } = parseSpeakerText(value);
        return text ? [createSegment(start, end, speaker, text)] : [];
    }
    const leadingText = decodeText(value.slice(0, firstVoice.index));
    const segments = leadingText ? [createSegment(start, end, "", leadingText)] : [];
    for (const voice of voices) {
        const text = decodeText(voice[2] ?? "");
        if (text) segments.push(createSegment(start, end, decodeText(voice[1] ?? ""), text));
    }
    return segments;
}

function parseTimedTranscript(value: string): MeetingSegment[] {
    const segments: MeetingSegment[] = [];
    for (const block of value.split(/\n\s*\n/)) {
        const lines = block.split("\n");
        if (/^(WEBVTT|NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0] ?? "")) continue;
        const timingIndex = lines.findIndex((line) => line.includes("-->"));
        if (timingIndex === -1) continue;
        const timing = lines[timingIndex]?.match(
            /^\s*(\d{1,3}:\d{2}(?::\d{2})?(?:[.,]\d+)?)\s+-->\s+(\d{1,3}:\d{2}(?::\d{2})?(?:[.,]\d+)?)(?:\s.*)?$/,
        );
        if (!timing?.[1] || !timing[2]) throw new Error("A transcript cue has invalid timestamps.");
        const start = parseTimestamp(timing[1]);
        const end = parseTimestamp(timing[2]);
        if (end < start) throw new Error("A transcript cue ends before it starts.");
        segments.push(...parseCueText(lines.slice(timingIndex + 1).join("\n"), start, end));
    }
    return segments;
}

function parsePlainTranscript(value: string): MeetingSegment[] {
    const segments: MeetingSegment[] = [];
    let pendingStart = 0;
    let pendingSpeaker = "";
    for (const rawLine of value.split("\n")) {
        const line = rawLine.trim();
        if (!line) continue;
        const timedLine = line.match(/^\[?(\d{1,3}:\d{2}(?::\d{2})?(?:[.,]\d+)?)\]?\s*(.*)$/);
        const body = timedLine ? (timedLine[2] ?? "") : line;
        if (timedLine?.[1]) pendingStart = parseTimestamp(timedLine[1]);
        const speakerText = parseSpeakerText(body);
        if (!speakerText.text && speakerText.speaker) {
            pendingSpeaker = speakerText.speaker;
            continue;
        }
        if (!speakerText.text) continue;
        const speaker = speakerText.speaker || pendingSpeaker;
        const previous = segments.at(-1);
        if (!timedLine && !speakerText.speaker && !pendingSpeaker && previous) {
            previous.text += `\n${speakerText.text}`;
        } else {
            segments.push(createSegment(pendingStart, pendingStart, speaker, speakerText.text));
        }
        pendingSpeaker = "";
    }
    return segments;
}

export function importMeetingTranscript(text: string, platform: MeetingPlatform): MeetingTranscript {
    MeetingPlatformSchema.parse(platform);
    const value = TranscriptInputSchema.parse(text)
        .replace(/^\uFEFF/, "")
        .replace(/\r\n?/g, "\n");
    const segments =
        value.includes("-->") || /^WEBVTT(?:\s|$)/.test(value)
            ? parseTimedTranscript(value)
            : parsePlainTranscript(value);
    if (segments.length === 0) throw new Error("The file contains no transcript text.");
    return MeetingTranscriptSchema.parse({ segments: identifyMeetingSpeakers(segments) });
}
