import type { Page } from "@playwright/test";
import { resolve } from "node:path";
import { expect, goHome, test } from "./fixtures";

test.use({
    viewport: { width: 1440, height: 900 },
    video: { mode: "on", size: { width: 1440, height: 900 } },
    actionTimeout: 10_000,
});

test.skip(process.env.RECORD_COMPLETION_DEMO !== "1", "Run with RECORD_COMPLETION_DEMO=1 to record the walkthrough");

async function caption(page: Page, title: string, action: string, detail = ""): Promise<void> {
    await page.evaluate(
        ({ title, action, detail }) => {
            let panel = document.getElementById("playwright-demo-caption");
            if (!panel) {
                panel = document.createElement("aside");
                panel.id = "playwright-demo-caption";
                Object.assign(panel.style, {
                    position: "fixed",
                    top: "64px",
                    right: "24px",
                    zIndex: "99999",
                    width: "370px",
                    padding: "18px 22px",
                    borderRadius: "12px",
                    pointerEvents: "none",
                    background: "var(--var-color-secondary-background)",
                    color: "var(--var-color-foreground)",
                    border: "1px solid var(--var-color-border)",
                    boxShadow: "0 8px 28px rgba(0,0,0,.2)",
                    fontFamily: "system-ui, sans-serif",
                    lineHeight: "1.5",
                });
                document.body.append(panel);
            }
            const heading = document.createElement("strong");
            heading.textContent = title;
            heading.style.fontSize = "16px";
            const instruction = document.createElement("div");
            instruction.textContent = action;
            Object.assign(instruction.style, { marginTop: "8px", fontSize: "15px" });
            const note = document.createElement("div");
            note.textContent = detail;
            Object.assign(note.style, { marginTop: "8px", fontSize: "12px", opacity: ".75" });
            panel.replaceChildren(heading, instruction, ...(detail ? [note] : []));
        },
        { title, action, detail },
    );
}

async function typeSlowly(page: Page, text: string): Promise<void> {
    await page.keyboard.type(text, { delay: 90 });
}

async function createDemoNote(page: Page, title: string): Promise<string> {
    await page
        .getByRole("main")
        .getByRole("button", { name: /^New note/ })
        .first()
        .click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    const input = dialog.getByTitle("Note title");
    await expect(input).toBeVisible();
    await page.waitForTimeout(600);
    await input.fill(title);
    await expect(input).toHaveValue(title);
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);
    await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toBeVisible();
    return page.url();
}

async function mockWorkspaceFiles(page: Page): Promise<void> {
    await page.evaluate(() => {
        Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Electron" });
        Object.defineProperty(window, "electronAPI", {
            configurable: true,
            value: {
                fs: {
                    readDirRecursive: async (root: string, _depth: number, includeAllFiles: boolean) => {
                        if (root !== "/demo-workspace" || !includeAllFiles)
                            throw new Error("Unexpected workspace scan");
                        Reflect.deleteProperty(navigator, "userAgent");
                        Reflect.deleteProperty(window, "electronAPI");
                        await new Promise((resolve) => window.setTimeout(resolve, 600));
                        return {
                            success: true,
                            files: [
                                {
                                    name: "logo.svg",
                                    path: "/demo-workspace/public/logo.svg",
                                    relativePath: "public/logo.svg",
                                },
                                {
                                    name: "logo.svg",
                                    path: "/demo-workspace/src/icons/logo.svg",
                                    relativePath: "src/icons/logo.svg",
                                },
                                {
                                    name: "roadmap.md",
                                    path: "/demo-workspace/notes/roadmap.md",
                                    relativePath: "notes/roadmap.md",
                                },
                                {
                                    name: "settings.ts",
                                    path: "/demo-workspace/src/settings.ts",
                                    relativePath: "src/settings.ts",
                                },
                            ],
                        };
                    },
                },
            },
        });
    });
}

