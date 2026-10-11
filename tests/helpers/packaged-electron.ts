import { expect, type BrowserType, type Page, type TestInfo } from "@playwright/test";
import { access } from "node:fs/promises";
import path from "node:path";

export async function launchPackagedNotebook(
    profile: string,
    testInfo: TestInfo,
    chromium: BrowserType,
): Promise<{ page: Page; close: () => Promise<void> }> {
    const root = path.resolve(`out/writeme-${process.platform}-${process.arch}`);
    const executable = path.resolve(
        process.env.WRITEME_PACKAGED_EXECUTABLE ??
            (process.platform === "darwin"
                ? path.join(root, "writeme.app/Contents/MacOS/writeme")
                : path.join(root, process.platform === "win32" ? "writeme.exe" : "writeme")),
    );
    await access(executable);
    const context = await chromium.launchPersistentContext(profile, {
        executablePath: executable,
        headless: false,
        ignoreDefaultArgs: ["about:blank", "--no-startup-window"],
        viewport: { width: 1280, height: 800 },
        recordVideo: { dir: testInfo.outputPath("packaged-videos"), size: { width: 1280, height: 800 } },
    });
    const page = context.pages()[0] ?? (await context.waitForEvent("page"));
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    async function close(): Promise<void> {
        await context.close();
        const video = page.video();
        if (!video) throw new Error("Packaged Electron video was not recorded");
        await testInfo.attach("Packaged Electron session", { path: await video.path(), contentType: "video/webm" });
        expect(errors).toEqual([]);
    }
    try {
        await expect(page).toHaveURL(/app\.asar[\\/].*index\.html/);
        await expect(async () => {
            await access(path.join(profile, "writeme.sqlite"));
        }).toPass();
        return { page, close };
    } catch (error) {
        await close();
        throw error;
    }
}
