import { addNoteComment, readCommentStorage, selectCommentWords } from "../helpers/comments";
import { createNote, expect, goHome, test } from "./fixtures";

test("persists sentence comments and offline replies in the production PWA", async ({
    cleanPage: page,
    context,
}, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await goHome(page);
    const sourceUrl = await createNote(page, "Production comments", "Review this production sentence.");
    await selectCommentWords(page, "Review this production sentence.");
    await addNoteComment(page, "Production comment");
    await expect
        .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 20_000 })
        .toBe(true);
    await context.setOffline(true);
    await page.reload();
    const panel = page.getByRole("complementary", { name: "Sentence comments" });
    await page
        .getByRole("textbox", { name: "Note editor", exact: true })
        .getByRole("link", { name: "Review this production sentence." })
        .click();
    await expect(panel).toContainText("Production comment");
    await panel.getByRole("button", { name: "Reply", exact: true }).click();
    await panel.getByRole("textbox", { name: "Comment", exact: true }).fill("Offline reply");
    await panel.getByRole("button", { name: "Save comment", exact: true }).click();
    await expect(panel.getByRole("list", { name: "Comments on this text" }).getByRole("listitem")).toHaveCount(2);
    await panel.getByRole("button", { name: "Resolve", exact: true }).click();
    await expect(panel).toContainText("Status: resolved");
    await page.reload();
    await page
        .getByRole("textbox", { name: "Note editor", exact: true })
        .getByRole("link", { name: "Review this production sentence." })
        .click();
    await expect(panel).toContainText("Offline reply");
    await expect(panel).toContainText("Status: resolved");
    expect((await readCommentStorage(page)).comments[0]?.comments).toEqual(["Production comment", "Offline reply"]);
    await panel.getByRole("button", { name: "Open comments note" }).click();
    await page
        .getByRole("toolbar", { name: "Note tools" })
        .getByRole("button", { name: "Markdown", exact: true })
        .click();
    const raw = page.getByRole("textbox", { name: "Markdown note editor", exact: true });
    await expect(raw).toContainText("Production comment");
    const markdown = await raw.innerText();
    await raw.focus();
    await raw.press("ControlOrMeta+a");
    await page.keyboard.insertText(markdown.replace("- Production comment", "- Edited offline comment"));
    await expect(raw).toContainText("Edited offline comment");
    await expect
        .poll(async () => (await readCommentStorage(page)).comments[0]?.comments, { timeout: 15_000 })
        .toEqual(["Edited offline comment", "Offline reply"]);
    await page.goto(sourceUrl);
    await page
        .getByRole("toolbar", { name: "Note tools" })
        .getByRole("button", { name: "Formatted", exact: true })
        .click();
    await page
        .getByRole("textbox", { name: "Note editor", exact: true })
        .getByRole("link", { name: "Review this production sentence." })
        .click();
    await expect(panel).toContainText("Edited offline comment");
    await expect(panel).toContainText("Status: resolved");
    await panel.getByRole("button", { name: "Reopen", exact: true }).click();
    await expect(panel).toContainText("Status: unresolved");
    expect((await readCommentStorage(page)).comments[0]?.history).toHaveLength(2);
    await expect(panel.getByRole("list", { name: "Comments on this text" }).getByRole("listitem")).toHaveCount(2);
    await page.screenshot({ path: testInfo.outputPath("offline-comments.png") });
    expect(errors).toEqual([]);
    await context.setOffline(false);
});
