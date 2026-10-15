import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type {} from "../../packages/editor/src/preload";
import { researchPdf, selectPdfPhrase } from "../helpers/research";

for (const filesystem of [false, true]) {
    test(`persists PDF research excerpts in Electron ${filesystem ? "filesystem" : "SQLite"}`, async ({
        playwright,
    }, testInfo) => {
        test.slow();
        const profile = await mkdtemp(path.join(tmpdir(), "writeme-research-native-"));
        const workspace = path.join(profile, "workspace");
        await mkdir(workspace);
        const bootstrap = path.join(profile, "bootstrap.cjs");
        const entry = process.env.RESEARCH_NATIVE_ENTRY ?? ".vite/build/main.js";
        await writeFile(
            bootstrap,
            `const { app } = require("electron");\napp.setPath("appData", ${JSON.stringify(profile)});\napp.setPath("userData", ${JSON.stringify(profile)});\nrequire(${JSON.stringify(path.resolve(entry))});\n`,
        );
        const application = await playwright._electron.launch({
            args: [bootstrap, "--no-sandbox"],
            env: { ...process.env, NODE_ENV: "production" },
        });
        try {
            expect(
                (await application.evaluate(({ app }) => app.getPath("userData"))).startsWith(profile + path.sep),
            ).toBe(true);
            const page = await application.firstWindow();
            const nativeWindow = await application.browserWindow(page);
            await nativeWindow.evaluate((window) => window.setSize(1280, 900));
            await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
            if (filesystem) {
                await application.evaluate(({ dialog }, folder) => {
                    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
                }, workspace);
                await page.evaluate(async () => {
                    const selected = await window.electronAPI.fs.chooseDirectory();
                    await window.electronAPI.db.save("settings", {
                        id: "directory",
                        name: "directory",
                        value: JSON.stringify(selected),
                        type: "setting",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });
                });
                await page.reload();
            }
            await page.getByRole("button", { name: "Import PDF", exact: true }).click();
            const importer = page.getByRole("dialog", { name: "Import PDF", exact: true });
            await importer
                .getByLabel("PDF document", { exact: true })
                .setInputFiles({ name: "Research.pdf", mimeType: "application/pdf", buffer: researchPdf() });
            await importer.getByRole("button", { name: "Import PDF", exact: true }).click();
            await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true", {
                timeout: 30_000,
            });
            const sourceId = new URL(page.url()).hash.split("/").at(-1)!;
            const sourceContent = filesystem ? await readFile(path.join(workspace, "Research.md"), "utf8") : "";
            await page.getByRole("button", { name: "Next page", exact: true }).click();
            await expect(page.getByLabel("PDF page 2", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
            await selectPdfPhrase(page);
            await page.getByRole("button", { name: "Send selection to note", exact: true }).click();
            const dialog = page.getByRole("dialog", { name: "Send selection to note", exact: true });
            await dialog.getByRole("button", { name: "Create a note", exact: true }).click();
            await dialog.getByLabel("Destination note title", { exact: true }).fill("Research writing");
            await dialog.getByRole("button", { name: "Send excerpt", exact: true }).click();
            await expect(page.locator(".ProseMirror")).toContainText("Landscape research phrase");
            const destinationId = new URL(page.url()).hash.split("/").at(-1)!;
            await page.reload();
            await expect(page.locator(".ProseMirror")).toContainText("Research, p. 2");
            await page.getByRole("link", { name: "Open source", exact: true }).click();
            await expect(page.getByLabel("Go to page", { exact: true })).toHaveValue("2");
            await page.getByRole("button", { name: "Previous page", exact: true }).click();
            await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveAttribute("data-pdf-ready", "true");
            await page.getByRole("button", { name: "Select page text", exact: true }).click();
            await dialog.getByLabel("Destination note", { exact: true }).selectOption(destinationId);
            await dialog.getByRole("button", { name: "Send excerpt", exact: true }).click();
            await expect(page.locator(".ProseMirror blockquote")).toHaveCount(2);
            await page.reload();
            await expect(page.locator(".ProseMirror blockquote")).toHaveCount(2);
            if (filesystem) {
                const writing = await readFile(path.join(workspace, "research-writing.md"), "utf8");
                expect(writing).toContain(`Open source](/note/${sourceId}?research=1`);
                expect(writing).toContain("page=2&pdf=");
                expect(writing).toContain("Portrait research phrase");
                expect(await readFile(path.join(workspace, "Research.md"), "utf8")).toBe(sourceContent);
                expect(await readFile(path.join(workspace, "attachments", sourceId, "document.pdf"))).toEqual(
                    researchPdf(),
                );
            }
            await page.screenshot({ path: testInfo.outputPath("native-research-excerpts.png") });
        } finally {
            await application.close();
            await rm(profile, { recursive: true, force: true });
        }
    });
}
