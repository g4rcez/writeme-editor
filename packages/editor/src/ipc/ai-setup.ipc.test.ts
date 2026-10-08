import { beforeEach, describe, expect, it, vi } from "vitest";

type Frame = { url: string };
type SetupEvent = { senderFrame: Frame | null; sender: { mainFrame: Frame } };
type Handler = (event: SetupEvent, value?: unknown) => unknown;

const mocks = vi.hoisted(() => ({
    handle: vi.fn<(channel: string, handler: Handler) => void>(),
    prepareCredentialStorage: vi.fn(),
    writeText: vi.fn(),
    ready: vi.fn(() => true),
    syncAvailable: vi.fn(() => false),
    asyncAvailable: vi.fn(async () => true),
}));

vi.mock("electron", () => ({
    app: { isReady: mocks.ready },
    clipboard: { writeText: mocks.writeText },
    ipcMain: { handle: mocks.handle },
    safeStorage: {
        isEncryptionAvailable: mocks.syncAvailable,
        isAsyncEncryptionAvailable: mocks.asyncAvailable,
    },
}));
vi.mock("../main-process/credential-storage", () => ({
    prepareCredentialStorage: mocks.prepareCredentialStorage,
}));

import { registerAISetupHandlers } from "./ai-setup.ipc";

const rendererUrl = "file:///Applications/Write%20Me.app/Contents/Resources/app.asar/index.html";

function invoke(channel: string, url: string | null, value?: unknown, mainFrame = true): unknown {
    const handler = mocks.handle.mock.calls.find(([name]) => name === channel)?.[1];
    if (!handler) throw new Error("Setup handler not registered.");
    const frame = url === null ? null : { url };
    return handler(
        { senderFrame: frame, sender: { mainFrame: mainFrame && frame ? frame : { url: rendererUrl } } },
        value,
    );
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.ready.mockReturnValue(true);
    mocks.syncAvailable.mockReturnValue(false);
    mocks.asyncAvailable.mockResolvedValue(true);
});

describe("AI setup IPC", () => {
    it.each(["", "#/settings/ai", "#/floating-editor"])(
        "allows storage preparation from the trusted renderer %s",
        (hash) => {
            registerAISetupHandlers(rendererUrl);
            invoke("ai:prepare-credential-storage", rendererUrl + hash);
            expect(mocks.prepareCredentialStorage).toHaveBeenCalledOnce();
            expect(mocks.writeText).not.toHaveBeenCalled();
        },
    );

    it("allows the configured development renderer", () => {
        registerAISetupHandlers("http://localhost:5173");
        invoke("ai:prepare-credential-storage", "http://localhost:5173/#/settings/ai");
        expect(mocks.prepareCredentialStorage).toHaveBeenCalledOnce();
    });

    it.each(["ai:prepare-credential-storage", "ai:copy-device-code", "ai:credential-storage-status"])(
        "rejects untrusted frames for %s",
        (channel) => {
            registerAISetupHandlers(rendererUrl);
            for (const url of [
                null,
                "",
                "invalid",
                "https://example.com",
                "file:///tmp/page.html",
                rendererUrl + "?other=true",
            ]) {
                expect(() => invoke(channel, url, "ABCD-1234")).toThrow("AI setup access denied.");
            }
            expect(() => invoke(channel, rendererUrl, "ABCD-1234", false)).toThrow("AI setup access denied.");
            expect(mocks.prepareCredentialStorage).not.toHaveBeenCalled();
            expect(mocks.writeText).not.toHaveBeenCalled();
        },
    );

    it.each(["ABCD-1234", "12345678", "A".repeat(64)])("copies a valid device code", (code) => {
        registerAISetupHandlers(rendererUrl);
        invoke("ai:copy-device-code", rendererUrl + "#/settings/ai", code);
        expect(mocks.writeText).toHaveBeenCalledExactlyOnceWith(code);
    });

    it.each(["", "A".repeat(65), "a\nb", "<script>", "a b", null, 123, {}])(
        "rejects an invalid clipboard payload",
        (value) => {
            registerAISetupHandlers(rendererUrl);
            expect(() => invoke("ai:copy-device-code", rendererUrl, value)).toThrow(
                "Invalid device authorization code.",
            );
            expect(mocks.writeText).not.toHaveBeenCalled();
        },
    );

    it("awaits the encrypted storage probe before reporting readiness", async () => {
        let finish: () => void = () => undefined;
        const probe = new Promise<void>((resolve) => {
            finish = resolve;
        });
        mocks.prepareCredentialStorage.mockReturnValue(probe);
        registerAISetupHandlers(rendererUrl);
        const result = invoke("ai:prepare-credential-storage", rendererUrl);
        expect(result).toBe(probe);
        finish();
        await expect(result).resolves.toBeUndefined();
    });

    it("propagates an asynchronous storage failure", async () => {
        mocks.prepareCredentialStorage.mockRejectedValue(new Error("Async storage unavailable"));
        registerAISetupHandlers(rendererUrl);
        await expect(invoke("ai:prepare-credential-storage", rendererUrl)).rejects.toThrow("Async storage unavailable");
    });

    it("reports only non-secret storage diagnostics to the trusted renderer", async () => {
        registerAISetupHandlers(rendererUrl);
        expect(await invoke("ai:credential-storage-status", rendererUrl)).toEqual({
            ready: true,
            electronVersion: process.versions.electron ?? "unknown",
            platform: process.platform,
            synchronousEncryptionAvailable: false,
            asynchronousEncryptionAvailable: true,
        });
    });

    it("does not initialize the native encryptor before app readiness", async () => {
        mocks.ready.mockReturnValue(false);
        registerAISetupHandlers(rendererUrl);
        expect(await invoke("ai:credential-storage-status", rendererUrl)).toEqual({
            ready: false,
            electronVersion: process.versions.electron ?? "unknown",
            platform: process.platform,
            synchronousEncryptionAvailable: false,
            asynchronousEncryptionAvailable: false,
        });
        expect(mocks.asyncAvailable).not.toHaveBeenCalled();
        expect(mocks.syncAvailable).not.toHaveBeenCalled();
    });

    it("marks failed availability checks as unknown without returning exception details", async () => {
        mocks.asyncAvailable.mockRejectedValue(new Error("Synthetic private diagnostic"));
        mocks.syncAvailable.mockImplementation(() => {
            throw new Error("Synthetic private diagnostic");
        });
        registerAISetupHandlers(rendererUrl);
        expect(await invoke("ai:credential-storage-status", rendererUrl)).toEqual({
            ready: true,
            electronVersion: process.versions.electron ?? "unknown",
            platform: process.platform,
            synchronousEncryptionAvailable: null,
            asynchronousEncryptionAvailable: null,
        });
    });

    it("preserves secure-storage failures", () => {
        mocks.prepareCredentialStorage.mockImplementation(() => {
            throw new Error("Storage unavailable");
        });
        registerAISetupHandlers(rendererUrl);
        expect(() => invoke("ai:prepare-credential-storage", rendererUrl)).toThrow("Storage unavailable");
    });

    it("rejects invalid renderer configuration before registering handlers", () => {
        expect(() => registerAISetupHandlers("invalid")).toThrow("Invalid app renderer URL.");
        expect(mocks.handle).not.toHaveBeenCalled();
    });
});
