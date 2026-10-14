import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { } from "../../packages/editor/src/preload";

type StoredView = { id: string; title: string; createdAt: string; updatedAt: string };

async function launchViewsApp(directory: string): Promise<ElectronApplication> {
    const bootstrap = path.join(directory, "bootstrap.cjs");
    const main = path.resolve(".vite/build/main.js");
    await writeFile(
        bootstrap,
        `const { app } = require("electron");\napp.setPath("appData", ${JSON.stringify(directory)});\napp.setPath("userData", ${JSON.stringify(directory)});\nrequire(${JSON.stringify(main)});\n`,
    );
    // Workspace instances avoid shared proxy ports, CLI sockets and OS shortcuts.
    return electron.launch({ args: [bootstrap, "--no-sandbox", "--workspace-instance"], timeout: 30_000 });
}

async function openViews(page: Page): Promise<void> {
    await page.evaluate(() => {
        location.hash = "#/views";
    });
    await expect(page.getByRole("main").getByRole("heading", { name: "Views", exact: true })).toBeVisible();
}

async function storedViews(page: Page): Promise<StoredView[]> {
    return page.evaluate(() => window.electronAPI.db.getAll<StoredView>("views"));
}

test("adds, reloads, edits and reopens both starter Views through Electron SQLite", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "writeme-views-native-"));
    let application: ElectronApplication | undefined;
    const errors: string[] = [];
    try {
        application = await launchViewsApp(directory);
        let page = await application.firstWindow();
        page.on("pageerror", (error) => errors.push(error.message));
        await expect(page.getByRole("heading", { name: "Your notes, ready when you are." })).toBeVisible();
        const userData = await application.evaluate(({ app }) => app.getPath("userData"));
        expect(userData === directory || userData.startsWith(`${directory}${path.sep}`)).toBe(true);
        await openViews(page);
        await expect(page.getByText("No Views yet. Create one to query your notes.", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Add starter Views", exact: true }).click();
        await expect(page.getByRole("button", { name: "Recently edited", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Reading queue", exact: true })).toBeVisible();
        await expect(page.getByRole("alert")).toHaveCount(0);
        await access(path.join(userData, "writeme.sqlite"));
        const original = await storedViews(page);
        expect(original).toHaveLength(2);
        for (const view of original) {
            expect(typeof view.createdAt).toBe("string");
            expect(typeof view.updatedAt).toBe("string");
            expect(Number.isFinite(Date.parse(view.updatedAt))).toBe(true);
        }
        await page.reload();
        await expect(page.getByRole("button", { name: "Recently edited", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Reading queue", exact: true }).click();
        const title = page.getByTitle("View title", { exact: true });
        await expect(title).toHaveValue("Reading queue");
        await title.fill("My reading queue");
        await title.press("Tab");
        await expect
            .poll(async () => (await storedViews(page)).find((view) => view.title === "My reading queue")?.title)
            .toBe("My reading queue");
        await page.getByRole("button", { name: "All Views", exact: true }).click();
        await expect(page.getByRole("button", { name: "My reading queue", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Add starter Views", exact: true })).toHaveCount(0);
        await page.getByRole("button", { name: "Recently edited", exact: true }).click();
        await expect(title).toHaveValue("Recently edited");
        await page.reload();
        await expect(title).toHaveValue("Recently edited");
        await application.close();
        application = undefined;
        application = await launchViewsApp(directory);
        page = await application.firstWindow();
        page.on("pageerror", (error) => errors.push(error.message));
        await openViews(page);
        await expect(page.getByRole("button", { name: "Recently edited", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "My reading queue", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Add starter Views", exact: true })).toHaveCount(0);
        await expect(page.getByRole("alert")).toHaveCount(0);
        expect((await storedViews(page)).map((view) => view.id).sort()).toEqual(original.map((view) => view.id).sort());
        await page.getByRole("button", { name: "My reading queue", exact: true }).click();
        await expect(page.getByTitle("View title", { exact: true })).toHaveValue("My reading queue");
        expect(errors).toEqual([]);
    } finally {
        await application?.close();
        await rm(directory, { recursive: true, force: true });
    }
});
