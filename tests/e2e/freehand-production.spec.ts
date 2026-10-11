import { expect, test } from "@playwright/test";
import { createConnection, createServer, type Socket } from "node:net";
import { addInk, expectSavedNotebook, navigateHome, writeNotebook } from "../helpers/handwriting";

test("persists ink and paper in the production bundle", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await writeNotebook(page);
    const url = page.url();
    await navigateHome(page);
    await expect(page.getByRole("heading", { name: "Make space for the next idea." })).toBeVisible();
    await page.goto(url);
    await expectSavedNotebook(page);
    await page.screenshot({ path: testInfo.outputPath("production-notebook.png") });
    expect(errors).toEqual([]);
});

test("reloads and saves ink when the app is unreachable", async ({ page, context, browserName, baseURL }, testInfo) => {
    const sockets = new Set<Socket>();
    const target = new URL(baseURL!);
    const proxy = createServer((client) => {
        const upstream = createConnection({ host: target.hostname, port: Number(target.port) });
        sockets.add(client);
        sockets.add(upstream);
        client.pipe(upstream);
        upstream.pipe(client);
        client.on("error", () => upstream.destroy());
        upstream.on("error", () => client.destroy());
        client.on("close", () => sockets.delete(client));
        upstream.on("close", () => sockets.delete(upstream));
    });
    const useServerOutage = browserName === "webkit";
    testInfo.annotations.push({
        type: "network disruption",
        description: useServerOutage
            ? "App server stopped; WebKit offline emulation is affected by https://github.com/microsoft/playwright/issues/42775"
            : "Browser context offline",
    });
    if (useServerOutage) await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
    const address = proxy.address();
    const origin =
        useServerOutage && address && typeof address !== "string" ? `http://127.0.0.1:${address.port}` : baseURL!;
    try {
        await page.goto(origin);
        await writeNotebook(page);
        await expect
            .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 20_000 })
            .toBe(true);
        if (useServerOutage) {
            for (const socket of sockets) socket.destroy();
            await new Promise<void>((resolve) => proxy.close(() => resolve()));
        } else await context.setOffline(true);
        await page.reload();
        await expectSavedNotebook(page);
        await addInk(page, 280);
        await page.reload();
        await expectSavedNotebook(page, 2);
    } finally {
        await context.setOffline(false);
        for (const socket of sockets) socket.destroy();
        if (proxy.listening) await new Promise<void>((resolve) => proxy.close(() => resolve()));
    }
});
