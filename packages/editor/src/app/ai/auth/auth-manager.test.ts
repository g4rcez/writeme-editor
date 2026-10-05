import { describe, expect, it } from "vitest";
import {
    createOpenAIApiKeyExchangeBody,
    createOpenAIPlatformSetupUrl,
    parseOpenAIAccountId,
    parseOpenAIOrganizationId,
    parseOpenAIPlatformOrganizationId,
    parseOpenAIPlatformProjectId,
} from "./auth-manager";

function createJwt(payload: object): string {
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    return `header.${encodedPayload}.signature`;
}

describe("OpenAI platform claim parsing", () => {
    it("returns organization and project IDs from OpenAI ID token claims", () => {
        const idToken = createJwt({
            "https://api.openai.com/auth": {
                organization_id: "org-platform",
                project_id: "proj-platform",
            },
        });

        expect(parseOpenAIPlatformOrganizationId(idToken)).toBe("org-platform");
        expect(parseOpenAIPlatformProjectId(idToken)).toBe("proj-platform");
    });

    it("supports top-level organization and project claims", () => {
        const idToken = createJwt({
            organization_id: "org-top-level",
            project_id: "proj-top-level",
        });

        expect(parseOpenAIPlatformOrganizationId(idToken)).toBe("org-top-level");
        expect(parseOpenAIOrganizationId(idToken)).toBe("org-top-level");
        expect(parseOpenAIPlatformProjectId(idToken)).toBe("proj-top-level");
    });

    it("returns the ChatGPT account ID from OpenAI auth claims", () => {
        const idToken = createJwt({
            "https://api.openai.com/auth": {
                chatgpt_account_id: "chatgpt-account-1",
            },
        });

        expect(parseOpenAIAccountId(idToken)).toBe("chatgpt-account-1");
    });
});

describe("createOpenAIPlatformSetupUrl", () => {
    it("uses the default ChatGPT organization as setup context", () => {
        const idToken = createJwt({
            "https://api.openai.com/auth": {
                chatgpt_plan_type: "prolite",
                organizations: [
                    { id: "org-secondary", is_default: false },
                    { id: "org-default", is_default: true },
                ],
            },
        });
        const setupUrl = new URL(createOpenAIPlatformSetupUrl(idToken));

        expect(setupUrl.origin + setupUrl.pathname).toBe("https://platform.openai.com/org-setup");
        expect(setupUrl.searchParams.get("t")).toBe(idToken);
        expect(setupUrl.searchParams.get("p")).toBe("prolite");
        expect(setupUrl.searchParams.get("with_org")).toBe("org-default");
    });
});

describe("createOpenAIApiKeyExchangeBody", () => {
    it("omits organization_id because OpenAI rejects it as an unknown parameter", () => {
        const idToken = createJwt({
            "https://api.openai.com/auth": {
                organization_id: "org-required",
                project_id: "proj-required",
            },
        });
        const body = createOpenAIApiKeyExchangeBody(idToken);

        expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:token-exchange");
        expect(body.get("requested_token")).toBe("openai-api-key");
        expect(body.get("subject_token")).toBe(idToken);
        expect(body.get("organization_id")).toBeNull();
        expect(body.get("project_id")).toBeNull();
        expect(body.get("name")).toMatch(/^Writeme \(\d{4}-\d{2}-\d{2}\)$/);
    });

    it("does not block token exchange when platform setup claims are absent", () => {
        const idToken = createJwt({
            "https://api.openai.com/auth": {
                organizations: [{ id: "org-chatgpt" }],
            },
        });
        const body = createOpenAIApiKeyExchangeBody(idToken);

        expect(body.get("subject_token")).toBe(idToken);
        expect(body.get("organization_id")).toBeNull();
        expect(body.get("project_id")).toBeNull();
    });
});
