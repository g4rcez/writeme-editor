import type { Page } from "@playwright/test";
import { expect, goHome, test } from "./fixtures";

async function seedNotes(page: Page): Promise<Record<string, string>> {
    return page.evaluate(async () => {
        const repositoryPath = "/packages/editor/src/store/repositories/index.ts";
        const notePath = "/packages/editor/src/store/note.ts";
        const { repositories } = await import(repositoryPath);
        const { Note, NoteType } = await import(notePath);
        const ordinary = Note.new(
            "Project plan",
            `# Introduction\n\n${"Some background.\n\n".repeat(40)}## Delivery\n\n- [x] Finished\n- [ ] Ship release\n- [ ] Ship release\n\n- ordinary list\n\n\`\`\`md\n- [ ] Code example\n\`\`\`\n`,
        );
        const daily = Note.new(
            "Renamed daily note",
            "# Review\n\n- [ ] Reflect on today\n\nPreserved journal content\n",
            NoteType.quick,
        );
        daily.metadata.journalDate = "2025-12-31";
        const meeting = Note.new(
            "Team meeting",
            "---\ntype: meeting-note\n---\n\n## Actions\n\n- [ ] Send summary\n",
            NoteType["meeting-note"],
        );
        const board = Note.new(
            "Release board",
            "---\ntype: task\nview: kanban\n---\n\n## Backlog\n\n- [x] Board done\n\n## Todo\n\n- [ ] Board task\n",
            NoteType.task,
        );
        const deleted = Note.new("Deleted", "- [ ] Deleted task");
        const template = Note.new("Template", "- [ ] Template task", NoteType.template);
        for (const note of [ordinary, daily, meeting, board, deleted, template]) await repositories.notes.save(note);
        await repositories.notes.delete(deleted.id);
        return { ordinary: ordinary.id, daily: daily.id, meeting: meeting.id, board: board.id };
    });
}

test("aggregates only unfinished tasks and opens the precise source context with a keyboard", async ({
    cleanPage: page,
}, info) => {
    await goHome(page);
    const ids = await seedNotes(page);
    await page.goto("/tasks");
    const tasks = page.getByRole("region", { name: "Open tasks", exact: true });
    await expect(tasks.getByRole("link")).toHaveCount(5);
    await expect(tasks).toContainText("Project plan · Delivery");
    await expect(tasks).not.toContainText("Finished");
    await expect(tasks).not.toContainText("Code example");
    await expect(tasks).not.toContainText("Deleted task");
    await expect(tasks).not.toContainText("Template task");
    await expect(tasks.getByRole("checkbox")).toHaveCount(0);
    const second = tasks.getByRole("link", { name: "Open Ship release in Project plan, Delivery", exact: true }).nth(1);
    await second.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/note/${ids.ordinary}\\?task=2&line=`));
    const target = page.locator(".ProseMirror li[data-checked]").nth(2);
    await expect(target).toBeInViewport();
    await expect(page.locator(".ProseMirror").first()).toBeFocused();
    await page.screenshot({ path: info.outputPath("agenda-source.png") });
    await page.goto("/tasks");
    await page.reload();
    await expect(tasks.getByRole("link")).toHaveCount(5);
    await tasks.getByRole("link", { name: "Open Board task in Release board, Todo", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/note/${ids.board}`));
    await expect(page.getByRole("button", { name: "Edit Board task", exact: true })).toBeFocused();
    await page.goto("/tasks");
    await tasks.getByRole("link", { name: "Open Send summary in Team meeting, Actions", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/note/${ids.meeting}`));
    await expect(page.locator(".ProseMirror li[data-checked]").first()).toBeInViewport();
});

test("opens a task's source line in Markdown mode", async ({ cleanPage: page }) => {
    await goHome(page);
    await seedNotes(page);
    await page.evaluate(async () => {
        const modulePath = "/packages/editor/src/store/settings.ts";
        const { SettingsService } = await import(modulePath);
        await SettingsService.save({ editorMode: "markdown" });
    });
    await page.goto("/tasks");
    await page.getByRole("link", { name: "Open Ship release in Project plan, Delivery", exact: true }).nth(1).click();
    await expect(page.locator(".cm-content")).toBeFocused();
    await expect
        .poll(() =>
            page.evaluate(async () => {
                const modulePath = "/node_modules/@codemirror/view/dist/index.js";
                const { EditorView } = await import(modulePath);
                const view = EditorView.findFromDOM(document.querySelector(".cm-editor")!);
                return view?.state.doc.lineAt(view.state.selection.main.head).text;
            }),
        )
        .toBe("- [ ] Ship release");
});

test("keeps journal dates separate and preserves daily notes across date navigation and refresh", async ({
    cleanPage: page,
}, info) => {
    await goHome(page);
    const ids = await seedNotes(page);
    await page.goto("/today?date=2025-12-31");
    await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Daily note", exact: true })).toContainText("Renamed daily note");
    await expect(page.getByRole("region", { name: "Recent work", exact: true })).toContainText("Project plan");
    await page.getByRole("button", { name: "Open daily note", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/note/${ids.daily}$`));
    await expect(page.locator(".ProseMirror").first()).toContainText("Preserved journal content");
    await page.goto("/today?date=2025-12-31");
    await page.getByRole("button", { name: "Next day", exact: true }).click();
    await expect(page.getByLabel("Journal date")).toHaveValue("2026-01-01");
    await page.getByRole("button", { name: "Create daily note", exact: true }).click();
    await expect(page).toHaveURL(/\/note\/[^?]+$/);
    const newUrl = page.url();
    await page.goto("/today?date=2026-01-01");
    await page.reload();
    await page.getByRole("button", { name: "Open daily note", exact: true }).click();
    await expect(page).toHaveURL(newUrl);
    await page.goto("/today?date=2026-01-01");
    await page.getByRole("button", { name: "Previous day", exact: true }).click();
    await expect(page.getByLabel("Journal date")).toHaveValue("2025-12-31");
    await page.setViewportSize({ width: 390, height: 844 });
    const closeMenu = page.getByRole("button", { name: "Close workspace menu", exact: true });
    if (await closeMenu.isVisible()) await closeMenu.click();
    await page.screenshot({ path: info.outputPath("today-narrow.png") });
    const lastTask = page.getByRole("region", { name: "Unfinished tasks", exact: true }).getByRole("link").last();
    await lastTask.scrollIntoViewIfNeeded();
    await expect(lastTask).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Open daily note", exact: true })).toBeVisible();
    await page.getByLabel("Journal date").fill("2026-02-03");
    await expect(page).toHaveURL(/date=2026-02-03/);
    await page.evaluate(async () => {
        const path = "/packages/editor/src/store/repositories/index.ts";
        const { repositories } = await import(path);
        const daily = (await repositories.notes.getAll()).filter(
            (note: { noteType: string }) => note.noteType === "quick",
        );
        if (
            daily.length !== 2 ||
            daily.find((note: { metadata: Record<string, unknown> }) => note.metadata.journalDate === "2025-12-31")
                ?.content !== "# Review\n\n- [ ] Reflect on today\n\nPreserved journal content\n"
        )
            throw new Error("Daily notes changed or duplicated");
    });
});

