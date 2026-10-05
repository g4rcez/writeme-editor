import { isElectron } from "@/lib/is-electron";
import { proxyFetch } from "@/lib/proxy-fetch";
import { repositories } from "@/store/global.store";
import type { AIAdapter, AuthCredentials } from "../adapters/types";
import { ANTHROPIC_OAUTH_CLIENT_ID, ANTHROPIC_OAUTH_SCOPES } from "../adapters/anthropic.adapter";
import { getGoogleClientId, GOOGLE_OAUTH_SCOPES } from "../adapters/gemini.adapter";

const ANTHROPIC_TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const ANTHROPIC_CALLBACK_URL = "https://platform.claude.com/oauth/code/callback";
const OPENAI_ISSUER = "https://auth.openai.com";
const OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const ANTHROPIC_TOKEN_HEADERS = {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    "User-Agent": "axios/1.13.6",
};

function generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64urlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return base64urlEncode(new Uint8Array(digest));
}

function base64urlEncode(bytes: Uint8Array): string {
    let str = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        str += String.fromCharCode(bytes[i]!);
    }
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generateState(): string {
    return crypto.randomUUID().replace(/-/g, "");
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJwtPayload<T extends object>(token: string | undefined): T | null {
    if (!token) return null;
    const [, payload] = token.split(".");
    if (!payload) return null;
    try {
        const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
        return JSON.parse(atob(padded)) as T;
    } catch {
        return null;
    }
}

function parseJwtExpiresAt(token: string | undefined): number | undefined {
    const claims = parseJwtPayload<{ exp?: number }>(token);
    return claims?.exp ? claims.exp * 1000 : undefined;
}

function parseTrustedOAuthUrl(rawUrl: string, expectedOrigin: string): string {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error("OAuth provider returned an invalid authorization URL.");
    }
    if (url.protocol !== "https:" || url.origin !== expectedOrigin) {
        throw new Error("OAuth provider returned an untrusted authorization URL.");
    }
    return url.toString();
}

function openTrustedOAuthUrl(url: string): void {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
}

function navigateToTrustedOAuthUrl(url: string): void {
    const link = document.createElement("a");
    link.href = url;
    link.rel = "noopener noreferrer";
    link.click();
}

const OPENAI_AUTH_CLAIMS_KEY = "https://api.openai.com/auth";
const OPENAI_PLATFORM_SETUP_URL = "https://platform.openai.com/org-setup";
const ANTHROPIC_AUTH_ORIGIN = "https://claude.ai";
const GEMINI_AUTH_ORIGIN = "https://accounts.google.com";
const OPENAI_AUTH_ORIGIN = "https://auth.openai.com";

type OpenAIOrganization = { id?: string; is_default?: boolean };

type OpenAIPlatformClaims = {
    chatgpt_account_id?: string;
    organization_id?: string;
    org_id?: string;
    project_id?: string;
    [OPENAI_AUTH_CLAIMS_KEY]?: {
        chatgpt_account_id?: string;
        organization_id?: string;
        project_id?: string;
        completed_platform_onboarding?: boolean;
        is_org_owner?: boolean;
        chatgpt_plan_type?: string;
        organizations?: OpenAIOrganization[];
    };
};

function getOpenAIAuthClaims(idToken: string | undefined) {
    return parseJwtPayload<OpenAIPlatformClaims>(idToken)?.[OPENAI_AUTH_CLAIMS_KEY];
}

function getDefaultOpenAIOrganizationId(organizations: OpenAIOrganization[] | undefined): string | undefined {
    return (
        organizations?.find((organization) => organization.is_default)?.id ??
        organizations?.find((organization) => organization.id)?.id
    );
}

export function parseOpenAIPlatformOrganizationId(idToken: string | undefined): string | undefined {
    const claims = parseJwtPayload<OpenAIPlatformClaims>(idToken);
    return claims?.organization_id ?? claims?.org_id ?? claims?.[OPENAI_AUTH_CLAIMS_KEY]?.organization_id;
}

