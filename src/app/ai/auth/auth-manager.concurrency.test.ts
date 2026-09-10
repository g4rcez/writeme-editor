import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIAdapter, AIFile, AIStreamEvent, AuthCredentials } from "../adapters/types";

const mocks = vi.hoisted(() => ({
    clearCredentials: vi.fn(),
    loadCredentials: vi.fn(),
    proxyFetch: vi.fn(),
    saveCredentials: vi.fn(),
}));

vi.mock("@/store/global.store", () => ({
    repositories: {
        ai: {
            clearCredentials: mocks.clearCredentials,
            loadCredentials: mocks.loadCredentials,
            saveCredentials: mocks.saveCredentials,
        },
    },
}));

vi.mock("@/lib/proxy-fetch", () => ({ proxyFetch: mocks.proxyFetch }));

import { authManager } from "./auth-manager";

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((promiseResolve) => {
        resolve = promiseResolve;
    });
    return { promise, resolve };
}

function createTestAdapter(refresh: (credentials: AuthCredentials) => Promise<AuthCredentials>): AIAdapter {
    return {
        id: "test",
        name: "Test",
        supportsFiles: false,
        fileCapabilities: { kinds: [], accept: "" },
        supportsOAuth: false,
        defaultModel: "test-model",
        auth: async () => ({}),
        refresh,
        isExpired: () => true,
        listModels: async () => [],
        prepareFile: async (file: File): Promise<AIFile> => ({
            id: "test-file",
            name: file.name,
            mimeType: file.type,
            data: await file.arrayBuffer(),
            size: file.size,
        }),
        sendMessage: async function* (): AsyncGenerator<AIStreamEvent> {
            yield { type: "done" };
        },
    };
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

beforeEach(() => {
    authManager.cancelOAuthFlow();
    vi.resetAllMocks();
    mocks.clearCredentials.mockResolvedValue(undefined);
    mocks.saveCredentials.mockResolvedValue(undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("credential refresh concurrency", () => {
    it("does not persist a refresh that finishes after credentials are cleared", async () => {
        const refreshResult = deferred<AuthCredentials>();
        const refreshStarted = deferred<void>();
        const refresh = vi.fn(async (_credentials: AuthCredentials) => {
            refreshStarted.resolve();
            return refreshResult.promise;
        });
        mocks.loadCredentials.mockResolvedValue({
            adapterId: "openai",
            accessToken: "expired-token",
            refreshToken: "refresh-token",
            expiresAt: 1,
        });

        const credentialsPromise = authManager.getCredentials("openai", createTestAdapter(refresh));
        await refreshStarted.promise;

        await authManager.clearCredentials("openai");
        refreshResult.resolve({
            accessToken: "refreshed-token",
            refreshToken: "refreshed-refresh-token",
            expiresAt: Date.now() + 60_000,
        });

        await expect(credentialsPromise).resolves.toMatchObject({ accessToken: "refreshed-token" });
        expect(mocks.clearCredentials).toHaveBeenCalledWith("openai");
        expect(mocks.saveCredentials).not.toHaveBeenCalled();
    });

    it("serializes an in-flight refresh save before clearing credentials", async () => {
        const refreshResult = deferred<AuthCredentials>();
        const refreshStarted = deferred<void>();
        const saveStarted = deferred<void>();
        const saveRelease = deferred<void>();
        let storedCredentials: AuthCredentials | null = { accessToken: "old-token" };
        const refresh = vi.fn(async (_credentials: AuthCredentials) => {
            refreshStarted.resolve();
            return refreshResult.promise;
        });
        mocks.loadCredentials.mockResolvedValue({
            adapterId: "openai",
            accessToken: "expired-token",
            refreshToken: "refresh-token",
            expiresAt: 1,
        });
        mocks.saveCredentials.mockImplementation(async (credentials: AuthCredentials & { adapterId: string }) => {
            saveStarted.resolve();
            await saveRelease.promise;
            storedCredentials = credentials;
        });
        mocks.clearCredentials.mockImplementation(async () => {
            storedCredentials = null;
        });

        const credentialsPromise = authManager.getCredentials("openai", createTestAdapter(refresh));
        await refreshStarted.promise;
        refreshResult.resolve({
            accessToken: "refreshed-token",
            refreshToken: "refreshed-refresh-token",
            expiresAt: Date.now() + 60_000,
        });
        await saveStarted.promise;

        const clearPromise = authManager.clearCredentials("openai");
        expect(mocks.clearCredentials).not.toHaveBeenCalled();
        saveRelease.resolve();
        await Promise.all([credentialsPromise, clearPromise]);

        expect(storedCredentials).toBeNull();
        const saveCallOrder = mocks.saveCredentials.mock.invocationCallOrder[0];
        const clearCallOrder = mocks.clearCredentials.mock.invocationCallOrder[0];
        if (saveCallOrder === undefined || clearCallOrder === undefined) {
            throw new Error("Expected both credential writes to be called.");
        }
        expect(saveCallOrder).toBeLessThan(clearCallOrder);
    });
});

describe("OAuth flow concurrency", () => {
    it("does not save credentials when an OpenAI device flow is canceled", async () => {
        const pollResponse = deferred<Response>();
        mocks.proxyFetch
            .mockResolvedValueOnce(
                jsonResponse({
                    verification_url: "https://auth.openai.com/codex/device",
                    user_code: "USER-CODE",
                    device_auth_id: "device-id",
                    interval: 0,
                }),
            )
            .mockReturnValueOnce(pollResponse.promise);
        vi.spyOn(window, "open").mockImplementation(() => null);

        await authManager.startOAuthFlow("openai");
        const completion = authManager.completeOAuthFlow("openai", "");
        expect(mocks.proxyFetch).toHaveBeenCalledTimes(2);

        authManager.cancelOAuthFlow();
        pollResponse.resolve(
            jsonResponse({
                authorization_code: "authorization-code",
                code_challenge: "code-challenge",
                code_verifier: "code-verifier",
            }),
        );

        await expect(completion).rejects.toThrow("canceled or superseded");
        expect(mocks.saveCredentials).not.toHaveBeenCalled();
    });

    it("cleans up credentials when an Anthropic OAuth save is canceled in flight", async () => {
        const tokenResponse = deferred<Response>();
        const saveStarted = deferred<void>();
        const saveRelease = deferred<void>();
        const cleanupFinished = deferred<void>();
        let storedCredentials: AuthCredentials | null = { accessToken: "old-token" };
        mocks.proxyFetch.mockReturnValue(tokenResponse.promise);
        mocks.saveCredentials.mockImplementation(async (credentials: AuthCredentials & { adapterId: string }) => {
            saveStarted.resolve();
            await saveRelease.promise;
            storedCredentials = credentials;
        });
        mocks.clearCredentials.mockImplementation(async () => {
            storedCredentials = null;
            cleanupFinished.resolve();
        });
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

        await authManager.startOAuthFlow("anthropic");
        const completion = authManager.completeOAuthFlow("anthropic", "authorization-code");
        tokenResponse.resolve(
            jsonResponse({
                access_token: "anthropic-access-token",
                expires_in: 3600,
            }),
        );
        await saveStarted.promise;

        authManager.cancelOAuthFlow();
        saveRelease.resolve();

        await expect(completion).rejects.toThrow("canceled or superseded");
        await cleanupFinished.promise;
        expect(storedCredentials).toBeNull();
        expect(mocks.clearCredentials).toHaveBeenCalledWith("anthropic");
    });

    it("does not let a superseded OAuth save remove newer credentials", async () => {
        const firstTokenResponse = deferred<Response>();
        const secondTokenResponse = deferred<Response>();
        const oldSaveStarted = deferred<void>();
        const oldSaveRelease = deferred<void>();
        const newSaveFinished = deferred<void>();
        let storedCredentials: (AuthCredentials & { adapterId: string }) | null = null;
        mocks.proxyFetch
            .mockReturnValueOnce(firstTokenResponse.promise)
            .mockReturnValueOnce(secondTokenResponse.promise);
        mocks.saveCredentials.mockImplementation(async (credentials: AuthCredentials & { adapterId: string }) => {
            if (credentials.adapterId === "anthropic") {
                oldSaveStarted.resolve();
                await oldSaveRelease.promise;
            }
            storedCredentials = credentials;
            if (credentials.adapterId === "gemini") newSaveFinished.resolve();
        });
        mocks.clearCredentials.mockImplementation(async () => {
            storedCredentials = null;
        });
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

        await authManager.startOAuthFlow("anthropic");
        const firstCompletion = authManager.completeOAuthFlow("anthropic", "old-code");
        firstTokenResponse.resolve(
            jsonResponse({
                access_token: "old-access-token",
                expires_in: 3600,
            }),
        );
        await oldSaveStarted.promise;

        await authManager.startOAuthFlow("gemini");
        const secondCompletion = authManager.completeOAuthFlow("gemini", "new-code");
        secondTokenResponse.resolve(
            jsonResponse({
                access_token: "new-access-token",
                expires_in: 3600,
            }),
        );
        oldSaveRelease.resolve();

        await expect(firstCompletion).rejects.toThrow("canceled or superseded");
        await expect(secondCompletion).resolves.toMatchObject({ accessToken: "new-access-token" });
        await newSaveFinished.promise;
        expect(storedCredentials).toMatchObject({ adapterId: "gemini", accessToken: "new-access-token" });
    });

    it("does not let a superseded device flow replace newer pending state", async () => {
        const firstStartResponse = deferred<Response>();
        const pollResponse = deferred<Response>();
        mocks.proxyFetch
            .mockReturnValueOnce(firstStartResponse.promise)
            .mockResolvedValueOnce(
                jsonResponse({
                    verification_url: "https://auth.openai.com/codex/device",
                    user_code: "USER-CODE-B",
                    device_auth_id: "device-id-B",
                    interval: 0,
                }),
            )
            .mockReturnValueOnce(pollResponse.promise);
        vi.spyOn(window, "open").mockImplementation(() => null);

        const firstFlow = authManager.startOAuthFlow("openai");
        authManager.cancelOAuthFlow();
        const secondFlow = authManager.startOAuthFlow("openai");
        await secondFlow;

        firstStartResponse.resolve(
            jsonResponse({
                verification_url: "https://auth.openai.com/codex/device",
                user_code: "USER-CODE-A",
                device_auth_id: "device-id-A",
                interval: 0,
            }),
        );
        await expect(firstFlow).rejects.toThrow("canceled or superseded");

        const completion = authManager.completeOAuthFlow("openai", "");
        expect(mocks.proxyFetch).toHaveBeenCalledTimes(3);
        const pollRequest = mocks.proxyFetch.mock.calls[2]?.[1] as RequestInit;
        expect(pollRequest.body).toContain('"device_auth_id":"device-id-B"');

        authManager.cancelOAuthFlow();
        pollResponse.resolve(
            jsonResponse({
                authorization_code: "authorization-code",
                code_challenge: "code-challenge",
                code_verifier: "code-verifier",
            }),
        );
        await expect(completion).rejects.toThrow("canceled or superseded");
    });
});
