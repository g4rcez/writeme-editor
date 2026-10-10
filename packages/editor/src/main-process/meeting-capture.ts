import { desktopCapturer, dialog, type Session } from "electron";

export function registerMeetingCapture(session: Session, rendererUrl: string): void {
    session.setDisplayMediaRequestHandler(
        (request, callback) => {
            const selectSource = async (): Promise<void> => {
                try {
                    const frameUrl = request.frame ? new URL(request.frame.url) : null;
                    const trustedUrl = new URL(rendererUrl);
                    if (
                        !request.userGesture ||
                        !frameUrl ||
                        request.frame?.parent !== null ||
                        frameUrl.origin !== trustedUrl.origin ||
                        frameUrl.pathname !== trustedUrl.pathname
                    ) {
                        callback({});
                        return;
                    }
                    const sources = await desktopCapturer.getSources({
                        types: ["screen"],
                        thumbnailSize: { width: 0, height: 0 },
                    });
                    if (!sources.length) {
                        callback({});
                        return;
                    }
                    const selection = await dialog.showMessageBox({
                        title: "Record meeting audio",
                        message: "Choose a screen to share its system audio.",
                        detail: "Only audio is recorded. Screen video is not saved.",
                        buttons: [...sources.map((source) => source.name), "Cancel"],
                        cancelId: sources.length,
                        defaultId: sources.length,
                        noLink: true,
                    });
                    const source = sources[selection.response];
                    if (!source) {
                        callback({});
                        return;
                    }
                    callback({ video: source, ...(request.audioRequested ? { audio: "loopback" } : {}) });
                } catch (error) {
                    console.error("Meeting audio source selection failed:", error);
                    callback({});
                }
            };
            void selectSource();
        },
        { useSystemPicker: true },
    );
}
