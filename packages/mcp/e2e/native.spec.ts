import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

for (const filesystem of [false, true]) {
    test(`actual stdio reads native saved ${filesystem ? "filesystem" : "SQLite"} state, excludes unsaved edits, survives app shutdown`, async ({
        playwright,
    }, testInfo) => {
        const directory = await mkdtemp(path.join(tmpdir(), "writeme-mcp-native-"));
        const workspace = path.join(directory, "workspace");
        await mkdir(workspace);
        const bootstrap = path.join(directory, "bootstrap.cjs");
        const resources = process.platform === "darwin" ? "writeme.app/Contents/Resources" : "resources";
        const entry =
            process.env.MCP_NATIVE_ENTRY ??
            path.resolve(
                testDirectory,
                `../../../out/writeme-${process.platform}-${process.arch}/${resources}/app.asar/.vite/build/main.js`,
            );
        await writeFile(
            bootstrap,
            `const {app}=require('electron'); app.setPath('appData',${JSON.stringify(directory)}); app.setPath('userData',${JSON.stringify(directory)}); require(${JSON.stringify(entry)});`,
        );
        const application = await playwright._electron.launch({
            args: [bootstrap, "--no-sandbox"],
            env: { ...process.env, NODE_ENV: "production" },
        });
        const client = new Client({ name: "native-acceptance", version: "1.0.0" });
        let closed = false;
        try {
            const page = await application.firstWindow();
            const mainWindow = await application.browserWindow(page);
            await mainWindow.evaluate((window) => window.setSize(1280, 900));
            await expect(
                page.getByRole("heading", { name: "Your notes, ready when you are." }),
            ).toBeVisible();
            const dataDir = await application.evaluate(({ app }) => app.getPath("userData"));
            expect(dataDir.startsWith(directory + path.sep)).toBe(true);
            if (filesystem) {
                await application.evaluate(({ dialog }, folder) => {
                    dialog.showOpenDialog = async () => ({
                        canceled: false,
                        filePaths: [folder],
                    });
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
            await page
                .getByRole("main")
                .getByRole("button", { name: /^New note/ })
                .first()
                .click();
            const dialog = page.getByRole("dialog", { name: /Create new note/i });
            const title = dialog.getByTitle("Note title");
            await title.fill("MCP acceptance");
            await title.press("Tab");
            await page.screenshot({ path: testInfo.outputPath("create-note.png") });
            await writeFile(testInfo.outputPath("create-note.txt"), await page.locator("body").innerText());
            await page.locator("form button[type=submit]").click();
            await expect(dialog).toBeHidden();
            const savedEditor = page.locator(".ProseMirror").first();
            await savedEditor.pressSequentially("Saved acceptance marker.");
            await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", {
                timeout: 15_000,
            });
            await page.evaluate(async () => {
                await window.electronAPI.db.save("settings", {
                    id: "autosave",
                    name: "autosave",
                    value: "false",
                    type: "setting",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            });
            await page.reload();
            const editor = page.locator(".ProseMirror").first();
            await expect(editor).toContainText("Saved acceptance marker.");
            await editor.press("End");
            await editor.pressSequentially(" UNSAVED_PRIVATE_MARKER");
            await expect(editor).toContainText("UNSAVED_PRIVATE_MARKER");
            await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText(
                "Unsaved changes",
            );
            await client.connect(
                new StdioClientTransport({
                    command: process.env.MCP_BUN ?? "bun",
                    args: [
                        process.env.MCP_STDIO_ENTRY ?? path.resolve(testDirectory, "../src/index.ts"),
                        "--data-dir",
                        dataDir,
                    ],
                }),
            );
            const listed = await client.callTool({
                name: "list_notes",
                arguments: {},
            });
            const notes = listed.structuredContent?.items as {
                ref: string;
                title: string;
            }[];
            const note = notes.find((item) => item.title === "MCP acceptance");
            expect(note).toBeDefined();
            const read = async (): Promise<unknown> =>
                (
                    await client.callTool({
                        name: "get_note",
                        arguments: { ref: note!.ref, format: "content", raw: true },
                    })
                ).structuredContent;
            const open = await read();
            expect(JSON.stringify(open)).toContain("Saved acceptance marker.");
            expect(JSON.stringify(open)).not.toContain("UNSAVED_PRIVATE_MARKER");
            const settings = await client.callTool({
                name: "get_settings",
                arguments: {},
            });
            expect(settings.structuredContent?.items).toContainEqual(
                expect.objectContaining({ key: "autosave", value: false }),
            );
            await page.screenshot({
                path: testInfo.outputPath("unsaved-editor.png"),
            });
            await application.close();
            closed = true;
            const hashes = async (): Promise<Record<string, string>> => {
                const databaseFiles = (await readdir(dataDir))
                    .filter((name) => name.startsWith("writeme.sqlite"))
                    .map((name) => path.join(dataDir, name));
                const noteFiles = (await readdir(workspace))
                    .filter((name) => name.endsWith(".md"))
                    .map((name) => path.join(workspace, name));
                if (filesystem) expect(noteFiles.length).toBeGreaterThan(0);
                return Object.fromEntries(
                    await Promise.all(
                        [...databaseFiles, ...noteFiles].map(async (file) => [
                            path.relative(directory, file),
                            createHash("sha256")
                                .update(await readFile(file))
                                .digest("hex"),
                        ]),
                    ),
                );
            };
            const before = await hashes();
            const afterClose = await read();
            expect(JSON.stringify(afterClose)).toContain("Saved acceptance marker.");
            expect(JSON.stringify(afterClose)).not.toContain("UNSAVED_PRIVATE_MARKER");
            expect(await hashes()).toEqual(before);
            await writeFile(
                testInfo.outputPath("stdio-results.json"),
                JSON.stringify(
                    {
                        open,
                        settings: settings.structuredContent,
                        afterClose,
                        before,
                        after: await hashes(),
                    },
                    null,
                    2,
                ),
            );
        } finally {
            await client.close();
            if (!closed) {
                const remainingPage = application.windows()[0];
                if (remainingPage) {
                    await remainingPage
                        .screenshot({ path: testInfo.outputPath("final-editor.png") })
                        .catch(() => undefined);
                    await writeFile(
                        testInfo.outputPath("final-editor.txt"),
                        await remainingPage
                            .locator("body")
                            .innerText()
                            .catch(() => "unavailable"),
                    );
                }
                await application.close();
            }
            await rm(directory, { recursive: true, force: true });
        }
    });
}
