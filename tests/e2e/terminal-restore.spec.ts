import { expect, goHome, test } from "./fixtures";

test("restores a terminal tab on startup with a fresh shell", async ({ cleanPage: page }) => {
    await goHome(page);
    await page.keyboard.press("Control+Shift+P");
    await page.getByText("New Terminal", { exact: true }).click();
    await expect(page).toHaveURL(/\/terminal\/[^/]+$/);
    const terminalUrl = page.url();
    const terminal = page.getByRole("group", { name: "Terminal" }).first();
    const input = page.getByRole("textbox", { name: "Terminal" }).first();
    await expect(terminal).toBeVisible();
    await expect(terminal).toContainText("/workspace");
    await input.focus();
    await input.pressSequentially("echo PreviousShellOutput");
    await input.press("Enter");
    await expect(terminal).toContainText("PreviousShellOutput");

    await page.goto("/");

    await expect(page).toHaveURL(terminalUrl);
    await expect(terminal).toBeVisible();
    await expect(terminal).toContainText("Terminal session restarted");
    await expect(terminal).not.toContainText("PreviousShellOutput");
    await input.focus();
    await input.pressSequentially("echo RestoredShellReady");
    await input.press("Enter");
    await expect(terminal).toContainText("RestoredShellReady");
});
