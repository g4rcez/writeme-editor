import { ipcMain } from "electron";
import puppeteer, { type Browser } from "puppeteer-core";
import { findChromePath } from "@/lib/find-chrome";
import { createCachedLookup, isPublicHttpUrl } from "./read-it-later-url";

const LAUNCH_ARGS = ["--disable-dev-shm-usage", "--disable-gpu"];

const IDLE_TIMEOUT = 30_000;
let browserInstance: Browser | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

async function getBrowser(executablePath: string): Promise<Browser> {
    if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
    }
    if (!browserInstance || !browserInstance.connected) {
        browserInstance = await puppeteer.launch({
            executablePath,
            headless: true,
            args: LAUNCH_ARGS,
        });
    }
    return browserInstance;
}

function scheduleBrowserClose() {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(async () => {
        if (browserInstance) {
            await browserInstance
                .close()
                .catch((error: unknown) => console.warn("read-it-later: browser close failed:", error));
            browserInstance = null;
        }
    }, IDLE_TIMEOUT);
}

export const readItLaterIpcHandler = () => {
    ipcMain.handle("read-it-later:fetch", async (_, url: string) => {
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
                return { success: false, error: "Only HTTP(S) URLs are supported" };
            }
        } catch {
            return { success: false, error: "Invalid URL" };
        }
        if (!(await isPublicHttpUrl(url))) {
            return { success: false, error: "Private or local addresses are not supported" };
        }

        const executablePath = findChromePath();
        if (!executablePath) {
            return {
                success: false,
                error: "No Chrome/Chromium installation found. Please install Google Chrome.",
            };
        }

        let page: Awaited<ReturnType<Browser["newPage"]>> | null = null;
        try {
            const browser = await getBrowser(executablePath);
            page = await browser.newPage();
            // Every request, including redirects and subresources, must target a public host.
            await page.setRequestInterception(true);
            const lookup = createCachedLookup();
            page.on("request", (request) => {
                const target = request.url();
                if (target.startsWith("data:") || target.startsWith("blob:") || target === "about:blank") {
                    void request.continue();
                    return;
                }
                isPublicHttpUrl(target, lookup)
                    .then((allowed) => (allowed ? request.continue() : request.abort("blockedbyclient")))
                    .catch((error: unknown) => console.warn("[read-it-later] request handling failed", error));
            });
            await page.setUserAgent(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            );
            await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
            const html = await page.evaluate((pageUrl: string) => {
                const resolve = (value: string) => {
                    if (
                        !value ||
                        value.startsWith("data:") ||
                        value.startsWith("blob:") ||
                        value.startsWith("javascript:")
                    )
                        return value;
                    try {
                        return new URL(value, pageUrl).href;
                    } catch {
                        return value;
                    }
                };

                const attrs: Record<string, string[]> = {
                    a: ["href"],
                    img: ["src", "srcset"],
                    video: ["src", "poster"],
                    audio: ["src"],
                    source: ["src", "srcset"],
                    link: ["href"],
                    iframe: ["src"],
                    object: ["data"],
                    embed: ["src"],
                };

                for (const [tag, attrList] of Object.entries(attrs)) {
                    for (const el of document.querySelectorAll(tag)) {
                        for (const attr of attrList) {
                            const val = el.getAttribute(attr);
                            if (!val) continue;
                            if (attr === "srcset") {
                                el.setAttribute(
                                    attr,
                                    val
                                        .split(",")
                                        .map((entry) => {
                                            const parts = entry.trim().split(/\s+/);
                                            parts[0] = resolve(parts[0] ?? "");
                                            return parts.join(" ");
                                        })
                                        .join(", "),
                                );
                            } else {
                                el.setAttribute(attr, resolve(val));
                            }
                        }
                    }
                }

                return document.documentElement.outerHTML;
            }, url);
            return { success: true, html };
        } catch (error: unknown) {
            console.error("read-it-later:fetch error:", error);
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
        } finally {
            if (page)
                await page.close().catch((error: unknown) => console.warn("read-it-later: page close failed:", error));
            scheduleBrowserClose();
        }
    });
};
