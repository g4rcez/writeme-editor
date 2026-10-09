import { createNote, goHome, test, expect } from "./fixtures";

test.describe("note context links", () => {
    test("shows outgoing notes and incoming link excerpts", async ({ cleanPage: page }) => {
        await goHome(page);
        const targetUrl = await createNote(page, "Link target");
        await createNote(page, "Link source", "This points to [[Link target|the roadmap]].");

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
