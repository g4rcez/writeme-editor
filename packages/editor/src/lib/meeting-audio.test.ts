// @vitest-environment node
import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { startMeetingRecording, transcribeMeetingAudio } from "./meeting-audio";

let server: Server;
let endpoint: string;
let responseBody: unknown = { text: "Meeting transcript" };
let responseStatus = 200;
let requestBody = "";
let requestAuthorization: string | undefined;
let requestContentType: string | undefined;

beforeAll(async () => {
    server = createServer(async (request, response) => {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        requestBody = Buffer.concat(chunks).toString();
        requestAuthorization = request.headers.authorization;
        requestContentType = request.headers["content-type"];
        response.writeHead(responseStatus, { "content-type": "application/json" });
        response.end(JSON.stringify(responseBody));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("The transcription fixture failed to start.");
    endpoint = `http://127.0.0.1:${address.port}/v1/audio/transcriptions`;
});

afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

afterEach(() => {
    responseBody = { text: "Meeting transcript" };
    responseStatus = 200;
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("meeting transcription", () => {
    const audio = new Blob(["synthetic audio fixture"], { type: "audio/webm;codecs=opus" });
    const settings = { model: "whisper-1", source: "microphone", localSpeaker: "Allan" } satisfies Omit<
        Parameters<typeof transcribeMeetingAudio>[1],
        "endpoint"
    >;

    it("sends browser OpenAI uploads directly to the official API", async () => {
        const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: "Direct browser upload" })));
        vi.stubGlobal("fetch", send);
        await transcribeMeetingAudio(audio, {
            ...settings,
            endpoint: "https://api.openai.com/v1/audio/transcriptions",
            apiKey: "fixture-key",
        });
        expect(send.mock.calls[0]?.[0].toString()).toBe("https://api.openai.com/v1/audio/transcriptions");
        expect(send.mock.calls[0]?.[1].headers.get("authorization")).toBe("Bearer fixture-key");
    });

    it("authenticates desktop OpenAI uploads through the local proxy", async () => {
        vi.stubGlobal("navigator", { userAgent: "Electron/44" });
        vi.stubGlobal("window", { electronAPI: { ai: { getProxyToken: async () => "proxy-session" } } });
        const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: "Desktop upload" })));
        vi.stubGlobal("fetch", send);
        await transcribeMeetingAudio(audio, {
            ...settings,
            endpoint: "https://api.openai.com/v1/audio/transcriptions",
            apiKey: "fixture-key",
        });
        expect(send.mock.calls[0]?.[0]).toBe("http://localhost:4079/proxy");
        expect(send.mock.calls[0]?.[1].headers.get("x-writeme-proxy-token")).toBe("proxy-session");
    });

    it("times out a stalled upload and releases its timer", async () => {
        vi.useFakeTimers();
        vi.stubGlobal(
            "fetch",
            vi.fn(
                (_input: unknown, init: RequestInit) =>
                    new Promise<Response>((_, reject) => {
                        init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
                    }),
            ),
        );
        const rejected = expect(transcribeMeetingAudio(audio, { ...settings, endpoint })).rejects.toMatchObject({
            name: "TimeoutError",
            message: expect.stringContaining("Retry or download"),
        });
        await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
        await rejected;
        expect(vi.getTimerCount()).toBe(0);
    });

    it("cancels an upload already in progress", async () => {
        const controller = new AbortController();
        vi.stubGlobal(
            "fetch",
            vi.fn(
                (_input: unknown, init: RequestInit) =>
                    new Promise<Response>((_, reject) => {
                        init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
                    }),
            ),
        );
        const rejected = expect(
            transcribeMeetingAudio(audio, { ...settings, endpoint, signal: controller.signal }),
        ).rejects.toMatchObject({ name: "AbortError" });
        controller.abort();
        await rejected;
    });

    it("does not expose an invalid upstream JSON body", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret-fixture-key")));
        await expect(transcribeMeetingAudio(audio, { ...settings, endpoint })).rejects.toThrow(
            "The transcription endpoint returned invalid JSON.",
        );
    });

    it("uploads multipart audio to a local endpoint without requiring an API key", async () => {
        const segments = await transcribeMeetingAudio(audio, { ...settings, endpoint });

        expect(segments).toEqual([
            expect.objectContaining({
                source: "microphone",
                speaker: "Allan",
                text: "Meeting transcript",
                start: 0,
                end: 0,
            }),
        ]);
        expect(requestAuthorization).toBeUndefined();
        expect(requestContentType).toMatch(/^multipart\/form-data; boundary=/);
        expect(requestBody).toContain('filename="microphone.webm"');
        expect(requestBody).toContain("synthetic audio fixture");
        expect(requestBody).toContain('name="model"\r\n\r\nwhisper-1');
        expect(requestBody).toContain('name="response_format"\r\n\r\nverbose_json');
        expect(requestBody).toContain('name="timestamp_granularities[]"\r\n\r\nsegment');
    });

    it("retains diarized speaker labels and timestamps without inventing participant names", async () => {
        responseBody = {
            segments: [
                { text: " Ship it. ", speaker: "speaker_0", start: 1.5, end: 2.75 },
                { text: "Confirmed.", speaker: "Maria", start: 3, end: 4 },
                { text: "Unknown voice.", start: 5, end: 6 },
            ],
        };
        const segments = await transcribeMeetingAudio(audio, {
            ...settings,
            endpoint,
            source: "system",
            model: "gpt-4o-transcribe-diarize",
            apiKey: "fixture-key",
        });

        expect(segments.map(({ speaker, start, end, text }) => ({ speaker, start, end, text }))).toEqual([
            { speaker: "speaker_0", start: 1.5, end: 2.75, text: "Ship it." },
            { speaker: "Maria", start: 3, end: 4, text: "Confirmed." },
            { speaker: "", start: 5, end: 6, text: "Unknown voice." },
        ]);
        expect(requestBody).toContain('name="response_format"\r\n\r\ndiarized_json');
        expect(requestBody).toContain('name="chunking_strategy"\r\n\r\nauto');
        expect(requestAuthorization).toBe("Bearer fixture-key");
    });

    it("groups labels within an upload and keeps identities separate across sources and later uploads", async () => {
        responseBody = {
            segments: [
                { text: "First turn.", speaker: "A", start: 0, end: 1 },
                { text: "Second turn.", speaker: "A", start: 2, end: 3 },
                { text: "Another person.", speaker: "B", start: 4, end: 5 },
            ],
        };
        const microphone = await transcribeMeetingAudio(audio, { ...settings, endpoint });
        const system = await transcribeMeetingAudio(audio, { ...settings, endpoint, source: "system" });
        const later = await transcribeMeetingAudio(audio, { ...settings, endpoint });
        expect(microphone[0]?.speakerId).toBeTruthy();
        expect(microphone[0]?.speakerId).toBe(microphone[1]?.speakerId);
        expect(microphone[0]?.speakerId).not.toBe(microphone[2]?.speakerId);
        expect(microphone[0]?.speakerId).not.toBe(system[0]?.speakerId);
        expect(microphone[0]?.speakerId).not.toBe(later[0]?.speakerId);
    });

    it.each(["tiny", "base", "small", "medium", "large-v3", "turbo", "base.en"])(
        "requests segment timestamps for the selected local Whisper model %s",
        async (model) => {
            responseBody = { segments: [{ text: "Local transcript", start: 2, end: 4 }] };
            const segments = await transcribeMeetingAudio(audio, { ...settings, endpoint, model });
            expect(requestBody).toContain(`name="model"\r\n\r\n${model}\r\n`);
            expect(requestBody).toContain('name="response_format"\r\n\r\nverbose_json');
            expect(requestBody).toContain('name="timestamp_granularities[]"\r\n\r\nsegment');
            expect(segments[0]).toMatchObject({ text: "Local transcript", start: 2, end: 4 });
        },
    );

    it("passes a custom server model ID unchanged", async () => {
        await transcribeMeetingAudio(audio, { ...settings, endpoint, model: "Systran/faster-whisper-small" });
        expect(requestBody).toContain('name="model"\r\n\r\nSystran/faster-whisper-small');
        expect(requestBody).toContain('name="response_format"\r\n\r\njson');
    });

    it("keeps plain system transcripts unattributed and ignores empty speech", async () => {
        expect(await transcribeMeetingAudio(audio, { ...settings, endpoint, source: "system" })).toEqual([
            expect.objectContaining({ speaker: "", source: "system" }),
        ]);
        responseBody = { text: "   " };
        expect(await transcribeMeetingAudio(audio, { ...settings, endpoint })).toEqual([]);
    });

    it.each([
        { segments: [{ text: "Invalid", start: 3, end: 2 }] },
        { segments: [{ text: "Invalid", start: -1, end: 2 }] },
        { unexpected: "Missing text" },
    ])("rejects malformed or invalid transcript responses", async (fixture) => {
        responseBody = fixture;
        await expect(transcribeMeetingAudio(audio, { ...settings, endpoint })).rejects.toThrow("invalid transcript");
    });

    it("reports failed transcription without including upstream secrets", async () => {
        responseStatus = 401;
        responseBody = { error: { message: "secret-fixture-key" } };
        await expect(transcribeMeetingAudio(audio, { ...settings, endpoint })).rejects.toThrow(
            "Transcription failed (401)",
        );
    });

    it("rejects empty and oversized uploads before contacting an endpoint", async () => {
        await expect(transcribeMeetingAudio(new Blob(), { ...settings, endpoint })).rejects.toThrow("no audio");
        await expect(
            transcribeMeetingAudio(new Blob([new Uint8Array(25_000_001)]), {
                ...settings,
                endpoint,
            }),
        ).rejects.toThrow("25 MB");
    });

    it("requires an API key for OpenAI and rejects invalid endpoint protocols", async () => {
        await expect(
            transcribeMeetingAudio(audio, {
                ...settings,
                endpoint: "https://api.openai.com/v1/audio/transcriptions",
            }),
        ).rejects.toThrow("OpenAI API key is required");
        await expect(
            transcribeMeetingAudio(audio, { ...settings, endpoint: "file:///tmp/transcript" }),
        ).rejects.toThrow();
    });

    it("honors cancelled transcription requests", async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(
            transcribeMeetingAudio(audio, {
                ...settings,
                endpoint,
                signal: controller.signal,
            }),
        ).rejects.toMatchObject({ name: "AbortError" });
    });
});