export function parseOpenAIPlatformProjectId(idToken: string | undefined): string | undefined {
    const claims = parseJwtPayload<OpenAIPlatformClaims>(idToken);
    return claims?.project_id ?? claims?.[OPENAI_AUTH_CLAIMS_KEY]?.project_id;
}

export const parseOpenAIOrganizationId = parseOpenAIPlatformOrganizationId;

export function parseOpenAIAccountId(token: string | undefined): string | undefined {
    const claims = parseJwtPayload<OpenAIPlatformClaims>(token);
    return (
        claims?.chatgpt_account_id ??
        claims?.[OPENAI_AUTH_CLAIMS_KEY]?.chatgpt_account_id ??
        getDefaultOpenAIOrganizationId(claims?.[OPENAI_AUTH_CLAIMS_KEY]?.organizations)
    );
}

export function createOpenAIPlatformSetupUrl(idToken: string): string {
    const authClaims = getOpenAIAuthClaims(idToken);
    let setupUrl: URL;
    try {
        setupUrl = new URL(OPENAI_PLATFORM_SETUP_URL);
    } catch {
        throw new Error("OpenAI platform setup URL is invalid.");
    }
    setupUrl.searchParams.set("t", idToken);

    const planType = authClaims?.chatgpt_plan_type;
    if (planType) setupUrl.searchParams.set("p", planType);

    const organizationId =
        parseOpenAIPlatformOrganizationId(idToken) ?? getDefaultOpenAIOrganizationId(authClaims?.organizations);
    if (organizationId) setupUrl.searchParams.set("with_org", organizationId);

    const projectId = parseOpenAIPlatformProjectId(idToken);
    if (projectId) setupUrl.searchParams.set("project_id", projectId);

    return setupUrl.toString();
}

export function createOpenAIApiKeyExchangeBody(idToken: string): URLSearchParams {
    return new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        client_id: OPENAI_CLIENT_ID,
        requested_token: "openai-api-key",
        subject_token: idToken,
        subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
        name: `Writeme (${new Date().toISOString().slice(0, 10)})`,
    });
}

type OpenAIDeviceCode = {
    verificationUrl: string;
    userCode: string;
    deviceAuthId: string;
    interval: number;
};

type OAuthCredentialWrite = {
    adapterId: string;
    oauthGeneration: number;
    credentialGeneration: number;
    version: number;
    wrote: boolean;
    canceled: boolean;
};

/**
 * Parse the authorization code pasted by the user.
 * Accepts: full callback URL, "code#state" format, URL-encoded params, or bare code.
 */
function parseCallbackInput(input: string): { code: string; state: string | null } | null {
    const trimmed = input.trim();

    // Try as a full URL with query params
    try {
        const url = new URL(trimmed);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (code) return { code, state };
    } catch {
        // not a URL
    }

    // Try "code#state" format
    const hashParts = trimmed.split("#");
    if (hashParts.length === 2 && hashParts[0] && hashParts[1]) {
        return { code: hashParts[0], state: hashParts[1] };
    }

    // Try URL-encoded "code=...&state=..."
    try {
        const params = new URLSearchParams(trimmed);
        const code = params.get("code");
        const state = params.get("state");
        if (code) return { code, state };
    } catch {
        // not URL params
    }

    // Treat as bare authorization code
    if (trimmed) return { code: trimmed, state: null };
    return null;
}

class AuthManager {
    private _pendingVerifier: string | null = null;
    private _pendingState: string | null = null;
    private _pendingAdapterId: string | null = null;
    private _pendingOpenAIDeviceCode: OpenAIDeviceCode | null = null;
    private _oauthGeneration = 0;
    private _credentialGenerations = new Map<string, number>();
    private _credentialWriteQueues = new Map<string, Promise<void>>();
    private _credentialWriteVersions = new Map<string, number>();
    private _latestCredentialWriteVersions = new Map<string, number>();
    private _pendingOAuthCredentialWrites = new Set<OAuthCredentialWrite>();

    private _clearPendingOAuth(): void {
        this._pendingVerifier = null;
        this._pendingState = null;
        this._pendingAdapterId = null;
        this._pendingOpenAIDeviceCode = null;
    }

