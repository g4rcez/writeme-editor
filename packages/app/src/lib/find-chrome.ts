import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const MAC_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
];

const LINUX_BINARIES = [
  "google-chrome",
  "google-chrome-stable",
  "chromium-browser",
  "chromium",
];

const WIN_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
];

function which(bin: string): string | null {
  try {
    const result = execFileSync("which", [bin], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

export function findChromePath(): string | null {
  const platform = process.platform;

  if (platform === "darwin") {
    for (const p of MAC_PATHS) {
      if (existsSync(p)) return p;
    }
  } else if (platform === "linux") {
    for (const bin of LINUX_BINARIES) {
      const path = which(bin);
      if (path) return path;
    }
  } else if (platform === "win32") {
    for (const p of WIN_PATHS) {
      if (p && existsSync(p)) return p;
    }
  }

  return null;
}
