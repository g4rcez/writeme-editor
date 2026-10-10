export const LOCAL_WHISPER_ENDPOINT = "http://localhost:8080/inference";
export const LOCAL_WHISPER_MODEL = "base";

export const WHISPER_MODELS = [
    { label: "Whisper tiny · multilingual", value: "tiny" },
    { label: "Whisper base · multilingual", value: "base" },
    { label: "Whisper small · multilingual", value: "small" },
    { label: "Whisper medium · multilingual", value: "medium" },
    { label: "Whisper large v3 · multilingual", value: "large-v3" },
    { label: "Whisper turbo · multilingual", value: "turbo" },
    { label: "Whisper tiny · English only", value: "tiny.en" },
    { label: "Whisper base · English only", value: "base.en" },
    { label: "Whisper small · English only", value: "small.en" },
    { label: "Whisper medium · English only", value: "medium.en" },
];

export const OPENAI_TRANSCRIPTION_MODELS = [
    { label: "OpenAI Whisper", value: "whisper-1" },
    { label: "OpenAI GPT-4o transcribe", value: "gpt-4o-transcribe" },
    { label: "OpenAI GPT-4o mini transcribe", value: "gpt-4o-mini-transcribe" },
    { label: "OpenAI GPT-4o transcribe · speaker separation", value: "gpt-4o-transcribe-diarize" },
];

export const TRANSCRIPTION_MODELS = [...WHISPER_MODELS, ...OPENAI_TRANSCRIPTION_MODELS];