async function restoreBrowserEnvironment(page: Page): Promise<void> {
    await page.evaluate(() => {
        Reflect.deleteProperty(navigator, "userAgent");
        Reflect.deleteProperty(window, "electronAPI");
    });
}

test("human-paced autocomplete walkthrough", async ({ cleanPage: setupPage, context }, testInfo) => {
    test.setTimeout(180_000);
    await goHome(setupPage);
    await setupPage.evaluate(async () => {
        const request = indexedDB.open("writeme");
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        const tx = db.transaction("settings", "readwrite");
        const store = tx.objectStore("settings");
        const read = store.getAll();
        read.onsuccess = () => {
            const existing = read.result.find((entry) => entry.name === "directory");
            store.put({
                ...existing,
                id: existing?.id ?? "demo-directory",
                name: "directory",
                value: JSON.stringify("/demo-workspace"),
                type: "setting",
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        };
        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    });
    await setupPage.reload();
    await createDemoNote(setupPage, "Workspace reference");
    const setupEditor = setupPage.getByRole("textbox", { name: "Note editor", exact: true });
    await setupEditor.click();
    await setupPage.keyboard.type("## Heading in another note");
    await setupPage.keyboard.press("Enter");
    await setupPage.keyboard.type("#workspace-tag");
    await expect(setupPage.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", {
        timeout: 15_000,
    });
    await goHome(setupPage);
    const noteUrl = await createDemoNote(setupPage, "Autocomplete walkthrough");
    await setupEditor.click();
    await setupPage.keyboard.type("## Planning");
    await setupPage.keyboard.press("Enter");
    await setupPage.keyboard.type("## Release checklist");
    await setupPage.keyboard.press("Enter");
    await setupPage.keyboard.type("Try autocomplete here: planner.");
    await expect(setupPage.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", {
        timeout: 15_000,
    });

    await setupPage.evaluate(async () => {
        const request = indexedDB.open("writeme");
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        const tx = db.transaction("notes", "readwrite");
        const store = tx.objectStore("notes");
        const read = store.getAll();
        read.onsuccess = () => {
            for (const note of read.result) store.put({ ...note, project: "/demo-workspace" });
        };
        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    });

    await setupPage.close();
    const page = await context.newPage();
    await page.bringToFront();
    const video = page.video();
    if (!video) throw new Error("Playwright video recording is disabled");
    const chapter = "artifacts/playwright/autocomplete-demo";
    const headingMenu = page.getByRole("listbox", { name: "Heading and tag suggestions" });
    const fileMenu = page.getByRole("listbox", { name: "Workspace file suggestions" });
    try {
        await page.goto(noteUrl);
        const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
        await expect(editor.getByRole("heading", { name: "Planning", exact: true })).toBeVisible();
        await editor.click();
        await expect(editor).toBeFocused();
        await caption(
            page,
            "Ctrl+Space autocomplete",
            "Headings, workspace tags, and workspace files.",
            "A real Playwright run, paced for watching.",
        );
        await page.waitForTimeout(2800);
        await editor.locator("p").last().click();
        await editor.evaluate((element) => {
            const view = element as HTMLElement & { editor: { commands: { focus: (position: "end") => void } } };
            view.editor.commands.focus("end");
        });
        await page.keyboard.press("Enter");

        await caption(page, "1 / 6 · Document headings", "Type #Pla. Suggestions wait for Ctrl+Space.");
        await typeSlowly(page, "Link to #Pla");
        await expect(editor.locator("p").last()).toHaveText("Link to #Pla");
        await expect(headingMenu).toBeHidden();
        await page.waitForTimeout(1400);
        await caption(page, "1 / 6 · Document headings", "Ctrl+Space opens matching headings.");
        await page.keyboard.press("Control+Space");
        await expect(headingMenu.getByRole("option", { name: /Planning/ })).toBeVisible();
        await page.waitForTimeout(2800);
        await caption(page, "1 / 6 · Document headings", "Tab accepts the heading as a section link.");
        await page.keyboard.press("Tab");
        await expect(editor.getByRole("link", { name: "Planning", exact: true })).toHaveAttribute("href", "#planning");
        await page.waitForTimeout(2200);
        await page.screenshot({ path: resolve(`${chapter}-heading.png`) });
        await page.keyboard.press("Enter");

        await caption(
            page,
            "2 / 6 · Workspace tags",
            "# offers local headings and tags from other notes.",
            "The tag comes from the Workspace reference note.",
        );
        await typeSlowly(page, "Tag #");
        await page.keyboard.press("Control+Space");
        await expect(headingMenu.getByRole("option", { name: /#workspace-tag/ })).toBeVisible();
        await expect(headingMenu.getByRole("option", { name: /Heading in another note/ })).toHaveCount(0);
        await page.waitForTimeout(3000);
        await caption(page, "2 / 6 · Workspace tags", "Keep typing to filter: workspace.");
        await typeSlowly(page, "workspace");
        await expect(headingMenu.getByRole("option")).toHaveCount(1);
        await page.waitForTimeout(2400);
        await caption(page, "2 / 6 · Workspace tags", "Enter inserts #workspace-tag.");
        await page.keyboard.press("Enter");
        await expect(editor).toContainText("Tag #workspace-tag");
        await page.waitForTimeout(2200);
        await page.keyboard.press("Enter");

        await caption(page, "3 / 6 · Dismiss suggestions", "Type #Rel, then Ctrl+Space.");
        await typeSlowly(page, "Draft #Rel");
        await page.keyboard.press("Control+Space");
        await expect(headingMenu.getByRole("option", { name: /Release checklist/ })).toBeVisible();
        await page.waitForTimeout(2500);
        await caption(page, "3 / 6 · Dismiss suggestions", "Escape closes the menu and keeps your text.");
        await page.keyboard.press("Escape");
        await expect(headingMenu).toBeHidden();
        await expect(editor).toContainText("Draft #Rel");
        await page.waitForTimeout(2200);
        await page.keyboard.press("Enter");

        await caption(
            page,
            "4 / 6 · Workspace files",
            "Type @logo. Ctrl+Space searches workspace files.",
            "Electron filesystem responses are mocked for this browser test.",
        );
        await typeSlowly(page, "Asset @logo");
        await expect(fileMenu).toBeHidden();
        await page.waitForTimeout(1400);
        await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", {
            timeout: 15_000,
        });
        await mockWorkspaceFiles(page);
        await page.keyboard.press("Control+Space");
        await expect(fileMenu.getByRole("option")).toHaveCount(2);
        await restoreBrowserEnvironment(page);
        await page.waitForTimeout(2800);
        await caption(
            page,
            "4 / 6 · Workspace files",
            "ArrowDown selects the file in src/icons.",
            "Folder paths distinguish files with the same name.",
        );
        await page.keyboard.press("ArrowDown");
        await expect(fileMenu.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
        await page.waitForTimeout(2200);
        await caption(page, "4 / 6 · Workspace files", "Enter inserts the selected file reference.");
        await page.keyboard.press("Enter");
        await expect(editor.locator('[data-type="mention"]')).toHaveAttribute("data-path", "src/icons/logo.svg");
        await page.waitForTimeout(2400);
        await page.screenshot({ path: resolve(`${chapter}-files.png`) });
        await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", {
            timeout: 15_000,
        });

        await page.keyboard.press("Enter");
        await caption(
            page,
            "5 / 6 · Document words",
            "Type pla without a prefix, then Ctrl+Space.",
            "Words come from the current document, including unsaved text.",
        );
        await typeSlowly(page, "Word: pla");
        const wordMenu = page.getByRole("listbox", { name: "Document word suggestions" });
        await expect(wordMenu).toBeHidden();
        await page.waitForTimeout(1400);
        await page.keyboard.press("Control+Space");
        await expect(wordMenu.getByRole("option", { name: "Planning Word", exact: true })).toBeVisible();
        await expect(wordMenu.getByRole("option", { name: "planner Word", exact: true })).toBeVisible();
        await page.waitForTimeout(2800);
        await caption(page, "5 / 6 · Document words", "ArrowDown chooses Planning; Tab inserts plain text.");
        await page.keyboard.press("ArrowDown");
        await expect(wordMenu.getByRole("option", { name: "Planning Word", exact: true })).toHaveAttribute(
            "aria-selected",
            "true",
        );
        await page.waitForTimeout(2200);
        await page.keyboard.press("Tab");
        await expect(editor).toContainText("Word: Planning");
        await page.waitForTimeout(2400);
        await page.screenshot({ path: resolve(`${chapter}-words.png`) });
        await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", {
            timeout: 15_000,
        });

        await caption(page, "6 / 6 · Markdown mode", "The same Ctrl+Space shortcuts work in Markdown.");
        await page
            .getByRole("toolbar", { name: "Note tools" })
            .getByRole("button", { name: "Markdown", exact: true })
            .click();
        const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
        await expect(raw).toBeVisible();
        await page.waitForTimeout(2200);
        await raw.locator(".cm-line").last().click();
        await page.keyboard.press(process.platform === "darwin" ? "Meta+End" : "Control+End");
        await typeSlowly(page, "\n\nMarkdown link: #Rel");
        await page.keyboard.press("Control+Space");
        await expect(headingMenu.getByRole("option", { name: /Release checklist/ })).toBeVisible();
        await page.waitForTimeout(2800);
        await caption(page, "6 / 6 · Markdown mode", "ArrowDown chooses the heading; Enter inserts its link.");
        await page.keyboard.press("ArrowDown");
        await expect(headingMenu.getByRole("option", { name: /Release checklist/ })).toHaveAttribute(
            "aria-selected",
            "true",
        );
        await page.waitForTimeout(2200);
        await page.keyboard.press("Enter");
        await expect(raw).toContainText("[Release checklist](#release-checklist)");
        await page.waitForTimeout(2400);
        await typeSlowly(page, "\nWorkspace tag: #work");
        await caption(page, "6 / 6 · Markdown mode", "Ctrl+Space also completes workspace tags.");
        await page.keyboard.press("Control+Space");
        await expect(headingMenu.getByRole("option", { name: /#workspace-tag/ })).toBeVisible();
        await page.waitForTimeout(2500);
        await page.keyboard.press("Tab");
        await expect(raw).toContainText("Workspace tag: #workspace-tag");
        await page.waitForTimeout(2200);
        await caption(page, "6 / 6 · Markdown mode", "Without a prefix, Ctrl+Space suggests document words.");
        await typeSlowly(page, "\nDocument word: pla");
        await page.keyboard.press("Control+Space");
        await expect(wordMenu.getByRole("option", { name: "planner Word", exact: true })).toBeVisible();
        await page.waitForTimeout(2800);
        await caption(page, "6 / 6 · Markdown mode", "Enter inserts planner as plain text.");
        await page.keyboard.press("Enter");
        await expect(raw).toContainText("Document word: planner");
        await page.waitForTimeout(2400);
        await page.screenshot({ path: resolve(`${chapter}-markdown.png`) });
        await caption(
            page,
            "Autocomplete checks passed",
            "Ctrl+Space opens · arrows navigate · Enter/Tab select · Escape dismisses.",
            "No prefix = document words. # = document headings + workspace tags. @ = workspace files.",
        );
        await page.waitForTimeout(4000);
    } finally {
        await page.close();
        const videoPath = resolve(`${chapter}.webm`);
        await video.saveAs(videoPath);
        await testInfo.attach("Autocomplete walkthrough", { path: videoPath, contentType: "video/webm" });
    }
});