class RecordingTrack extends EventTarget {
    readyState = "live";
    constructor(readonly kind: "audio" | "video") {
        super();
    }
    stop(): void {
        this.readyState = "ended";
    }
    end(): void {
        this.readyState = "ended";
        this.dispatchEvent(new Event("ended"));
    }
}

class RecordingStream {
    constructor(readonly tracks: RecordingTrack[]) {}
    getTracks(): RecordingTrack[] {
        return this.tracks;
    }
    getAudioTracks(): RecordingTrack[] {
        return this.tracks.filter(({ kind }) => kind === "audio");
    }
}

class RecordingMediaRecorder extends EventTarget {
    static instances: RecordingMediaRecorder[] = [];
    static failSource: RecordingStream | undefined;
    static isTypeSupported(): boolean {
        return true;
    }
    state = "inactive";
    readonly mimeType = "audio/webm;codecs=opus";
    constructor(readonly stream: RecordingStream) {
        super();
        RecordingMediaRecorder.instances.push(this);
    }
    start(): void {
        if (RecordingMediaRecorder.failSource?.getAudioTracks()[0] === this.stream.getAudioTracks()[0]) {
            throw new Error("Recorder cannot start");
        }
        this.state = "recording";
    }
    stop(): void {
        this.state = "inactive";
        queueMicrotask(() => {
            const event = new Event("dataavailable");
            Object.defineProperty(event, "data", { value: new Blob(["recorded audio"], { type: this.mimeType }) });
            this.dispatchEvent(event);
            this.dispatchEvent(new Event("stop"));
        });
    }
}

