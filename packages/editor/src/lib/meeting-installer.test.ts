import { describe, expect, it, vi } from "vitest";
import { detectMeetingInstallerOS, downloadMeetingInstaller, meetingInstaller } from "./meeting-installer";

describe("local transcription installers", () => {
    it.each([
        ["Macintosh", "MacIntel", 0, "macos"],
        ["Windows NT", "Win32", 0, "windows"],
        ["Linux", "Linux x86_64", 0, "linux"],
        ["Android", "Linux armv8l", 5, ""],
        ["iPhone", "iPhone", 5, ""],
        ["Macintosh", "MacIntel", 5, ""],
        ["unknown", "", 0, ""],
    ])("detects %s on %s", (userAgent, platform, touch, expected) => {
        expect(detectMeetingInstallerOS(userAgent, platform, touch)).toBe(expected);
    });

    it("uses native shell commands and Windows line endings", () => {
        expect(meetingInstaller("macos").command).toContain('bash "$HOME/Downloads/');
        expect(meetingInstaller("linux").filename).toMatch(/linux\.sh$/);
        const windows = meetingInstaller("windows");
        expect(windows.command).toContain("powershell -NoProfile -ExecutionPolicy Bypass -File");
        expect(windows.content).toContain("\r\n");
        expect(windows.content.replaceAll("\r\n", "")).not.toContain("\n");
    });

    it("downloads the installer and releases its temporary URL", () => {
        vi.useFakeTimers();
        const create = vi.fn(() => "blob:installer");
        const revoke = vi.fn();
        vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
        const click = vi
            .spyOn(HTMLAnchorElement.prototype, "click")
            .mockImplementation(function (this: HTMLAnchorElement) {
                expect(this.download).toBe("writeme-install-whisper-windows.ps1");
                expect(this.isConnected).toBe(true);
            });
        try {
            downloadMeetingInstaller("windows");
            expect(click).toHaveBeenCalledOnce();
            expect(revoke).not.toHaveBeenCalled();
            vi.runAllTimers();
            expect(revoke).toHaveBeenCalledWith("blob:installer");
            expect(document.querySelector("a[download]")).toBeNull();
        } finally {
            vi.restoreAllMocks();
            vi.unstubAllGlobals();
            vi.useRealTimers();
        }
    });
});
