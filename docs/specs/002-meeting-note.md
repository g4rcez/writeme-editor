# Meeting note

Create a meeting note through **New meeting note** in the command palette. Write markdown notes while recording microphone input and selected system or tab audio. **Stop and transcribe** sends separate audio recordings to the configured endpoint and saves the transcript in the note's metadata. Screen video is never included in recordings.

## Transcription

### Guided setup

The first meeting note opens **Set up meeting notes**. A four-step wizard helps users choose Local Whisper, OpenAI or a custom server; set the endpoint, model, credentials and speaker name; choose whether to capture shared audio; and review the configuration. **Skip for now**, Escape or closing the dialog dismisses onboarding without applying draft changes. The dismissal is remembered. **Set up meeting notes** or **Run setup again** reopens the wizard from the meeting panel, using the current configuration.

An optional five-second microphone sample checks recording and transcription through the configured endpoint. Users can stop it early or retry errors. The sample is not added to the note; closing setup immediately releases microphone tracks and cancels an active upload, even while saving the dismissal status is pending. The review distinguishes a successful sample from **Not tested**, and saving without a sample does not claim that the server is available. Setup does not install or start local servers.

**Save and finish** persists the transcription configuration and the shared-audio preference, then marks onboarding complete. Save errors keep the wizard open for retry. Provider changes clear the wizard's entered key and saved-key selection. Changing the endpoint origin in either setup or manual settings also clears credentials; changing only the path or query preserves them. Entered keys stay in memory for the current note, are not saved with configuration, and never appear in the review. Saved OpenAI keys are restricted to the official OpenAI endpoint. Existing configurations remain compatible with defaults for the new onboarding and audio preferences.

### Manual settings

Open **Recording and transcription settings** to set your name, endpoint, model and optional API key. Settings persist; keys entered in the panel remain in memory while that note is open.

The model selector offers multilingual Whisper tiny, base, small, medium, large-v3 and turbo; English-only tiny, base, small and medium; and OpenAI transcription models. Choose **Custom model** for a server-specific ID, including repository names or quantized model aliases. **Save transcription settings** persists the choice without starting a recording. Existing custom IDs remain editable. Settings are disabled during capture and transcription; failed uploads can be retried with another model.

