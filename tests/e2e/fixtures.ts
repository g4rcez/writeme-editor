import { test as base, expect, type Page } from "@playwright/test";

export const test = base.extend<{ cleanPage: Page }>({
  cleanPage: async ({ page }, use) => {
    await use(page);
  },
});

export const goHome = async (page: Page) => {
  await page.goto("/");
  await expect(page.getByText("Quick Actions")).toBeVisible();
};

export { expect };
