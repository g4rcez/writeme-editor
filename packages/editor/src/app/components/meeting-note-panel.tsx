import { Button, Checkbox, Input, Select, Textarea } from "@g4rcez/components";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/csr/Microphone";
import { useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import type { Note } from "@/store/note";
import { isSameMeetingEndpointOrigin, startMeetingRecording, transcribeMeetingAudio } from "@/lib/meeting-audio";
import {
    importMeetingTranscript,
    meetingSpeakerKey,
    parseMeetingTranscript,
    serializeMeetingTranscript,
    type MeetingPlatform,
    type MeetingTranscript,
} from "@/lib/meeting-transcript";
import { useGlobalStore, repositories } from "@/store/global.store";
import { SettingsService, type AppSettings } from "@/store/settings";
import { MeetingModelSelect } from "./meeting-model-select";
import { MeetingSetupWizard } from "./meeting-setup-wizard";

type Recording = Awaited<ReturnType<typeof startMeetingRecording>>;
type AudioRecording = Awaited<ReturnType<Recording["stop"]>>;
type Phase = "idle" | "starting" | "recording" | "stopping" | "transcribing" | "saving";

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : "The meeting operation failed.";
}

function timestamp(seconds: number): string {
    const rounded = Math.floor(seconds);
    return `${Math.floor(rounded / 60)
        .toString()
        .padStart(2, "0")}:${(rounded % 60).toString().padStart(2, "0")}`;
}

