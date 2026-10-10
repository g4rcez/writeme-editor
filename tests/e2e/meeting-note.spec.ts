import type { Page } from "@playwright/test";
import { expect, goHome, test } from "./fixtures";

test.use({
    launchOptions: {
        args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            ...(process.env.MEETING_AUDIO_FIXTURE
                ? [`--use-file-for-fake-audio-capture=${process.env.MEETING_AUDIO_FIXTURE}`]
                : []),
        ],
    },
});

async function createMeeting(page: Page, onboarding = false): Promise<void> {
    await page.addInitScript(() => {
        const start = MediaRecorder.prototype.start;
        let ready = false;
        MediaRecorder.prototype.start = function (timeslice?: number): void {
            ready = false;
            this.addEventListener("dataavailable", (event) => {
                if (event.data.size) ready = true;
            });
            start.call(this, timeslice);
        };
        Object.defineProperty(window, "meetingAudioReady", { get: () => ready });
    });
    await goHome(page);
    await page.keyboard.press("ControlOrMeta+Shift+P");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await palette.getByPlaceholder("Search for...").fill("New meeting note");
    await palette.getByText("New meeting note", { exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Create meeting note" });
    await dialog.getByTitle("Note title").fill("Weekly meeting");
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);
    const setup = page.getByRole("dialog", { name: "Set up meeting notes", exact: true });
    await expect(setup).toBeVisible();
    if (onboarding) return;
    await setup.getByRole("button", { name: "Skip for now" }).click();
    await expect(setup).not.toBeVisible();
    await expect(page.getByRole("region", { name: "Meeting transcription" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Weekly meeting", exact: true })).toBeVisible();
}

test("saves Whisper presets and custom model IDs without recording", async ({ cleanPage: page }) => {
    await createMeeting(page);
    const panel = page.getByRole("region", { name: "Meeting transcription" });
    const model = panel.getByRole("combobox", { name: "Transcription model", exact: true });
    const openSettings = async (): Promise<void> => {
        await panel.getByText("Recording and transcription settings", { exact: true }).click();
    };
    await openSettings();
    await expect(model).toHaveValue("base");
    await model.selectOption("base");
    await panel.getByRole("button", { name: "Save transcription settings" }).click();
    await expect(panel.getByRole("status")).toHaveText("Transcription settings saved");
    await page.reload();
    await openSettings();
    await expect(model).toHaveValue("base");
    await expect(panel.getByTitle("Transcription endpoint")).toHaveValue("http://localhost:8080/inference");

    await model.selectOption("tiny.en");
    await expect(model).toHaveValue("tiny.en");
    await model.selectOption("custom");
    const custom = panel.getByRole("textbox", { name: "Custom model ID", exact: true });
    await custom.fill("");
    await panel.getByRole("button", { name: "Save transcription settings" }).click();
    await expect(panel.getByRole("alert")).toHaveText("Enter a model and your name.");
    await custom.fill("Systran/faster-whisper-small");
    await panel.getByRole("button", { name: "Save transcription settings" }).click();
    await expect(panel.getByRole("status")).toHaveText("Transcription settings saved");
    await page.reload();
    await openSettings();
    await expect(model).toHaveValue("custom");
    await expect(custom).toHaveValue("Systran/faster-whisper-small");
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await panel.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "/tmp/writeme-meeting-model-mobile.png", fullPage: true });
});

test("onboards a local provider, retries a sample, and persists the completed setup", async ({ cleanPage: page }) => {
    let uploads = 0;
    await page.route("http://localhost:8080/inference", async (route) => {
        if (route.request().method() === "OPTIONS") {
            await route.fulfill({ status: 204 });
            return;
        }
        uploads++;
        expect(route.request().postDataBuffer()?.toString()).toContain('name="model"\r\n\r\nbase');
        expect(route.request().headers().authorization).toBeUndefined();
        await route.fulfill({
            status: uploads === 1 ? 503 : 200,
            contentType: "application/json",
            body: JSON.stringify({ text: "Microphone connected." }),
        });
    });
    await createMeeting(page, true);
    const setup = page.getByRole("dialog", { name: "Set up meeting notes", exact: true });
    await expect(setup.getByRole("radio", { name: "Local Whisper", exact: true })).toBeChecked();
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(setup.getByTitle("Transcription endpoint")).toHaveValue("http://localhost:8080/inference");
    await expect(setup).toContainText("--convert --language auto");
    await setup.getByRole("combobox", { name: "Transcription model", exact: true }).selectOption("base");
    await setup.getByTitle("Your speaker name").fill("Allan");
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await setup.getByLabel("Include meeting audio (screen or tab share)").uncheck();
    for (let attempt = 0; attempt < 2; attempt++) {
        await setup.getByRole("button", { name: "Test microphone and transcription" }).click();
        await expect(setup.getByRole("button", { name: "Back", exact: true })).toBeDisabled();
        await expect(setup.getByRole("button", { name: "Stop test and transcribe" })).toBeVisible();
        await page.waitForFunction(() => Reflect.get(window, "meetingAudioReady"));
        await setup.getByRole("button", { name: "Stop test and transcribe" }).click();
        if (attempt === 0) await expect(setup.getByRole("alert")).toContainText("503");
        else await expect(setup.getByRole("status")).toHaveText("Sample test passed");
    }
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(setup.getByRole("heading", { name: "Review and finish" })).toBeFocused();
    await expect(setup).toContainText("Microphone only");
    await page.screenshot({ path: "/tmp/writeme-meeting-setup-desktop.png" });
    await setup.getByRole("button", { name: "Save and finish" }).click();
    await expect(setup).not.toBeVisible();
    const panel = page.getByRole("region", { name: "Meeting transcription" });
    await expect(panel.getByRole("status")).toHaveText("Meeting setup saved");
    await expect(panel).toContainText("No transcript yet");
    await page.reload();
    await expect(setup).not.toBeVisible();
    await panel.getByText("Recording and transcription settings", { exact: true }).click();
    await expect(panel.getByTitle("Your speaker name")).toHaveValue("Allan");
    await expect(panel.getByRole("combobox", { name: "Transcription model", exact: true })).toHaveValue("base");
    await expect(panel.getByLabel("Include meeting audio (screen or tab share)")).not.toBeChecked();
    await panel.getByRole("button", { name: "Run setup again" }).click();
    await expect(setup.getByRole("radio", { name: "Local Whisper", exact: true })).toBeChecked();
    expect(uploads).toBe(2);
});

test("validates OpenAI credentials and clears them when switching to a custom provider", async ({
    cleanPage: page,
}) => {
    await createMeeting(page, true);
    const setup = page.getByRole("dialog", { name: "Set up meeting notes", exact: true });
    await setup.getByRole("radio", { name: "OpenAI", exact: true }).check();
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(setup.getByTitle("Transcription endpoint")).toHaveValue(
        "https://api.openai.com/v1/audio/transcriptions",
    );
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(setup.getByRole("alert")).toContainText("Enter an OpenAI API key");
    await setup.getByLabel("Use saved OpenAI API key").check();
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(setup.getByRole("alert")).toContainText("No saved OpenAI API key");
    await setup.getByLabel("Use saved OpenAI API key").uncheck();
    await setup.getByTitle("Transcription API key (optional)").fill("wizard-secret-fixture");
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await setup.getByRole("button", { name: "Back", exact: true }).click();
    await setup.getByRole("button", { name: "Back", exact: true }).click();
    await setup.getByRole("radio", { name: "Custom server", exact: true }).check();
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(setup.getByTitle("Transcription API key (optional)")).toHaveValue("");
    await setup.getByTitle("Transcription endpoint").fill("file:///tmp/transcriptions");
    await setup.getByTitle("Custom model ID").fill("custom-whisper-int8");
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(setup.getByRole("alert")).toContainText("HTTP or HTTPS");
    await setup.getByTitle("Transcription endpoint").fill("https://speech.example.com/v1/audio/transcriptions");
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(setup).toContainText("Not tested");
    await expect(setup).not.toContainText("wizard-secret-fixture");
    await setup.getByRole("button", { name: "Save and finish" }).click();
    await expect(setup).not.toBeVisible();
    await page.reload();
    const panel = page.getByRole("region", { name: "Meeting transcription" });
    await panel.getByText("Recording and transcription settings", { exact: true }).click();
    await expect(panel.getByTitle("Custom model ID")).toHaveValue("custom-whisper-int8");
});

test("saves OpenAI setup without uploading audio or persisting an entered API key", async ({ cleanPage: page }) => {
    let requests = 0;
    await page.route("**/proxy", async (route) => {
        requests++;
        await route.abort();
    });
    await createMeeting(page, true);
    const setup = page.getByRole("dialog", { name: "Set up meeting notes", exact: true });
    await setup.getByRole("radio", { name: "OpenAI", exact: true }).check();
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await setup.getByTitle("Transcription API key (optional)").fill("wizard-secret-fixture");
    await setup
        .getByRole("combobox", { name: "Transcription model", exact: true })
        .selectOption("gpt-4o-mini-transcribe");
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(setup).toContainText("Not tested");
    await setup.getByRole("button", { name: "Save and finish" }).click();
    const panel = page.getByRole("region", { name: "Meeting transcription" });
    await panel.getByText("Recording and transcription settings", { exact: true }).click();
    await expect(panel.getByTitle("Transcription API key (optional)")).toHaveValue("wizard-secret-fixture");
    await page.reload();
    await expect(setup).not.toBeVisible();
    await panel.getByText("Recording and transcription settings", { exact: true }).click();
    await expect(panel.getByTitle("Transcription API key (optional)")).toHaveValue("");
    await expect(panel.getByRole("combobox", { name: "Transcription model", exact: true })).toHaveValue(
        "gpt-4o-mini-transcribe",
    );
    expect(requests).toBe(0);
});

test("skips onboarding, reopens it on mobile, and discards cancelled changes", async ({ cleanPage: page }) => {
    await createMeeting(page);
    await page.reload();
    const setup = page.getByRole("dialog", { name: "Set up meeting notes", exact: true });
    await expect(setup).not.toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole("button", { name: "Set up meeting notes", exact: true }).click();
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await setup.getByRole("combobox", { name: "Transcription model", exact: true }).selectOption("medium");
    expect(await setup.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    const bounds = await setup.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
    await page.screenshot({ path: "/tmp/writeme-meeting-setup-mobile.png" });
    await page.keyboard.press("Escape");
    await expect(setup).not.toBeVisible();
    const panel = page.getByRole("region", { name: "Meeting transcription" });
    await panel.getByText("Recording and transcription settings", { exact: true }).click();
    await expect(panel.getByRole("combobox", { name: "Transcription model", exact: true })).toHaveValue("base");
});

test("reports microphone denial in setup and releases a cancelled sample", async ({ cleanPage: page }) => {
    await createMeeting(page, true);
    const setup = page.getByRole("dialog", { name: "Set up meeting notes", exact: true });
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await page.evaluate(() => {
        const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        let attempts = 0;
        let stream: MediaStream | null = null;
        Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
            value: async (constraints: MediaStreamConstraints) => {
                if (++attempts === 1) throw new Error("Microphone access denied");
                stream = await original(constraints);
                return stream;
            },
        });
        Object.defineProperty(window, "wizardTracksEnded", {
            get: () => stream?.getTracks().every((track) => track.readyState === "ended"),
        });
    });
    await setup.getByRole("button", { name: "Test microphone and transcription" }).click();
    await expect(setup.getByRole("alert")).toHaveText("Microphone access denied");
    await setup.getByRole("button", { name: "Test microphone and transcription" }).click();
    await expect(setup.getByRole("button", { name: "Stop test and transcribe" })).toBeVisible();
    await setup.getByRole("button", { name: "Skip for now" }).click();
    await expect(setup).not.toBeVisible();
    expect(await page.evaluate(() => Reflect.get(window, "wizardTracksEnded"))).toBe(true);
});

test("keeps setup open after a settings write fails and allows saving again", async ({ cleanPage: page }) => {
    await createMeeting(page, true);
    const setup = page.getByRole("dialog", { name: "Set up meeting notes", exact: true });
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await setup.getByTitle("Your speaker name").fill("Allan");
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await setup.getByRole("button", { name: "Continue", exact: true }).click();
    await page.evaluate(() => {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey): IDBRequest<IDBValidKey> {
            if (this.name === "settings") {
                IDBObjectStore.prototype.put = put;
                throw new DOMException("Unable to save setup", "QuotaExceededError");
            }
            return put.call(this, value, key);
        };
    });
    await setup.getByRole("button", { name: "Save and finish" }).click();
    await expect(setup.getByRole("alert")).toContainText("Unable to save setup");
    await expect(setup.getByRole("button", { name: "Save and finish" })).toBeEnabled();
    await setup.getByRole("button", { name: "Save and finish" }).click();
    await expect(setup).not.toBeVisible();
    await page.reload();
    await expect(setup).not.toBeVisible();
    await page.getByText("Recording and transcription settings", { exact: true }).click();
    await expect(page.getByTitle("Your speaker name")).toHaveValue("Allan");
});

