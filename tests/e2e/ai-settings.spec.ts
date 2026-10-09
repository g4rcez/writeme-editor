import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const DEVICE_CODE = "ABCD-1234";
const PROXY_URL = "http://localhost:4079/proxy";

async function prepareDeviceFlow(page: Page, denyFirstCopy = false): Promise<{ requests: string[] }> {
    const requests: string[] = [];
    await page.addInitScript(
        ({ denyFirstCopy }) => {
            const copies: string[] = [];
            let denied = false;
            Object.defineProperty(window, "__testDeviceCodeCopies", { value: copies });
            Object.defineProperty(navigator, "clipboard", {
                configurable: true,
                value: {
                    writeText: async (code: string): Promise<void> => {
                        if (denyFirstCopy && !denied) {
                            denied = true;
                            throw new Error("Synthetic clipboard denial");
                        }
                        copies.push(code);
                    },
                },
            });
            const click = HTMLAnchorElement.prototype.click;
            HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement): void {
                if (this.href.startsWith("https://auth.openai.com/")) return;
                click.call(this);
            };
        },
        { denyFirstCopy },
    );
    await page.route(PROXY_URL, async (route) => {
        const headers = {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "content-type, x-target-url",
            "content-type": "application/json",
        };
        if (route.request().method() === "OPTIONS") {
            await route.fulfill({ status: 204, headers });
            return;
        }
        const target = route.request().headers()["x-target-url"] ?? "";
        requests.push(target);
        if (target !== "https://auth.openai.com/api/accounts/deviceauth/usercode") {
            await route.fulfill({ status: 403, headers, body: "Unexpected test provider request" });
            return;
        }
        await route.fulfill({
            status: 200,
            headers,
            body: JSON.stringify({
                user_code: DEVICE_CODE,
                device_auth_id: "synthetic-device-id",
                verification_url: "https://auth.openai.com/codex/device",
                interval: 5,
            }),
        });
    });
    return { requests };
}

async function chooseOpenAI(page: Page): Promise<void> {
    await page.goto("/settings/ai");
    await expect(page.getByRole("heading", { name: "AI", exact: true })).toBeVisible();
    if ((page.viewportSize()?.width ?? 1280) < 1024) {
        const openSidebar = page.locator(".writeme-aside-panel--open");
        if (await openSidebar.count()) {
            await page.keyboard.press("Escape");
            await expect(openSidebar).toHaveCount(0);
        }
    }
    await expect(page.getByRole("heading", { name: "Provider", exact: true })).toBeVisible();
    const selector = page.getByRole("combobox", { name: "Provider", exact: true });
    if (await selector.isVisible()) await selector.selectOption("openai");
    else await page.getByRole("button", { name: /^OpenAI/ }).click();
    await expect(page.getByRole("button", { name: "Sign in with OpenAI" })).toBeVisible();
}

test.describe("AI provider setup", () => {
    test("asks for storage consent and restores focus when canceled", async ({ cleanPage: page }) => {
        const state = await prepareDeviceFlow(page);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await chooseOpenAI(page);
        await expect(page.getByText("Before you connect", { exact: true })).toBeVisible();
        const signIn = page.getByRole("button", { name: "Sign in with OpenAI" });
        await signIn.click();
        const dialog = page.getByRole("dialog", { name: "Store credentials in this browser?" });
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText("without system Keychain protection");
        expect(state.requests).toEqual([]);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(signIn).toBeFocused();
        expect(state.requests).toEqual([]);
    });

    test("copies the device code automatically and keeps a manual copy control", async ({ cleanPage: page }) => {
        const state = await prepareDeviceFlow(page);
        await chooseOpenAI(page);
        await page.getByRole("button", { name: "Sign in with OpenAI" }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Allow and continue" }).click();
        const code = page.getByRole("textbox", { name: "Device authorization code" });
        await expect(code).toHaveValue(DEVICE_CODE);
        await expect(code).toHaveAttribute("readonly", "");
        await code.focus();
        expect(
            await code.evaluate((element) => {
                if (!(element instanceof HTMLInputElement)) throw new Error("Expected a code input");
                return { start: element.selectionStart, end: element.selectionEnd };
            }),
        ).toEqual({ start: 0, end: DEVICE_CODE.length });
        await expect(page.getByText("Code copied to clipboard.", { exact: true })).toBeVisible();
        expect(state.requests).toEqual(["https://auth.openai.com/api/accounts/deviceauth/usercode"]);
        expect(await page.evaluate((): unknown => Reflect.get(window, "__testDeviceCodeCopies"))).toEqual([
            DEVICE_CODE,
        ]);
        await page.getByRole("button", { name: "Copy code" }).click();
        await expect
            .poll(() => page.evaluate((): unknown => Reflect.get(window, "__testDeviceCodeCopies")))
            .toEqual([DEVICE_CODE, DEVICE_CODE]);
        await expect(page.getByRole("link", { name: "Open OpenAI sign-in page" })).toHaveAttribute(
            "href",
            "https://auth.openai.com/codex/device",
        );
        await page.getByRole("button", { name: "Cancel sign-in" }).click();
        await expect(code).toBeHidden();
    });

    test("keeps sign-in usable when automatic clipboard access is denied", async ({ cleanPage: page }) => {
        await prepareDeviceFlow(page, true);
        await chooseOpenAI(page);
        await page.getByRole("button", { name: "Sign in with OpenAI" }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Allow and continue" }).click();
        await expect(page.getByText(/Automatic copy was unavailable/)).toBeVisible();
        await expect(page.getByRole("button", { name: "Complete sign-in" })).toBeEnabled();
        await page.getByRole("button", { name: "Copy code" }).click();
        await expect(page.getByText("Code copied to clipboard.", { exact: true })).toBeVisible();
    });

    for (const width of [375, 768, 1280]) {
        test(`keeps provider setup in bounds at ${width}px`, async ({ cleanPage: page }) => {
            await page.setViewportSize({ width, height: 812 });
            await page.emulateMedia({ reducedMotion: "reduce" });
            await prepareDeviceFlow(page);
            await chooseOpenAI(page);
            await expect(page.getByRole("heading", { name: "Writing instructions", exact: true })).toBeVisible();
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            const selector = page.getByRole("combobox", { name: "Provider", exact: true });
            if (width < 1024) await expect(selector).toBeVisible();
            else await expect(selector).toBeHidden();
            await page.getByRole("button", { name: "Sign in with OpenAI" }).click();
            const dialog = page.getByRole("dialog");
            await expect(dialog).toBeVisible();
            const bounds = await dialog.boundingBox();
            if (!bounds) throw new Error("Storage dialog has no visible bounds.");
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
            await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        });
    }
});