    private _beginOAuthFlow(): number {
        this._invalidateOAuthFlow();
        return this._oauthGeneration;
    }

    private _isCurrentOAuthFlow(generation: number): boolean {
        return generation === this._oauthGeneration;
    }

    private _assertCurrentOAuthFlow(generation: number): void {
        if (!this._isCurrentOAuthFlow(generation)) {
            throw new Error("OAuth flow was canceled or superseded.");
        }
    }

    private _assertPendingOAuth(adapterId: string, generation: number): void {
        if (!this._isCurrentOAuthFlow(generation) || this._pendingAdapterId !== adapterId) {
            throw new Error("No pending OAuth flow. Click the sign-in button first.");
        }
    }

    private _getCredentialGeneration(adapterId: string): number {
        return this._credentialGenerations.get(adapterId) ?? 0;
    }

    private _isCurrentCredentialGeneration(adapterId: string, generation: number): boolean {
        return generation === this._getCredentialGeneration(adapterId);
    }

    private _invalidateCredentialGeneration(adapterId: string): void {
        this._credentialGenerations.set(adapterId, this._getCredentialGeneration(adapterId) + 1);
    }

    private _nextCredentialWriteVersion(adapterId: string): number {
        const version = (this._credentialWriteVersions.get(adapterId) ?? 0) + 1;
        this._credentialWriteVersions.set(adapterId, version);
        return version;
    }

    private _markCredentialWriteCommitted(adapterId: string, version: number): void {
        this._latestCredentialWriteVersions.set(adapterId, version);
    }

    private _isLatestCredentialWrite(adapterId: string, version: number): boolean {
        return this._latestCredentialWriteVersions.get(adapterId) === version;
    }

    private _enqueueCredentialWrite<T>(adapterId: string, operation: () => Promise<T>): Promise<T> {
        const previous = this._credentialWriteQueues.get(adapterId) ?? Promise.resolve();
        const queued = previous.catch(() => undefined).then(operation);
        let current: Promise<void>;
        current = queued.then(
            () => {
                if (this._credentialWriteQueues.get(adapterId) === current) {
                    this._credentialWriteQueues.delete(adapterId);
                }
            },
            () => {
                if (this._credentialWriteQueues.get(adapterId) === current) {
                    this._credentialWriteQueues.delete(adapterId);
                }
            },
        );
        this._credentialWriteQueues.set(adapterId, current);
        return queued;
    }

    private async _saveCredentialsAtGeneration(
        adapterId: string,
        creds: AuthCredentials,
        credentialGeneration: number,
    ): Promise<boolean> {
        const version = this._nextCredentialWriteVersion(adapterId);
        return this._enqueueCredentialWrite(adapterId, async () => {
            if (!this._isCurrentCredentialGeneration(adapterId, credentialGeneration)) return false;
            await repositories.ai.saveCredentials({ adapterId, ...creds });
            this._markCredentialWriteCommitted(adapterId, version);
            return true;
        });
    }

    private async _saveOAuthCredentials(
        adapterId: string,
        creds: AuthCredentials,
        oauthGeneration: number,
    ): Promise<boolean> {
        const write: OAuthCredentialWrite = {
            adapterId,
            oauthGeneration,
            credentialGeneration: this._invalidateAndGetCredentialGeneration(adapterId),
            version: this._nextCredentialWriteVersion(adapterId),
            wrote: false,
            canceled: false,
        };
        this._pendingOAuthCredentialWrites.add(write);

        try {
            return await this._enqueueCredentialWrite(adapterId, async () => {
                if (
                    write.canceled ||
                    !this._isCurrentOAuthFlow(oauthGeneration) ||
                    !this._isCurrentCredentialGeneration(adapterId, write.credentialGeneration)
                ) {
                    return false;
                }
                await repositories.ai.saveCredentials({ adapterId, ...creds });
                write.wrote = true;
                this._markCredentialWriteCommitted(adapterId, write.version);
                return true;
            });
        } finally {
            this._pendingOAuthCredentialWrites.delete(write);
        }
    }