test("provides empty, loading, error and retry states without creating notes", async ({ cleanPage: page }) => {
    await goHome(page);
    await page.goto("/today");
    await expect(page.getByText("No open tasks in this workspace.", { exact: true })).toBeVisible();
    await expect(page.getByText("Your recent notes will appear here as you work.", { exact: true })).toBeVisible();
    await page.evaluate(async () => {
        const path = "/packages/editor/src/store/global.store.ts";
        const { repositories } = await import(path);
        const original = repositories.notes.getAll.bind(repositories.notes);
        repositories.notes.getAll = async () => {
            await new Promise((resolve) => setTimeout(resolve, 600));
            throw new Error("Could not read agenda notes");
        };
        Reflect.set(window, "restoreAgendaLoader", () => {
            repositories.notes.getAll = original;
        });
    });
    await page.getByRole("button", { name: "Open tasks", exact: true }).first().click();
    await expect(page.getByRole("status").filter({ hasText: "Loading workspace notes" })).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("Could not read agenda notes");
    await page.evaluate(() => Reflect.get(window, "restoreAgendaLoader")());
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByText("No open tasks in this workspace.", { exact: true })).toBeVisible();
});

test("opens the selected calendar day's daily note and displays it on its journal day", async ({ cleanPage: page }) => {
    await goHome(page);
    const ids = await seedNotes(page);
    await page.goto("/calendar?date=2025-12-31");
    const calendar = page.getByRole("grid");
    await expect(calendar.getByRole("button", { name: /Renamed daily note/ })).toBeVisible();
    await calendar.getByRole("button", { name: /Wednesday, Dec 31, 2025/ }).click();
    await page.getByRole("button", { name: "12:00", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "New note", exact: true });
    await dialog.getByRole("button", { name: "Open daily note", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/note/${ids.daily}$`));
    await expect(page.locator(".ProseMirror").first()).toContainText("Preserved journal content");
});

test("surfaces daily-note creation failures and permits retry", async ({ cleanPage: page }) => {
    await goHome(page);
    await page.goto("/today?date=2026-02-03");
    await expect(page.getByRole("button", { name: "Create daily note", exact: true })).toBeVisible();
    await page.evaluate(async () => {
        const path = "/packages/editor/src/store/global.store.ts";
        const { repositories } = await import(path);
        const original = repositories.notes.save.bind(repositories.notes);
        repositories.notes.save = async () => {
            throw new Error("Daily note storage unavailable");
        };
        Reflect.set(window, "restoreDailyWriter", () => {
            repositories.notes.save = original;
        });
    });
    await page.getByRole("button", { name: "Create daily note", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Daily note storage unavailable");
    await page.evaluate(() => Reflect.get(window, "restoreDailyWriter")());
    await page.getByRole("button", { name: "Create daily note", exact: true }).click();
    await expect(page).toHaveURL(/\/note\/[^?]+$/);
});
