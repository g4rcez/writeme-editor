import { _electron as electron, expect, test, type ElectronApplication } from "@playwright/test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("shows workspace file status and Markdown tags in the native note context drawer", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "writeme-context-native-"));
    const workspace = path.join(directory, "workspace");
    const bootstrap = path.join(directory, "bootstrap.cjs");
    const resources = process.platform === "darwin" ? "writeme.app/Contents/Resources" : "resources";
    const entry =
        process.env.CONTEXT_NATIVE_ENTRY ??
        `out/writeme-${process.platform}-${process.arch}/${resources}/app.asar/.vite/build/main.js`;
    await writeFile(
        bootstrap,
        `const { app } = require("electron");\napp.setPath("appData", ${JSON.stringify(directory)});\napp.setPath("userData", ${JSON.stringify(directory)});\nrequire(${JSON.stringify(path.resolve(entry))});\n`,
    );
    await mkdir(path.join(workspace, "projects", "splinter"), { recursive: true });
    await mkdir(path.join(workspace, "ai"), { recursive: true });
    await writeFile(path.join(workspace, "projects", "splinter", "README.md"), "# Project\n");
    await writeFile(path.join(workspace, "ai", "maestro.md"), "# Maestro\n");
    const content = [
        '[README.md](projects/splinter/README.md "writeme-mention:file:projects/splinter/README.md")',
        '[maestro.md](ai/maestro.md "writeme-mention:file:ai/maestro.md")',
        '[missing.md](missing.md "writeme-mention:file:missing.md")',
        "",
        "#hashtag",
    ].join("\n\n");
    await mkdir(path.join(workspace, "tests"), { recursive: true });
    await writeFile(path.join(workspace, "tests", "md-playground.md"), content);

    let application: ElectronApplication | undefined;
    try {
        application = await electron.launch({
            args: [bootstrap, "--no-sandbox"],
            env: { ...process.env, NODE_ENV: "production" },
        });
        const page = await application.firstWindow();
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible({
            timeout: 30_000,
        });
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
        await page.evaluate(() => {
            window.location.hash = "/";
        });
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible({
            timeout: 30_000,
        });

        const noteIds = await page.evaluate(({ sourcePath, readmePath }) => {
            return window.electronAPI.db.getAll<{ id: string; filePath: string }>("notes").then((notes) => ({
                sourceId: notes.find((note) => note.filePath === sourcePath)?.id ?? null,
                readmeId: notes.find((note) => note.filePath === readmePath)?.id ?? null,
            }));
        }, {
            sourcePath: path.join(workspace, "tests", "md-playground.md"),
            readmePath: path.join(workspace, "projects", "splinter", "README.md"),
        });
        expect(noteIds.sourceId).not.toBeNull();
        expect(noteIds.readmeId).not.toBeNull();
        expect(noteIds.readmeId).not.toBe(noteIds.sourceId);
        await page.evaluate((id) => {
            window.location.hash = `/note/${id}`;
        }, noteIds.sourceId);
        await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toContainText("#hashtag");
        const context = page.locator(".writeme-context-modal");
        await page.getByRole("button", { name: "Open note context", exact: true }).click();
        await context.getByText("File references", { exact: true }).click();
        await expect(context.getByRole("link", { name: /README\.md/ })).toBeVisible();
        await expect(context.getByRole("link", { name: /maestro\.md/ })).toBeVisible();
        await expect(context.getByRole("link", { name: /missing\.md/ })).toHaveCount(0);
        await expect(context.getByRole("link")).toHaveCount(2);

        const unresolvedSection = context.locator("details").filter({ hasText: "Unresolved references" });
        await unresolvedSection.locator("summary").click();
        await expect(unresolvedSection.locator("summary")).toContainText("1");
        await expect(unresolvedSection.getByText("Missing from workspace", { exact: true })).toBeVisible();
        await expect(unresolvedSection.getByText("missing.md", { exact: true }).first()).toBeVisible();

        await context.getByText("Tags", { exact: true }).click();
        await expect(context.getByText("#hashtag", { exact: true })).toBeVisible();

        const readmeLink = context.getByRole("link", { name: /README\.md/ });
        const readmeHref = await readmeLink.getAttribute("href");
        expect(readmeHref).toBe(`#/note/${noteIds.readmeId}`);
        await readmeLink.click();
        await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(readmeHref);
        await expect(context.locator(".writeme-context-modal-note")).toHaveText("Project", {
            timeout: 15_000,
        });
    } finally {
        await application?.close();
        await rm(directory, { recursive: true, force: true });
    }
});
