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
    await page.goto("/tasks", { waitUntil: "domcontentloaded" });
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
    await page.reload({ waitUntil: "domcontentloaded" });
    await page
        .getByRole("navigation", { name: "Workspace views", exact: true })
        .getByRole("button", { name: "Open tasks", exact: true })
        .click();
    await expect(tasks.getByRole("link")).toHaveCount(5);
    await tasks.getByRole("link", { name: "Open Board task in Release board, Todo", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/note/${ids.board}`));
    await expect(page.getByRole("button", { name: "Edit Board task", exact: true })).toBeFocused();
    await page
        .getByRole("navigation", { name: "Workspace navigation", exact: true })
        .getByRole("button", { name: "Open tasks", exact: true })
        .click();
    await expect(tasks.getByRole("link")).toHaveCount(5);
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
    test.setTimeout(120_000);
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
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open workspace menu", exact: true })).toBeVisible();
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
        const seededDaily = daily.find(
            (note: { metadata: Record<string, unknown> }) => note.metadata.journalDate === "2025-12-31",
        );
        if (
            daily.length !== 2 ||
            seededDaily?.content !== "# Review\n\n- [ ] Reflect on today\n\nPreserved journal content\n"
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

test("opens nested board tasks at their Markdown source and following tasks at their own card", async ({
    cleanPage: page,
}) => {
    // These imports must execute in the page's Vite module graph, not Playwright's Node process.
    await goHome(page);
    const id = await page.evaluate(async () => {
        const notePath = "/packages/editor/src/store/note.ts";
        const repositoryPath = "/packages/editor/src/store/repositories/index.ts";
        const { Note, NoteType } = await import(notePath);
        const { repositories } = await import(repositoryPath);
        const note = Note.new(
            "Nested board",
            "---\ntype: task\n---\n\n## Todo\n\n- [ ] Parent\n  - [ ] Child\n- [ ] Later\n",
            NoteType.task,
        );
        await repositories.notes.save(note);
        return note.id;
    });
    await page.goto("/tasks");
    await page.getByRole("link", { name: "Open Child in Nested board, Todo", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/note/${id}\\?task=1&line=8`));
    await expect(page.getByRole("textbox", { name: "Markdown note editor", exact: true })).toBeFocused();
    await expect
        .poll(() =>
            page.evaluate(async () => {
                const modulePath = "/node_modules/@codemirror/view/dist/index.js";
                const { EditorView } = await import(modulePath);
                const view = EditorView.findFromDOM(document.querySelector(".cm-editor")!);
                return view?.state.doc.lineAt(view.state.selection.main.head).text;
            }),
        )
        .toBe("  - [ ] Child");
    await page.goto("/tasks");
    await page.getByRole("link", { name: "Open Later in Nested board, Todo", exact: true }).click();
    await expect(page.getByRole("button", { name: "Edit Later", exact: true })).toBeFocused();
    await expect(page.getByRole("button", { name: "Edit Parent", exact: true })).not.toBeFocused();
});

