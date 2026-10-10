import { describe, expect, it } from "vitest";
import {
    importMeetingTranscript,
    meetingSpeakerKey,
    parseMeetingTranscript,
    serializeMeetingTranscript,
} from "./meeting-transcript";

describe("meeting transcript persistence", () => {
    it("round trips microphone, system and imported segments through note metadata", () => {
        const transcript = {
            segments: [
                { id: "local", start: 0, end: 1.5, speaker: "Allan", text: "Hello", source: "microphone" },
                { id: "remote", start: 2, end: 3, speaker: "", text: "Welcome", source: "system" },
                { id: "imported", start: 4, end: 5, speaker: "Jo", text: "Thanks", source: "import" },
            ],
        };
        const parsed = parseMeetingTranscript(transcript);
        const metadata = { meetingTranscript: serializeMeetingTranscript(parsed) };
        expect(parseMeetingTranscript(metadata.meetingTranscript)).toEqual(transcript);
    });

    it("treats absent metadata as an empty transcript", () => {
        expect(parseMeetingTranscript(undefined)).toEqual({ segments: [] });
        expect(parseMeetingTranscript(null)).toEqual({ segments: [] });
    });

    it("preserves speaker identity after renaming and distinguishes legacy sources", () => {
        const transcript = parseMeetingTranscript({
            segments: [
                { id: "1", speakerId: "identity", start: 0, end: 1, speaker: "A", text: "Hello", source: "microphone" },
                { id: "2", start: 0, end: 1, speaker: "A", text: "Welcome", source: "system" },
            ],
        });
        const segment = transcript.segments[0]!;
        expect(meetingSpeakerKey({ ...segment, speaker: "Allan" })).toBe(meetingSpeakerKey(segment));
        expect(meetingSpeakerKey({ ...transcript.segments[1]!, source: "microphone" })).not.toBe(
            meetingSpeakerKey(transcript.segments[1]!),
        );
        expect(parseMeetingTranscript(serializeMeetingTranscript(transcript))).toEqual(transcript);
    });

    it("rejects malformed JSON, negative times, reversed times and unrecognized sources", () => {
        expect(() => parseMeetingTranscript("{broken")).toThrow();
        const segment = { id: "1", start: 0, end: 1, speaker: "", text: "Hello", source: "import" };
        for (const invalid of [{ start: -1 }, { end: -1 }, { start: 2 }, { source: "guessed" }, { text: " " }]) {
            expect(() => parseMeetingTranscript({ segments: [{ ...segment, ...invalid }] })).toThrow();
        }
    });
});

describe("meeting transcript imports", () => {
    it("keeps repeated names in one import together and separates the same name in another import", () => {
        const text = "A: Hello\nB: Welcome\nA: Thanks";
        const first = importMeetingTranscript(text, "other");
        const second = importMeetingTranscript(text, "other");
        expect(first.segments[0]?.speakerId).toBeTruthy();
        expect(first.segments[0]?.speakerId).toBe(first.segments[2]?.speakerId);
        expect(first.segments[0]?.speakerId).not.toBe(first.segments[1]?.speakerId);
        expect(first.segments[0]?.speakerId).not.toBe(second.segments[0]?.speakerId);
    });
    it("imports Google Meet WebVTT voices, cue identifiers, timing settings and multiline speech", () => {
        const transcript = importMeetingTranscript(
            "WEBVTT\n\ncue-a\n00:00:01.250 --> 00:00:04.500 align:start\n<v Allan Garcez>Hello &amp; welcome.\nLet’s begin.</v>\n\n00:04.500 --> 00:05.000\nNo named speaker.",
            "google-meet",
        );
        expect(transcript.segments).toEqual([
            expect.objectContaining({
                start: 1.25,
                end: 4.5,
                speaker: "Allan Garcez",
                text: "Hello & welcome.\nLet’s begin.",
                source: "import",
            }),
            expect.objectContaining({ start: 4.5, end: 5, speaker: "", text: "No named speaker." }),
        ]);
        expect(new Set(transcript.segments.map((segment) => segment.id)).size).toBe(2);
    });

    it("imports Teams VTT speakers and ignores non-speech blocks", () => {
        const transcript = importMeetingTranscript(
            "\uFEFFWEBVTT\r\n\r\nNOTE metadata\r\nignored\r\n\r\nSTYLE\r\n::cue { color: blue }\r\n\r\n1\r\n00:01:02.000 --> 00:01:05.200\r\n<v Maria>Plan &lt;ready&gt;.</v>",
            "teams",
        );
        expect(transcript.segments).toEqual([
            expect.objectContaining({ start: 62, end: 65.2, speaker: "Maria", text: "Plan <ready>." }),
        ]);
    });

    it("keeps separate supplied speakers within one cue", () => {
        const transcript = importMeetingTranscript(
            "WEBVTT\n\n00:00.000 --> 00:03.000\n<v Alex>Hello.</v><v Sam>Hi.</v>",
            "teams",
        );
        expect(transcript.segments.map(({ speaker, text }) => ({ speaker, text }))).toEqual([
            { speaker: "Alex", text: "Hello." },
            { speaker: "Sam", text: "Hi." },
        ]);
    });

    it("imports Zoom SRT with supplied names and comma fractions", () => {
        const transcript = importMeetingTranscript(
            "1\n00:00:03,100 --> 00:00:05,250\nAlex Chen: First point.\n\n2\n00:00:05,250 --> 00:00:06,000\nSecond point.",
            "zoom",
        );
        expect(transcript.segments).toEqual([
            expect.objectContaining({ start: 3.1, end: 5.25, speaker: "Alex Chen", text: "First point." }),
            expect.objectContaining({ speaker: "", text: "Second point." }),
        ]);
    });

    it("imports Zoom timestamped speaker text and speaker-only headers", () => {
        const transcript = importMeetingTranscript(
            "00:02:03 Alex Chen: First point.\nContinued point.\n[02:05] Sam:\nSecond point.",
            "zoom",
        );
        expect(transcript.segments).toEqual([
            expect.objectContaining({
                start: 123,
                end: 123,
                speaker: "Alex Chen",
                text: "First point.\nContinued point.",
            }),
            expect.objectContaining({ start: 125, end: 125, speaker: "Sam", text: "Second point." }),
        ]);
    });

    it("imports generic speaker-colon text without inventing names or durations", () => {
        const transcript = importMeetingTranscript("Jo: Agenda\nDetails\nLi: Decision", "other");
        expect(transcript.segments).toEqual([
            expect.objectContaining({ start: 0, end: 0, speaker: "Jo", text: "Agenda\nDetails" }),
            expect.objectContaining({ start: 0, end: 0, speaker: "Li", text: "Decision" }),
        ]);
        expect(importMeetingTranscript("An unnamed transcript.", "other").segments[0]?.speaker).toBe("");
    });

    it("rejects empty files, empty cues and invalid timing instead of importing misleading text", () => {
        for (const text of [
            " ",
            "WEBVTT",
            "WEBVTT\n\n00:00.000 --> 00:01.000\n<v Jo></v>",
            "00:99.000 --> 00:01.000\nHello",
            "00:02.000 --> 00:01.000\nHello",
            "bad --> timing\nHello",
        ]) {
            expect(() => importMeetingTranscript(text, "other")).toThrow();
        }
    });
});
