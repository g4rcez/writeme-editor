import { isElectron } from "@/lib/is-electron";
import { proxyFetch } from "@/lib/proxy-fetch";
import { repositories } from "@/store/global.store";
import type { AIAdapter, AuthCredentials } from "../adapters/types";
import {
  getGoogleClientId,
  GOOGLE_OAUTH_SCOPES,
} from "../adapters/gemini.adapter";
import {
  ANTHROPIC_OAUTH_CLIENT_ID,
  ANTHROPIC_OAUTH_SCOPES,
} from "../adapters/anthropic.adapter";

const ANTHROPIC_TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const ANTHROPIC_CALLBACK_URL =
  "https://platform.claude.com/oauth/code/callback";
const ANTHROPIC_TOKEN_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/plain, */*",
  "User-Agent": "axios/1.13.6",
};

async function generateCodeVerifier(): Promise<string> {
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

/**
 * Parse the authorization code pasted by the user.
 * Accepts: full callback URL, "code#state" format, URL-encoded params, or bare code.
 */
function parseCallbackInput(
  input: string,
): { code: string; state: string | null } | null {
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

  async startOAuthFlow(adapterId: string): Promise<{ message: string }> {
    if (adapterId === "anthropic") {
      return this._openAnthropicBrowser();
    }
    if (adapterId === "gemini") {
      return this._openGeminiBrowser();
    }
    throw new Error(`OAuth not supported for adapter: ${adapterId}`);
  }

  private async _openAnthropicBrowser(): Promise<{ message: string }> {
    const codeVerifier = await generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

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

    if (isElectron()) {
      await window.electronAPI.ai.startOAuth(authUrl);
    } else {
      window.open(authUrl, "_blank");
    }

    return {
      message:
        "Your browser opened. Sign in and paste the authorization code shown on the page.",
    };
  }

  private async _openGeminiBrowser(): Promise<{ message: string }> {
    const codeVerifier = await generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const clientId = getGoogleClientId();

    const redirectUri = isElectron()
      ? "writeme://oauth/callback"
      : `${window.location.origin}/oauth/callback`;

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

    if (isElectron()) {
      await window.electronAPI.ai.startOAuth(authUrl);
    } else {
      sessionStorage.setItem("ai_pkce_verifier", codeVerifier);
      sessionStorage.setItem("ai_pkce_adapter", "gemini");
      window.location.href = authUrl;
    }

    return {
      message:
        "Your browser opened. Sign in then paste the authorization code here.",
    };
  }

  async completeOAuthFlow(
    adapterId: string,
    rawInput: string,
  ): Promise<AuthCredentials> {
    const verifier = this._pendingVerifier;
    if (!verifier || this._pendingAdapterId !== adapterId) {
      throw new Error("No pending OAuth flow. Click the sign-in button first.");
    }
    const pendingState = this._pendingState;
    this._pendingVerifier = null;
    this._pendingState = null;
    this._pendingAdapterId = null;

    let creds: AuthCredentials;
    if (adapterId === "anthropic") {
      const parsed = parseCallbackInput(rawInput);
      if (!parsed) throw new Error("Invalid authorization code.");
      if (pendingState && parsed.state && parsed.state !== pendingState) {
        throw new Error("State mismatch. Please restart the sign-in flow.");
      }
      creds = await this.exchangeAnthropicCode(
        parsed.code,
        verifier,
        parsed.state ?? pendingState ?? "",
      );
    } else if (adapterId === "gemini") {
      creds = await this.exchangeGoogleCode(rawInput, verifier);
    } else {
      throw new Error(`OAuth not supported for adapter: ${adapterId}`);
    }

    await this.saveCredentials(adapterId, creds);
    return creds;
  }

  async exchangeAnthropicCode(
    code: string,
    codeVerifier: string,
    state: string,
  ): Promise<AuthCredentials> {
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

  async refreshAnthropicToken(
    credentials: AuthCredentials,
  ): Promise<AuthCredentials> {
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

  async exchangeGoogleCode(
    code: string,
    codeVerifier: string,
    redirectUri?: string,
  ): Promise<AuthCredentials> {
    const clientId = getGoogleClientId();
    const resolvedRedirectUri =
      redirectUri ??
      (isElectron()
        ? "writeme://oauth/callback"
        : `${window.location.origin}/oauth/callback`);

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

  async getCredentials(
    adapterId: string,
    adapter: AIAdapter,
  ): Promise<AuthCredentials> {
    const creds = await this.loadCredentials(adapterId);
    if (!creds) {
      throw new Error("Not authenticated. Connect in Settings.");
    }
    if (adapter.isExpired(creds)) {
      const refreshed = await adapter.refresh(creds);
      await this.saveCredentials(adapterId, refreshed);
      return refreshed;
    }
    return creds;
  }

  async saveCredentials(
    adapterId: string,
    creds: AuthCredentials,
  ): Promise<void> {
    await repositories.ai.saveCredentials({ adapterId, ...creds });
  }

  async loadCredentials(adapterId: string): Promise<AuthCredentials | null> {
    const result = await repositories.ai.loadCredentials(adapterId);
    if (!result) return null;
    const { adapterId: _id, ...creds } = result;
    return creds;
  }

  async clearCredentials(adapterId: string): Promise<void> {
    await repositories.ai.clearCredentials(adapterId);
  }
}

export const authManager = new AuthManager();
