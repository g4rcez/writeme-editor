import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    proxyFetch: vi.fn(),
    copyDeviceCode: vi.fn(),
}));
vi.mock("@/lib/proxy-fetch", () => ({ proxyFetch: mocks.proxyFetch }));
vi.mock("@/lib/copy-device-code", () => ({ copyDeviceCode: mocks.copyDeviceCode }));
vi.mock("@/lib/is-electron", () => ({ isElectron: () => false }));
vi.mock("@/store/global.store", () => ({ repositories: { ai: {} } }));

import { authManager } from "./auth-manager";

beforeEach(() => {
    authManager.cancelOAuthFlow();
    vi.resetAllMocks();
    mocks.copyDeviceCode.mockResolvedValue(true);
    mocks.proxyFetch.mockResolvedValue(
        new Response(
            JSON.stringify({
                user_code: "ABCD-1234",
                device_auth_id: "synthetic-device-id",
                verification_url: "https://auth.openai.com/codex/device",
            }),
        ),
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});

afterEach(() => {
    authManager.cancelOAuthFlow();
    vi.restoreAllMocks();
});

describe("OpenAI device code clipboard", () => {
    it("copies the code before opening the provider page and returns display metadata", async () => {
        const result = await authManager.startOAuthFlow("openai");
        expect(mocks.copyDeviceCode).toHaveBeenCalledExactlyOnceWith("ABCD-1234");
        expect(mocks.copyDeviceCode.mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(HTMLAnchorElement.prototype.click).mock.invocationCallOrder[0] ?? 0,
        );
        expect(result.deviceCode).toStrictEqual({
            userCode: "ABCD-1234",
            verificationUrl: "https://auth.openai.com/codex/device",
            copied: true,
        });
        expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
        expect(vi.mocked(HTMLAnchorElement.prototype.click).mock.contexts[0]).toMatchObject({
            href: "https://auth.openai.com/codex/device",
            target: "_blank",
            rel: "noopener noreferrer",
        });
    });

    it("keeps sign-in available when automatic copy fails", async () => {
        mocks.copyDeviceCode.mockResolvedValue(false);
        const result = await authManager.startOAuthFlow("openai");
        expect(result.deviceCode?.copied).toBe(false);
        expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    });

    it("does not copy codes for an untrusted verification URL", async () => {
        mocks.proxyFetch.mockResolvedValue(
            new Response(
                JSON.stringify({
                    user_code: "ABCD-1234",
                    device_auth_id: "synthetic-device-id",
                    verification_url: "https://example.com/device",
                }),
            ),
        );
        await expect(authManager.startOAuthFlow("openai")).rejects.toThrow("untrusted authorization URL");
        expect(mocks.copyDeviceCode).not.toHaveBeenCalled();
        expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    });

    it.each([null, 1234, {}, "   "])(
        "rejects malformed codes before copying or opening the provider",
        async (userCode) => {
            mocks.proxyFetch.mockResolvedValue(
                new Response(
                    JSON.stringify({
                        user_code: userCode,
                        device_auth_id: "synthetic-device-id",
                    }),
                ),
            );
            await expect(authManager.startOAuthFlow("openai")).rejects.toThrow("did not return a user code");
            expect(mocks.copyDeviceCode).not.toHaveBeenCalled();
            expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
        },
    );

    it("does not open the browser if sign-in is canceled during a clipboard write", async () => {
        let finishCopy: (copied: boolean) => void = () => {
            throw new Error("Copy not started");
        };
        const pendingCopy = new Promise<boolean>((resolve) => {
            finishCopy = resolve;
        });
        mocks.copyDeviceCode.mockReturnValue(pendingCopy);
        const start = authManager.startOAuthFlow("openai");
        const assertion = expect(start).rejects.toThrow("OAuth flow was canceled or superseded.");
        await vi.waitFor(() => expect(mocks.copyDeviceCode).toHaveBeenCalledOnce());
        authManager.cancelOAuthFlow();
        finishCopy(true);
        await assertion;
        expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    });
});