function installRecordingDevices(systemAudio = true): { microphone: RecordingStream; system: RecordingStream } {
    RecordingMediaRecorder.instances = [];
    RecordingMediaRecorder.failSource = undefined;
    const microphone = new RecordingStream([new RecordingTrack("audio")]);
    const system = new RecordingStream([
        ...(systemAudio ? [new RecordingTrack("audio")] : []),
        new RecordingTrack("video"),
    ]);
    vi.stubGlobal("MediaRecorder", RecordingMediaRecorder);
    vi.stubGlobal("MediaStream", RecordingStream);
    vi.stubGlobal("navigator", {
        mediaDevices: {
            getUserMedia: async (): Promise<RecordingStream> => microphone,
            getDisplayMedia: async (): Promise<RecordingStream> => system,
        },
    });
    return { microphone, system };
}

describe("meeting audio capture", () => {
    it("releases shared audio immediately when cancelled while microphone permission is pending", async () => {
        const { microphone, system } = installRecordingDevices();
        let grant: (stream: RecordingStream) => void = () => {};
        const pending = new Promise<RecordingStream>((resolve) => {
            grant = resolve;
        });
        vi.stubGlobal("navigator", {
            mediaDevices: {
                getDisplayMedia: async () => system,
                getUserMedia: () => pending,
            },
        });
        const controller = new AbortController();
        const starting = startMeetingRecording({ includeSystemAudio: true, signal: controller.signal });
        const rejected = expect(starting).rejects.toMatchObject({ name: "AbortError" });
        await vi.waitFor(() => expect(system.getTracks()[0]?.readyState).toBe("live"));
        await new Promise((resolve) => setTimeout(resolve, 0));
        controller.abort();
        expect(system.getTracks().every(({ readyState }) => readyState === "ended")).toBe(true);
        await rejected;
        grant(microphone);
        await Promise.resolve();
        expect(microphone.getTracks().every(({ readyState }) => readyState === "ended")).toBe(true);
    });
    it("records microphone and system separately without recording screen video", async () => {
        const { microphone, system } = installRecordingDevices();
        const recording = await startMeetingRecording({ includeSystemAudio: true });
        const audio = await recording.stop();

        expect(audio.map(({ source, audio }) => ({ source, size: audio.size, type: audio.type }))).toEqual([
            { source: "microphone", size: 14, type: "audio/webm;codecs=opus" },
            { source: "system", size: 14, type: "audio/webm;codecs=opus" },
        ]);
        expect(
            RecordingMediaRecorder.instances.every(({ stream }) =>
                stream.getTracks().every(({ kind }) => kind === "audio"),
            ),
        ).toBe(true);
        expect(
            [...microphone.getTracks(), ...system.getTracks()].every(({ readyState }) => readyState === "ended"),
        ).toBe(true);
        expect(await recording.stop()).toBe(audio);
    });

    it("supports microphone-only capture", async () => {
        const { microphone, system } = installRecordingDevices();
        const recording = await startMeetingRecording({ includeSystemAudio: false });
        expect((await recording.stop()).map(({ source }) => source)).toEqual(["microphone"]);
        expect(microphone.getTracks()[0]?.readyState).toBe("ended");
        expect(system.getTracks()[0]?.readyState).toBe("live");
    });

    it("rejects absent system audio and releases the shared screen", async () => {
        const { microphone, system } = installRecordingDevices(false);
        await expect(startMeetingRecording({ includeSystemAudio: true })).rejects.toThrow("No system audio was shared");
        expect(system.getTracks().every(({ readyState }) => readyState === "ended")).toBe(true);
        expect(microphone.getTracks()[0]?.readyState).toBe("live");
    });

    it("releases all capture resources when a recorder fails to start", async () => {
        const { microphone, system } = installRecordingDevices();
        RecordingMediaRecorder.failSource = system;
        await expect(startMeetingRecording({ includeSystemAudio: true })).rejects.toThrow("Recorder cannot start");
        expect(
            [...microphone.getTracks(), ...system.getTracks()].every(({ readyState }) => readyState === "ended"),
        ).toBe(true);
    });

    it("finalizes both recordings when sharing ends and retains the audio", async () => {
        const { system } = installRecordingDevices();
        let automaticallyEnded = false;
        const recording = await startMeetingRecording({
            includeSystemAudio: true,
            onEnded: () => {
                automaticallyEnded = true;
            },
        });
        system
            .getTracks()
            .find(({ kind }) => kind === "video")
            ?.end();
        expect(automaticallyEnded).toBe(true);
        expect((await recording.stop()).every(({ audio }) => audio.size > 0)).toBe(true);
    });

    it("discards capture and releases tracks when disposed", async () => {
        const { microphone } = installRecordingDevices();
        const recording = await startMeetingRecording({ includeSystemAudio: false });
        recording.dispose();
        expect(microphone.getTracks()[0]?.readyState).toBe("ended");
        await expect(recording.stop()).rejects.toThrow("discarded");
    });

    it("stops recording after one hour and retains audio for transcription", async () => {
        vi.useFakeTimers();
        installRecordingDevices();
        let automaticallyEnded = false;
        const recording = await startMeetingRecording({
            includeSystemAudio: false,
            onEnded: () => {
                automaticallyEnded = true;
            },
        });
        await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
        expect(automaticallyEnded).toBe(true);
        expect((await recording.stop())[0]?.audio.size).toBeGreaterThan(0);
    });
});
