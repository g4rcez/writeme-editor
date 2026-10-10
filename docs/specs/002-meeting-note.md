# Meeting note

Create a meeting note through **New meeting note** in the command palette. Write markdown notes while recording microphone input and selected system or tab audio. **Stop and transcribe** sends separate audio recordings to the configured endpoint and saves the transcript in the note's metadata. Screen video is never included in recordings.

## Transcription

### Guided setup

The first meeting note opens **Set up meeting notes**. A four-step wizard helps users choose Local Whisper, OpenAI or a custom server; set the endpoint, model, credentials and speaker name; choose whether to capture shared audio; and review the configuration. **Skip for now**, Escape or closing the dialog dismisses onboarding without applying draft changes. The dismissal is remembered. **Set up meeting notes** or **Run setup again** reopens the wizard from the meeting panel, using the current configuration.

An optional five-second microphone sample checks recording and transcription through the configured endpoint. Users can stop it early or retry errors. The sample is not added to the note; closing setup releases microphone tracks and cancels an active upload. The review distinguishes a successful sample from **Not tested**, and saving without a sample does not claim that the server is available. Setup does not install or start local servers.

**Save and finish** persists the transcription configuration and the shared-audio preference, then marks onboarding complete. Save errors keep the wizard open for retry. Provider changes clear the wizard's entered key and saved-key selection. Entered keys stay in memory for the current note, are not saved with configuration, and never appear in the review. Saved OpenAI keys are restricted to the official OpenAI endpoint. Existing configurations remain compatible with defaults for the new onboarding and audio preferences.

### Manual settings

Open **Recording and transcription settings** to set your name, endpoint, model and optional API key. Settings persist; keys entered in the panel remain in memory while that note is open.

The model selector offers multilingual Whisper tiny, base, small, medium, large-v3 and turbo; English-only tiny, base, small and medium; and OpenAI transcription models. Choose **Custom model** for a server-specific ID, including repository names or quantized model aliases. **Save transcription settings** persists the choice without starting a recording. Existing custom IDs remain editable. Settings are disabled during capture and transcription; failed uploads can be retried with another model.

Tiny and base prioritize lower memory usage; larger models generally favor accuracy. Multilingual models support Portuguese and mixed-language meetings. Presets send the selected ID to the endpoint; the server must support that ID. With whisper.cpp, the model file and quantization are configured on the server using `--model`; selecting a model here does not download or switch its loaded model. See the [Whisper model reference](https://github.com/openai/whisper/blob/main/README.md) and [whisper.cpp server options](https://github.com/ggml-org/whisper.cpp/blob/master/examples/server/README.md).

- Local default: `http://localhost:8080/inference`, model `base`, matching whisper.cpp. After building whisper.cpp, installing FFmpeg and downloading `models/ggml-base.bin`, run `./build/bin/whisper-server --model models/ggml-base.bin --threads 4 --port 8080 --convert --language auto` from the whisper.cpp checkout. `--convert` accepts browser WebM/MP4 recordings; `--language auto` detects Portuguese and other languages. The app does not install or start Whisper. Existing endpoint settings remain unchanged, and OpenAI-compatible local servers can use their own endpoint. Custom servers must allow requests from the app through CORS.
- OpenAI: `https://api.openai.com/v1/audio/transcriptions`. Enter an API key or select the existing saved OpenAI API key. ChatGPT OAuth credentials do not authorize this endpoint. The browser development server requires the existing proxy started by `npm run browser:dev`; Electron starts its proxy automatically.
- Whisper requests `verbose_json` with segment timestamps. Models with plain JSON responses may supply only a single block of text. `gpt-4o-transcribe-diarize` requests `diarized_json` with automatic chunking to preserve speaker labels.

Microphone transcripts without speaker labels use the configured local name. System transcripts without speaker labels remain unattributed. Diarization labels distinguish voices; they do not identify real names. Names can be corrected in the transcript panel or preserved from imported captions. No live Meet, Zoom or Teams participant detection is implemented.

Each transcription request and caption import gets independent speaker identities. Repeated labels within that request share an identity; the same label in another source or later recording stays separate. Corrections rename only that identity, even if two people share a display name. Existing transcripts without identity fields remain readable and distinguish their speakers by source and name.

## Capture and recovery

System audio is optional. Enable audio in the share picker; a video-only share produces an explicit error. Capture availability depends on the operating system and browser. Electron uses the native picker where available and an explicit screen choice otherwise. macOS builds declare microphone and system-audio usage descriptions.

Recording stops when sharing ends, after one hour, or when a source reaches 24 MB. Uploads above 25 MB are rejected. Transcription happens after recording stops. Failed transcription retains audio for retry or download while the note stays open. Failed transcript saves retain the transcript for retry. Leaving the note requires acknowledging that unsaved audio or transcript data will be discarded. Audio is not stored permanently; the transcript is stored in IndexedDB or SQLite alongside note metadata. Editing transcript metadata does not overwrite markdown content.

## Transcript imports

Import `.vtt`, `.srt` or `.txt` files, or paste transcript text. Supported representations include Meet and Teams WebVTT voice annotations, Zoom SRT captions, timestamped speaker text and `Name: speech` text. Formats are detected from their content. Timestamp and speaker information are retained when present. Invalid captions are rejected without replacing a saved transcript.

## Verification

Playwright exercises creation, caption import, speaker corrections, markdown and transcript persistence, real Chromium MediaRecorder output with a synthetic microphone, failed transcription and retry, and unavailable system audio. The transcription response is a fixture; no paid API calls are made. Service tests upload multipart audio to a real local HTTP server and cover diarization, cancellation, limits and media cleanup. Native physical-device system audio and production speech recognition require a configured transcription service and an OS device check.

Final checks passed against an isolated snapshot containing only the meeting-note changes: 79 focused Vitest tests, all 12 meeting-note Playwright scenarios, TypeScript, lint, formatting for meeting-note modules, browser production build and main-process build. Browser coverage includes first-use onboarding, local endpoint and launch guidance, provider credentials, optional sample testing and retry, cleanup on cancel, failed settings writes, mobile bounds, model selection, caption imports, two-source recording, navigation recovery and independent speaker corrections across sources and later recordings. Unit tests also verify imported-speaker isolation and compatibility with existing transcript metadata. Tests use synthetic audio and fixture transcription responses, with no live cloud calls.

Two note-page unit tests previously failed identically against unchanged HEAD: keyboard order and Markdown title editing. Those failures were left unchanged. Existing lint and build warnings outside meeting-note code remain.
