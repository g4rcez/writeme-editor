import { desktopCapturer, dialog, session, type DisplayMediaRequestHandlerHandlerRequest } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerMeetingCapture } from "./meeting-capture";

vi.mock("electron", () => ({
    desktopCapturer: { getSources: vi.fn() },
    dialog: { showMessageBox: vi.fn() },
    session: { defaultSession: { setDisplayMediaRequestHandler: vi.fn() } },
}));

beforeEach(() => {
    vi.resetAllMocks();
});

async function requestCapture(overrides: Partial<DisplayMediaRequestHandlerHandlerRequest> = {}): Promise<unknown> {
    registerMeetingCapture(session.defaultSession, "http://localhost:5173/");
    const handler = vi.mocked(session.defaultSession.setDisplayMediaRequestHandler).mock.calls[0]?.[0];
    if (!handler) throw new Error("Capture handler was not registered.");
    const request = {
        userGesture: true,
        audioRequested: true,
        frame: { url: "http://localhost:5173/" },
        ...overrides,
    } as DisplayMediaRequestHandlerHandlerRequest;
    return new Promise((resolve) => handler(request, resolve));
}

describe("Electron meeting capture", () => {
    it("uses the native picker and grants selected screen audio without muting playback", async () => {
        const source = { id: "screen:0", name: "Screen 1" };
        vi.mocked(desktopCapturer.getSources).mockResolvedValue([source as Electron.DesktopCapturerSource]);
        vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false });
        expect(await requestCapture()).toEqual({ video: source, audio: "loopback" });
        expect(session.defaultSession.setDisplayMediaRequestHandler).toHaveBeenCalledWith(expect.any(Function), {
            useSystemPicker: true,
        });
    });

    it("denies requests without a gesture or from another renderer", async () => {
        expect(await requestCapture({ userGesture: false })).toEqual({});
        expect(await requestCapture({ frame: { url: "https://example.com/" } as Electron.WebFrameMain })).toEqual({});
        expect(desktopCapturer.getSources).not.toHaveBeenCalled();
    });

    it("honors source-picker cancellation", async () => {
        vi.mocked(desktopCapturer.getSources).mockResolvedValue([
            { id: "screen:0", name: "Screen 1" } as Electron.DesktopCapturerSource,
        ]);
        vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
        expect(await requestCapture()).toEqual({});
    });
});
