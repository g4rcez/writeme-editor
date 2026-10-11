import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("completes headings, tags, words and real workspace files in compiled Electron", async ({
    playwright,
}, testInfo) => {
    const directory = await mkdtemp(path.join(tmpdir(), "writeme-autocomplete-native-"));
    const workspace = path.join(directory, "workspace");
    const assetPath = 'docs/Asset [1] #x "draft".svg';
    await mkdir(path.join(workspace, "docs"), { recursive: true });
    await writeFile(path.join(workspace, assetPath), "<svg></svg>");
    await writeFile(path.join(workspace, "reference.md"), "# Other heading\n\n#project/topic\n");
    const bootstrap = path.join(directory, "bootstrap.cjs");
    const buildRoot = path.resolve(process.env.COMPLETION_ELECTRON_BUILD_ROOT ?? ".vite");
    await writeFile(
        bootstrap,
        `const { app } = require("electron");\napp.setPath("appData", ${JSON.stringify(directory)});\napp.setPath("userData", ${JSON.stringify(directory)});\nrequire(${JSON.stringify(path.join(buildRoot, "build/main.js"))});\n`,
    );
    const application = await playwright._electron.launch({
        args: [bootstrap, "--no-sandbox"],
        env: { ...process.env, NODE_ENV: "production" },
    });
    try {
        expect(
            (await application.evaluate(({ app }) => app.getPath("userData"))).startsWith(directory + path.sep),
        ).toBe(true);
        const page = await application.firstWindow();
        await expect(page).toHaveURL(/^file:/);
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        await application.evaluate(({ dialog }, selected) => {
            dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
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
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        await page
            .getByRole("main")
            .getByRole("button", { name: /^New note/ })
            .first()
            .click();
        const dialog = page.getByRole("dialog", { name: /Create new note/i });
        await expect(async () => {
            await dialog.getByTitle("Note title").fill("Native completion");
            await dialog.getByRole("button", { name: /^Create/ }).click();
            await expect(dialog).toBeHidden({ timeout: 1000 });
        }).toPass({ timeout: 6000 });
        const formatted = page.getByRole("textbox", { name: "Note editor", exact: true });
        await formatted.click();
        await expect(formatted).toBeFocused();
        await page.keyboard.type("## Local section");
        await page.keyboard.press("Enter");
        await page.keyboard.type("Vocabulary planner");
        await page.keyboard.press("Enter");
        for (const mode of ["Formatted", "Markdown"] as const) {
            if (mode === "Markdown") {
                await page
                    .getByRole("toolbar", { name: "Note tools" })
                    .getByRole("button", { name: mode, exact: true })
                    .click();
            }
            const editor = page.getByRole("textbox", {
                name: mode === "Formatted" ? "Note editor" : "Markdown note editor",
                exact: true,
            });
            await editor.click();
            await page.keyboard.press("Meta+End");
            await page.keyboard.press("Enter");
            await page.keyboard.type("Section #Loc");
            await page.keyboard.press("Control+Space");
            const tags = page.getByRole("listbox", { name: "Heading and tag suggestions" });
            await expect(tags.getByRole("option", { name: /Local section/ })).toBeVisible();
            await expect(tags.getByRole("option", { name: /Other heading/ })).toHaveCount(0);
            await page.keyboard.press("Tab");
            await expect(editor).toContainText(
                mode === "Formatted" ? "Section Local section" : "Section [Local section](#local-section)",
            );
            await page.keyboard.press("Enter");
            await page.keyboard.type("Tag #proj");
            await page.keyboard.press("Control+Space");
            await expect(tags.getByRole("option", { name: /#project\/topic/ })).toBeVisible();
            await page.keyboard.press("Enter");
            await expect(editor).toContainText("Tag #project/topic");
            await page.keyboard.press("Enter");
            await page.keyboard.type("File @Asset");
            const files = page.getByRole("listbox", { name: "Workspace file suggestions" });
            await expect(files).toBeHidden();
            await page.keyboard.press("Control+Space");
            await expect(files.getByRole("option", { name: /Asset \[1\]/ })).toBeVisible();
            await page.keyboard.press("Enter");
            await expect(editor).toContainText("Asset");
            if (mode === "Formatted")
                await expect(editor.locator('[data-type="mention"]')).toHaveAttribute("data-path", assetPath);
            await page.keyboard.press("Enter");
            await page.keyboard.type("Word pla");
            await page.keyboard.press("Control+Space");
            await expect(
                page
                    .getByRole("listbox", { name: "Document word suggestions" })
                    .getByRole("option", { name: "planner Word", exact: true }),
            ).toBeVisible();
            await page.keyboard.press("Tab");
            await expect(editor).toContainText("Word planner");
            await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", {
                timeout: 15_000,
            });
            await page.screenshot({ path: testInfo.outputPath(`native-${mode.toLowerCase()}.png`) });
        }
        await page.evaluate(() => {
            document.documentElement.dataset.completionFileChanged = "false";
            window.electronAPI.fs.onDirChanged(() => {
                document.documentElement.dataset.completionFileChanged = "true";
            });
        });
        await writeFile(path.join(workspace, "NewAsset.svg"), "<svg></svg>");
        await expect(page.locator("html")).toHaveAttribute("data-completion-file-changed", "true");
        await page.keyboard.press("Enter");
        await page.keyboard.type("New file @NewAsset");
        await page.keyboard.press("Control+Space");
        await expect(
            page
                .getByRole("listbox", { name: "Workspace file suggestions" })
                .getByRole("option", { name: /NewAsset.svg/ }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", {
            timeout: 15_000,
        });
        await page
            .getByRole("toolbar", { name: "Note tools" })
            .getByRole("button", { name: "Formatted", exact: true })
            .click();
        await page.reload();
        await expect(formatted.locator('[data-type="mention"]')).toHaveCount(2);
        await expect(formatted.locator('[data-type="mention"]').first()).toHaveAttribute("data-path", assetPath);
        await expect(formatted.getByRole("link", { name: "Local section", exact: true })).toHaveCount(2);
        const documents = await readdir(workspace);
        const saved = documents.find((filename) => filename.endsWith(".md") && filename !== "reference.md");
        expect(saved).toBeDefined();
        expect(await readFile(path.join(workspace, saved!), "utf8")).toContain(
            "docs/Asset%20%5B1%5D%20%23x%20%22draft%22.svg",
        );
    } finally {
        await application.close();
        await rm(directory, { recursive: true, force: true });
    }
});
