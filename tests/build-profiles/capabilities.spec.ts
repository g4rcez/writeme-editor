import { expect, test, type Page } from "@playwright/test";

function route(page: Page, pathname: string): Promise<unknown> {
    return page.goto(`/#${pathname}`);
}

test("keeps Vim editing in both editors and ignores stored init.ts in restricted builds", async ({ page, request }) => {
    const response = await request.get("/writeme-build-renderer.json");
    const manifest = await response.json();
    const workers: string[] = [];
    page.on("worker", (worker) => workers.push(worker.url()));
    await route(page, "/settings/vim");
    await page.getByRole("checkbox", { name: "Enable Vim mode in all editors" }).check();
    await page.getByRole("button", { name: "Save Vim", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("saved");
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
            const existing = read.result.find((entry) => entry.name === "vimConfig");
            settings.put({
                ...existing,
                id: existing?.id ?? crypto.randomUUID(),
                name: "vimConfig",
                value: JSON.stringify('throw new Error("VIM_SCRIPT_STORE_SENTINEL")'),
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
    await route(page, "/");
    await page
        .getByRole("main")
        .getByRole("button", { name: /^New note/ })
        .first()
        .click();
    const dialog = page.getByRole("dialog", { name: /Create new note/i });
    await dialog.getByTitle("Note title").fill("Store Vim");
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(dialog).toBeHidden();
    const formatted = page.getByRole("textbox", { name: "Note editor", exact: true });
    await expect(formatted).toHaveAttribute("contenteditable", "true");
    await expect(formatted).toHaveAttribute("data-neovim-mode", "normal");
    await formatted.click();
    await page.keyboard.press("i");
    await expect(formatted).toHaveAttribute("data-neovim-mode", "insert");
    await page.keyboard.type("one two");
    await expect(formatted).toHaveText("one two");
    await page.keyboard.press("Escape");
    await page.keyboard.type("gg0dw");
    await expect(formatted).toHaveText("two");
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 15_000 });
    const toolbar = page.getByRole("toolbar", { name: "Note tools" });
    await toolbar.getByRole("button", { name: "Markdown", exact: true }).click();
    const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    await raw.click();
    await page.keyboard.type("gg0x");
    await expect(raw).toHaveText("wo");
    if (!manifest.features.vimScripts) {
        expect(workers.some((url) => url.includes("configuration.worker"))).toBe(false);
        await expect(page.getByRole("alert")).toHaveCount(0);
    } else await expect(page.getByRole("alert")).toContainText("VIM_SCRIPT_STORE_SENTINEL");
});

test("distribution controls routes, commands and runnable code while preserving ordinary notes", async ({
    page,
    request,
}) => {
    const store = test.info().project.name !== "macos-homebrew";
    const errors: string[] = [];
    const aiRequests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
        if (
            /localhost:4079|api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com/.test(
                request.url(),
            )
        )
            aiRequests.push(request.url());
    });
    const response = await request.get("/writeme-build-renderer.json");
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.channel).toBe(
        store ? (test.info().project.name === "android-google-play" ? "google-play" : "app-store") : "homebrew",
    );
    expect(manifest.features.codeExecution).toBe(!store);
    expect(manifest.features.vimScripts).toBe(!store);
    expect(manifest.features.ai).toBe(!store);
    if (store) expect(manifest.excludedModules).toContain("packages/editor/src/lib/run-javascript.ts");

    await route(page, "/");
    await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
    await route(page, "/settings/ai");
    if (store) await expect(page.getByRole("heading", { name: "Not found", exact: true })).toBeVisible();
    else await expect(page.getByRole("heading", { name: "AI", exact: true })).toBeVisible();
    await route(page, "/settings/variables");
    await expect(page.getByRole("heading", { name: store ? "Not found" : "Variables", exact: true })).toBeVisible();
    await route(page, "/settings/vim");
    await expect(page.getByRole("heading", { name: "Vim", exact: true })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Enable Vim mode in all editors" })).toBeVisible();
    if (store) {
        await expect(page.getByRole("textbox", { name: "Global init.ts" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Validate", exact: true })).toHaveCount(0);
        await expect(page.getByText("TypeScript customization is unavailable", { exact: false })).toBeVisible();
    } else await expect(page.getByRole("textbox", { name: "Global init.ts" })).toBeVisible();

    if (store) {
        for (const pathname of ["/chat", "/oauth/callback", "/terminal/saved-session"]) {
            await route(page, pathname);
            await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        }
        await page.evaluate(() => {
            localStorage.setItem("WRITEME_ENABLE_FEATURES", "ai,terminal,codeExecution,vimScripts");
            localStorage.setItem(
                "writeme-feature-flags",
                JSON.stringify({ ai: true, terminal: true, codeExecution: true, vimScripts: true }),
            );
        });
        await page.reload();
        await expect(page.getByRole("button", { name: "Ask AI", exact: true })).toHaveCount(0);
    }
    await route(page, "/examples");
    await expect(page.getByRole("link", { name: /^>>math/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Code Runner/ })).toHaveCount(store ? 0 : 1);
    await route(page, "/examples/code-run");
    if (store) await expect(page.getByRole("button", { name: "Run", exact: true })).toHaveCount(0);
    else await expect(page.getByRole("button", { name: "Run", exact: true }).first()).toBeVisible();

    await route(page, "/");
    await page.keyboard.press("Control+Shift+P");
    const command = page.getByRole("dialog").filter({ has: page.getByRole("combobox") });
    await expect(command).toBeVisible();
    await expect(command.getByText("New meeting note", { exact: true })).toHaveCount(store ? 0 : 1);
    await expect(command.getByText("New Terminal", { exact: true })).toHaveCount(store ? 0 : 1);
    await page.keyboard.press("Escape");

    await page
        .getByRole("main")
        .getByRole("button", { name: /^New note/ })
        .first()
        .click();
    const dialog = page.getByRole("dialog", { name: /Create new note/ });
    await dialog.getByTitle("Note title").fill("Profile verification");
    await dialog.getByRole("button", { name: /^Create/ }).click();
    const editor = page.locator(".ProseMirror").first();
    await expect(editor).toBeVisible();
    await editor.fill("An ordinary note remains editable.");
    await page.evaluate(() => window.dispatchEvent(new Event("writeme:mobile-pause")));
    await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 15_000 });
    await page.reload();
    await expect(editor).toContainText("An ordinary note remains editable.");
    await page.screenshot({ path: `artifacts/playwright/build-profiles/${test.info().project.name}.png` });
    expect(errors).toEqual([]);
    expect(aiRequests).toEqual([]);
});
