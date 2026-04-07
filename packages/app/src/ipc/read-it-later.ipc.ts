import { ipcMain } from "electron";
import puppeteer from "puppeteer-core";
import { findChromePath } from "@/lib/find-chrome";

export const readItLaterIpcHandler = () => {
  ipcMain.handle("read-it-later:fetch", async (_, url: string) => {
    const executablePath = findChromePath();
    if (!executablePath) {
      return {
        success: false,
        error:
          "No Chrome/Chromium installation found. Please install Google Chrome.",
      };
    }
    let browser;
    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
      const html = await page.evaluate((pageUrl: string) => {
        const base = new URL(pageUrl);
        const origin = base.origin;

        const resolve = (value: string) => {
          if (
            !value ||
            value.startsWith("data:") ||
            value.startsWith("blob:") ||
            value.startsWith("javascript:")
          )
            return value;
          try {
            return new URL(value, origin).href;
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
                      parts[0] = resolve(parts[0]);
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
    } catch (error: any) {
      console.error("read-it-later:fetch error:", error);
      return { success: false, error: error.message };
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  });
};
