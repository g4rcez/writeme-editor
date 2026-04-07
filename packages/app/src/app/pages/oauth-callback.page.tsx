import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authManager } from "@/app/ai/auth/auth-manager";

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
      setStatus("error");
      setErrorMsg("No authorization code received.");
      return;
    }

    const codeVerifier = sessionStorage.getItem("ai_pkce_verifier");
    const adapterId = sessionStorage.getItem("ai_pkce_adapter") ?? "gemini";

    if (!codeVerifier) {
      setStatus("error");
      setErrorMsg("PKCE verifier not found. Please try connecting again.");
      return;
    }

    authManager
      .exchangeGoogleCode(code, codeVerifier)
      .then(async (creds) => {
        await authManager.saveCredentials(adapterId, creds);
        sessionStorage.removeItem("ai_pkce_verifier");
        sessionStorage.removeItem("ai_pkce_adapter");
        setStatus("success");
        const returnTo = state ?? "/settings";
        setTimeout(() => navigate(returnTo), 1500);
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err?.message ?? "Authentication failed.");
      });
  }, []);

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-4 justify-center items-center h-full p-8">
        <p className="text-muted-foreground">Completing authentication...</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col gap-4 justify-center items-center h-full p-8">
        <p className="text-success font-medium">Connected! Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 justify-center items-center h-full p-8">
      <p className="font-medium text-destructive">Authentication failed</p>
      <p className="text-sm text-muted-foreground">{errorMsg}</p>
    </div>
  );
}