Tiny and base prioritize lower memory usage; larger models generally favor accuracy. Multilingual models support Portuguese and mixed-language meetings. Presets send the selected ID to the endpoint; the server must support that ID. With whisper.cpp, the model file and quantization are configured on the server using `--model`; selecting a model here does not download or switch its loaded model. See the [Whisper model reference](https://github.com/openai/whisper/blob/main/README.md) and [whisper.cpp server options](https://github.com/ggml-org/whisper.cpp/blob/master/examples/server/README.md).

- Local default: `http://localhost:8080/inference`, model `base`, matching whisper.cpp. After building whisper.cpp, installing FFmpeg and downloading `models/ggml-base.bin`, run `./build/bin/whisper-server --model models/ggml-base.bin --threads 4 --port 8080 --convert --language auto` from the whisper.cpp checkout. `--convert` accepts browser WebM/MP4 recordings; `--language auto` detects Portuguese and other languages. The app does not install or start Whisper. Existing endpoint settings remain unchanged, and OpenAI-compatible local servers can use their own endpoint. Custom servers must allow requests from the app through CORS.
- OpenAI: `https://api.openai.com/v1/audio/transcriptions`. Enter an API key or select the existing saved OpenAI API key. ChatGPT OAuth credentials do not authorize this endpoint. Browser uploads go directly to the official API, including hosted PWAs; Electron uses its authenticated local proxy. No localhost proxy is required for browser transcription.
- Whisper requests `verbose_json` with segment timestamps. Models with plain JSON responses may supply only a single block of text. `gpt-4o-transcribe-diarize` requests `diarized_json` with automatic chunking to preserve speaker labels.

Microphone transcripts without speaker labels use the configured local name. System transcripts without speaker labels remain unattributed. Diarization labels distinguish voices; they do not identify real names. Names can be corrected in the transcript panel or preserved from imported captions. No live Meet, Zoom or Teams participant detection is implemented.

Each transcription request and caption import gets independent speaker identities. Repeated labels within that request share an identity; the same label in another source or later recording stays separate. Corrections rename only that identity, even if two people share a display name. Existing transcripts without identity fields remain readable and distinguish their speakers by source and name.

## Capture and recovery

System audio is optional. Enable audio in the share picker; a video-only share produces an explicit error. Capture availability depends on the operating system and browser. Electron uses the native picker where available and an explicit screen choice otherwise. macOS builds declare microphone and system-audio usage descriptions.

Recording stops when sharing ends, after one hour, or when a source reaches 24 MB. Uploads above 25 MB are rejected. Transcription happens after recording stops. Uploads time out after 15 minutes; users can also cancel transcription and retry or download the retained audio. Canceling recording setup immediately releases shared tracks, even while microphone permission is pending; a late permission grant is released without starting a recording. A failed upload cancels the other source's upload. Proxy rate-limit waits honor cancellation.

Failed transcription retains audio for retry or download while the note stays open. Failed transcript saves retain the transcript for retry. Leaving the note requires acknowledging that unsaved audio or transcript data will be discarded. Audio is held in memory, so an application crash or forced closure loses an unfinished recording. The transcript is stored in IndexedDB or SQLite alongside note metadata. Editing transcript metadata does not overwrite markdown content.

## Transcript imports

Import `.vtt`, `.srt` or `.txt` files, or paste transcript text. Supported representations include Meet and Teams WebVTT voice annotations, Zoom SRT captions, timestamped speaker text and `Name: speech` text. Formats are detected from their content. Timestamp and speaker information are retained when present. Invalid captions are rejected without replacing a saved transcript.

## Verification

Verification uses Node 24.18.0 from `.nvmrc`. The isolated release snapshot passes all 1,260 unit tests and 18 production-browser Playwright scenarios. These include credential clearing when changing server origins, immediate microphone cleanup while dismissal persistence is pending, and retrying a failed transcript save without uploading audio again. The optional live-Whisper scenario also passed separately: Chromium recorded the upstream JFK speech WAV through MediaRecorder, uploaded its WebM to a CPU-only whisper.cpp server using the multilingual tiny model and FFmpeg conversion, and persisted the resulting transcript across reload. Cloud requests use fixtures; no paid API calls were made.

The macOS arm64 app packaged successfully and passed `codesign --verify --deep --strict`; its microphone and audio usage descriptions are present. Two native Playwright tests loaded the production Electron bundles with isolated user data and verified SQLite persistence after reload: one imports a transcript; the other records microphone audio with MediaRecorder and uploads it to a local transcription fixture. At the default window size, the tests dismiss the workspace drawer through its Escape shortcut before accessing recording controls. TypeScript and the browser production build pass. Two stale note-page tests now cover the current toolbar order and the editable reading-list title. Existing lint warnings in the note-page test mock remain.

The reusable `.github/workflows/meeting-verification.yml` runs unit tests, TypeScript, production-browser scenarios, packaging and the native SQLite tests on macOS, Windows and Linux. Its separate Linux job compiles a pinned whisper.cpp revision, verifies the tiny model checksum and runs the live browser transcription test. Release publication depends on this workflow succeeding. Windows and Linux jobs have not been run from this local macOS workspace.

Local browser verification:

```sh
npm run browser:build
npm run test:e2e -- --config playwright.meeting-browser.config.ts
```

After starting a local tiny-model Whisper server on port 8097, run the live scenario with its speech fixture:

```sh
MEETING_WHISPER_ENDPOINT=http://localhost:8097/inference \
MEETING_AUDIO_FIXTURE=/absolute/path/to/whisper.cpp/samples/jfk.wav \
npm run test:e2e -- --config playwright.meeting-browser.config.ts --grep 'live local Whisper'
```

After `npm run package:app`, run the native tests with `npm exec playwright test -- --config playwright.meeting-native.config.ts` (use `xvfb-run --auto-servernum` on headless Linux).

## Release gates

Full deployment to all targets remains unverified until the workflow passes for the release commit and physical audio checks pass on the supported OS/browser versions. Automated device fixtures do not verify privacy dialogs, drivers or actual system loopback. Record these results before publishing:

| Target  | Required physical check                                                                                                                          | Current evidence                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| macOS   | Installed signed app: grant/deny microphone and audio sharing, record both sources, revoke sharing, retry denied permissions                     | Packaging, signature, usage descriptions, microphone fixture and SQLite passed; physical audio pending |
| Windows | Installed app: microphone and screen loopback, picker cancellation, sharing ended, permissions denied                                            | CI configured; runner and physical audio pending                                                       |
| Linux   | Installed app on supported audio/display stacks: microphone; shared audio where the stack supplies it; microphone-only fallback when it does not | CI configured; runner and physical audio pending                                                       |
| Browser | Hosted HTTPS PWA: real microphone, tab sharing with audio when supported, denied permissions and local-server CORS/network permission            | Production Chromium and live local ASR passed with device fixtures; physical permissions pending       |

System audio is optional and cannot be promised on every Linux stack or browser. Microphone-only capture and caption imports remain available. Other browsers must be checked before advertising their recording support. Automatic real-name recognition and live platform participant detection are outside the implemented feature.
