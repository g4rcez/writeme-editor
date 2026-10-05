import { expect, test } from "./fixtures";

test("renders filename headers for code and math fences", async ({ cleanPage: page }) => {
    await page.goto("/examples/code-run");

    const codeBlock = page.locator(".node-codeBlock").filter({ hasText: "example.js" });
    await expect(codeBlock.getByText("example.js", { exact: true })).toBeVisible();
    await expect(codeBlock.getByRole("combobox", { name: "Code language" })).toHaveValue("javascript");
    await expect(codeBlock.getByRole("button", { name: "Copy", exact: true })).toBeVisible();

    const mathBlock = page.locator(".node-codeBlock").filter({ hasText: "calculation.math" });
    await expect(mathBlock.getByText("calculation.math", { exact: true })).toBeVisible();
    await expect(mathBlock.getByRole("combobox", { name: "Code language" })).toHaveValue("math");
    await expect(mathBlock.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
});