    private _queueOAuthCredentialCleanup(write: OAuthCredentialWrite): void {
        const cleanup = this._enqueueCredentialWrite(write.adapterId, async () => {
            if (!write.wrote || !this._isLatestCredentialWrite(write.adapterId, write.version)) return;
            const version = this._nextCredentialWriteVersion(write.adapterId);
            await repositories.ai.clearCredentials(write.adapterId);
            this._markCredentialWriteCommitted(write.adapterId, version);
        });
        void cleanup.catch(() => undefined);
    }

    private _invalidateAndGetCredentialGeneration(adapterId: string): number {
        this._invalidateCredentialGeneration(adapterId);
        return this._getCredentialGeneration(adapterId);
    }

    private _invalidateOAuthFlow(): void {
        const canceledGeneration = this._oauthGeneration;
        this._oauthGeneration += 1;
        this._clearPendingOAuth();

        const canceledWrites = [...this._pendingOAuthCredentialWrites].filter(
            (write) => write.oauthGeneration === canceledGeneration,
        );
        const canceledAdapters = new Set(canceledWrites.map((write) => write.adapterId));
        for (const adapterId of canceledAdapters) {
            this._invalidateCredentialGeneration(adapterId);
        }
        for (const write of canceledWrites) {
            write.canceled = true;
            this._queueOAuthCredentialCleanup(write);
        }
    }

    cancelOAuthFlow(): void {
        this._invalidateOAuthFlow();
    }

    async startOAuthFlow(adapterId: string): Promise<{ message: string }> {
        const generation = this._beginOAuthFlow();
        if (adapterId === "anthropic") {
            return this._openAnthropicBrowser(generation);
        }
        if (adapterId === "gemini") {
            return this._openGeminiBrowser(generation);
        }
        if (adapterId === "openai") {
            return this._startOpenAIDeviceFlow(generation);
        }
        throw new Error(`OAuth not supported for adapter: ${adapterId}`);
    }

    private async _openAnthropicBrowser(generation: number): Promise<{ message: string }> {
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const state = generateState();
        this._assertCurrentOAuthFlow(generation);

        const params = new URLSearchParams({
            code: "true",
            client_id: ANTHROPIC_OAUTH_CLIENT_ID,
            redirect_uri: ANTHROPIC_CALLBACK_URL,
            response_type: "code",
            scope: ANTHROPIC_OAUTH_SCOPES,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            state,
        });

        const authUrl = `https://claude.ai/oauth/authorize?${params.toString()}`;

        this._pendingVerifier = codeVerifier;
        this._pendingState = state;
        this._pendingAdapterId = "anthropic";

        try {
            const trustedAuthUrl = parseTrustedOAuthUrl(authUrl, ANTHROPIC_AUTH_ORIGIN);
            if (isElectron()) {
                await window.electronAPI.ai.startOAuth(trustedAuthUrl);
            } else {
                openTrustedOAuthUrl(trustedAuthUrl);
            }
            this._assertCurrentOAuthFlow(generation);
        } catch (error: unknown) {
            if (this._isCurrentOAuthFlow(generation)) this._clearPendingOAuth();
            throw error;
        }

        return {
            message: "Your browser opened. Sign in and paste the authorization code shown on the page.",
        };
    }

