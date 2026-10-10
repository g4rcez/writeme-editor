import { Button, Checkbox, Input, Modal, Radiobox } from "@g4rcez/components";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import type { AppSettings } from "@/store/settings";
import { isSameMeetingEndpointOrigin, startMeetingRecording, transcribeMeetingAudio } from "@/lib/meeting-audio";
import {
    LOCAL_WHISPER_ENDPOINT,
    LOCAL_WHISPER_MODEL,
    OPENAI_TRANSCRIPTION_MODELS,
    TRANSCRIPTION_MODELS,
    WHISPER_MODELS,
} from "@/lib/meeting-models";
import { repositories } from "@/store/global.store";
import { MeetingModelSelect } from "./meeting-model-select";

type Configuration = AppSettings["meetingTranscription"];
type Provider = "local" | "openai" | "custom";
type Phase = "idle" | "validating" | "starting" | "recording" | "transcribing" | "saving";
type Recording = Awaited<ReturnType<typeof startMeetingRecording>>;

const STEPS = ["Choose a provider", "Configure transcription", "Audio and test", "Review and finish"];
const OPENAI_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

function providerOf(endpoint: string): Provider {
    try {
        const url = new URL(endpoint);
        if (url.origin === "https://api.openai.com") return "openai";
        if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return "local";
    } catch {
        return "custom";
    }
    return "custom";
}

function validate(configuration: Configuration): Configuration {
    let endpoint: URL;
    try {
        endpoint = new URL(configuration.endpoint.trim());
    } catch {
        throw new Error("Enter a valid transcription endpoint.");
    }
    if (!["https:", "http:"].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
        throw new Error("Use an HTTP or HTTPS endpoint without credentials in the URL.");
    }
    const model = configuration.model.trim();
    const localSpeaker = configuration.localSpeaker.trim();
    if (!model || !localSpeaker) throw new Error("Enter a model and your speaker name.");
    if (model.length > 200 || localSpeaker.length > 200)
        throw new Error("Model IDs and names must be 200 characters or fewer.");
    return { ...configuration, endpoint: endpoint.toString(), model, localSpeaker };
}

function errorMessage(reason: unknown): string {
    return reason instanceof Error ? reason.message : "Setup failed. Please try again.";
}