test("adopts legacy title-only journal dates before H1 synchronization and reuses them after reload", async ({
    cleanPage: page,
}) => {
    await goHome(page);
    const id = await page.evaluate(async () => {
        const notePath = "/packages/editor/src/store/note.ts";
        const repositoryPath = "/packages/editor/src/store/repositories/index.ts";
        const { Note, NoteType } = await import(notePath);
        const { repositories } = await import(repositoryPath);
        const note = Note.parse({
            ...Note.new("2025-12-31-quicknote.md", "# Retrospective\n\nPreserved legacy content\n", NoteType.quick),
            createdAt: new Date(2026, 0, 7),
        });
        await repositories.notes.save(note);
        return note.id;
    });
    // Opening directly must also preserve identity, without going through the daily service.
    await page.goto(`/note/${id}`, { waitUntil: "domcontentloaded" });
    await expect
        .poll(() =>
            page.evaluate(async (id) => {
                const repositoryPath = "/packages/editor/src/store/repositories/index.ts";
                const { repositories } = await import(repositoryPath);
                const note = await repositories.notes.getOne(id);
                return {
                    title: note.title,
                    journalDate: note.metadata.journalDate,
                    content: note.content,
                    createdAt: note.createdAt.getTime(),
                };
            }, id),
        )
        .toEqual({
            title: "Retrospective",
            journalDate: "2025-12-31",
            content: "# Retrospective\n\nPreserved legacy content\n",
            createdAt: new Date(2026, 0, 7).getTime(),
        });
    await page.goto("/today?date=2025-12-31", { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open daily note", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/note/${id}$`));
    await page.goto("/calendar?date=2025-12-31", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("grid").getByRole("button", { name: /Retrospective/ })).toBeVisible();
    expect(
        await page.evaluate(async () => {
            const repositoryPath = "/packages/editor/src/store/repositories/index.ts";
            const { repositories } = await import(repositoryPath);
            return (await repositories.notes.getAll()).filter((note: { noteType: string }) => note.noteType === "quick")
                .length;
        }),
    ).toBe(1);
});

async function deferDailyLookup(page: Page): Promise<void> {
    await page.evaluate(async () => {
        const repositoryPath = "/packages/editor/src/store/repositories/index.ts";
        const { repositories } = await import(repositoryPath);
        const original = repositories.notes.getQuicknoteByDate.bind(repositories.notes);
        const gate = Promise.withResolvers<void>();
        const settled = Promise.withResolvers<void>();
        Reflect.set(window, "releaseDailyLookup", gate.resolve);
        Reflect.set(window, "dailyLookupSettled", settled.promise);
        repositories.notes.getQuicknoteByDate = async (date: Date) => {
            Reflect.set(window, "dailyLookupStarted", true);
            await gate.promise;
            repositories.notes.getQuicknoteByDate = original;
            const note = await original(date);
            settled.resolve();
            return note;
        };
    });
}

for (const intent of ["change date", "leave Today", "cancel calendar", "leave calendar"] as const) {
    test(`does not redirect an obsolete daily request after ${intent}`, async ({ cleanPage: page }) => {
        await goHome(page);
        await seedNotes(page);
        const calendar = intent.includes("calendar");
        await page.goto(`/${calendar ? "calendar" : "today"}?date=2025-12-31`);
        if (calendar) {
            await page
                .getByRole("grid")
                .getByRole("button", { name: /Wednesday, Dec 31, 2025/ })
                .click();
            await page.getByRole("button", { name: "12:00", exact: true }).click();
        }
        await deferDailyLookup(page);
        await page.getByRole("button", { name: "Open daily note", exact: true }).click();
        await expect.poll(() => page.evaluate(() => Reflect.get(window, "dailyLookupStarted"))).toBe(true);
        if (intent === "change date") await page.getByRole("button", { name: "Next day", exact: true }).click();
        else if (intent === "cancel calendar") await page.getByRole("button", { name: "Cancel", exact: true }).click();
        else if (intent === "leave calendar")
            await page.evaluate(() => {
                window.history.pushState(null, "", "/tasks");
                window.dispatchEvent(new PopStateEvent("popstate"));
            });
        else await page.getByRole("button", { name: "Open tasks", exact: true }).first().click();
        const destination = page.url();
        await page.evaluate(async () => {
            Reflect.get(window, "releaseDailyLookup")();
            await Reflect.get(window, "dailyLookupSettled");
            const settling = Promise.withResolvers<void>();
            setTimeout(settling.resolve, 200);
            await settling.promise;
        });
        await expect(page).toHaveURL(destination);
        await expect(page.getByRole("dialog", { name: "New note", exact: true })).toBeHidden();
        if (intent === "change date") {
            await expect(page.getByLabel("Journal date")).toHaveValue("2026-01-01");
            await expect(page.getByRole("button", { name: "Create daily note", exact: true })).toBeEnabled();
        }
    });
}
