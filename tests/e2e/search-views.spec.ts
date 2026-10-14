import type { Page } from "@playwright/test";
import { expect, goHome, test } from "./fixtures";

const escapedTag = "ação ' OR title = 'escaped\\tag";
const folder = "/vault/ação's";

type SeedNote = {
    id: string;
    title: string;
    tags?: string[];
    noteType?: string;
    filePath?: string;
    updatedAt?: string;
};

async function seedNotes(page: Page, notes: SeedNote[]): Promise<void> {
    await page.evaluate(async (items) => {
        const storePath = "/packages/editor/src/store/global.store.ts";
        const notePath = "/packages/editor/src/store/note.ts";
        const { globalDispatch, repositories } = await import(storePath);
        const { Note } = await import(notePath);
        for (const item of items)
            await repositories.notes.save(
                Note.parse({
                    ...item,
                    content: "Seeded note content",
                    updatedAt: new Date(item.updatedAt ?? "2026-10-14T15:00:00Z"),
                }),
            );
        globalDispatch.notes(await repositories.notes.getAll());
    }, notes);
}

async function openSearch(page: Page): Promise<void> {
    const menu = page.getByRole("button", { name: "Open workspace menu", exact: true });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("region", { name: "Search notes", exact: true })).toBeVisible();
}

async function seedSearch(page: Page): Promise<void> {
    await goHome(page);
    await seedNotes(page, [
        {
            id: "matching",
            title: "Matching article",
            tags: [escapedTag, "reading"],
            noteType: "read-it-later",
            filePath: `${folder}/a.md`,
        },
        { id: "local", title: "Local article", tags: [escapedTag, "reading"], noteType: "read-it-later" },
        {
            id: "sibling",
            title: "Sibling article",
            tags: [escapedTag, "reading"],
            noteType: "read-it-later",
            filePath: `${folder}-other/b.md`,
        },
        {
            id: "old",
            title: "Old article",
            tags: [escapedTag, "reading"],
            noteType: "read-it-later",
            filePath: `${folder}/old.md`,
            updatedAt: "2026-10-13T15:00:00Z",
        },
        { id: "wrong-type", title: "Normal note", tags: [escapedTag], filePath: `${folder}/note.md` },
    ]);
    await openSearch(page);
}

async function combineFilters(page: Page): Promise<void> {
    await page.getByRole("combobox", { name: "Add tag filter" }).selectOption(escapedTag);
    await page.getByRole("combobox", { name: "Add tag filter" }).selectOption("reading");
    await page.getByRole("combobox", { name: "Filter by note type" }).selectOption("read-it-later");
    await page.getByRole("combobox", { name: "Filter by folder or location" }).selectOption(`folder:${folder}`);
    await page.getByLabel("Updated on or after", { exact: true }).fill("2026-10-14");
    await page.getByLabel("Updated through", { exact: true }).fill("2026-10-14");
}

