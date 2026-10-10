import { createNote, expect, goHome, test } from "./fixtures";

const endOfLine = process.platform === "darwin" ? "Meta+ArrowRight" : "End";

for (const [command, result] of [
    [">>math 1 + 1=", "1 + 1 = 2"],
    [">>rule3(2, 4, x, 8)", "x = 4"],
    [">>rule3(2/4, x/8)", "x = 4"],
] as const) {
    test(`replaces ${command} after text in a normal paragraph`, async ({ cleanPage: page }) => {
        await goHome(page);
        await createNote(page, "Paragraph text commands", "Existing paragraph.");
        const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
        const paragraph = editor.locator("p").filter({ hasText: "Existing paragraph." }).last();
        await paragraph.click();
        await paragraph.press(endOfLine);
        await editor.pressSequentially(` ${command}`);
        await expect(paragraph).toHaveText(`Existing paragraph. ${result}`);
    });
}

for (const [type, selector, prefix, expected] of [
    ["paragraph", "p", "Existing paragraph.", /^Existing paragraph\. \d{4}-\d{2}-\d{2}$/],
    ["heading", "h1", "Paragraph text commands", /^Paragraph text commands \d{4}-\d{2}-\d{2}$/],
] as const) {
    test(`runs the space-triggered date command in a ${type}`, async ({ cleanPage: page }) => {
        await goHome(page);
        await createNote(page, "Paragraph text commands", "Existing paragraph.");
        const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
        const block = editor.locator(selector).filter({ hasText: prefix }).last();
        await block.click();
        await block.press(endOfLine);
        await editor.pressSequentially(" >>date");
        await editor.press("Space");
        await expect(block).toHaveText(expected);
    });
}

for (const [command, expected] of [
    [">>time", /^Existing paragraph\. \d{2}:\d{2}$/],
    [">>datetime", /^Existing paragraph\. \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/],
    [">>uuid", /^Existing paragraph\. [0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i],
] as const) {
    test(`runs the space-triggered ${command} command in a paragraph`, async ({ cleanPage: page }) => {
        await goHome(page);
        await createNote(page, "Paragraph text commands", "Existing paragraph.");
        const editor = page.getByRole("textbox", { name: "Note editor", exact: true });
        const paragraph = editor.locator("p").filter({ hasText: "Existing paragraph." }).last();
        await paragraph.click();
        await paragraph.press(endOfLine);
        await editor.pressSequentially(` ${command}`);
        await editor.press("Space");
        await expect(paragraph).toHaveText(expected);
    });
}