test("imports named captions, renames speakers and preserves notes across reload", async ({ cleanPage: page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await createMeeting(page);
    const panel = page.getByRole("region", { name: "Meeting transcription" });
    await panel.getByText("Import meeting transcript", { exact: true }).click();
    await panel.getByLabel("Transcript file", { exact: true }).setInputFiles({
        name: "teams.vtt",
        mimeType: "text/vtt",
        buffer: Buffer.from(
            "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n<v Alex>Ship the editor on Friday.</v>\n\n00:00:05.000 --> 00:00:08.000\n<v Sam>I will review the changes.</v>",
        ),
    });
    await expect(panel.getByTitle("Transcript text")).toContainText("Ship the editor");
    await panel.getByRole("button", { name: "Import transcript", exact: true }).click();
    await expect(panel.getByRole("status")).toHaveText("Transcript saved");
    await expect(panel.getByRole("list", { name: "Transcript entries" })).toContainText("Alex");
    await panel.getByTitle("Speaker name: Alex", { exact: true }).fill("Alex Taylor");
    await panel.getByTitle("Speaker name: Alex", { exact: true }).press("Tab");
    await expect(panel.getByTitle("Speaker name: Alex Taylor", { exact: true })).toBeVisible();

    const editor = page.locator(".ProseMirror").first();
    await editor.click();
    await page.keyboard.type("Remember to check the release checklist.");
    const saveStatus = page.locator(".writeme-editor-status-bar output").first();
    await expect(saveStatus).toHaveText("Unsaved changes");
    await expect(saveStatus).toHaveText("Saved", { timeout: 15_000 });
    await page.reload();
    await expect(page.getByRole("list", { name: "Transcript entries" })).toContainText("Alex Taylor");
    await expect(page.locator(".ProseMirror").first()).toContainText("Remember to check the release checklist.");
    await page.screenshot({ path: "/tmp/writeme-meeting-note-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    const overflow = await page
        .getByRole("region", { name: "Meeting transcription" })
        .evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
});

test("records real browser audio, keeps failed uploads for retry and persists transcription", async ({
    cleanPage: page,
}) => {
    let uploads = 0;
    let uploadedAudio = false;
    const uploadedModels: string[] = [];
    await page.route("http://localhost:8080/inference", async (route) => {
        if (route.request().method() === "OPTIONS") {
            await route.fulfill({ status: 204 });
            return;
        }
        uploads++;
        const body = route.request().postDataBuffer();
        uploadedModels.push(body?.toString().match(/name="model"\r\n\r\n([^\r]+)/)?.[1] ?? "");
        uploadedAudio = Boolean(body?.includes(Buffer.from('name="file"')) && body.includes(Buffer.from("webm")));
        await route.fulfill({
            status: uploads === 1 ? 503 : 200,
            contentType: "application/json",
            body: JSON.stringify(
                uploads === 1
                    ? { error: "unavailable" }
                    : {
                          text: "The release is ready.",
                          segments: [{ start: 0, end: 2, text: "The release is ready." }],
                      },
            ),
        });
    });
    await createMeeting(page);
    const panel = page.getByRole("region", { name: "Meeting transcription" });
    await panel.getByText("Recording and transcription settings", { exact: true }).click();
    await panel.getByLabel("Include meeting audio (screen or tab share)").uncheck();
    await panel.getByTitle("Your speaker name").fill("Allan");
    await panel.getByRole("combobox", { name: "Transcription model", exact: true }).selectOption("base");
    await panel.getByRole("button", { name: "Start recording", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Stop and transcribe" })).toBeVisible();
    await expect(panel.getByRole("combobox", { name: "Transcription model", exact: true })).toBeDisabled();
    await page.waitForFunction(() => Reflect.get(window, "meetingAudioReady"));
    await panel.getByRole("button", { name: "Stop and transcribe" }).click();
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Download audio" })).toBeVisible();
    expect(uploadedAudio).toBe(true);
    const downloadEvent = page.waitForEvent("download");
    await panel.getByRole("button", { name: "Download audio" }).click();
    expect((await downloadEvent).suggestedFilename()).toBe("meeting-microphone.webm");
    await panel.getByRole("combobox", { name: "Transcription model", exact: true }).selectOption("custom");
    await panel.getByRole("textbox", { name: "Custom model ID", exact: true }).fill("Systran/faster-whisper-small");
    await panel.getByRole("button", { name: "Retry transcription" }).click();
    await expect(panel.getByRole("status")).toHaveText("Transcript saved");
    await expect(panel.getByRole("list", { name: "Transcript entries" })).toContainText("Allan");
    expect(uploads).toBe(2);
    expect(uploadedModels).toEqual(["base", "Systran/faster-whisper-small"]);
    await page.reload();
    await expect(page.getByRole("list", { name: "Transcript entries" })).toContainText("The release is ready.");
});

test("cancels a pending upload and retries the retained browser recording", async ({ cleanPage: page }) => {
    let uploads = 0;
    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route("http://localhost:8080/inference", async (route) => {
        if (route.request().method() === "OPTIONS") {
            await route.fulfill({ status: 204 });
            return;
        }
        uploads++;
        if (uploads === 1) await pending;
        await route
            .fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ text: "Retried recording" }),
            })
            .catch(() => {});
    });
    await createMeeting(page);
    const panel = page.getByRole("region", { name: "Meeting transcription" });
    await panel.getByText("Recording and transcription settings", { exact: true }).click();
    await panel.getByLabel("Include meeting audio (screen or tab share)").uncheck();
    await panel.getByRole("button", { name: "Start recording", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Stop and transcribe" })).toBeVisible();
    await page.waitForFunction(() => Reflect.get(window, "meetingAudioReady"));
    await panel.getByRole("button", { name: "Stop and transcribe" }).click();
    await expect.poll(() => uploads).toBe(1);
    await panel.getByRole("button", { name: "Cancel transcription", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Retry transcription" })).toBeEnabled();
    await expect(panel.getByRole("button", { name: "Download audio" })).toBeVisible();
    await expect(panel.getByRole("list", { name: "Transcript entries" })).not.toBeVisible();
    release();
    await panel.getByRole("button", { name: "Retry transcription" }).click();
    await expect(panel.getByRole("status")).toHaveText("Transcript saved");
    await expect(panel.getByRole("list", { name: "Transcript entries" }).getByRole("listitem")).toHaveCount(1);
    await page.reload();
    await expect(panel.getByRole("list", { name: "Transcript entries" })).toContainText("Retried recording");
});

test("uploads browser audio directly to OpenAI without requiring a localhost proxy", async ({ cleanPage: page }) => {
    let uploads = 0;
    await page.route("http://localhost:4079/**", (route) => route.abort());
    await page.route("https://api.openai.com/v1/audio/transcriptions", async (route) => {
        if (route.request().method() === "OPTIONS") {
            await route.fulfill({ status: 204 });
            return;
        }
        uploads++;
        expect(route.request().headers().authorization).toBe("Bearer fixture-key");
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ text: "Browser cloud transcript" }),
        });
    });
    await createMeeting(page);
    const panel = page.getByRole("region", { name: "Meeting transcription" });
    await panel.getByText("Recording and transcription settings", { exact: true }).click();
    await panel.getByLabel("Include meeting audio (screen or tab share)").uncheck();
    await panel.getByTitle("Transcription endpoint").fill("https://api.openai.com/v1/audio/transcriptions");
    await panel.getByTitle("Transcription API key (optional)").fill("fixture-key");
    await panel
        .getByRole("combobox", { name: "Transcription model", exact: true })
        .selectOption("gpt-4o-mini-transcribe");
    await panel.getByRole("button", { name: "Start recording", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Stop and transcribe" })).toBeVisible();
    await page.waitForFunction(() => Reflect.get(window, "meetingAudioReady"));
    await panel.getByRole("button", { name: "Stop and transcribe" }).click();
    await expect(panel.getByRole("status")).toHaveText("Transcript saved");
    expect(uploads).toBe(1);
    await page.reload();
    await expect(panel.getByRole("list", { name: "Transcript entries" })).toContainText("Browser cloud transcript");
    await panel.getByText("Recording and transcription settings", { exact: true }).click();
    await expect(panel.getByTitle("Transcription API key (optional)")).toHaveValue("");
});

test("transcribes browser MediaRecorder output with a live local Whisper server", async ({ cleanPage: page }) => {
    test.setTimeout(90_000);
    test.skip(
        !process.env.MEETING_WHISPER_ENDPOINT || !process.env.MEETING_AUDIO_FIXTURE,
        "Requires an explicit local Whisper server and speech fixture.",
    );
    await createMeeting(page);
    const panel = page.getByRole("region", { name: "Meeting transcription" });
    await panel.getByText("Recording and transcription settings", { exact: true }).click();
    await panel.getByLabel("Include meeting audio (screen or tab share)").uncheck();
    await panel.getByTitle("Transcription endpoint").fill(process.env.MEETING_WHISPER_ENDPOINT!);
    await panel.getByRole("combobox", { name: "Transcription model", exact: true }).selectOption("tiny");
    await panel.getByRole("button", { name: "Start recording", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Stop and transcribe" })).toBeVisible();
    await page.waitForTimeout(12_000);
    await panel.getByRole("button", { name: "Stop and transcribe" }).click();
    await expect(panel.getByRole("status")).toHaveText("Transcript saved", { timeout: 60_000 });
    await expect(panel.getByRole("list", { name: "Transcript entries" })).toContainText(/country/i);
    await page.reload();
    await expect(panel.getByRole("list", { name: "Transcript entries" })).toContainText(/country/i);
});

test("reports unavailable shared audio, releases sharing and avoids opening the microphone", async ({
    cleanPage: page,
}) => {
    await createMeeting(page);
    await page.evaluate(() => {
        const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        let microphoneRequests = 0;
        let shared: MediaStream | null = null;
        Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
            value: async (constraints: MediaStreamConstraints) => {
                microphoneRequests++;
                return original(constraints);
            },
        });
        Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
            value: async () => {
                shared = document.createElement("canvas").captureStream();
                return shared;
            },
        });
        Object.defineProperty(window, "meetingCaptureState", {
            get: () => ({
                microphoneRequests,
                sharedStopped: shared?.getTracks().every((track) => track.readyState === "ended"),
            }),
        });
    });
    const panel = page.getByRole("region", { name: "Meeting transcription" });
    await panel.getByRole("button", { name: "Start recording", exact: true }).click();
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Start recording", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => Reflect.get(window, "meetingCaptureState"))).toEqual({
        microphoneRequests: 0,
        sharedStopped: true,
    });
});

