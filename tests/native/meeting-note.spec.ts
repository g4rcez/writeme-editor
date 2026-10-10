import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("creates and persists a meeting transcript through Electron and SQLite", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "writeme-meeting-native-"));
    const bootstrap = path.join(directory, "bootstrap.cjs");
    const main = path.resolve(".vite/build/main.js");
    await writeFile(
        bootstrap,
        `const { app } = require("electron");\napp.setPath("appData", ${JSON.stringify(directory)});\napp.setPath("userData", ${JSON.stringify(directory)});\nrequire(${JSON.stringify(main)});\n`,
    );
    const application = await electron.launch({ args: [bootstrap, "--no-sandbox"], timeout: 30_000 });
    try {
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
        const panel = page.getByRole("region", { name: "Meeting transcription" });
        await panel.getByText("Import meeting transcript", { exact: true }).click();
        await panel.getByTitle("Transcript text").fill("Allan: Native persistence works.");
        await panel.getByRole("button", { name: "Import transcript", exact: true }).click();
        await expect(panel.getByRole("status")).toHaveText("Transcript saved");
        await page.reload();
        await expect(panel.getByRole("list", { name: "Transcript entries" })).toContainText(
            "Native persistence works.",
        );
        await expect(setup).not.toBeVisible();
    } finally {
        await application.close();
        await rm(directory, { recursive: true, force: true });
    }
});
