import os from "node:os";
import path from "node:path";

export function getSocketPath(): string {
    if (process.platform === "win32") {
        return "\\\\.\\pipe\\writeme-cli";
    }
    if (process.platform === "darwin") {
        return path.join(os.homedir(), "Library", "Application Support", "writeme", "writeme.sock");
    }
    return path.join(os.homedir(), ".config", "writeme", "writeme.sock");
}

export function getDbPath(): string {
    if (process.platform === "win32") {
        return path.join(
            process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"),
            "writeme",
            "writeme.sqlite",
        );
    }
    if (process.platform === "darwin") {
        return path.join(os.homedir(), "Library", "Application Support", "writeme", "writeme.sqlite");
    }
    return path.join(os.homedir(), ".config", "writeme", "writeme.sqlite");
}

export function getAppBinary(): string {
    if (process.platform === "win32") return "writeme.exe";
    if (process.platform === "darwin") return "/Applications/writeme.app/Contents/MacOS/writeme";
    return "writeme";
}
