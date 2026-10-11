import type { Page } from "@playwright/test";
import { expect, goHome, test } from "./fixtures";

async function newNote(page: Page, title: string): Promise<void> {
    await goHome(page);
    await page
        .getByRole("main")
        .getByRole("button", { name: /^New note/ })
        .first()
        .click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await expect(async () => {
        await dialog.getByTitle("Note title").fill(title);
        await dialog.getByRole("button", { name: /^Create/ }).click();
        await expect(dialog).toBeHidden({ timeout: 1000 });
    }).toPass({ timeout: 6000 });
    await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toBeVisible();
    await expect(page.getByRole("toolbar", { name: "Note tools" })).toContainText(title);
    await page.getByRole("textbox", { name: "Note editor", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toBeFocused();
}

test("opens heading completion with Ctrl+Space and dismisses it with Escape", async ({ cleanPage: page }) => {
    await newNote(page, "Completion source");
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.click();
    await page.keyboard.type("## Local section");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Reference #Lo");
    const menu = page.getByRole("listbox", { name: "Heading and tag suggestions" });
    await expect(menu).toBeHidden();
    await page.keyboard.press("Control+Space");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("option", { name: /Local section/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(editor).toContainText("Reference #Lo");
});

test("waits for Ctrl+Space before completing workspace files", async ({ cleanPage: page }) => {
    await newNote(page, "Target note");
    await newNote(page, "Reference source");
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.click();
    await page.keyboard.type("See @Target");
    await expect(page.getByRole("listbox", { name: "Note and file suggestions" })).toBeHidden();
    await page.keyboard.press("Control+Space");
    const menu = page.getByRole("listbox", { name: "Workspace file suggestions" });
    await expect(menu.getByRole("option", { name: /Target note/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(menu).toBeHidden();
    await expect(editor).toContainText("See Target note");
    await expect(editor).not.toContainText("@Target");
});

test("completes headings as section links and preserves them after reload", async ({ cleanPage: page }) => {
    await newNote(page, "Heading links");
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.click();
    await page.keyboard.type("## Local section");
    await page.keyboard.press("Enter");
    await page.keyboard.type("See #Loc");
    await page.keyboard.press("Control+Space");
    await page.keyboard.press("Tab");
    const link = editor.getByRole("link", { name: "Local section", exact: true });
    await expect(link).toHaveAttribute("href", "#local-section");
    await expect(editor).not.toContainText("#Loc");
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 15_000 });
    await page.reload();
    await expect(link).toHaveAttribute("href", "#local-section");
    const noteUrl = page.url();
    await link.click();
    await expect(page).toHaveURL(noteUrl);
});

test("offers tags from another note and headings only from the current document", async ({ cleanPage: page }) => {
    await newNote(page, "Elsewhere");
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.click();
    await page.keyboard.type("## Other heading");
    await page.keyboard.press("Enter");
    await page.keyboard.type("#shared-topic");
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 15_000 });
    await newNote(page, "Tag consumer");
    await editor.click();
    await page.keyboard.type("Tag #sha");
    await page.keyboard.press("Control+Space");
    const menu = page.getByRole("listbox", { name: "Heading and tag suggestions" });
    await expect(menu.getByRole("option", { name: /#shared-topic/ })).toBeVisible();
    await menu.getByRole("option", { name: /#shared-topic/ }).click();
    await expect(editor).toHaveText("Tag #shared-topic");
    await page.keyboard.type(" #");
    await page.keyboard.press("Control+Space");
    await expect(menu.getByRole("option", { name: /Other heading/ })).toHaveCount(0);
    await expect(menu.getByRole("option", { name: /#shared-topic/ })).toBeVisible();
});

test("filters an open menu, replaces the whole token, and closes on cursor movement", async ({ cleanPage: page }) => {
    await newNote(page, "Editable query");
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.click();
    await page.keyboard.type("## Alpha");
    await page.keyboard.press("Enter");
    await page.keyboard.type("## Beta");
    await page.keyboard.press("Enter");
    await page.keyboard.type("See #Alphasuffix");
    await expect(editor).toContainText("See #Alphasuffix");
    for (let index = 0; index < 6; index++) await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Control+Space");
    const menu = page.getByRole("listbox", { name: "Heading and tag suggestions" });
    await expect(menu.getByRole("option", { name: /Alpha/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(editor).toContainText("See Alpha");
    await expect(editor).not.toContainText("suffix");
    await page.keyboard.type(" #");
    await page.keyboard.press("Control+Space");
    await expect(menu.getByRole("option")).toHaveCount(2);
    await page.keyboard.type("Bet");
    await expect(menu.getByRole("option")).toHaveCount(1);
    await expect(menu.getByRole("option", { name: /Beta/ })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(menu).toBeHidden();
});

test("keeps empty completion non-destructive and ignores code and whitespace", async ({ cleanPage: page }) => {
    await newNote(page, "Completion contexts");
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.click();
    await page.keyboard.type("No trigger ");
    await page.keyboard.press("Control+Space");
    await expect(page.getByRole("listbox", { name: /suggestions/ })).toHaveCount(0);
    await page.keyboard.type(" #zzzzzz");
    await page.keyboard.press("Control+Space");
    const menu = page.getByRole("listbox", { name: "Heading and tag suggestions" });
    await expect(menu.getByText("No suggestions found")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Enter");
    await page.keyboard.type("```");
    await page.keyboard.press("Enter");
    await page.keyboard.type("#zzzzzz");
    await page.keyboard.press("Control+Space");
    await expect(menu).toBeHidden();
    await expect(editor).toContainText("No trigger #zzzzzz");
});

for (const mode of ["Formatted", "Markdown"] as const) {
    test(`offers unsaved document tags without suggesting the active partial tag in ${mode}`, async ({
        cleanPage: page,
    }) => {
        await newNote(page, `${mode} unsaved tags`);
        if (mode === "Markdown")
            await page
                .getByRole("toolbar", { name: "Note tools" })
                .getByRole("button", { name: mode, exact: true })
                .click();
        const editor = page.getByRole("textbox", {
            name: mode === "Markdown" ? "Markdown note editor" : "Note editor",
            exact: true,
        });
        await editor.click();
        await page.keyboard.type("#unsaved-topic");
        await page.keyboard.press("Enter");
        await page.keyboard.type("Use #unsa");
        await page.keyboard.press("Control+Space");
        const menu = page.getByRole("listbox", { name: "Heading and tag suggestions" });
        await expect(menu.getByRole("option", { name: "#unsaved-topic Tag", exact: true })).toBeVisible();
        await expect(menu.getByRole("option", { name: "#unsa Tag", exact: true })).toHaveCount(0);
        await page.keyboard.press("Tab");
        await expect(editor).toContainText("Use #unsaved-topic");
    });

    test(`replaces a filename containing spaces at the middle of the reference in ${mode}`, async ({
        cleanPage: page,
    }) => {
        await newNote(page, "My File.md");
        await newNote(page, `${mode} spaced filename`);
        if (mode === "Markdown")
            await page
                .getByRole("toolbar", { name: "Note tools" })
                .getByRole("button", { name: mode, exact: true })
                .click();
        const editor = page.getByRole("textbox", {
            name: mode === "Markdown" ? "Markdown note editor" : "Note editor",
            exact: true,
        });
        await editor.click();
        await page.keyboard.type("See @My File.md then");
        for (let i = 0; i < 13; i++) await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("Control+Space");
        await expect(
            page.getByRole("listbox").getByRole("option", { name: "My File.md File", exact: true }),
        ).toBeVisible();
        await page.keyboard.press("Tab");
        await expect(editor).not.toContainText("@My");
        if (mode === "Formatted") await expect(editor).toHaveText("See My File.md then");
        else await expect(editor).toContainText(/See \[My File\.md\]\(\/note\/[^)]+\) then/);
    });

    test(`preserves earlier tags, punctuation and undo while completing words in ${mode}`, async ({
        cleanPage: page,
    }) => {
        await newNote(page, `${mode} safe replacement`);
        if (mode === "Markdown")
            await page
                .getByRole("toolbar", { name: "Note tools" })
                .getByRole("button", { name: mode, exact: true })
                .click();
        const editor = page.getByRole("textbox", {
            name: mode === "Markdown" ? "Markdown note editor" : "Note editor",
            exact: true,
        });
        await editor.click();
        await page.keyboard.type("## Work planning");
        await page.keyboard.press("Enter");
        if (mode === "Markdown") await page.keyboard.press("Enter");
        await page.keyboard.type("Continue #work plaSuffix!");
        for (let i = 0; i < 7; i++) await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("Control+Space");
        const words = page.getByRole("listbox", { name: "Document word suggestions" });
        await expect(words.getByRole("option", { name: "planning Word", exact: true })).toBeVisible();
        await page.keyboard.press("Tab");
        await expect(editor).toContainText("Continue #work planning!");
        await expect(editor).not.toContainText("Suffix");
        await page.keyboard.press("ControlOrMeta+z");
        await expect(editor).toContainText("Continue #work plaSuffix!");
    });

    test(`filters multiword headings within an explicitly opened session in ${mode}`, async ({ cleanPage: page }) => {
        await newNote(page, `${mode} multiword headings`);
        if (mode === "Markdown")
            await page
                .getByRole("toolbar", { name: "Note tools" })
                .getByRole("button", { name: mode, exact: true })
                .click();
        const editor = page.getByRole("textbox", {
            name: mode === "Markdown" ? "Markdown note editor" : "Note editor",
            exact: true,
        });
        await editor.click();
        await page.keyboard.type("## Work planning");
        await page.keyboard.press("Enter");
        if (mode === "Markdown") await page.keyboard.press("Enter");
        await page.keyboard.type("See #Work");
        await page.keyboard.press("Control+Space");
        const menu = page.getByRole("listbox", { name: "Heading and tag suggestions" });
        await expect(menu.getByRole("option", { name: "Work planning Heading", exact: true })).toBeVisible();
        await page.keyboard.type(" plan");
        await expect(menu.getByRole("option", { name: "Work planning Heading", exact: true })).toBeVisible();
        await page.keyboard.press("Tab");
        await expect(editor).toContainText(
            mode === "Markdown" ? "See [Work planning](#work-planning)" : "See Work planning",
        );
    });

    test(`completes current-document words in ${mode} mode`, async ({ cleanPage: page }) => {
        await newNote(page, "Other vocabulary");
        const formatted = page.getByRole("textbox", { name: "Note editor", exact: true });
        await formatted.click();
        await page.keyboard.type("platform");
        await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", {
            timeout: 15_000,
        });
        await newNote(page, `${mode} word completion`);
        if (mode === "Markdown") {
            await page
                .getByRole("toolbar", { name: "Note tools" })
                .getByRole("button", { name: mode, exact: true })
                .click();
        }
        const editor = page.getByRole("textbox", {
            name: mode === "Markdown" ? "Markdown note editor" : "Note editor",
            exact: true,
        });
        await editor.click();
        await page.keyboard.type("planning planner Planning plant");
        await page.keyboard.press("Enter");
        await page.keyboard.type("Use plaSuffix!");
        for (let index = 0; index < 7; index++) await page.keyboard.press("ArrowLeft");
        const menu = page.getByRole("listbox", { name: "Document word suggestions" });
        await expect(menu).toBeHidden();
        await page.keyboard.press("Control+Space");
        await expect(menu.getByRole("option", { name: "planning Word", exact: true })).toHaveCount(1);
        await expect(menu.getByRole("option", { name: "planner Word", exact: true })).toBeVisible();
        await expect(menu.getByRole("option", { name: /platform|plaSuffix/ })).toHaveCount(0);
        await page.keyboard.press("ArrowLeft");
        await expect(menu).toBeHidden();
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Control+Space");
        await page.keyboard.type("nn");
        await expect(menu.getByRole("option")).toHaveCount(2);
        await page.keyboard.press("ArrowDown");
        await expect(menu.getByRole("option", { name: "planning Word", exact: true })).toHaveAttribute(
            "aria-selected",
            "true",
        );
        await page.keyboard.press("Tab");
        await expect(menu).toBeHidden();
        await expect(editor).toContainText("Use planning!");
        await expect(editor).not.toContainText("Suffix");
        await expect(editor.getByRole("link", { name: "planning", exact: true })).toHaveCount(0);
        await page.keyboard.press("ArrowRight");
        await page.keyboard.type(" zzzunique");
        await page.keyboard.press("Control+Space");
        await expect(menu.getByText("No suggestions found")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(menu).toBeHidden();
        await expect(editor).toContainText("zzzunique");
        if (mode === "Formatted") {
            await page.keyboard.press("Enter");
            await page.keyboard.type("Styled ");
            await page.keyboard.press("ControlOrMeta+b");
            await page.keyboard.type("plannSuffix");
            for (let index = 0; index < 6; index++) await page.keyboard.press("ArrowLeft");
            await page.keyboard.press("Control+Space");
            await menu.getByRole("option", { name: "planner Word", exact: true }).click();
            await expect(editor.locator("strong")).toHaveText("planner");
        }
        await page.screenshot({ path: `test-results/editor-word-completion-${mode.toLowerCase()}.png` });
    });
}

test("uses visible Markdown headings and navigates completed section links after switching modes", async ({
    cleanPage: page,
}) => {
    await newNote(page, "Visible heading labels");
    const toolbar = page.getByRole("toolbar", { name: "Note tools" });
    await toolbar.getByRole("button", { name: "Markdown", exact: true }).click();
    const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    await raw.click();
    await page.keyboard.type("## **[Plan](https://example.com)** &amp; `review`\n\nSee #Pla");
    await page.keyboard.press("Control+Space");
    const option = page.getByRole("listbox").getByRole("option", { name: "Plan & review Heading", exact: true });
    await expect(option).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(raw).toContainText("[Plan & review](#plan-review)");
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 15_000 });
    await toolbar.getByRole("button", { name: "Formatted", exact: true }).click();
    const formatted = page.getByRole("textbox", { name: "Note editor", exact: true });
    await expect(formatted.getByRole("heading", { name: "Plan & review", exact: true })).toBeVisible();
    const link = formatted.locator('a[href="#plan-review"]');
    await expect(link).toHaveText("Plan & review");
    const url = page.url();
    await link.click();
    await expect(page).toHaveURL(url);
});

test("completes nested, Unicode and hex-looking tags once per casing and preserves punctuation", async ({
    cleanPage: page,
}) => {
    await newNote(page, "Unicode tag source");
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.click();
    await page.keyboard.insertText("Existing #project/active #ação #abc #🌱 #Work #work");
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 15_000 });
    await newNote(page, "Unicode tag consumer");
    await editor.click();
    await page.keyboard.type("Tags #");
    await page.keyboard.press("Control+Space");
    const menu = page.getByRole("listbox", { name: "Heading and tag suggestions" });
    for (const tag of ["project/active", "ação", "abc", "🌱"])
        await expect(menu.getByRole("option", { name: `#${tag} Tag`, exact: true })).toBeVisible();
    await expect(menu.getByRole("option", { name: /#work Tag/i })).toHaveCount(1);
    await menu.getByRole("option", { name: "#ação Tag", exact: true }).click();
    await page.keyboard.type(" #Work!");
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Control+Space");
    await menu.getByRole("option", { name: /#work Tag/i }).click();
    await expect(editor).toContainText("#ação #Work!");
    await expect(editor.locator('a[href="/tags/a%C3%A7%C3%A3o"]')).toHaveText("#ação");
});

test("opens a Unicode tag after completion and lists its source note", async ({ cleanPage: page }) => {
    await newNote(page, "Emoji tag source");
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.click();
    await page.keyboard.type("Tag #");
    await page.keyboard.insertText("🌱");
    await expect(editor).toContainText("#🌱");
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 15_000 });
    const tag = editor.locator('a[href="/tags/%F0%9F%8C%B1"]');
    await expect(tag).toHaveText("#🌱");
    await tag.click();
    await expect(page.getByRole("main").getByRole("link", { name: "Emoji tag source", exact: true })).toBeVisible();
});

test("completes headings and local workspace files in Markdown mode", async ({ cleanPage: page }) => {
    await newNote(page, "Markdown target");
    await newNote(page, "Markdown completion");
    await page
        .getByRole("toolbar", { name: "Note tools" })
        .getByRole("button", { name: "Markdown", exact: true })
        .click();
    const editor = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    await editor.click();
    await page.keyboard.type("## Raw section\n\nSee #Raw");
    await page.keyboard.press("Control+Space");
    const headings = page.getByRole("listbox", { name: "Heading and tag suggestions" });
    await expect(headings.getByRole("option", { name: /Raw section/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(editor).toContainText("See [Raw section](#raw-section)");
    await page.keyboard.type(" and @Markdown target");
    await page.keyboard.press("Control+Space");
    const files = page.getByRole("listbox", { name: "Workspace file suggestions" });
    await expect(files.getByRole("option", { name: /Markdown target/ })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(editor).toContainText("[Markdown target](/note/");
    await page.keyboard.type("\n\n```ts\n#Raw");
    await page.keyboard.press("Control+Space");
    await expect(headings).toBeHidden();
});

test("loads workspace files, retries errors, and distinguishes paths with the keyboard", async ({
    cleanPage: page,
}) => {
    await goHome(page);
    await page.evaluate(async () => {
        const request = indexedDB.open("writeme");
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        const transaction = database.transaction("settings", "readwrite");
        const settings = transaction.objectStore("settings");
        const read = settings.getAll();
        read.onsuccess = () => {
            const existing = read.result.find((entry) => entry.name === "directory");
            settings.put({
                ...existing,
                id: existing?.id ?? "completion-workspace",
                name: "directory",
                value: JSON.stringify("/workspace"),
                type: "setting",
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        };
        await new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
        database.close();
    });
    await page.reload();
    await newNote(page, "Workspace files");
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.click();
    await page.keyboard.type("Asset @logo");
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 15_000 });
    await page.evaluate(() => {
        Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Electron" });
        let attempts = 0;
        Object.defineProperty(window, "electronAPI", {
            configurable: true,
            value: {
                fs: {
                    readDirRecursive: async (root: string, maxDepth: number, includeAllFiles: boolean) => {
                        if (root !== "/workspace" || maxDepth < 20 || !includeAllFiles)
                            throw new Error("Incorrect workspace scan");
                        attempts += 1;
                        document.body.dataset.completionScanCount = String(attempts);
                        if (attempts === 1) return { success: false, files: [], error: "Disk unavailable" };
                        await new Promise((resolve) => window.setTimeout(resolve, 150));
                        return {
                            success: true,
                            files: [
                                {
                                    name: "logo.svg",
                                    path: "/workspace/public/logo.svg",
                                    relativePath: "public/logo.svg",
                                },
                                {
                                    name: "logo.svg",
                                    path: "/workspace/src/deep/assets/logo.svg",
                                    relativePath: "src/deep/assets/logo.svg",
                                },
                                {
                                    name: "settings.ts",
                                    path: "/workspace/src/settings.ts",
                                    relativePath: "src/settings.ts",
                                },
                            ],
                        };
                    },
                    onDirChanged: (callback: (event: { dirPath: string }) => void) => {
                        const changed = () => callback({ dirPath: "/workspace" });
                        window.addEventListener("completion-directory-change", changed);
                        return () => window.removeEventListener("completion-directory-change", changed);
                    },
                },
            },
        });
    });
    await page.keyboard.press("Control+Space");
    const menu = page.getByRole("listbox", { name: "Workspace file suggestions" });
    await expect(menu.getByText(/Unable to load workspace suggestions/)).toBeVisible();
    await page.keyboard.press("Control+Space");
    await expect(menu.getByRole("option")).toHaveCount(2);
    await expect(page.locator("body")).toHaveAttribute("data-completion-scan-count", "2");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+Space");
    await expect(menu.getByRole("option")).toHaveCount(2);
    await expect(page.locator("body")).toHaveAttribute("data-completion-scan-count", "2");
    await page.evaluate(() => window.dispatchEvent(new Event("completion-directory-change")));
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+Space");
    await expect(menu.getByRole("option")).toHaveCount(2);
    await expect(page.locator("body")).toHaveAttribute("data-completion-scan-count", "3");
    await expect(menu.getByRole("option").nth(1)).toContainText("src/deep/assets/logo.svg");
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(editor.locator('[data-type="mention"]')).toHaveAttribute("data-path", "src/deep/assets/logo.svg");
    await expect(editor).not.toContainText("@logo");
});

test("keeps completion within a narrow viewport", async ({ cleanPage: page }) => {
    await page.setViewportSize({ width: 375, height: 480 });
    await newNote(page, "Menu placement");
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await editor.click();
    await page.keyboard.type("## Small screen");
    await page.keyboard.press("Enter");
    for (let index = 0; index < 18; index++) await page.keyboard.press("Enter");
    await page.keyboard.type("See #Small");
    await page.keyboard.press("Control+Space");
    const menu = page.getByRole("listbox", { name: "Heading and tag suggestions" });
    await expect(menu.getByRole("option", { name: /Small screen/ })).toBeVisible();
    await expect
        .poll(async () => {
            const bounds = await menu.boundingBox();
            return Boolean(
                bounds &&
                bounds.x >= 0 &&
                bounds.y >= 0 &&
                bounds.x + bounds.width <= 375 &&
                bounds.y + bounds.height <= 480,
            );
        })
        .toBe(true);
    await page.screenshot({ path: "test-results/editor-completion-narrow.png" });
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
});
