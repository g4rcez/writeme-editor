import { z } from "zod";
import { WHISPER_MODELS } from "./meeting-models";
import { identifyMeetingSpeakers, type MeetingSegment } from "./meeting-transcript";
import { proxyFetch } from "./proxy-fetch";

const MAX_RECORDING_BYTES = 24_000_000;
const MAX_UPLOAD_BYTES = 25_000_000;
const MAX_RECORDING_DURATION = 60 * 60 * 1000;
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];

type AudioSource = "microphone" | "system";
type RecordedAudio = { source: AudioSource; audio: Blob };
type CapturedRecorder = { recorder: MediaRecorder; completed: Promise<RecordedAudio>; clear: () => void };

export type MeetingRecording = {
    stop: () => Promise<RecordedAudio[]>;
    dispose: () => void;
};

export async function startMeetingRecording(options: {
    includeSystemAudio: boolean;
    onEnded?: () => void;
}): Promise<MeetingRecording> {
    z.object({ includeSystemAudio: z.boolean() }).parse(options);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Audio recording is unavailable in this browser.");
    }
    if (options.includeSystemAudio && !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("System audio capture is unavailable. Use microphone only or a supported desktop browser.");
    }

    const streams: MediaStream[] = [];
    const recorders: CapturedRecorder[] = [];
    const listeners: { track: MediaStreamTrack; listener: () => void }[] = [];
    let ended = false;
    let disposed = false;
    let recordingError: Error | undefined;
    let durationTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped: Promise<RecordedAudio[]> | undefined;

    const release = (): void => {
        clearTimeout(durationTimer);
        for (const { track, listener } of listeners) track.removeEventListener("ended", listener);
        for (const stream of streams) for (const track of stream.getTracks()) track.stop();
    };
    const finish = (): void => {
        if (ended) return;
        ended = true;
        for (const { recorder } of recorders) {
            if (recorder.state !== "inactive") recorder.stop();
        }
        release();
    };
    const endAutomatically = (): void => {
        if (ended) return;
        finish();
        options.onEnded?.();
    };
    const capture = (stream: MediaStream, source: AudioSource): void => {
        const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
        const recorder = new MediaRecorder(new MediaStream(stream.getAudioTracks()), {
            ...(mimeType ? { mimeType } : {}),
            audioBitsPerSecond: 48_000,
        });
        const chunks: Blob[] = [];
        let bytes = 0;
        const completed = new Promise<RecordedAudio>((resolve) => {
            recorder.addEventListener("dataavailable", (event) => {
                if (disposed || !event.data.size) return;
                chunks.push(event.data);
                bytes += event.data.size;
                if (bytes >= MAX_RECORDING_BYTES) endAutomatically();
            });
            recorder.addEventListener("error", () => {
                recordingError = new Error(`The ${source} recording failed. Start a new recording.`);
                endAutomatically();
            });
            recorder.addEventListener(
                "stop",
                () => {
                    resolve({ source, audio: new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type }) });
                    chunks.length = 0;
                },
                { once: true },
            );
        });
        recorders.push({
            recorder,
            completed,
            clear: () => {
                chunks.length = 0;
            },
        });
        recorder.start(1000);
    };

    try {
        let systemStream: MediaStream | undefined;
        if (options.includeSystemAudio) {
            systemStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
            streams.push(systemStream);
            if (!systemStream.getAudioTracks().some((track) => track.readyState === "live")) {
                throw new Error(
                    "No system audio was shared. Select a source with audio enabled, or use microphone only.",
                );
            }
        }
        const microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        streams.push(microphoneStream);
        if (!microphoneStream.getAudioTracks().some((track) => track.readyState === "live")) {
            throw new Error("No microphone audio is available. Check microphone access and try again.");
        }
        if (streams.some((stream) => stream.getTracks().some((track) => track.readyState === "ended"))) {
            throw new Error("Audio sharing ended before recording could start. Try again.");
        }
        capture(microphoneStream, "microphone");
        if (systemStream) capture(systemStream, "system");
        for (const stream of streams) {
            for (const track of stream.getTracks()) {
                track.addEventListener("ended", endAutomatically);
                listeners.push({ track, listener: endAutomatically });
            }
        }
        durationTimer = setTimeout(endAutomatically, MAX_RECORDING_DURATION);
        return {
            stop: (): Promise<RecordedAudio[]> => {
                stopped ??= (async (): Promise<RecordedAudio[]> => {
                    finish();
                    const audio = await Promise.all(recorders.map(({ completed }) => completed));
                    if (disposed) throw new Error("The recording was discarded.");
                    if (recordingError) throw recordingError;
                    return audio;
                })();
                return stopped;
            },
            dispose: (): void => {
                disposed = true;
                finish();
                for (const { clear } of recorders) clear();
            },
        };
    } catch (error) {
        disposed = true;
        finish();
        for (const { clear } of recorders) clear();
        throw error;
    }
}