    private async _startOpenAIDeviceFlow(generation: number): Promise<{ message: string }> {
        const resp = await proxyFetch(`${OPENAI_ISSUER}/api/accounts/deviceauth/usercode`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ client_id: OPENAI_CLIENT_ID }),
        });

        this._assertCurrentOAuthFlow(generation);
        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`OpenAI device authorization failed: ${err}`);
        }

        const data = (await resp.json()) as {
            verification_url?: string;
            user_code?: string;
            usercode?: string;
            device_auth_id: string;
            interval?: string | number;
        };
        this._assertCurrentOAuthFlow(generation);

        const userCode = data.user_code ?? data.usercode;
        if (!userCode) {
            throw new Error("OpenAI device authorization did not return a user code.");
        }

        const deviceCode: OpenAIDeviceCode = {
            verificationUrl: data.verification_url ?? `${OPENAI_ISSUER}/codex/device`,
            userCode,
            deviceAuthId: data.device_auth_id,
            interval: Number(data.interval ?? 5),
        };

        this._pendingOpenAIDeviceCode = deviceCode;
        this._pendingAdapterId = "openai";

        try {
            const trustedVerificationUrl = parseTrustedOAuthUrl(deviceCode.verificationUrl, OPENAI_AUTH_ORIGIN);
            if (isElectron()) {
                await window.electronAPI.ai.startOAuth(trustedVerificationUrl);
            } else {
                openTrustedOAuthUrl(trustedVerificationUrl);
            }
            this._assertCurrentOAuthFlow(generation);
        } catch (error: unknown) {
            if (this._isCurrentOAuthFlow(generation)) this._clearPendingOAuth();
            throw error;
        }

        return {
            message: `Your browser opened. Enter code ${deviceCode.userCode} on the OpenAI page, then return here and complete sign-in.`,
        };
    }

    private async _openGeminiBrowser(generation: number): Promise<{ message: string }> {
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const clientId = getGoogleClientId();
        this._assertCurrentOAuthFlow(generation);

        const redirectUri = isElectron() ? "writeme://oauth/callback" : `${window.location.origin}/oauth/callback`;

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: GOOGLE_OAUTH_SCOPES,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            access_type: "offline",
        });

        const authUrl = `https://accounts.google.com/o/oauth2/auth?${params.toString()}`;

        this._pendingVerifier = codeVerifier;
        this._pendingState = null;
        this._pendingAdapterId = "gemini";

        try {
            const trustedAuthUrl = parseTrustedOAuthUrl(authUrl, GEMINI_AUTH_ORIGIN);
            if (isElectron()) {
                await window.electronAPI.ai.startOAuth(trustedAuthUrl);
            } else {
                sessionStorage.setItem("ai_pkce_verifier", codeVerifier);
                sessionStorage.setItem("ai_pkce_adapter", "gemini");
                navigateToTrustedOAuthUrl(trustedAuthUrl);
            }
            this._assertCurrentOAuthFlow(generation);
        } catch (error: unknown) {
            if (this._isCurrentOAuthFlow(generation)) this._clearPendingOAuth();
            throw error;
        }

        return {
            message: "Your browser opened. Sign in then paste the authorization code here.",
        };
    }

    async completeOAuthFlow(adapterId: string, rawInput: string): Promise<AuthCredentials> {
        const generation = this._oauthGeneration;
        if (adapterId === "openai") {
            this._assertPendingOAuth(adapterId, generation);
            const creds = await this.completeOpenAIDeviceFlow(generation);
            this._assertCurrentOAuthFlow(generation);
            const saved = await this._saveOAuthCredentials(adapterId, creds, generation);
            this._assertCurrentOAuthFlow(generation);
            if (!saved) throw new Error("OAuth credentials were not saved.");
            return creds;
        }

        const verifier = this._pendingVerifier;
        if (!verifier || this._pendingAdapterId !== adapterId) {
            throw new Error("No pending OAuth flow. Click the sign-in button first.");
        }
        const pendingState = this._pendingState;
        this._clearPendingOAuth();

        let creds: AuthCredentials;
        if (adapterId === "anthropic") {
            const parsed = parseCallbackInput(rawInput);
            if (!parsed) throw new Error("Invalid authorization code.");
            if (pendingState && parsed.state && parsed.state !== pendingState) {
                throw new Error("State mismatch. Please restart the sign-in flow.");
            }
            creds = await this.exchangeAnthropicCode(parsed.code, verifier, parsed.state ?? pendingState ?? "");
        } else if (adapterId === "gemini") {
            creds = await this.exchangeGoogleCode(rawInput, verifier);
        } else {
            throw new Error(`OAuth not supported for adapter: ${adapterId}`);
        }

        this._assertCurrentOAuthFlow(generation);
        const saved = await this._saveOAuthCredentials(adapterId, creds, generation);
        this._assertCurrentOAuthFlow(generation);
        if (!saved) throw new Error("OAuth credentials were not saved.");
        return creds;
    }

    async completeOpenAIDeviceFlow(generation = this._oauthGeneration): Promise<AuthCredentials> {
        this._assertPendingOAuth("openai", generation);
        const deviceCode = this._pendingOpenAIDeviceCode;
        if (!deviceCode) {
            throw new Error("No pending OpenAI device authorization flow.");
        }
        this._clearPendingOAuth();

        const codeResp = await this.pollOpenAIDeviceCode(deviceCode, generation);
        this._assertCurrentOAuthFlow(generation);
        const tokens = await this.exchangeOpenAICode(codeResp.authorization_code, codeResp.code_verifier);
        this._assertCurrentOAuthFlow(generation);

        return {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            idToken: tokens.id_token,
            accountId: parseOpenAIAccountId(tokens.id_token) ?? parseOpenAIAccountId(tokens.access_token),
            expiresAt: parseJwtExpiresAt(tokens.access_token),
        };
    }

    private async pollOpenAIDeviceCode(
        deviceCode: OpenAIDeviceCode,
        generation: number,
    ): Promise<{
        authorization_code: string;
        code_challenge: string;
        code_verifier: string;
    }> {
        const startedAt = Date.now();
        const maxWaitMs = 60 * 1000;

        while (Date.now() - startedAt < maxWaitMs) {
            this._assertCurrentOAuthFlow(generation);
            const resp = await proxyFetch(`${OPENAI_ISSUER}/api/accounts/deviceauth/token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    device_auth_id: deviceCode.deviceAuthId,
                    user_code: deviceCode.userCode,
                }),
            });
            this._assertCurrentOAuthFlow(generation);

            if (resp.ok) {
                const data = (await resp.json()) as {
                    authorization_code: string;
                    code_challenge: string;
                    code_verifier: string;
                };
                this._assertCurrentOAuthFlow(generation);
                return data;
            }

            if (resp.status !== 403 && resp.status !== 404) {
                const err = await resp.text();
                throw new Error(`OpenAI device authorization failed: ${err}`);
            }

            await sleep(Math.max(deviceCode.interval, 1) * 1000);
            this._assertCurrentOAuthFlow(generation);
        }

        throw new Error("OpenAI device authorization is still pending. Finish sign-in and try again.");
    }

    async exchangeOpenAICode(
        code: string,
        codeVerifier: string,
    ): Promise<{
        id_token: string;
        access_token: string;
        refresh_token: string;
    }> {
        const resp = await proxyFetch(`${OPENAI_ISSUER}/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: `${OPENAI_ISSUER}/deviceauth/callback`,
                client_id: OPENAI_CLIENT_ID,
                code_verifier: codeVerifier,
            }),
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`OpenAI OAuth token exchange failed: ${err}`);
        }

        return (await resp.json()) as {
            id_token: string;
            access_token: string;
            refresh_token: string;
        };
    }

    async obtainOpenAIApiKey(idToken: string): Promise<string> {
        const resp = await proxyFetch(`${OPENAI_ISSUER}/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: createOpenAIApiKeyExchangeBody(idToken),
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`OpenAI API token exchange failed: ${err}`);
        }

        const data = (await resp.json()) as { access_token: string };
        return data.access_token;
    }

    async refreshOpenAIToken(credentials: AuthCredentials): Promise<AuthCredentials> {
        if (!credentials.refreshToken) return credentials;
        try {
            const resp = await proxyFetch(`${OPENAI_ISSUER}/oauth/token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    grant_type: "refresh_token",
                    refresh_token: credentials.refreshToken,
                    client_id: OPENAI_CLIENT_ID,
                }),
            });
            if (!resp.ok) return credentials;
            const data = (await resp.json()) as {
                id_token?: string;
                access_token?: string;
                refresh_token?: string;
            };
            return {
                ...credentials,
                accessToken: data.access_token ?? credentials.accessToken,
                refreshToken: data.refresh_token ?? credentials.refreshToken,
                idToken: data.id_token ?? credentials.idToken,
                accountId:
                    parseOpenAIAccountId(data.id_token) ??
                    parseOpenAIAccountId(data.access_token) ??
                    credentials.accountId,
                expiresAt: parseJwtExpiresAt(data.access_token) ?? credentials.expiresAt,
            };
        } catch {
            return credentials;
        }
    }

    async exchangeAnthropicCode(code: string, codeVerifier: string, state: string): Promise<AuthCredentials> {
        const resp = await proxyFetch(ANTHROPIC_TOKEN_URL, {
            method: "POST",
            headers: ANTHROPIC_TOKEN_HEADERS,
            body: JSON.stringify({
                code,
                state,
                grant_type: "authorization_code",
                client_id: ANTHROPIC_OAUTH_CLIENT_ID,
                redirect_uri: ANTHROPIC_CALLBACK_URL,
                code_verifier: codeVerifier,
            }),
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`Anthropic OAuth token exchange failed: ${err}`);
        }

        const data = (await resp.json()) as {
            access_token: string;
            refresh_token?: string;
            expires_in: number;
        };

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
        };
    }

    async refreshAnthropicToken(credentials: AuthCredentials): Promise<AuthCredentials> {
        if (!credentials.refreshToken) return credentials;
        try {
            const resp = await proxyFetch(ANTHROPIC_TOKEN_URL, {
                method: "POST",
                headers: ANTHROPIC_TOKEN_HEADERS,
                body: JSON.stringify({
                    grant_type: "refresh_token",
                    refresh_token: credentials.refreshToken,
                    client_id: ANTHROPIC_OAUTH_CLIENT_ID,
                }),
            });
            if (!resp.ok) return credentials;
            const data = (await resp.json()) as {
                access_token: string;
                expires_in: number;
                refresh_token?: string;
            };
            return {
                ...credentials,
                accessToken: data.access_token,
                expiresAt: Date.now() + data.expires_in * 1000,
                refreshToken: data.refresh_token ?? credentials.refreshToken,
            };
        } catch {
            return credentials;
        }
    }

    async exchangeGoogleCode(code: string, codeVerifier: string, redirectUri?: string): Promise<AuthCredentials> {
        const clientId = getGoogleClientId();
        const resolvedRedirectUri =
            redirectUri ?? (isElectron() ? "writeme://oauth/callback" : `${window.location.origin}/oauth/callback`);

        const resp = await proxyFetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                redirect_uri: resolvedRedirectUri,
                grant_type: "authorization_code",
                code_verifier: codeVerifier,
            }),
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`OAuth token exchange failed: ${err}`);
        }

        const data = (await resp.json()) as {
            access_token: string;
            refresh_token?: string;
            expires_in: number;
        };

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
        };
    }

    async getCredentials(adapterId: string, adapter: AIAdapter): Promise<AuthCredentials> {
        const credentialGeneration = this._getCredentialGeneration(adapterId);
        const creds = await this.loadCredentials(adapterId);
        if (!creds) {
            if (adapterId === "ollama") return {};
            throw new Error("Not authenticated. Connect in Settings.");
        }
        if (adapter.isExpired(creds)) {
            const refreshed = await adapter.refresh(creds);
            await this._saveCredentialsAtGeneration(adapterId, refreshed, credentialGeneration);
            return refreshed;
        }
        return creds;
    }

    async saveCredentials(adapterId: string, creds: AuthCredentials): Promise<void> {
        this._invalidateCredentialGeneration(adapterId);
        const version = this._nextCredentialWriteVersion(adapterId);
        await this._enqueueCredentialWrite(adapterId, async () => {
            await repositories.ai.saveCredentials({ adapterId, ...creds });
            this._markCredentialWriteCommitted(adapterId, version);
        });
    }

    async loadCredentials(adapterId: string): Promise<AuthCredentials | null> {
        const result = await repositories.ai.loadCredentials(adapterId);
        if (!result) return null;
        const { adapterId: _id, ...creds } = result;
        return creds;
    }

    async clearCredentials(adapterId: string): Promise<void> {
        this._invalidateCredentialGeneration(adapterId);
        const version = this._nextCredentialWriteVersion(adapterId);
        await this._enqueueCredentialWrite(adapterId, async () => {
            await repositories.ai.clearCredentials(adapterId);
            this._markCredentialWriteCommitted(adapterId, version);
        });
    }
}

export const authManager = new AuthManager();
