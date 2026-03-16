import { isElectron } from "@/lib/is-electron";
import { repositories } from "@/store/global.store";
import type { AIAdapter, AuthCredentials } from "../adapters/types";
import { getGoogleClientId, GOOGLE_OAUTH_SCOPES } from "../adapters/gemini.adapter";

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

class AuthManager {
  async startOAuthFlow(adapterId: string): Promise<AuthCredentials> {
    if (adapterId !== "gemini") {
      throw new Error(`OAuth not supported for adapter: ${adapterId}`);
    }

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

    let code: string;

    if (isElectron()) {
      const result = await window.electronAPI.ai.startOAuth(authUrl);
      code = result.code;
    } else {
      sessionStorage.setItem("ai_pkce_verifier", codeVerifier);
      sessionStorage.setItem("ai_pkce_adapter", adapterId);
      window.location.href = authUrl;
      // This promise never resolves in browser — page navigates away
      await new Promise(() => {});
      code = "";
    }

    const creds = await this.exchangeGoogleCode(code, codeVerifier, redirectUri);
    await this.saveCredentials(adapterId, creds);
    return creds;
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

    const resp = await fetch("https://oauth2.googleapis.com/token", {
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

    const data = await resp.json() as {
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

  async saveCredentials(adapterId: string, creds: AuthCredentials): Promise<void> {
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