const TranscriptionOptionsSchema = z.object({
    endpoint: z.url().refine((value) => {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
    }, "Use an HTTP or HTTPS transcription endpoint without embedded credentials."),
    model: z.string().trim().min(1).max(200),
    apiKey: z.string().trim().optional(),
    source: z.enum(["microphone", "system"]),
    localSpeaker: z.string().trim().min(1).max(200),
});

const TranscriptionResponseSchema = z
    .object({
        text: z.string().optional(),
        segments: z
            .array(
                z
                    .object({
                        text: z.string(),
                        speaker: z.string().nullable().optional(),
                        start: z.number().finite().nonnegative().optional(),
                        end: z.number().finite().nonnegative().optional(),
                    })
                    .refine(
                        (segment) => segment.end === undefined || segment.end >= (segment.start ?? 0),
                        "Transcript segment ends before it starts.",
                    ),
            )
            .optional(),
    })
    .refine(
        (response) => response.text !== undefined || response.segments !== undefined,
        "The transcription endpoint returned no transcript.",
    );

export async function transcribeMeetingAudio(
    audio: Blob,
    options: {
        endpoint: string;
        model: string;
        apiKey?: string;
        source: AudioSource;
        localSpeaker: string;
        signal?: AbortSignal;
    },
): Promise<MeetingSegment[]> {
    const settings = TranscriptionOptionsSchema.parse(options);
    options.signal?.throwIfAborted();
    if (!audio.size) throw new Error("The recording contains no audio. Record again before transcribing.");
    if (audio.size > MAX_UPLOAD_BYTES) throw new Error("The recording exceeds the 25 MB transcription upload limit.");
    const url = new URL(settings.endpoint);
    if (url.hostname === "api.openai.com" && !settings.apiKey) {
        throw new Error("An OpenAI API key is required for this transcription endpoint.");
    }
    const extension = audio.type.includes("mp4") ? "mp4" : audio.type.includes("wav") ? "wav" : "webm";
    const body = new FormData();
    body.set("file", audio, `${settings.source}.${extension}`);
    body.set("model", settings.model);
    const diarized = settings.model === "gpt-4o-transcribe-diarize";
    const whisper = settings.model === "whisper-1" || WHISPER_MODELS.some(({ value }) => value === settings.model);
    body.set("response_format", diarized ? "diarized_json" : whisper ? "verbose_json" : "json");
    if (whisper) body.set("timestamp_granularities[]", "segment");
    if (diarized) body.set("chunking_strategy", "auto");
    const headers = new Headers();
    if (settings.apiKey) headers.set("authorization", `Bearer ${settings.apiKey}`);
    const request = url.origin === "https://api.openai.com" ? proxyFetch : fetch;
    const response = await request(url, { method: "POST", body, headers, signal: options.signal, redirect: "error" });
    if (!response.ok) {
        throw new Error(
            `Transcription failed (${response.status}). Check the endpoint, model and credentials, then retry.`,
        );
    }
    const parsed = TranscriptionResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("The transcription endpoint returned an invalid transcript.");
    const segments: NonNullable<z.infer<typeof TranscriptionResponseSchema>["segments"]> = parsed.data.segments?.length
        ? parsed.data.segments
        : parsed.data.text
          ? [{ text: parsed.data.text }]
          : [];
    return identifyMeetingSpeakers(
        segments
            .filter((segment) => segment.text.trim())
            .map((segment): MeetingSegment => ({
                id: crypto.randomUUID(),
                source: settings.source,
                start: segment.start ?? 0,
                end: segment.end ?? segment.start ?? 0,
                speaker: segment.speaker?.trim() || (settings.source === "microphone" ? settings.localSpeaker : ""),
                text: segment.text.trim(),
            })),
    );
}
