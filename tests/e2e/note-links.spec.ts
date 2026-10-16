import { createNote, goHome, test, expect } from "./fixtures";

test.describe("note context links", () => {
    test("shows outgoing notes and incoming link excerpts", async ({ cleanPage: page }) => {
        await goHome(page);
        const targetUrl = await createNote(page, "Link target");
        await createNote(page, "Link source");
        const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
        await editor.click();
        await editor.evaluate((element) => {
            const clipboardData = new DataTransfer();
            clipboardData.setData("text/plain", "This points to [[Link target|the roadmap]].");
            element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }));
        });
        await editor.press("ControlOrMeta+s");
        await expect(page.locator(".writeme-editor-status-bar output").first()).toHaveText("Saved", { timeout: 15_000 });

        await page.getByRole("button", { name: "Open note context" }).click();
        const sourceContext = page.getByRole("complementary", { name: "Context" });
        await sourceContext.getByText("Linked notes").click();
        await expect(sourceContext.getByRole("link", { name: "Link target" })).toBeVisible();

        await page.goto(targetUrl);
        await expect(page.getByRole("button", { name: "Open note context" })).toBeVisible();
        await page.getByRole("button", { name: "Open note context" }).click();
        const targetContext = page.getByRole("complementary", { name: "Context" });
        await targetContext.getByText("Incoming links").click();
        await expect(targetContext.getByRole("link", { name: "Link source" })).toBeVisible();
        await expect(targetContext.getByText("This points to the roadmap.")).toBeVisible();
    });
});
