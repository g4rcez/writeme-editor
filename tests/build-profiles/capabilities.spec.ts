import { expect, test, type Page } from "@playwright/test";

function route(page: Page, pathname: string): Promise<unknown> {
    return page.goto(`/#${pathname}`);
}

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
    expect(manifest.features.ai).toBe(!store);
    if (store) expect(manifest.excludedModules).toContain("packages/editor/src/lib/run-javascript.ts");

    await route(page, "/");
    await expect(page.getByRole("heading", { name: "Make space for the next idea." })).toBeVisible();
    await route(page, "/settings/ai");
    if (store) await expect(page.getByRole("heading", { name: "Not found", exact: true })).toBeVisible();
    else await expect(page.getByRole("heading", { name: "AI", exact: true })).toBeVisible();
    await route(page, "/settings/variables");
    await expect(page.getByRole("heading", { name: store ? "Not found" : "Variables", exact: true })).toBeVisible();

    if (store) {
        for (const pathname of ["/chat", "/oauth/callback", "/terminal/saved-session"]) {
            await route(page, pathname);
            await expect(page.getByRole("heading", { name: "Make space for the next idea." })).toBeVisible();
        }
        await page.evaluate(() => {
            localStorage.setItem("WRITEME_ENABLE_FEATURES", "ai,terminal,codeExecution");
            localStorage.setItem(
                "writeme-feature-flags",
                JSON.stringify({ ai: true, terminal: true, codeExecution: true }),
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
