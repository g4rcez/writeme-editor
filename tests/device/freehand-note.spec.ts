import { expect, test, type AndroidDevice, type BrowserContext } from "@playwright/test";
import { mkdir, readdir } from "node:fs/promises";
import { createConnection } from "node:net";
import { expectSavedNotebook, writeNotebook } from "../helpers/handwriting";

test("saves physical pen pressure and ink after reopening Chrome @physical-pen", async ({ playwright }, testInfo) => {
    const baseURL = process.env.PLAYWRIGHT_DEVICE_BASE_URL;
    if (!baseURL)
        throw new Error("Set PLAYWRIGHT_DEVICE_BASE_URL to the test app's HTTPS or device-local localhost URL.");
    const origin = new URL(baseURL);
    const localHTTP = origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
    if (origin.protocol !== "https:" && !localHTTP)
        throw new Error("The device test requires HTTPS or localhost for a secure browser context.");
    const videoDirectory = testInfo.outputPath("videos");
    await mkdir(videoDirectory, { recursive: true });
    let device: AndroidDevice | undefined;
    let context: BrowserContext | undefined;
    try {
        await new Promise<void>((resolve, reject) => {
            const connection = createConnection({ host: "127.0.0.1", port: 5037 });
            const fail = (): void => {
                connection.destroy();
                reject(
                    new Error(
                        "ADB is unavailable. Start adb, authorize a physical device and check adb devices before running this test.",
                    ),
                );
            };
            connection.setTimeout(3000, fail);
            connection.once("error", fail);
            connection.once("connect", () => {
                connection.destroy();
                resolve();
            });
        });
        const devices = await playwright._android.devices({ omitDriverInstall: true }).catch((error: unknown) => {
            throw new Error(
                "Cannot connect to ADB. Start adb, authorize a physical device and check adb devices before running this test.",
                { cause: error },
            );
        });
        const serial = process.env.PLAYWRIGHT_ANDROID_SERIAL;
        const candidates = serial ? devices.filter((candidate) => candidate.serial() === serial) : devices;
        if (candidates.length !== 1) {
            await Promise.all(devices.map((candidate) => candidate.close()));
            throw new Error(
                "Connect exactly one authenticated Android device, or select it with PLAYWRIGHT_ANDROID_SERIAL. No emulation fallback is used.",
            );
        }
        device = candidates[0];
        await Promise.all(devices.filter((candidate) => candidate !== device).map((candidate) => candidate.close()));
        if (!device) throw new Error("No Android device was selected.");
        const emulator = (await device.shell("getprop ro.kernel.qemu")).toString().trim();
        expect(emulator, "Physical pen sign-off cannot run on an Android emulator").not.toBe("1");
        const version = (await device.shell("getprop ro.build.version.release")).toString().trim();
        await testInfo.attach("Physical device", {
            body: JSON.stringify({ model: device.model(), androidVersion: version, physicalDevice: true }),
            contentType: "application/json",
        });
        const launch = (): Promise<BrowserContext> =>
            device!.launchBrowser({ baseURL, viewport: null, recordVideo: { dir: videoDirectory } });
        context = await launch();
        const page = context.pages()[0] ?? (await context.newPage());
        await page.goto("/");
        await expect.poll(() => page.evaluate(() => window.isSecureContext)).toBe(true);
        expect(
            await page.evaluate(() => navigator.maxTouchPoints),
            "The physical device must support touch input",
        ).toBeGreaterThan(0);
        await writeNotebook(page);
        const canvas = page.getByLabel("Handwriting canvas", { exact: true });
        await canvas.evaluate((element) => {
            const pressures: number[] = [];
            let completed = 0;
            const record = (event: Event): void => {
                if (!(event instanceof PointerEvent) || !event.isTrusted || event.pointerType !== "pen") return;
                if (event.type === "pointerup") completed += 1;
                else if (event.pressure > 0) pressures.push(event.pressure);
                element.setAttribute("data-physical-pen", JSON.stringify({ completed, pressures }));
            };
            for (const name of ["pointerdown", "pointermove", "pointerup"]) element.addEventListener(name, record);
        });
        console.log(
            "On the connected tablet, draw TWO separate pen strokes, varying pressure from light to firm. Keep fingers off the canvas for this measured step.",
        );
        await expect
            .poll(
                async () => {
                    const value = await canvas.getAttribute("data-physical-pen");
                    if (!value) return 0;
                    const sample: { completed: number } = JSON.parse(value);
                    return sample.completed;
                },
                { timeout: 120_000 },
            )
            .toBe(2);
        await expectSavedNotebook(page, 3);
        const raw = await canvas.getAttribute("data-physical-pen");
        if (!raw) throw new Error("No physical pen events were captured.");
        const sample: { completed: number; pressures: number[] } = JSON.parse(raw);
        expect(sample.pressures.length).toBeGreaterThan(2);
        expect(
            Math.max(...sample.pressures) - Math.min(...sample.pressures),
            "Vary physical pen pressure from light to firm",
        ).toBeGreaterThan(0.1);
        await testInfo.attach("Trusted pen events", { body: raw, contentType: "application/json" });
        const paths = await canvas
            .locator("[data-ink-stroke]")
            .evaluateAll((elements) => elements.map((element) => element.getAttribute("d")));
        const source = page.url();
        await page.reload();
        await expectSavedNotebook(page, 3);
        await context.close();
        context = undefined;
        context = await launch();
        const reopened = context.pages()[0] ?? (await context.newPage());
        await reopened.goto(source);
        await expectSavedNotebook(reopened, 3);
        expect(
            await reopened
                .locator("[data-ink-stroke]")
                .evaluateAll((elements) => elements.map((element) => element.getAttribute("d"))),
        ).toEqual(paths);
        await testInfo.attach("Reopened physical notebook", {
            body: await reopened.screenshot(),
            contentType: "image/png",
        });
    } finally {
        try {
            await context?.close();
        } finally {
            await device?.close();
            for (const filename of await readdir(videoDirectory)) {
                if (filename.endsWith(".webm"))
                    await testInfo.attach("Physical Android session", {
                        path: testInfo.outputPath("videos", filename),
                        contentType: "video/webm",
                    });
            }
        }
    }
});
