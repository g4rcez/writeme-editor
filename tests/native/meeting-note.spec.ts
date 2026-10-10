import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

async function launchMeetingApp(): Promise<{ application: ElectronApplication; directory: string }> {
    const directory = await mkdtemp(path.join(tmpdir(), "writeme-meeting-native-"));
    const bootstrap = path.join(directory, "bootstrap.cjs");
    const main = path.resolve(".vite/build/main.js");
    await writeFile(
        bootstrap,
        `const { app } = require("electron");\napp.setPath("appData", ${JSON.stringify(directory)});\napp.setPath("userData", ${JSON.stringify(directory)});\nrequire(${JSON.stringify(main)});\n`,
    );
    try {
        const application = await electron.launch({
            args: [
                bootstrap,
                "--no-sandbox",
                "--use-fake-device-for-media-stream",
                "--use-fake-ui-for-media-stream",
                ...(process.env.MEETING_AUDIO_FIXTURE
                    ? [`--use-file-for-fake-audio-capture=${process.env.MEETING_AUDIO_FIXTURE}`]
                    : []),
            ],
            timeout: 30_000,
        });
        return { application, directory };
    } catch (reason) {
        await rm(directory, { recursive: true, force: true });
        throw reason;
    }
}

async function createMeetingPage(application: ElectronApplication, directory: string): Promise<Page> {
    const page = await application.firstWindow();
    await expect(page.getByRole("heading", { name: "Make space for the next idea." })).toBeVisible();
    const userData = await application.evaluate(({ app }) => app.getPath("userData"));
    expect(userData.startsWith(directory)).toBe(true);
    await page.keyboard.press("ControlOrMeta+Shift+P");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await palette.getByPlaceholder("Search for...").fill("New meeting note");
    await palette.getByText("New meeting note", { exact: true }).click();
    const create = page.getByRole("dialog", { name: "Create meeting note" });
    await create.getByTitle("Note title").fill("Native meeting");
    await create.getByRole("button", { name: /^Create/ }).click();
    const setup = page.getByRole("dialog", { name: "Set up meeting notes", exact: true });
    await expect(setup).toBeVisible();
    await setup.getByRole("button", { name: "Skip for now" }).click();
    await expect(setup).not.toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Close workspace menu", exact: true })).not.toBeVisible();
    return page;
}

test("creates and persists a meeting transcript through Electron and SQLite", async () => {
    const { application, directory } = await launchMeetingApp();
    try {
        const page = await createMeetingPage(application, directory);
        const panel = page.getByRole("region", { name: "Meeting transcription" });
        await panel.getByText("Import meeting transcript", { exact: true }).click();
        await panel.getByTitle("Transcript text").fill("Allan: Native persistence works.");
        await panel.getByRole("button", { name: "Import transcript", exact: true }).click();
        await expect(panel.getByRole("status")).toHaveText("Transcript saved");
        await page.reload();
        await expect(panel.getByRole("list", { name: "Transcript entries" })).toContainText(
            "Native persistence works.",
        );
        await expect(page.getByRole("dialog", { name: "Set up meeting notes", exact: true })).not.toBeVisible();
    } finally {
        await application.close();
        await rm(directory, { recursive: true, force: true });
    }
});

test("records native microphone audio, transcribes it and persists the result in SQLite", async () => {
    let uploads = 0;
    let uploadedAudio = false;
    const server = createServer(async (request, response) => {
        response.setHeader("access-control-allow-origin", "*");
        if (request.method === "OPTIONS") {
            response.writeHead(204).end();
            return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const body = Buffer.concat(chunks);
        uploadedAudio = body.includes(Buffer.from('filename="microphone.webm"')) && body.length > 1000;
        uploads++;
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ text: "Native audio transcript" }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Transcription server did not start.");
        const { application, directory } = await launchMeetingApp();
        try {
            const page = await createMeetingPage(application, directory);
            await page.evaluate(() => {
                const start = MediaRecorder.prototype.start;
                Reflect.set(window, "nativeMeetingAudioReady", false);
                MediaRecorder.prototype.start = function (timeslice?: number): void {
                    this.addEventListener("dataavailable", (event) => {
                        if (event.data.size) Reflect.set(window, "nativeMeetingAudioReady", true);
                    });
                    start.call(this, timeslice);
                };
            });
            const panel = page.getByRole("region", { name: "Meeting transcription" });
            await panel.getByText("Recording and transcription settings", { exact: true }).click();
            await panel.getByLabel("Include meeting audio (screen or tab share)").uncheck();
            await panel.getByTitle("Transcription endpoint").fill(`http://127.0.0.1:${address.port}/inference`);
            await panel.getByRole("button", { name: "Start recording", exact: true }).click();
            await expect(panel.getByRole("button", { name: "Stop and transcribe" })).toBeVisible();
            await page.waitForFunction(() => Reflect.get(window, "nativeMeetingAudioReady"));
            await panel.getByRole("button", { name: "Stop and transcribe" }).click();
            await expect(panel.getByRole("status")).toHaveText("Transcript saved");
            expect(uploads).toBe(1);
            expect(uploadedAudio).toBe(true);
            await page.reload();
            await expect(panel.getByRole("list", { name: "Transcript entries" })).toContainText(
                "Native audio transcript",
            );
        } finally {
            await application.close();
            await rm(directory, { recursive: true, force: true });
        }
    } finally {
        await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
});
