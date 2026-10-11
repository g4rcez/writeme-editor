import windowsScript from "./meeting-installers/install-whisper.ps1?raw";
import shellScript from "./meeting-installers/install-whisper.sh?raw";

export type MeetingInstallerOS = "macos" | "windows" | "linux";

export const MEETING_INSTALLER_LABELS: Record<MeetingInstallerOS, string> = {
    macos: "macOS",
    windows: "Windows",
    linux: "Linux",
};

export function detectMeetingInstallerOS(
    userAgent: string,
    platform: string,
    maxTouchPoints = 0,
): MeetingInstallerOS | "" {
    if (/Android|iPhone|iPad|iPod/i.test(userAgent) || (/Mac/i.test(platform) && maxTouchPoints > 1)) return "";
    if (/Win/i.test(platform)) return "windows";
    if (/Mac/i.test(platform)) return "macos";
    if (/Linux/i.test(platform)) return "linux";
    if (/Windows/i.test(userAgent)) return "windows";
    if (/Macintosh/i.test(userAgent)) return "macos";
    if (/Linux/i.test(userAgent)) return "linux";
    return "";
}

export function meetingInstaller(os: MeetingInstallerOS): { filename: string; content: string; command: string } {
    const filename = `writeme-install-whisper-${os}.${os === "windows" ? "ps1" : "sh"}`;
    return {
        filename,
        content: os === "windows" ? windowsScript.replace(/\r?\n/g, "\r\n") : shellScript,
        command:
            os === "windows"
                ? `powershell -NoProfile -ExecutionPolicy Bypass -File "$HOME\\Downloads\\${filename}"`
                : `bash "$HOME/Downloads/${filename}"`,
    };
}

export function downloadMeetingInstaller(os: MeetingInstallerOS): void {
    const installer = meetingInstaller(os);
    const url = URL.createObjectURL(new Blob([installer.content], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = installer.filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