export function MeetingNotePanel({ note }: { note: Note }): React.JSX.Element {
    const [, dispatch] = useGlobalStore();
    const [settings, setSettings] = useState(() => SettingsService.load().meetingTranscription);
    const [onboardingStatus, setOnboardingStatus] = useState(() => SettingsService.load().meetingOnboardingStatus);
    const [setupOpen, setSetupOpen] = useState(() => SettingsService.load().meetingOnboardingStatus === "pending");
    const [apiKey, setApiKey] = useState("");
    const [useOpenAIKey, setUseOpenAIKey] = useState(false);
    const [phase, setPhase] = useState<Phase>("idle");
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState("");
    const [audio, setAudio] = useState<AudioRecording>([]);
    const [unsavedTranscript, setUnsavedTranscript] = useState<MeetingTranscript | null>(null);
    const [importText, setImportText] = useState("");
    const [platform, setPlatform] = useState<MeetingPlatform>("other");
    const recorder = useRef<Recording | null>(null);
    const controller = useRef<AbortController | null>(null);
    const mounted = useRef(true);
    const noteRef = useRef(note);
    const busy = phase !== "idle";
    const includeSystemAudio = settings.includeSystemAudio;
    const blocker = useBlocker(busy || audio.length > 0 || unsavedTranscript !== null);
    let transcript: MeetingTranscript = { segments: [] };
    let parseError: string | null = null;
    try {
        transcript = parseMeetingTranscript(note.metadata.meetingTranscript);
    } catch (reason) {
        parseError = messageOf(reason);
    }

    async function persist(next: MeetingTranscript): Promise<void> {
        setUnsavedTranscript(next);
        setPhase("saving");
        await dispatch.updateNoteMetadata(note.id, {
            ...noteRef.current.metadata,
            meetingTranscript: serializeMeetingTranscript(next),
        });
        if (!mounted.current) return;
        setUnsavedTranscript(null);
        setAudio([]);
        setNotice("Transcript saved");
    }

    async function transcribe(recordings: AudioRecording): Promise<void> {
        if (parseError) throw new Error(parseError);
        setPhase("transcribing");
        const pending = new AbortController();
        controller.current = pending;
        const key = await resolveKey();
        const batches = await Promise.all(
            recordings.map((recording) =>
                transcribeMeetingAudio(recording.audio, {
                    ...settings,
                    apiKey: key || undefined,
                    source: recording.source,
                    signal: pending.signal,
                }),
            ),
        ).catch((reason: unknown) => {
            pending.abort();
            throw reason;
        });
        pending.signal.throwIfAborted();
        if (!mounted.current) return;
        const current = parseMeetingTranscript(noteRef.current.metadata.meetingTranscript);
        const offset = current.segments.length
            ? current.segments.reduce((end, segment) => Math.max(end, segment.end), 0) + 1
            : 0;
        const segments = batches
            .flat()
            .map((segment) => ({ ...segment, start: segment.start + offset, end: segment.end + offset }));
        if (segments.length === 0)
            throw new Error("No speech was detected. You can download the recording or try another model.");
        await persist({ segments: [...current.segments, ...segments].sort((a, b) => a.start - b.start) });
    }

    async function resolveKey(): Promise<string> {
        let key = apiKey.trim();
        if (useOpenAIKey) {
            if (new URL(settings.endpoint).origin !== "https://api.openai.com") {
                throw new Error("The saved OpenAI key can only be used with https://api.openai.com.");
            }
            const credentials = await repositories.ai.loadCredentials("openai");
            if (!credentials?.apiKey)
                throw new Error(
                    "No OpenAI API key is saved. Enter a transcription API key below; ChatGPT sign-in cannot transcribe audio.",
                );
            key = credentials.apiKey;
        }
        if (new URL(settings.endpoint).origin === "https://api.openai.com" && !key)
            throw new Error("An OpenAI API key is required for this transcription endpoint.");
        return key;
    }

    async function stop(): Promise<void> {
        const active = recorder.current;
        if (!active) return;
        recorder.current = null;
        setError(null);
        setPhase("stopping");
        try {
            const recordings = await active.stop();
            if (!mounted.current) return;
            setAudio(recordings);
            await transcribe(recordings);
        } catch (reason) {
            if (mounted.current) setError(messageOf(reason));
        } finally {
            if (mounted.current) setPhase("idle");
        }
    }

    async function start(): Promise<void> {
        setPhase("starting");
        setError(null);
        setNotice("");
        controller.current = new AbortController();
        try {
            new URL(settings.endpoint);
            if (!settings.model.trim() || !settings.localSpeaker.trim())
                throw new Error("Enter a model and your name.");
            await SettingsService.save({ meetingTranscription: settings });
            await resolveKey();
            const active = await startMeetingRecording({
                includeSystemAudio,
                signal: controller.current.signal,
                onEnded: () => {
                    void stop();
                },
            });
            if (!mounted.current) {
                active.dispose();
                return;
            }
            recorder.current = active;
            setPhase("recording");
        } catch (reason) {
            if (mounted.current) {
                setError(messageOf(reason));
                setPhase("idle");
            }
        }
    }

    async function retry(): Promise<void> {
        setError(null);
        try {
            if (unsavedTranscript) await persist(unsavedTranscript);
            else await transcribe(audio);
        } catch (reason) {
            if (mounted.current) setError(messageOf(reason));
        } finally {
            if (mounted.current) setPhase("idle");
        }
    }

    async function saveSettings(): Promise<void> {
        setError(null);
        setNotice("");
        setPhase("saving");
        try {
            const next = { ...settings, model: settings.model.trim(), localSpeaker: settings.localSpeaker.trim() };
            if (!next.model || !next.localSpeaker) throw new Error("Enter a model and your name.");
            await SettingsService.save({ meetingTranscription: next });
            if (mounted.current) {
                setSettings(next);
                setNotice("Transcription settings saved");
            }
        } catch (reason) {
            if (mounted.current) setError(messageOf(reason));
        } finally {
            if (mounted.current) setPhase("idle");
        }
    }

    async function dismissSetup(): Promise<void> {
        setSetupOpen(false);
        if (onboardingStatus !== "pending") return;
        try {
            await SettingsService.save({ meetingOnboardingStatus: "skipped" });
            if (mounted.current) setOnboardingStatus("skipped");
        } catch (reason) {
            if (mounted.current) setError(messageOf(reason));
        }
    }

    async function finishSetup(
        next: AppSettings["meetingTranscription"],
        key: string,
        savedKey: boolean,
    ): Promise<void> {
        await SettingsService.save({ meetingTranscription: next });
        await SettingsService.save({ meetingOnboardingStatus: "completed" });
        if (!mounted.current) return;
        setSettings(next);
        setApiKey(key);
        setUseOpenAIKey(savedKey);
        setOnboardingStatus("completed");
        setSetupOpen(false);
        setError(null);
        setNotice("Meeting setup saved");
    }

    async function importTranscript(): Promise<void> {
        setError(null);
        try {
            if (parseError) throw new Error(parseError);
            const imported = importMeetingTranscript(importText, platform);
            if (!imported.segments.length) throw new Error("No transcript entries were found.");
            const current = parseMeetingTranscript(noteRef.current.metadata.meetingTranscript);
            await persist({ segments: [...current.segments, ...imported.segments].sort((a, b) => a.start - b.start) });
            setImportText("");
        } catch (reason) {
            setError(messageOf(reason));
        } finally {
            if (mounted.current) setPhase("idle");
        }
    }

    async function renameSpeaker(speakerKey: string, oldName: string, newName: string): Promise<void> {
        const trimmed = newName.trim();
        if (trimmed === oldName) return;
        setError(null);
        try {
            const current = parseMeetingTranscript(noteRef.current.metadata.meetingTranscript);
            await persist({
                segments: current.segments.map((segment) =>
                    meetingSpeakerKey(segment) === speakerKey ? { ...segment, speaker: trimmed } : segment,
                ),
            });
        } catch (reason) {
            setError(messageOf(reason));
        } finally {
            if (mounted.current) setPhase("idle");
        }
    }

    function downloadAudio(): void {
        for (const recording of audio) {
            const url = URL.createObjectURL(recording.audio);
            const link = document.createElement("a");
            link.href = url;
            link.download = `meeting-${recording.source}.${recording.audio.type.includes("mp4") ? "m4a" : "webm"}`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
    }

    useEffect(() => {
        noteRef.current = note;
    }, [note]);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            controller.current?.abort();
            recorder.current?.dispose();
        };
    }, []);

    useEffect(() => {
        if (!busy && audio.length === 0 && !unsavedTranscript) return;
        const beforeUnload = (event: BeforeUnloadEvent): void => {
            event.preventDefault();
        };
        window.addEventListener("beforeunload", beforeUnload);
        return () => window.removeEventListener("beforeunload", beforeUnload);
    }, [busy, audio.length, unsavedTranscript]);

    const speakers = [...new Map(transcript.segments.map((segment) => [meetingSpeakerKey(segment), segment])).values()];
    return (
        <section
            aria-label="Meeting transcription"
            className="writeme-editor-column my-4 rounded-xl border border-border bg-card-background p-4 text-foreground sm:p-6"
        >
            {setupOpen ? (
                <MeetingSetupWizard
                    configuration={settings}
                    apiKey={apiKey}
                    useOpenAIKey={useOpenAIKey}
                    onClose={() => void dismissSetup()}
                    onSave={finishSetup}
                />
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                        <MicrophoneIcon aria-hidden="true" />
                        Meeting note
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Capture the conversation and write your own notes below.
                    </p>
                </div>
                {phase === "recording" ? (
                    <Button onClick={() => void stop()}>Stop and transcribe</Button>
                ) : (
                    <Button
                        disabled={busy || audio.length > 0 || unsavedTranscript !== null || parseError !== null}
                        onClick={() => void start()}
                    >
                        Start recording
                    </Button>
                )}
            </div>
            <output aria-live="polite" className="my-3 block text-sm text-muted-foreground">
                {phase === "recording"
                    ? `Recording ${includeSystemAudio ? "microphone and selected audio" : "microphone"}. Keep this note open until you stop.`
                    : phase === "idle"
                      ? notice || "Ready to record"
                      : `${phase.charAt(0).toUpperCase()}${phase.slice(1)}...`}
            </output>
            {phase === "transcribing" || phase === "starting" ? (
                <Button
                    theme="muted"
                    onClick={() =>
                        controller.current?.abort(
                            new DOMException(
                                "Cancelled. Recorded audio remains available for retry or download.",
                                "AbortError",
                            ),
                        )
                    }
                >
                    {phase === "starting" ? "Cancel recording setup" : "Cancel transcription"}
                </Button>
            ) : null}
            <div className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <p className="text-sm text-muted-foreground">
                    {onboardingStatus === "completed"
                        ? "Need to change providers or check your audio?"
                        : "Get help choosing a provider, configuring a model and testing your audio."}
                </p>
                <Button theme="muted" disabled={busy} onClick={() => setSetupOpen(true)}>
                    {onboardingStatus === "completed" ? "Run setup again" : "Set up meeting notes"}
                </Button>
            </div>
            {error || parseError ? (
                <p role="alert" className="my-3 rounded border border-danger/40 p-3 text-sm">
                    {error || parseError}
                </p>
            ) : null}
            {blocker.state === "blocked" ? (
                <div role="alert" className="my-3 space-y-3 rounded border border-border p-3">
                    <p>Leaving will discard the active recording or unsaved transcript.</p>
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={() => blocker.reset()}>Stay on this note</Button>
                        <Button theme="muted" onClick={() => blocker.proceed()}>
                            Leave and discard
                        </Button>
                    </div>
                </div>
            ) : null}
            {audio.length || unsavedTranscript ? (
                <div className="my-3 flex flex-wrap items-center gap-2">
                    <p className="w-full text-sm text-muted-foreground">
                        {unsavedTranscript
                            ? "Transcript has not been saved."
                            : "Audio is kept here for retry. Download it before leaving this note."}
                    </p>
                    <Button disabled={busy} onClick={() => void retry()}>
                        {unsavedTranscript ? "Retry saving" : "Retry transcription"}
                    </Button>
                    {audio.length ? (
                        <Button theme="muted" onClick={downloadAudio}>
                            Download audio
                        </Button>
                    ) : null}
                </div>
            ) : null}
            <details className="my-4 rounded border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">Recording and transcription settings</summary>
                <fieldset disabled={busy} className="mt-4 flex min-w-0 flex-col gap-4">
                    <Input
                        title="Your speaker name"
                        value={settings.localSpeaker}
                        onChange={(event) => setSettings({ ...settings, localSpeaker: event.target.value })}
                    />
                    <Checkbox
                        checked={includeSystemAudio}
                        onChange={(event) => setSettings({ ...settings, includeSystemAudio: event.target.checked })}
                    >
                        Include meeting audio (screen or tab share)
                    </Checkbox>
                    <Input
                        title="Transcription endpoint"
                        type="url"
                        value={settings.endpoint}
                        onChange={(event) => {
                            const endpoint = event.target.value;
                            if (!isSameMeetingEndpointOrigin(settings.endpoint, endpoint)) {
                                setApiKey("");
                                setUseOpenAIKey(false);
                            }
                            setSettings({ ...settings, endpoint });
                        }}
                    />
                    <MeetingModelSelect
                        model={settings.model}
                        onChange={(model) => setSettings({ ...settings, model })}
                    />
                    <p className="text-xs leading-5 text-muted-foreground">
                        Tiny and base use less memory; larger models generally improve accuracy. Choose multilingual for
                        Portuguese or mixed languages. The endpoint must support the selected model. For whisper.cpp,
                        configure the server's loaded model separately; this selection does not download or load model
                        files.
                    </p>
                    <Input
                        title="Transcription API key (optional)"
                        type="password"
                        autoComplete="off"
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                    />
                    <Checkbox checked={useOpenAIKey} onChange={(event) => setUseOpenAIKey(event.target.checked)}>
                        Use saved OpenAI API key
                    </Checkbox>
                    <Button theme="muted" onClick={() => void saveSettings()}>
                        Save transcription settings
                    </Button>
                    <p className="text-xs leading-5 text-muted-foreground">
                        Use a running Whisper-compatible server, or https://api.openai.com/v1/audio/transcriptions with
                        an API key. Custom servers must allow this app through CORS. For speaker separation, choose a
                        diarization-capable model such as gpt-4o-transcribe-diarize. Audio is sent to the endpoint when
                        you stop. Keys entered here last only while this note is open. Recordings stop automatically
                        after one hour or 24 MB per source.
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                        Enable audio in the share picker. System audio availability depends on the browser and OS. Names
                        come from imported captions or your corrections; audio does not identify participants by name.
                    </p>
                </fieldset>
            </details>
            <details className="my-4 rounded border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">Import meeting transcript</summary>
                <fieldset
                    disabled={busy || audio.length > 0 || unsavedTranscript !== null || parseError !== null}
                    className="mt-4 flex min-w-0 flex-col gap-4"
                >
                    <Select
                        title="Meeting platform"
                        value={platform}
                        onChange={(event) => {
                            const value = event.target.value;
                            if (value === "google-meet" || value === "zoom" || value === "teams" || value === "other")
                                setPlatform(value);
                        }}
                        options={[
                            { label: "Google Meet", value: "google-meet" },
                            { label: "Zoom", value: "zoom" },
                            { label: "Microsoft Teams", value: "teams" },
                            { label: "Other", value: "other" },
                        ]}
                    />
                    <label className="text-sm">
                        Transcript file (.vtt, .srt, .txt)
                        <input
                            aria-label="Transcript file"
                            type="file"
                            accept=".vtt,.srt,.txt"
                            className="mt-2 block w-full text-sm"
                            onChange={async (event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (!file) return;
                                try {
                                    if (file.size > 5_000_000)
                                        throw new Error("Transcript files must be smaller than 5 MB.");
                                    const text = await file.text();
                                    if (mounted.current) setImportText(text);
                                } catch (reason) {
                                    if (mounted.current) setError(messageOf(reason));
                                }
                            }}
                        />
                    </label>
                    <Textarea
                        title="Transcript text"
                        value={importText}
                        rows={5}
                        onChange={(event) => setImportText(event.target.value)}
                        placeholder="Paste captions or a transcript with speaker names..."
                    />
                    <Button disabled={!importText.trim()} onClick={() => void importTranscript()}>
                        Import transcript
                    </Button>
                </fieldset>
            </details>
            <h3 className="mb-3 text-sm font-semibold">Transcript</h3>
            {speakers.length ? (
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    {speakers.map((segment, index) => (
                        <Input
                            key={meetingSpeakerKey(segment)}
                            title={`Speaker name: ${segment.speaker || "Unknown speaker"}${speakers.some((other) => other !== segment && other.speaker === segment.speaker) ? ` (${segment.source}, ${index + 1})` : ""}`}
                            defaultValue={segment.speaker}
                            placeholder="Unknown speaker"
                            disabled={busy || audio.length > 0 || unsavedTranscript !== null}
                            onBlur={(event) =>
                                void renameSpeaker(meetingSpeakerKey(segment), segment.speaker, event.target.value)
                            }
                        />
                    ))}
                </div>
            ) : null}
            {transcript.segments.length ? (
                <ol aria-label="Transcript entries" className="max-h-80 space-y-3 overflow-y-auto">
                    {transcript.segments.map((segment) => (
                        <li key={segment.id} className="rounded border border-border bg-background p-3">
                            <div className="mb-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <time>{timestamp(segment.start)}</time>
                                <span className="font-medium text-foreground">
                                    {segment.speaker || "Unknown speaker"}
                                </span>
                                <span>{segment.source}</span>
                            </div>
                            <p className="break-words whitespace-pre-wrap text-sm leading-6">{segment.text}</p>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="text-sm text-muted-foreground">
                    No transcript yet. Record a meeting or import its captions.
                </p>
            )}
        </section>
    );
}