test.describe("Search into saved Views", () => {
    test.use({ timezoneId: "America/Sao_Paulo" });

    test("combines, removes and resets filters without changing text search", async ({ cleanPage: page }) => {
        await seedSearch(page);
        await combineFilters(page);
        const results = page.getByRole("list", { name: "Search results" });
        await expect(results.getByRole("button")).toHaveCount(1);
        await expect(results).toContainText("Matching article");
        await page.getByRole("button", { name: "Remove Updated on or after: 2026-10-14 filter", exact: true }).click();
        await expect(results.getByRole("button")).toHaveCount(2);
        await page.getByRole("button", { name: "Remove Location: /vault/ação's filter", exact: true }).click();
        await expect(results.getByRole("button")).toHaveCount(4);
        await page.getByTitle("Search notes", { exact: true }).fill("Local article");
        await page.getByRole("button", { name: "Reset filters", exact: true }).click();
        await expect(page.getByTitle("Search notes", { exact: true })).toHaveValue("Local article");
        await expect(page.getByTitle("Search notes", { exact: true })).toBeFocused();
        await expect(results.getByRole("button")).toHaveCount(1);
        await page.getByTitle("Search notes", { exact: true }).fill("no matching phrase");
        await expect(page.getByText("No notes match", { exact: true })).toBeVisible();
        await page.getByTitle("Search notes", { exact: true }).fill("");
        await page.getByRole("combobox", { name: "Filter by folder or location" }).selectOption("local");
        await expect(results.getByRole("button")).toHaveCount(1);
        await expect(results).toContainText("Local article");
        await page.getByRole("combobox", { name: "Filter by folder or location" }).selectOption("filesystem");
        await expect(results.getByRole("button")).toHaveCount(4);
    });

    test("requires clearing free text, persists all filters and title, and includes new matching notes", async ({
        cleanPage: page,
    }, info) => {
        await seedSearch(page);
        await combineFilters(page);
        await page.getByTitle("Search notes", { exact: true }).fill("Matching article");
        await page.getByRole("button", { name: "Save as View", exact: true }).click();
        const title = page.getByTitle("View title", { exact: true });
        await expect(title).toBeFocused();
        await title.fill("Leitura d'ação \\ 2026");
        await expect(page.getByRole("button", { name: "Create View", exact: true })).toBeDisabled();
        await page.getByRole("button", { name: "Clear text search and keep filters", exact: true }).click();
        await page.getByRole("button", { name: "Create View", exact: true }).click();
        await expect(page).toHaveURL(/\/views\/[^/]+$/);
        const url = page.url();
        const main = page.getByRole("main");
        await expect(main.getByRole("link", { name: "Matching article", exact: true })).toBeVisible();
        await expect(main.getByRole("link", { name: "Old article", exact: true })).toHaveCount(0);
        await page.reload();
        await expect(page.getByTitle("View title", { exact: true })).toHaveValue("Leitura d'ação \\ 2026");
        await expect(main.getByRole("link", { name: "Matching article", exact: true })).toBeVisible();
        await seedNotes(page, [
            {
                id: "new-match",
                title: "New matching article",
                tags: [escapedTag, "reading"],
                noteType: "read-it-later",
                filePath: `${folder}/new.md`,
            },
        ]);
        await expect(main.getByRole("link", { name: "New matching article", exact: true })).toBeVisible();
        await expect(main.getByRole("link")).toHaveCount(2);
        await page.getByRole("button", { name: "All Views", exact: true }).click();
        await page.getByRole("button", { name: "Leitura d'ação \\ 2026", exact: true }).click();
        await expect(page).toHaveURL(url);
        await expect(main.getByRole("link", { name: "New matching article", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Visual Filters", exact: true }).click();
        const tagValue = page.getByTitle("Value", { exact: true }).first();
        await expect(tagValue).toHaveValue(escapedTag);
        await tagValue.fill("missing-tag");
        await expect(main.getByText("No results match this query.", { exact: true })).toBeVisible();
        await expect
            .poll(async () =>
                page.evaluate(async () => {
                    const path = "/packages/editor/src/store/repositories/index.ts";
                    const { repositories } = await import(path);
                    return (await repositories.views.getOne(location.pathname.split("/").at(-1)))?.query;
                }),
            )
            .toContain("missing-tag");
        await tagValue.fill(escapedTag);
        await expect(main.getByRole("link", { name: "Matching article", exact: true })).toBeVisible();
        await expect
            .poll(async () =>
                page.evaluate(async () => {
                    const path = "/packages/editor/src/store/repositories/index.ts";
                    const { repositories } = await import(path);
                    return (await repositories.views.getOne(location.pathname.split("/").at(-1)))?.query;
                }),
            )
            .toContain("escaped\\\\tag");
        await page.reload();
        await expect(main.getByRole("link", { name: "Matching article", exact: true })).toBeVisible();
        await expect(main.getByRole("link", { name: "New matching article", exact: true })).toBeVisible();
        const screenshot = info.outputPath("saved-search-view.png");
        await page.screenshot({ path: screenshot });
        await info.attach("Persisted View", { path: screenshot, contentType: "image/png" });
    });

    test("preserves local-day boundaries, rejects reversed dates and recovers from a missing View", async ({
        cleanPage: page,
    }) => {
        await goHome(page);
        await seedNotes(page, [
            { id: "before", title: "Before day", updatedAt: "2026-10-14T02:59:59.999Z" },
            { id: "start", title: "Start of day", updatedAt: "2026-10-14T03:00:00.000Z" },
            { id: "end", title: "End of day", updatedAt: "2026-10-15T02:59:59.999Z" },
            { id: "next", title: "Next day", updatedAt: "2026-10-15T03:00:00.000Z" },
        ]);
        await openSearch(page);
        await page.getByLabel("Updated on or after", { exact: true }).fill("2026-10-14");
        await page.getByLabel("Updated through", { exact: true }).fill("2026-10-14");
        const results = page.getByRole("list", { name: "Search results" });
        await expect(results.getByRole("button")).toHaveCount(2);
        await expect(results).toContainText("Start of day");
        await expect(results).toContainText("End of day");
        await page.getByLabel("Updated on or after", { exact: true }).fill("2026-10-15");
        await expect(page.getByRole("alert")).toContainText("The start date must be on or before the end date");
        await expect(page.getByRole("button", { name: "Save as View", exact: true })).toBeDisabled();
        await page.getByLabel("Updated on or after", { exact: true }).fill("2026-10-14");
        await page.getByRole("button", { name: "Save as View", exact: true }).click();
        await page.getByTitle("View title", { exact: true }).fill("One local day");
        await page.getByRole("button", { name: "Create View", exact: true }).click();
        await expect(page.getByRole("main").getByRole("link")).toHaveCount(2);
        await page.reload();
        await expect(page.getByRole("main").getByRole("link")).toHaveCount(2);
        await page.goto("/views/missing-view");
        await expect(page.getByRole("alert")).toContainText("This View no longer exists");
        await page.getByRole("button", { name: "All Views", exact: true }).click();
        await expect(page.getByRole("button", { name: "One local day", exact: true })).toBeVisible();
    });

    test("loads a saved View with retry after storage fails and explains an empty workspace", async ({
        cleanPage: page,
    }) => {
        await goHome(page);
        await openSearch(page);
        await expect(page.getByText("No notes yet", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Views", exact: true }).click();
        await page.getByRole("button", { name: "Add starter Views", exact: true }).click();
        await page.evaluate(async () => {
            const path = "/packages/editor/src/store/repositories/index.ts";
            const { repositories } = await import(path);
            const getOne = repositories.views.getOne.bind(repositories.views);
            repositories.views.getOne = async () => {
                await new Promise<void>((resolve) => {
                    (window as Window & { finishViewLoad?: () => void }).finishViewLoad = resolve;
                });
                repositories.views.getOne = getOne;
                throw new Error("Injected storage error");
            };
        });
        await page.getByRole("button", { name: "Reading queue", exact: true }).click();
        await expect(page.getByText("Loading View…", { exact: true })).toBeVisible();
        await page.evaluate(() => (window as Window & { finishViewLoad?: () => void }).finishViewLoad?.());
        await expect(page.getByRole("alert")).toContainText("Could not load this View");
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await expect(page.getByTitle("View title", { exact: true })).toHaveValue("Reading queue");
        await expect(page.getByText("No results match this query.", { exact: true })).toBeVisible();
    });

    test("shows loading and storage errors with retry and preserves the entered save title", async ({
        cleanPage: page,
    }) => {
        await seedSearch(page);
        await page.getByRole("combobox", { name: "Filter by note type" }).selectOption("read-it-later");
        await page.getByRole("button", { name: "Save as View", exact: true }).click();
        await page.getByTitle("View title", { exact: true }).fill("Retry reading");
        await page.evaluate(async () => {
            const path = "/packages/editor/src/store/repositories/index.ts";
            const { repositories } = await import(path);
            const save = repositories.views.save.bind(repositories.views);
            repositories.views.save = async () => {
                repositories.views.save = save;
                await new Promise((resolve) => setTimeout(resolve, 600));
                throw new Error("Injected storage error");
            };
        });
        await page.getByRole("button", { name: "Create View", exact: true }).click();
        await expect(page.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
        await expect(page.getByRole("alert")).toContainText("Could not save this View");
        await expect(page.getByTitle("View title", { exact: true })).toHaveValue("Retry reading");
        await page.getByRole("button", { name: "Create View", exact: true }).click();
        await expect(page).toHaveURL(/\/views\/[^/]+$/);
        await page.evaluate(async () => {
            const path = "/packages/editor/src/store/repositories/index.ts";
            const { repositories } = await import(path);
            const getAll = repositories.views.getAll.bind(repositories.views);
            repositories.views.getAll = async () => {
                await new Promise<void>((resolve) => {
                    (window as Window & { finishViewsLoad?: () => void }).finishViewsLoad = resolve;
                });
                repositories.views.getAll = getAll;
                throw new Error("Injected load error");
            };
        });
        await page.getByRole("button", { name: "All Views", exact: true }).click();
        await expect(page.getByText("Loading Views…", { exact: true })).toBeVisible();
        await page.evaluate(() => (window as Window & { finishViewsLoad?: () => void }).finishViewsLoad?.());
        await expect(page.getByRole("alert")).toContainText("Could not load Views");
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await expect(page.getByRole("button", { name: "Retry reading", exact: true })).toBeVisible();
    });

    test("adds useful starter Views once, preserves edits, and respects deletion", async ({ cleanPage: page }) => {
        await goHome(page);
        await seedNotes(page, [
            { id: "latest", title: "Latest note" },
            { id: "reading", title: "Queued article", noteType: "read-it-later", updatedAt: "2026-10-13T15:00:00Z" },
        ]);
        await page.goto("/views");
        await page.getByRole("button", { name: "Add starter Views", exact: true }).click();
        await expect(page.getByRole("button", { name: "Add starter Views", exact: true })).toHaveCount(0);
        await page.reload();
        await expect(page.getByRole("button", { name: "Recently edited", exact: true })).toHaveCount(1);
        await page.getByRole("button", { name: "Recently edited", exact: true }).click();
        const main = page.getByRole("main");
        await expect(main.getByRole("link", { name: "Latest note", exact: true })).toBeVisible();
        await expect(main.getByRole("link", { name: "Queued article", exact: true })).toBeVisible();
        const title = page.getByTitle("View title", { exact: true });
        await title.fill("My recent notes");
        await title.press("Enter");
        await expect
            .poll(async () =>
                page.evaluate(async () => {
                    const path = "/packages/editor/src/store/repositories/index.ts";
                    const { repositories } = await import(path);
                    return (await repositories.views.getOne("starter-view-recently-edited"))?.title;
                }),
            )
            .toBe("My recent notes");
        await page.getByRole("button", { name: "All Views", exact: true }).click();
        await expect(page.getByRole("button", { name: "Recently edited", exact: true })).toHaveCount(0);
        await page.getByRole("button", { name: "Reading queue", exact: true }).click();
        await expect(main.getByRole("link", { name: "Queued article", exact: true })).toBeVisible();
        await expect(main.getByRole("link", { name: "Latest note", exact: true })).toHaveCount(0);
        await page.getByRole("button", { name: "All Views", exact: true }).click();
        page.once("dialog", (dialog) => dialog.accept());
        await page.getByRole("button", { name: "Delete Reading queue", exact: true }).click();
        await page.reload();
        await expect(page.getByRole("button", { name: "Reading queue", exact: true })).toHaveCount(0);
        await page.getByRole("button", { name: "Add starter Views", exact: true }).click();
        await expect(page.getByRole("button", { name: "Reading queue", exact: true })).toHaveCount(1);
        await expect(page.getByRole("button", { name: "My recent notes", exact: true })).toHaveCount(1);
    });

    test("keeps filters and save controls usable on a narrow screen and restores keyboard focus", async ({
        cleanPage: page,
    }, info) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await seedSearch(page);
        await page.getByRole("combobox", { name: "Add tag filter" }).selectOption(escapedTag);
        await page.getByRole("button", { name: "Save as View", exact: true }).click();
        await expect(page.getByTitle("View title", { exact: true })).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("button", { name: "Save as View", exact: true })).toBeFocused();
        await page.keyboard.press("Enter");
        await page.getByTitle("View title", { exact: true }).fill("Phone reading");
        const create = page.getByRole("button", { name: "Create View", exact: true });
        await create.scrollIntoViewIfNeeded();
        const bounds = await create.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
        const screenshot = info.outputPath("search-filters-mobile.png");
        await page.screenshot({ path: screenshot });
        await info.attach("Narrow search", { path: screenshot, contentType: "image/png" });
        await create.focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/views\/[^/]+$/);
        await expect(page.getByTitle("View title", { exact: true })).toHaveValue("Phone reading");
        await expect(page.getByRole("button", { name: "Open workspace menu", exact: true })).toBeVisible();
    });
});