test("rejects malformed captions without overwriting a saved transcript", async ({ cleanPage: page }) => {
    await createMeeting(page);
    const panel = page.getByRole("region", { name: "Meeting transcription" });
    await panel.getByText("Import meeting transcript", { exact: true }).click();
    await panel.getByTitle("Transcript text").fill("Alex: The plan is approved.");
    await panel.getByRole("button", { name: "Import transcript", exact: true }).click();
    await expect(panel.getByRole("status")).toHaveText("Transcript saved");
    await panel.getByTitle("Transcript text").fill("WEBVTT\n\n00:00:10.000 --> 00:00:01.000\nInvalid cue");
    await panel.getByRole("button", { name: "Import transcript", exact: true }).click();
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(panel.getByRole("list", { name: "Transcript entries" })).toContainText("The plan is approved.");
});

test("records both sources, guards navigation and transcribes when sharing ends", async ({ cleanPage: page }) => {
    let uploads = 0;
    await page.route("http://localhost:8080/inference", async (route) => {
        if (route.request().method() === "OPTIONS") {
            await route.fulfill({ status: 204 });
            return;
        }
        const body = route.request().postDataBuffer()?.toString() ?? "";
        expect(body).toContain("diarized_json");
        uploads++;
        const system = body.includes('filename="system.webm"');
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                segments: system
                    ? [
                          { start: 1, end: 2, speaker: "A", text: "I will prepare the release." },
                          { start: 3, end: 4, speaker: "B", text: "I will test the editor." },
                      ]
                    : [{ start: 0, end: 1, speaker: "A", text: "Thanks everyone." }],
            }),
        });
    });
    await createMeeting(page);
    await page.evaluate(() => {
        const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        let shared: MediaStream | null = null;
        Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
            value: async () => {
                shared = await original({ audio: true, video: true });
                return shared;
            },
        });
        Object.defineProperty(window, "endMeetingShare", {
            value: () => {
                const track = shared?.getVideoTracks()[0];
                track?.stop();
                track?.dispatchEvent(new Event("ended"));
            },
        });
    });
    const panel = page.getByRole("region", { name: "Meeting transcription" });
    await panel.getByText("Recording and transcription settings", { exact: true }).click();
    await panel
        .getByRole("combobox", { name: "Transcription model", exact: true })
        .selectOption("gpt-4o-transcribe-diarize");
    await panel.getByRole("button", { name: "Start recording", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Stop and transcribe" })).toBeVisible();
    await page.getByText("All notes", { exact: true }).click();
    await expect(panel.getByRole("button", { name: "Stay on this note" })).toBeVisible();
    await panel.getByRole("button", { name: "Stay on this note" }).click();
    await page.waitForFunction(() => Reflect.get(window, "meetingAudioReady"));
    await page.evaluate(() => Reflect.get(window, "endMeetingShare")());
    await expect(panel.getByRole("status")).toHaveText("Transcript saved");
    expect(uploads).toBe(2);
    await expect(panel.getByRole("list", { name: "Transcript entries" }).getByRole("listitem")).toHaveCount(3);
    const entries = panel.getByRole("list", { name: "Transcript entries" });
    await expect(panel.getByRole("textbox", { name: /^Speaker name:/ })).toHaveCount(3);
    const microphoneSpeaker = panel.getByRole("textbox", { name: /^Speaker name: A [(]microphone,/ });
    await microphoneSpeaker.fill("Allan");
    await microphoneSpeaker.blur();
    await expect(panel.getByTitle("Speaker name: Allan", { exact: true })).toBeVisible();
    await expect(
        entries
            .getByRole("listitem")
            .filter({ hasText: "I will prepare the release." })
            .getByText("A", { exact: true }),
    ).toBeVisible();
    await expect(panel.getByTitle("Speaker name: B", { exact: true })).toBeVisible();

    await panel.getByRole("button", { name: "Start recording", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Stop and transcribe" })).toBeVisible();
    await page.waitForFunction(() => Reflect.get(window, "meetingAudioReady"));
    await panel.getByRole("button", { name: "Stop and transcribe" }).click();
    await expect(panel.getByRole("status")).toHaveText("Transcript saved");
    await expect(entries.getByRole("listitem")).toHaveCount(6);
    await expect(panel.getByRole("textbox", { name: /^Speaker name:/ })).toHaveCount(6);
    await microphoneSpeaker.fill("Jo");
    await microphoneSpeaker.blur();
    await expect(panel.getByTitle("Speaker name: Jo", { exact: true })).toBeVisible();
    await page.reload();
    await expect(panel.getByTitle("Speaker name: Allan", { exact: true })).toBeVisible();
    await expect(panel.getByTitle("Speaker name: Jo", { exact: true })).toBeVisible();
    await expect(
        entries
            .getByRole("listitem")
            .filter({ hasText: "I will prepare the release." })
            .getByText("A", { exact: true }),
    ).toHaveCount(2);
});