export function MeetingSetupWizard({
    configuration,
    apiKey,
    useOpenAIKey,
    onClose,
    onSave,
}: {
    configuration: Configuration;
    apiKey: string;
    useOpenAIKey: boolean;
    onClose: () => void;
    onSave: (configuration: Configuration, apiKey: string, useOpenAIKey: boolean) => Promise<void>;
}): React.JSX.Element {
    const [draft, setDraft] = useState(configuration);
    const [provider, setProvider] = useState<Provider>(() => providerOf(configuration.endpoint));
    const [key, setKey] = useState(apiKey);
    const [savedKey, setSavedKey] = useState(useOpenAIKey);
    const [step, setStep] = useState(0);
    const [phase, setPhase] = useState<Phase>("idle");
    const [error, setError] = useState<string | null>(null);
    const [sample, setSample] = useState<string | null>(null);
    const recording = useRef<Recording | null>(null);
    const controller = useRef<AbortController | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const mounted = useRef(true);
    const heading = useRef<HTMLHeadingElement>(null);
    const busy = phase !== "idle";
    const models =
        provider === "openai"
            ? OPENAI_TRANSCRIPTION_MODELS
            : provider === "custom"
              ? TRANSCRIPTION_MODELS
              : [...WHISPER_MODELS, { label: "Whisper server default (whisper-1)", value: "whisper-1" }];

    function update(next: Partial<Configuration>): void {
        setDraft((current) => ({ ...current, ...next }));
        setSample(null);
        setError(null);
    }

    function chooseProvider(next: Provider): void {
        if (next === provider) return;
        setProvider(next);
        setKey("");
        setSavedKey(false);
        update(
            next === "openai"
                ? { endpoint: OPENAI_ENDPOINT, model: "whisper-1" }
                : next === "local"
                  ? { endpoint: LOCAL_WHISPER_ENDPOINT, model: LOCAL_WHISPER_MODEL }
                  : { endpoint: "", model: "" },
        );
    }

    async function resolveKey(): Promise<string> {
        const origin = new URL(draft.endpoint.trim()).origin;
        if (savedKey) {
            if (origin !== "https://api.openai.com")
                throw new Error("The saved OpenAI key requires an OpenAI endpoint.");
            const credentials = await repositories.ai.loadCredentials("openai");
            if (!credentials?.apiKey)
                throw new Error("No saved OpenAI API key was found. Enter a key or save one in AI settings.");
            return credentials.apiKey;
        }
        if (origin === "https://api.openai.com" && !key.trim())
            throw new Error("Enter an OpenAI API key or use a saved API key.");
        return key.trim();
    }

    async function next(): Promise<void> {
        setError(null);
        setPhase("validating");
        try {
            if (step === 1) {
                const valid = validate(draft);
                if (provider === "openai" && new URL(valid.endpoint).origin !== "https://api.openai.com") {
                    throw new Error("Choose Custom server to use a different provider's endpoint.");
                }
                await resolveKey();
                if (!mounted.current) return;
                setDraft(valid);
            }
            setStep((current) => Math.min(current + 1, STEPS.length - 1));
        } catch (reason) {
            if (mounted.current) setError(errorMessage(reason));
        } finally {
            if (mounted.current) setPhase("idle");
        }
    }

    async function stopTest(): Promise<void> {
        clearTimeout(timer.current);
        const active = recording.current;
        if (!active) return;
        recording.current = null;
        setPhase("transcribing");
        try {
            const audio = await active.stop();
            const segments = await transcribeMeetingAudio(audio[0]?.audio ?? new Blob(), {
                ...validate(draft),
                apiKey: (await resolveKey()) || undefined,
                source: "microphone",
                signal: controller.current?.signal,
            });
            if (!segments.length) throw new Error("No speech was detected. Speak during the sample and try again.");
            if (mounted.current) setSample(segments.map(({ text }) => text).join(" "));
        } catch (reason) {
            if (mounted.current) setError(errorMessage(reason));
        } finally {
            if (mounted.current) setPhase("idle");
        }
    }

    async function testAudio(): Promise<void> {
        setError(null);
        setSample(null);
        setPhase("starting");
        controller.current = new AbortController();
        try {
            const active = await startMeetingRecording({
                includeSystemAudio: false,
                signal: controller.current.signal,
            });
            if (!mounted.current) {
                active.dispose();
                return;
            }
            recording.current = active;
            setPhase("recording");
            timer.current = setTimeout(() => void stopTest(), 5000);
        } catch (reason) {
            if (mounted.current) {
                setError(errorMessage(reason));
                setPhase("idle");
            }
        }
    }

    async function finish(): Promise<void> {
        setError(null);
        setPhase("saving");
        try {
            const valid = validate(draft);
            await resolveKey();
            if (mounted.current) await onSave(valid, key.trim(), savedKey);
        } catch (reason) {
            if (mounted.current) {
                setError(errorMessage(reason));
                setPhase("idle");
            }
        }
    }

    useEffect(() => {
        heading.current?.focus();
    }, [step]);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            clearTimeout(timer.current);
            controller.current?.abort();
            recording.current?.dispose();
        };
    }, []);

    const actions = (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
            <Button className="min-h-11" theme="ghost-muted" disabled={phase === "saving"} onClick={onClose}>
                Skip for now
            </Button>
            <div className="flex flex-wrap gap-2">
                {step > 0 ? (
                    <Button
                        className="min-h-11"
                        theme="muted"
                        disabled={busy}
                        onClick={() => {
                            setError(null);
                            setStep((current) => current - 1);
                        }}
                    >
                        Back
                    </Button>
                ) : null}
                {step < STEPS.length - 1 ? (
                    <Button className="min-h-11" disabled={busy} onClick={() => void next()}>
                        Continue
                    </Button>
                ) : (
                    <Button className="min-h-11" loading={phase === "saving"} onClick={() => void finish()}>
                        Save and finish
                    </Button>
                )}
            </div>
        </div>
    );

    return (
        <Modal
            open
            title="Set up meeting notes"
            ariaDescription="Choose how to transcribe meetings, test your microphone, then save your configuration."
            className="max-w-xl"
            bodyClassName="min-w-0"
            footer={actions}
            closable={phase !== "saving"}
            onChange={(open) => {
                if (!open && phase !== "saving") onClose();
            }}
        >
            <div className="flex min-w-0 flex-col gap-5 py-2 text-foreground">
                <div>
                    <p className="mb-2 text-xs text-muted-foreground">
                        Step {step + 1} of {STEPS.length}
                    </p>
                    <progress
                        aria-label="Setup progress"
                        value={step + 1}
                        max={STEPS.length}
                        aria-valuetext={STEPS[step]}
                        className="sr-only"
                    />
                    <div aria-hidden="true" className="grid grid-cols-4 gap-1">
                        {STEPS.map((title, index) => (
                            <span
                                key={title}
                                className={clsx("h-1 rounded-full", index <= step ? "bg-primary" : "bg-border")}
                            />
                        ))}
                    </div>
                    <h3 ref={heading} tabIndex={-1} className="mt-4 text-lg font-semibold outline-none">
                        {STEPS[step]}
                    </h3>
                </div>
                {step === 0 ? (
                    <fieldset className="flex flex-col gap-3">
                        <legend className="mb-3 text-sm text-muted-foreground">
                            Where should meeting audio be transcribed?
                        </legend>
                        {(
                            [
                                {
                                    value: "local",
                                    title: "Local Whisper",
                                    description:
                                        "Send audio to a server on your device. Run the server separately; no cloud API key is required.",
                                },
                                {
                                    value: "openai",
                                    title: "OpenAI",
                                    description:
                                        "Send audio to OpenAI using an API key. Transcription is billed by OpenAI.",
                                },
                                {
                                    value: "custom",
                                    title: "Custom server",
                                    description:
                                        "Connect another provider or a self-hosted server with a compatible transcription API.",
                                },
                            ] satisfies { value: Provider; title: string; description: string }[]
                        ).map((option) => (
                            <div key={option.value} className="rounded-lg border border-border bg-background p-3">
                                <Radiobox
                                    name="meeting-provider"
                                    value={option.value}
                                    checked={provider === option.value}
                                    onChange={() => chooseProvider(option.value)}
                                >
                                    <span className="font-medium">{option.title}</span>
                                </Radiobox>
                                <p className="mt-2 text-sm leading-5 text-muted-foreground">{option.description}</p>
                            </div>
                        ))}
                    </fieldset>
                ) : null}
                {step === 1 ? (
                    <>
                        {provider === "local" ? (
                            <p className="rounded-lg border border-border bg-background p-3 text-sm leading-6">
                                Install FFmpeg, build whisper.cpp and download the base model first. From your
                                whisper.cpp folder, start the server with:
                                <code className="my-2 block break-all text-xs">
                                    ./build/bin/whisper-server --model models/ggml-base.bin --threads 4 --port 8080
                                    --convert --language auto
                                </code>
                                Use http://localhost:8080/inference below. For another model, change the model file in
                                the server command. This wizard does not install or start the server.{" "}
                                <a
                                    className="text-primary underline"
                                    href="https://github.com/ggml-org/whisper.cpp/blob/master/examples/server/README.md"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Local server guide
                                </a>
                            </p>
                        ) : null}
                        <Input
                            title="Transcription endpoint"
                            type="url"
                            value={draft.endpoint}
                            onChange={(event) => {
                                const endpoint = event.target.value;
                                if (!isSameMeetingEndpointOrigin(draft.endpoint, endpoint)) {
                                    setKey("");
                                    setSavedKey(false);
                                }
                                update({ endpoint });
                            }}
                        />
                        <MeetingModelSelect
                            model={draft.model}
                            models={models}
                            onChange={(model) => update({ model })}
                        />
                        <p className="text-xs leading-5 text-muted-foreground">
                            {provider === "local"
                                ? "Tiny and base use less memory. Choose multilingual for Portuguese or mixed languages. Your server must support the selected model ID; whisper.cpp uses its loaded model file."
                                : "The endpoint must support the selected model. Choose a model with speaker separation if you need voice labels."}
                        </p>
                        <Input
                            title="Your speaker name"
                            value={draft.localSpeaker}
                            maxLength={200}
                            onChange={(event) => update({ localSpeaker: event.target.value })}
                        />
                        <Input
                            title="Transcription API key (optional)"
                            type="password"
                            autoComplete="off"
                            disabled={savedKey}
                            value={key}
                            onChange={(event) => {
                                setKey(event.target.value);
                                setSample(null);
                                setError(null);
                            }}
                        />
                        {provider === "openai" ? (
                            <Checkbox
                                checked={savedKey}
                                onChange={(event) => {
                                    setSavedKey(event.target.checked);
                                    setSample(null);
                                    setError(null);
                                }}
                            >
                                Use saved OpenAI API key
                            </Checkbox>
                        ) : null}
                        <p className="text-xs leading-5 text-muted-foreground">
                            Keys entered here stay in memory while this note is open. OpenAI requires an API key;
                            ChatGPT sign-in cannot transcribe audio.
                        </p>
                    </>
                ) : null}
                {step === 2 ? (
                    <>
                        <Checkbox
                            disabled={busy}
                            checked={draft.includeSystemAudio}
                            onChange={(event) => update({ includeSystemAudio: event.target.checked })}
                        >
                            Include meeting audio (screen or tab share)
                        </Checkbox>
                        <p className="text-sm leading-6 text-muted-foreground">
                            During a meeting, enable audio in the share picker. Availability depends on your browser and
                            operating system. Voice labels do not identify real names; you can rename speakers or import
                            meeting captions.
                        </p>
                        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
                            <h4 className="font-medium">Try a short sample</h4>
                            <p className="text-sm leading-6 text-muted-foreground">
                                Record five seconds from your microphone and send it to your selected endpoint. The
                                sample is discarded after the test and is not added to your note. Cloud transcription
                                may be billed.
                            </p>
                            <Button className="min-h-11" disabled={busy} onClick={() => void testAudio()}>
                                Test microphone and transcription
                            </Button>
                            {phase === "recording" ? (
                                <Button className="min-h-11" theme="muted" onClick={() => void stopTest()}>
                                    Stop test and transcribe
                                </Button>
                            ) : null}
                            <output aria-live="polite" className="block text-sm text-muted-foreground">
                                {phase === "starting"
                                    ? "Requesting microphone access..."
                                    : phase === "recording"
                                      ? "Recording a five-second sample. Speak now."
                                      : phase === "transcribing"
                                        ? "Transcribing sample..."
                                        : sample
                                          ? "Sample test passed"
                                          : error
                                            ? "Sample test failed"
                                            : "Sample test is optional"}
                            </output>
                            {sample ? <p className="break-words text-sm">{sample}</p> : null}
                        </div>
                    </>
                ) : null}
                {step === 3 ? (
                    <>
                        <dl className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border border-border bg-background p-4 text-sm">
                            <div>
                                <dt className="text-muted-foreground">Provider</dt>
                                <dd>
                                    {provider === "local"
                                        ? "Local Whisper"
                                        : provider === "openai"
                                          ? "OpenAI"
                                          : "Custom server"}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">Endpoint</dt>
                                <dd className="break-all">{draft.endpoint}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">Model</dt>
                                <dd className="break-all">{draft.model}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">Your speaker name</dt>
                                <dd className="break-words">{draft.localSpeaker}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">Meeting audio</dt>
                                <dd>{draft.includeSystemAudio ? "Microphone and shared audio" : "Microphone only"}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">Sample test</dt>
                                <dd>{sample ? "Passed" : "Not tested"}</dd>
                            </div>
                        </dl>
                        <p className="text-sm leading-6 text-muted-foreground">
                            {sample
                                ? "Your sample was transcribed successfully. You can change these settings or run setup again from the meeting panel."
                                : "You can save without testing. Run a sample before your first meeting to check microphone access and the transcription server."}
                        </p>
                    </>
                ) : null}
                {error ? (
                    <p role="alert" className="rounded-lg border border-danger/40 p-3 text-sm">
                        {error}
                    </p>
                ) : null}
            </div>
        </Modal>
    );
}
