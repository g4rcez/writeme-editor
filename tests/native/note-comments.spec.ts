import { expect, test } from "@playwright/test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Note } from "../../packages/editor/src/store/note";
import { createNote } from "../e2e/fixtures";
import { addNoteComment, selectCommentWords } from "../helpers/comments";

for (const filesystem of [false, true]) {
    test(`persists sentence comments in compiled Electron (${filesystem ? "filesystem" : "SQLite"})`, async ({
        playwright,
    }, testInfo) => {
        const directory = await mkdtemp(path.join(tmpdir(), "writeme-comments-native-"));
        const folder = path.join(directory, "workspace", "plans");
        await mkdir(folder, { recursive: true });
        if (filesystem) await writeFile(path.join(folder, "advisor.md"), "Review native sentence.\n");
        const bootstrap = path.join(directory, "bootstrap.cjs");
        const resources = process.platform === "darwin" ? "writeme.app/Contents/Resources" : "resources";
        const entry =
            process.env.COMMENTS_NATIVE_ENTRY ??
            `out/writeme-${process.platform}-${process.arch}/${resources}/app.asar/.vite/build/main.js`;
        await writeFile(
            bootstrap,
            `const { app } = require("electron");\napp.setPath("appData", ${JSON.stringify(directory)});\napp.setPath("userData", ${JSON.stringify(directory)});\nrequire(${JSON.stringify(path.resolve(entry))});\n`,
        );
        const application = await playwright._electron.launch({
            args: [bootstrap, "--no-sandbox"],
            env: { ...process.env, NODE_ENV: "production" },
        });
        try {
            const page = await application.firstWindow();
            const mainWindow = await application.browserWindow(page);
            await mainWindow.evaluate((window) => window.setSize(1280, 900));
            await expect(page).toHaveURL(/^file:/);
            expect(
                (await application.evaluate(({ app }) => app.getPath("userData"))).startsWith(directory + path.sep),
            ).toBe(true);
            await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
            if (filesystem) {
                await application.evaluate(({ dialog }, folder) => {
                    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
                }, folder);
                const source = Note.new("advisor", "Review native sentence.\n");
                source.filePath = path.join(folder, "advisor.md");
                source.lastSynced = new Date();
                await page.evaluate(async (source) => {
                    const selected = await window.electronAPI.fs.chooseDirectory();
                    await window.electronAPI.db.save("settings", {
                        id: "directory",
                        name: "directory",
                        value: JSON.stringify(selected),
                        type: "setting",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });
                    await window.electronAPI.db.save("notes", source);
                }, source);
                await page.reload();
            }
            if (filesystem) {
                await page.getByRole("main").getByText("advisor", { exact: true }).click();
                await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toContainText(
                    "Review native sentence.",
                );
            } else {
                await createNote(page, "advisor", "Review native sentence.");
            }
            await selectCommentWords(page, "Review native sentence.");
            await addNoteComment(page, "Native first comment");
            const panel = page.getByRole("complementary", { name: "Sentence comments" });
            await panel.getByRole("button", { name: "Reply", exact: true }).click();
            await panel.getByRole("textbox", { name: "Comment", exact: true }).fill("Native reply");
            await panel.getByRole("button", { name: "Save comment", exact: true }).click();
            await expect(panel.getByRole("list", { name: "Comments on this text" }).getByRole("listitem")).toHaveCount(
                2,
            );
            await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved");
            await page.clock.setFixedTime(new Date("2026-10-15T00:00:00.000Z"));
            await panel.getByRole("button", { name: "Resolve", exact: true }).click();
            await expect(panel).toContainText("Status: resolved");
            await page.reload();
            await page
                .getByRole("textbox", { name: "Note editor", exact: true })
                .getByRole("link", { name: "Review native sentence." })
                .click();
            await expect(panel).toContainText("Native reply");
            await expect(panel).toContainText("Status: resolved");
            if (filesystem) {
                expect(await readFile(path.join(folder, "comments_advisor.md"), "utf8")).toContain("- Native reply");
                expect(await readFile(path.join(folder, "advisor.md"), "utf8")).toContain(
                    "[==Review native sentence.==](./comments_advisor.md#review-native-sentence)",
                );
                const referencePath = path.join(folder, "comments_advisor.md");
                const content = await readFile(referencePath, "utf8");
                expect(content).toContain("writeme-comment-status: resolved");
                await writeFile(referencePath, content.replace("status: resolved", "status: unresolved"));
                await page.reload();
                await page
                    .getByRole("textbox", { name: "Note editor", exact: true })
                    .getByRole("link", { name: "Review native sentence." })
                    .click();
                await expect(panel).toContainText("Status: unresolved");
                await panel.getByRole("button", { name: "Resolve", exact: true }).click();
                await expect(panel).toContainText("Status: resolved");
            }
            await page.clock.setFixedTime(new Date("2026-10-14T00:00:00.000Z"));
            await panel.getByRole("button", { name: "Reopen", exact: true }).click();
            await expect(panel).toContainText("Status: unresolved");
            const statusHistory = await page.evaluate(async () => {
                const notes = await window.electronAPI.db.getAll("notes");
                const companion = notes.find((note: Note) => typeof note.metadata?.commentSourceId === "string");
                if (!companion) throw new Error("Companion missing after clock correction");
                return companion.content;
            });
            expect(statusHistory).toContain("writeme-comment-status: unresolved");
            expect(statusHistory).toContain(`"at":"2026-10-15T00:00:00.00${filesystem ? 2 : 1}Z"`);
            await page.evaluate(async () => {
                const notes = await window.electronAPI.db.getAll("notes");
                const source = notes.find((note: Note) => !note.metadata?.commentSourceId);
                if (!source) throw new Error("Source note missing");
                const filePath = source.filePath?.replace(/advisor\.md$/, "renamed-advisor.md") ?? null;
                if (source.filePath && filePath) {
                    const moved = await window.electronAPI.fs.moveFile(source.filePath, filePath);
                    if (!moved.success) throw new Error(moved.error);
                }
                await window.electronAPI.db.save("notes", {
                    ...source,
                    title: "Renamed advisor",
                    filePath,
                    updatedAt: new Date(),
                });
            });
            await page.reload();
            await expect(page.getByRole("button", { name: "Comments (1)", exact: true })).toBeVisible();
            await page
                .getByRole("textbox", { name: "Note editor", exact: true })
                .getByRole("link", { name: "Review native sentence." })
                .click();
            await expect(panel).toContainText("Native reply");
            await expect(panel).toContainText("Status: unresolved");
            await panel.getByRole("button", { name: "Resolve", exact: true }).click();
            await expect(panel).toContainText("Status: resolved");
            await page.reload();
            await page
                .getByRole("textbox", { name: "Note editor", exact: true })
                .getByRole("link", { name: "Review native sentence." })
                .click();
            await expect(panel).toContainText("Status: resolved");
            await page.screenshot({ path: testInfo.outputPath("native-comments.png") });
        } finally {
            await application.close();
            await rm(directory, { recursive: true, force: true });
        }
    });
}
