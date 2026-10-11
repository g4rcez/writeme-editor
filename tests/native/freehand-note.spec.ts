import { expect, test, type ElectronApplication } from "@playwright/test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expectSavedNotebook, writeNotebook } from "../helpers/handwriting";
import { launchPackagedNotebook } from "../helpers/packaged-electron";

test("persists handwriting through the compiled Electron renderer and SQLite", async ({ playwright }, testInfo) => {
    const directory = await mkdtemp(path.join(tmpdir(), "writeme-handwriting-native-"));
    const bootstrap = path.join(directory, "bootstrap.cjs");
    await writeFile(
        bootstrap,
        `const { app } = require("electron");\napp.setPath("appData", ${JSON.stringify(directory)});\napp.setPath("userData", ${JSON.stringify(directory)});\nrequire(${JSON.stringify(path.resolve(".vite/build/main.js"))});\n`,
    );
    const launch = (): Promise<ElectronApplication> =>
        playwright._electron.launch({
            args: [bootstrap, "--no-sandbox"],
            env: { ...process.env, NODE_ENV: "production" },
            recordVideo: { dir: testInfo.outputPath("videos"), size: { width: 1280, height: 800 } },
        });
    await mkdir(testInfo.outputPath("videos"), { recursive: true });
    let application: ElectronApplication | undefined;
    try {
        application = await launch();
        const userData = await application.evaluate(({ app }) => app.getPath("userData"));
        expect(userData.startsWith(directory + path.sep)).toBe(true);
        const page = await application.firstWindow();
        await expect(page).toHaveURL(/^file:/);
        await writeNotebook(page);
        await page.reload();
        await expectSavedNotebook(page);
        await page.screenshot({ path: testInfo.outputPath("native-notebook.png") });
        await testInfo.attach("Native notebook", {
            path: testInfo.outputPath("native-notebook.png"),
            contentType: "image/png",
        });
        await application.close();
        application = undefined;
        application = await launch();
        await expectSavedNotebook(await application.firstWindow());
    } finally {
        try {
            await application?.close();
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
        for (const filename of await readdir(testInfo.outputPath("videos"))) {
            if (filename.endsWith(".webm"))
                await testInfo.attach("Electron session", {
                    path: testInfo.outputPath("videos", filename),
                    contentType: "video/webm",
                });
        }
    }
});

test("persists handwriting through the packaged application and SQLite restart", async ({ playwright }, testInfo) => {
    const profile = await mkdtemp(path.join(tmpdir(), "writeme-handwriting-packaged-"));
    let application: Awaited<ReturnType<typeof launchPackagedNotebook>> | undefined;
    try {
        application = await launchPackagedNotebook(profile, testInfo, playwright.chromium);
        await writeNotebook(application.page);
        await application.page.reload();
        await expectSavedNotebook(application.page);
        await testInfo.attach("Packaged notebook", {
            body: await application.page.screenshot(),
            contentType: "image/png",
        });
        await application.close();
        application = undefined;
        application = await launchPackagedNotebook(profile, testInfo, playwright.chromium);
        await expectSavedNotebook(application.page);
    } finally {
        try {
            await application?.close();
        } finally {
            await rm(profile, { recursive: true, force: true });
        }
    }
});
