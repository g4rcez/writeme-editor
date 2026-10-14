import type { Page } from "@playwright/test";
import { expect, goHome, test } from "./fixtures";

async function createBoard(page: Page): Promise<void> {
    await goHome(page);
    const close = page.getByRole("button", { name: "Close workspace menu", exact: true });
    if (await close.isVisible()) await close.click();
    await page.getByRole("button", { name: "Task board", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Create task note" });
    await dialog.getByTitle("Note title").fill("Project tasks");
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(page.getByRole("region", { name: "Task board", exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
}
async function addTask(page: Page, title = "Ship task board"): Promise<void> {
    await page.getByRole("button", { name: "Add task to Backlog", exact: true }).click();
    await page.getByRole("textbox", { name: "Task title", exact: true }).fill(title);
    await page.getByRole("textbox", { name: "Task description", exact: true }).fill("Keep tasks in Markdown");
    await page.getByRole("button", { name: "Create task", exact: true }).click();
    await expect(page.getByRole("button", { name: `Edit ${title}`, exact: true })).toBeVisible();
    await expect(page.locator(".wm-task-save")).toHaveText("Saved");
    const handle = await page.getByRole("button", { name: `Move ${title}`, exact: true }).boundingBox();
    const titleBounds = await page
        .getByRole("button", { name: `Edit ${title}`, exact: true })
        .locator("span")
        .first()
        .boundingBox();
    if (!handle || !titleBounds) throw new Error("Missing task title or drag handle");
    expect(titleBounds.x).toBeGreaterThanOrEqual(handle.x + handle.width);
    expect(titleBounds.y).toBeLessThan(handle.y + handle.height);
    expect(titleBounds.y + titleBounds.height).toBeGreaterThan(handle.y);
}

test("switches from the task board to Markdown with Ctrl+M", async ({ cleanPage: page }) => {
    await createBoard(page);
    await page.keyboard.press("Control+M");
    await expect(page.getByRole("button", { name: "Markdown", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toBeVisible();
});

test("creates a full-page board, edits cards, moves columns and persists Markdown", async ({
    cleanPage: page,
}, info) => {
    await createBoard(page);
    await expect(page.locator(".wm-task-column")).toHaveCount(4);
    await expect(page.locator(".ProseMirror")).toHaveCount(0);
    await addTask(page);
    await page.getByRole("button", { name: "Edit Ship task board", exact: true }).click();
    await page.getByRole("textbox", { name: "Task title", exact: true }).fill("Ship the board");
    await page.getByRole("combobox", { name: "Task column" }).selectOption("2");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    const progress = page.getByRole("region", { name: "In Progress column" });
    await expect(progress.getByRole("button", { name: "Edit Ship the board", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Complete Ship the board", exact: true }).click();
    await expect(page.locator(".wm-task-save")).toHaveText("Saved");
    await page.keyboard.press("Control+M");
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await expect(editor).toBeVisible();
    await expect(editor).toContainText("Ship the board");
    await expect(editor).toContainText("In Progress");
    await page.reload();
    await expect(progress.getByRole("button", { name: "Reopen Ship the board", exact: true })).toBeVisible();
    await expect(progress).toContainText("Keep tasks in Markdown");
    await page.screenshot({ path: info.outputPath("task-board-desktop.png") });
});

test("filters, renames columns, switches to the editor and deletes tasks", async ({ cleanPage: page }) => {
    await createBoard(page);
    await addTask(page);
    await page.getByRole("searchbox", { name: "Search tasks" }).fill("missing");
    await expect(page.locator(".wm-task-card")).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Search tasks" }).fill("");
    await page.getByRole("button", { name: "Active", exact: true }).click();
    await expect(page.locator(".wm-task-card")).toHaveCount(0);
    await page.getByRole("button", { name: "All tasks", exact: true }).click();
    await page.getByRole("button", { name: "Rename Todo column", exact: true }).click();
    await page.getByRole("textbox", { name: "Column name" }).fill("Ready");
    await page.getByRole("button", { name: "Save column", exact: true }).click();
    await expect(page.getByRole("region", { name: "Ready column" })).toBeVisible();
    await page.getByRole("button", { name: "Markdown", exact: true }).click();
    const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
    await expect(editor).toContainText("Ready");
    await page.getByRole("button", { name: "Board", exact: true }).click();
    await page.getByRole("button", { name: "Add task to Ready", exact: true }).click();
    await page.getByRole("textbox", { name: "Task title", exact: true }).fill("Check tests");
    await page.getByRole("button", { name: "Create task", exact: true }).click();
    await expect(page.getByRole("region", { name: "Ready column" })).toContainText("Check tests");
    await page.getByRole("button", { name: "Edit Check tests", exact: true }).click();
    await page.getByRole("button", { name: "Delete task", exact: true }).click();
    await expect(page.locator(".wm-task-save")).toHaveText("Saved");
    await page.reload();
    await expect(page.getByRole("region", { name: "Ready column" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Check tests", exact: true })).toHaveCount(0);
});

test("supports keyboard and pointer movement between columns", async ({ cleanPage: page }) => {
    await createBoard(page);
    await addTask(page, "Keyboard card");
    const handle = page.getByRole("button", { name: "Move Keyboard card", exact: true });
    await handle.focus();
    await page.keyboard.press("Space");
    await expect(handle).toHaveAttribute("aria-pressed", "true");
    const preview = page.getByTestId("task-drag-preview");
    await expect(preview).toBeVisible();
    await expect(preview).toContainText("Keyboard card");
    await expect(page.locator(".wm-task-card--dragging")).toBeVisible();
    await expect(
        page.getByRole("status").filter({ hasText: /Draggable item .* was (picked up|moved over droppable area)/ }),
    ).toHaveCount(1);
    await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("status").filter({ hasText: "was moved over droppable area stack-" })).toHaveCount(1);
    await page.keyboard.press("Space");
    await expect(page.getByRole("region", { name: "Todo column" })).toContainText("Keyboard card");
    await expect(page.locator(".wm-task-save")).toHaveText("Saved");
    const destination = page.getByRole("region", { name: "In Progress column" });
    await destination.scrollIntoViewIfNeeded();
    const from = await handle.boundingBox();
    const card = await page.locator(".wm-task-card").filter({ has: handle }).boundingBox();
    const target = await destination.locator(".wm-task-column-cards").boundingBox();
    if (!from || !card || !target) throw new Error("Missing drag target");
    const grab = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(target.x + grab.x - card.x, target.y + grab.y - card.y, { steps: 20 });
    await expect(preview).toBeVisible();
    await expect(destination.getByRole("button", { name: "Drop task here", exact: true })).toBeVisible();
    expect(await preview.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    await expect(destination).toContainText("Keyboard card");
    await expect(page.locator(".wm-task-save")).toHaveText("Saved");
    await page.reload();
    await expect(page.getByRole("region", { name: "In Progress column" })).toContainText("Keyboard card");
});

test("keeps local tasks after a save failure and retries", async ({ cleanPage: page }) => {
    await createBoard(page);
    await page.evaluate(async () => {
        const modulePath = "/packages/editor/src/store/global.store.ts";
        const { repositories } = await import(modulePath);
        const original = repositories.notes.updateContentIfUnchanged;
        repositories.notes.updateContentIfUnchanged = async () => {
            throw new Error("Storage unavailable");
        };
        window.addEventListener(
            "restore-task-storage",
            () => {
                repositories.notes.updateContentIfUnchanged = original;
            },
            { once: true },
        );
    });
    await page.getByRole("button", { name: "Add task to Backlog", exact: true }).click();
    await page.getByRole("textbox", { name: "Task title", exact: true }).fill("Recover task");
    await page.getByRole("button", { name: "Create task", exact: true }).click();
    await expect(page.locator(".wm-task-save")).toHaveText("Could not save");
    await expect(page.getByRole("button", { name: "Edit Recover task", exact: true })).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("restore-task-storage")));
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.locator(".wm-task-save")).toHaveText("Saved");
    await page.reload();
    await expect(page.getByRole("button", { name: "Edit Recover task", exact: true })).toBeVisible();
});

test("fits a mobile viewport and scrolls columns inside the board", async ({ cleanPage: page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await createBoard(page);
    await addTask(page);
    const board = page.getByRole("region", { name: "Task board", exact: true });
    const toolbar = page.getByRole("toolbar", { name: "Task board tools", exact: true });
    await expect(toolbar.getByRole("searchbox", { name: "Search tasks" })).toBeVisible();
    await expect(toolbar.getByRole("checkbox", { name: "Hide empty columns" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Add column", exact: true })).toBeVisible();
    const searchBounds = await toolbar.getByRole("searchbox").boundingBox();
    const addBounds = await toolbar.getByRole("button", { name: "Add column", exact: true }).boundingBox();
    expect(searchBounds).not.toBeNull();
    expect(addBounds).not.toBeNull();
    expect(addBounds!.y).toBeGreaterThanOrEqual(searchBounds!.y + searchBounds!.height);
    const bounds = await board.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: info.outputPath("task-board-mobile.png") });
});

test("creates and deletes empty columns and persists rapid task edits", async ({ cleanPage: page }) => {
    await createBoard(page);
    await page.getByRole("button", { name: "Add column", exact: true }).click();
    await page.getByRole("textbox", { name: "Column name" }).fill("Review");
    await page.getByRole("button", { name: "Save column", exact: true }).click();
    await expect(page.getByRole("region", { name: "Review column" })).toBeVisible();
    await page.getByRole("button", { name: "Rename Review column", exact: true }).click();
    await page.getByRole("button", { name: "Delete column", exact: true }).click();
    await expect(page.getByRole("region", { name: "Review column" })).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Hide empty columns", exact: true }).check();
    await expect(page.locator(".wm-task-column")).toHaveCount(0);
    await page.getByRole("button", { name: "Show all columns", exact: true }).click();
    await page.getByRole("button", { name: "Add task to Todo", exact: true }).click();
    await page.getByRole("textbox", { name: "Task title", exact: true }).fill("First revision");
    await page.getByRole("button", { name: "Create task", exact: true }).click();
    await page.getByRole("button", { name: "Edit First revision", exact: true }).click();
    await page.getByRole("textbox", { name: "Task title", exact: true }).fill("Final revision");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await expect(page.locator(".wm-task-save")).toHaveText("Saved");
    await page.reload();
    await expect(page.getByRole("region", { name: "Todo column" })).toContainText("Final revision");
    await expect(page.locator(".wm-task-card")).toHaveCount(1);
    await page.getByRole("button", { name: "Markdown", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Note editor", exact: true })).toContainText("Final revision");
});

test("retains local changes without overwriting a concurrent editor", async ({ cleanPage: page }) => {
    await createBoard(page);
    await page.evaluate(async () => {
        const modulePath = "/packages/editor/src/store/global.store.ts";
        const { repositories } = await import(modulePath);
        const id = location.pathname.split("/").at(-1)!;
        await repositories.notes.updateContent(
            id,
            "---\ntype: task\n---\n\n## External\n\n- [ ] Another editor's task\n",
        );
    });
    await page.getByRole("button", { name: "Add task to Backlog", exact: true }).click();
    await page.getByRole("textbox", { name: "Task title", exact: true }).fill("Local task");
    await page.getByRole("button", { name: "Create task", exact: true }).click();
    await expect(page.locator(".wm-task-save")).toHaveText("Could not save");
    await expect(page.getByRole("alert")).toContainText("changed in another editor");
    await expect(page.getByRole("button", { name: "Edit Local task", exact: true })).toBeVisible();
    const saved = await page.evaluate(async () => {
        const modulePath = "/packages/editor/src/store/global.store.ts";
        const { repositories } = await import(modulePath);
        return (await repositories.notes.getOne(location.pathname.split("/").at(-1)!))?.content;
    });
    expect(saved).toContain("Another editor's task");
    expect(saved).not.toContain("Local task");
    const download = page.waitForEvent("download");
    await page.getByRole("alert").getByRole("button", { name: "Download local copy", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("Project tasks-local-copy.md");
});

test("keeps the board readable in light and dark themes", async ({ cleanPage: page }, info) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await createBoard(page);
    await addTask(page, "Plan next release");
    await addTask(page, "Review task Markdown");
    const url = page.url();
    for (const theme of ["light", "dark"]) {
        await page.goto("/settings/appearance");
        await page.getByRole("main", { name: "Settings" }).getByRole("combobox").selectOption(theme);
        await page.getByRole("button", { name: "Save Appearance", exact: true }).click();
        await page.goto(url);
        await expect(page.getByRole("button", { name: "Edit Plan next release", exact: true })).toBeVisible();
        await expect(page.locator(".wm-task-header")).toBeVisible();
        const colors = await page
            .locator(".wm-task-card")
            .first()
            .evaluate((card) => ({
                background: getComputedStyle(card).backgroundColor,
                foreground: getComputedStyle(card).color,
            }));
        expect(colors.background).not.toBe("rgba(0, 0, 0, 0)");
        expect(colors.background).not.toBe(colors.foreground);
        await page.screenshot({ path: info.outputPath(`task-board-${theme}.png`) });
    }
});
