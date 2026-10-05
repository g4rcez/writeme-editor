import { expect, test } from "./fixtures";

test("keeps slash-command suggestions above a caret near the viewport bottom", async ({ cleanPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 480 });
    await page.goto("/examples/eval");

    const editor = page.getByRole("textbox", { name: "Note editor" });
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    for (let index = 0; index < 24; index += 1) {
        await page.keyboard.press("Enter");
    }
    await page.keyboard.type("/");

    const menu = page.getByRole("listbox", { name: "Slash command suggestions" });
    await expect(menu).toBeVisible();

    const placement = await page.evaluate(() => {
        const popup = document.querySelector('[role="listbox"][aria-label="Slash command suggestions"]');
        const selection = window.getSelection();
        const caret = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
        const popupRect = popup?.getBoundingClientRect();
        if (!caret || !popupRect) return null;
        return { caretTop: caret.top, popupBottom: popupRect.bottom, viewportHeight: window.innerHeight };
    });
    if (!placement) throw new Error("Unable to read slash-command popup placement");
    expect(placement.popupBottom).toBeLessThanOrEqual(placement.viewportHeight);
    expect(placement.popupBottom).toBeLessThanOrEqual(placement.caretTop + 2);
});
