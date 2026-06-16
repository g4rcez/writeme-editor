import { Button, Input, Select, Textarea, css, uuid } from "@g4rcez/components";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { XCircleIcon } from "@phosphor-icons/react/dist/csr/XCircle";
import { SpinnerIcon } from "@phosphor-icons/react/dist/csr/Spinner";
import { TerminalIcon } from "@phosphor-icons/react/dist/csr/Terminal";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { PlugIcon } from "@phosphor-icons/react/dist/csr/Plug";
import { useEffect, useRef, useState } from "react";
import { repositories } from "@/store/repositories";
import { adapterRegistry } from "@/app/ai/adapters/registry";
import { authManager } from "@/app/ai/auth/auth-manager";
import { uiDispatch } from "@/store/ui.store";
import type { AIConfig } from "@/store/repositories/electron/ai.repository";
import type { AIModel } from "@/app/ai/adapters/types";
import { isElectron } from "@/lib/is-electron";

type CredentialStatus = "connected" | "disconnected" | "loading";
type TestStatus = "idle" | "testing" | "success" | "error";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";

const PROVIDER_META: Record<
  string,
  {
    color: string;
    description: string;
    consoleUrl: string;
    keyHint: string;
    oauthLabel: string;
    disconnectLabel: string;
  }
> = {
  anthropic: {
    color: "bg-[#d4a27f]/10 border-[#d4a27f]/40 hover:border-[#d4a27f]",
    description: "Claude models with vision and PDF support",
    consoleUrl: "https://console.anthropic.com/settings/keys",
    keyHint: "Starts with sk-ant-",
    oauthLabel: "Sign in with Claude",
    disconnectLabel: "Disconnect Claude account",
  },
  gemini: {
    color: "bg-[#4285f4]/10 border-[#4285f4]/40 hover:border-[#4285f4]",
    description: "Gemini models with OAuth or API key",
    consoleUrl: "https://aistudio.google.com/apikey",
    keyHint: "Google AI Studio API key",
    oauthLabel: "Connect with Google",
    disconnectLabel: "Disconnect Google account",
  },
  openai: {
    color: "bg-[#10a37f]/10 border-[#10a37f]/40 hover:border-[#10a37f]",
    description: "GPT and o-series models with ChatGPT OAuth",
    consoleUrl: "",
    keyHint: "",
    oauthLabel: "Sign in with OpenAI",
    disconnectLabel: "Disconnect OpenAI account",
  },
  ollama: {
    color: "bg-muted/50 border-border hover:border-foreground/30",
    description: "Local or cloud Ollama via OpenAI-compatible endpoints",
    consoleUrl: "",
    keyHint: "Optional cloud API key",
    oauthLabel: "",
    disconnectLabel: "Disconnect Ollama credentials",
  },
  cli: {
    color: "bg-muted/50 border-border hover:border-foreground/30",
    description: "Run any CLI command as AI backend",
    consoleUrl: "",
    keyHint: "",
    oauthLabel: "",
    disconnectLabel: "",
  },
};

export const AISettings = () => {
  const adapters = adapterRegistry.getAll();
  const [adapterId, setAdapterId] = useState(adapters[0]?.id ?? "anthropic");
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_OLLAMA_BASE_URL);
  const [commandTemplate, setCommandTemplate] = useState(
    "claude --dangerously-skip-permissions {{context}}",
  );
  const [credentialStatus, setCredentialStatus] =
    useState<CredentialStatus>("loading");
  const [authLoading, setAuthLoading] = useState(false);
  const [configId, setConfigId] = useState<string>(uuid());
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testError, setTestError] = useState("");
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);
  const [oauthCode, setOauthCode] = useState("");
  const [oauthInstruction, setOauthInstruction] = useState("");

  const adapter = adapterRegistry.get(adapterId);
  const meta = PROVIDER_META[adapterId];
  const ollamaModelRequestId = useRef(0);

  const checkCredentials = async (id: string) => {
    setCredentialStatus("loading");
    const creds = await repositories.ai.loadCredentials(id);
    if (!creds) {
      setCredentialStatus("disconnected");
      return;
    }
    const hasCredential = !!(creds.apiKey || creds.accessToken);
    setCredentialStatus(hasCredential ? "connected" : "disconnected");
  };

  useEffect(() => {
    const load = async () => {
      const configs = await repositories.ai.getConfigs();
      const def = configs.find((c) => c.isDefault) ?? configs[0];
      if (def) {
        setConfigId(def.id);
        setAdapterId(def.adapterId ?? "anthropic");
        setModel(def.model ?? "");
        setSystemPrompt(def.systemPrompt ?? "");
        setBaseUrl(def.baseUrl ?? DEFAULT_OLLAMA_BASE_URL);
        setCommandTemplate(
          def.commandTemplate ??
            "claude --dangerously-skip-permissions {{context}}",
        );
        await checkCredentials(def.adapterId ?? "anthropic");
      } else {
        const firstId = adapters[0]?.id ?? "anthropic";
        setAdapterId(firstId);
        setModel(adapterRegistry.get(firstId)?.defaultModel ?? "");
        await checkCredentials(firstId);
      }
    };
    load();
  }, []);

  const handleAdapterChange = async (id: string) => {
    setAdapterId(id);
    setModel(adapterRegistry.get(id)?.defaultModel ?? "");
    setApiKey("");
    setBaseUrl(id === "ollama" ? DEFAULT_OLLAMA_BASE_URL : "");
    setTestStatus("idle");
    setTestError("");
    setAvailableModels([]);
    setOauthPending(false);
    setOauthCode("");
    await checkCredentials(id);
  };

  const loadOllamaModels = async (silent = false): Promise<boolean> => {
    const ollamaAdapter = adapterRegistry.get("ollama");
    if (!ollamaAdapter || adapterId !== "ollama" || !baseUrl.trim()) {
      return false;
    }

    const requestId = ++ollamaModelRequestId.current;
    setOllamaModelsLoading(true);
    if (!silent) {
      setTestStatus("testing");
      setTestError("");
    }

    try {
      const savedCreds = await repositories.ai.loadCredentials("ollama");
      const models = await ollamaAdapter.listModels({
        ...(savedCreds ?? {}),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        baseUrl: baseUrl.trim(),
      });

      if (requestId !== ollamaModelRequestId.current) {
        return false;
      }

      setAvailableModels(models);
      if (models.length > 0) {
        if (!models.some((m) => m.id === model)) {
          setModel(models[0]?.id ?? "");
        }
        setCredentialStatus("connected");
        if (!silent) {
          setTestStatus("success");
        }
        return true;
      }

      if (!silent) {
        setTestStatus("error");
        setTestError(
          "Could not reach Ollama or no models are installed. Check the base URL and try again.",
        );
      }
      return false;
    } catch (err: unknown) {
      if (!silent) {
        setTestStatus("error");
        setTestError(err instanceof Error ? err.message : "Connection failed.");
      }
      return false;
    } finally {
      if (requestId === ollamaModelRequestId.current) {
        setOllamaModelsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (adapterId !== "ollama") return;
    ollamaModelRequestId.current += 1;
    setAvailableModels([]);
    setOllamaModelsLoading(false);
    if (!baseUrl.trim()) return;

    const timeoutId = window.setTimeout(() => {
      void loadOllamaModels(true);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [adapterId, baseUrl]);

  const handleTestConnection = async () => {
    if (!adapter) return;
    if (adapterId === "ollama") {
      const loaded = await loadOllamaModels(false);
      if (loaded && apiKey.trim()) {
        await repositories.ai.saveCredentials({
          adapterId,
          apiKey: apiKey.trim(),
          baseUrl: baseUrl.trim(),
        });
        setApiKey("");
      }
      return;
    }

    setTestStatus("testing");
    setTestError("");
    try {
      const savedCreds = await repositories.ai.loadCredentials(adapterId);
      const creds = {
        ...(savedCreds ?? {}),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      };
      if (!("apiKey" in creds) && !("accessToken" in creds)) {
        setTestStatus("error");
        setTestError("No credentials found. Connect first.");
        return;
      }
      const models = await adapter.listModels(creds);
      if (models.length > 0) {
        setTestStatus("success");
        setAvailableModels(models);
        if (apiKey.trim()) {
          await repositories.ai.saveCredentials({
            adapterId,
            apiKey: apiKey.trim(),
          });
          setApiKey("");
        }
        setCredentialStatus("connected");
      } else {
        setTestStatus("error");
        setTestError(
          adapterId === "ollama"
            ? "Could not reach Ollama or no models are installed. Check the base URL and try again."
            : "Could not reach the API. Check your credentials and try again.",
        );
      }
    } catch (err: any) {
      setTestStatus("error");
      setTestError(err?.message ?? "Connection failed.");
    }
  };

  // Phase 1: open external browser
  const handleConnectOAuth = async () => {
    setAuthLoading(true);
    try {
      const result = await authManager.startOAuthFlow(adapterId);
      setOauthInstruction(result.message);
      setOauthPending(true);
      setOauthCode("");
    } catch (err: any) {
      uiDispatch.setAlert({
        open: true,
        message: err?.message ?? "OAuth failed.",
        type: "error",
      });
    } finally {
      setAuthLoading(false);
    }
  };

  // Phase 2: exchange the pasted code or complete device authorization
  const handleSubmitOAuthCode = async () => {
    if (adapterId !== "openai" && !oauthCode.trim()) return;
    setAuthLoading(true);
    try {
      await authManager.completeOAuthFlow(adapterId, oauthCode.trim());
      setOauthPending(false);
      setOauthCode("");
      setCredentialStatus("connected");
      uiDispatch.setAlert({
        open: true,
        message: `Connected to ${adapter?.name ?? adapterId}.`,
        type: "success",
      });
    } catch (err: any) {
      uiDispatch.setAlert({
        open: true,
        message: err?.message ?? "OAuth code exchange failed.",
        type: "error",
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await authManager.clearCredentials(adapterId);
    setCredentialStatus("disconnected");
    setTestStatus("idle");
    setAvailableModels([]);
    setOauthPending(false);
    setOauthCode("");
    uiDispatch.setAlert({
      open: true,
      message: "Disconnected.",
      type: "success",
    });
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const config: AIConfig = {
        id: configId,
        name: `${adapter?.name ?? adapterId} Config`,
        adapterId,
        model: model || adapter?.defaultModel || "",
        systemPrompt,
        commandTemplate: adapterId === "cli" ? commandTemplate : undefined,
        baseUrl: adapterId === "ollama" ? baseUrl.trim() : undefined,
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await repositories.ai.saveConfig(config);
      uiDispatch.setAlert({
        open: true,
        message: "AI configuration saved.",
        type: "success",
      });
    } catch (err: any) {
      uiDispatch.setAlert({
        open: true,
        message: err?.message ?? "Failed to save configuration.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const visibleAdapters = adapters.filter(
    (a) => a.id !== "cli" || isElectron(),
  );

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Provider</span>
          <div className="grid grid-cols-2 gap-2">
            {visibleAdapters.map((a) => {
              const aMeta = PROVIDER_META[a.id];
              const isSelected = adapterId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleAdapterChange(a.id)}
                  className={css(
                    "flex flex-col gap-1 p-3 rounded-lg border text-left transition-[box-shadow,border-color]",
                    aMeta?.color ?? "bg-muted/50 border-border",
                    isSelected &&
                      "ring-2 ring-primary ring-offset-1 ring-offset-background",
                  )}
                >
                  <div className="flex gap-2 justify-between items-center">
                    <span className="text-sm font-medium">
                      {a.id === "cli" ? (
                        <span className="flex gap-1.5 items-center">
                          <TerminalIcon size={14} />
                          CLI
                        </span>
                      ) : (
                        a.name
                      )}
                    </span>
                    {isSelected && credentialStatus === "connected" && (
                      <CheckCircleIcon size={14} className="text-green-500" />
                    )}
                    {isSelected && credentialStatus === "disconnected" && (
                      <XCircleIcon
                        size={14}
                        className="text-muted-foreground"
                      />
                    )}
                    {isSelected && credentialStatus === "loading" && (
                      <SpinnerIcon
                        size={14}
                        className="text-muted-foreground animate-spin"
                      />
                    )}
                  </div>
                  {aMeta?.description && (
                    <span className="text-[10px] leading-tight text-muted-foreground">
                      {aMeta.description}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Credentials section */}
        {adapterId === "cli" ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">CLI Command Template</span>
            <p className="text-xs text-muted-foreground">
              Use <code>{"{{prompt}}"}</code> for the user message,{" "}
              <code>{"{{system_prompt}}"}</code> for the system prompt,{" "}
              <code>{"{{context}}"}</code> for the note content.
            </p>
            <Input
              hiddenLabel
              value={commandTemplate}
              placeholder="claude --dangerously-skip-permissions {{context}}"
              onChange={(e: any) => setCommandTemplate(e.target.value)}
            />
          </div>
        ) : adapterId === "ollama" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Base URL</span>
              <Input
                hiddenLabel
                value={baseUrl}
                placeholder={DEFAULT_OLLAMA_BASE_URL}
                onChange={(e: any) => setBaseUrl(e.target.value)}
                onKeyDown={(e: any) =>
                  e.key === "Enter" && handleTestConnection()
                }
              />
              <p className="text-[10px] text-muted-foreground">
                Use <code>{DEFAULT_OLLAMA_BASE_URL}</code> for local Ollama, or
                a cloud Ollama OpenAI-compatible base URL. Running models load
                from the same host via <code>/api/ps</code>.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">API Key (optional)</span>
              <div className="flex gap-2">
                <Input
                  hiddenLabel
                  type="password"
                  value={apiKey}
                  container="flex-1"
                  placeholder={meta?.keyHint ?? "Optional API key"}
                  onChange={(e: any) => setApiKey(e.target.value)}
                  onKeyDown={(e: any) =>
                    e.key === "Enter" && handleTestConnection()
                  }
                />
                <Button
                  size="small"
                  disabled={
                    !baseUrl.trim() ||
                    testStatus === "testing" ||
                    ollamaModelsLoading
                  }
                  onClick={handleTestConnection}
                >
                  {testStatus === "testing" || ollamaModelsLoading ? (
                    <SpinnerIcon size={14} className="animate-spin" />
                  ) : (
                    <span className="flex gap-1.5 items-center">
                      <PlugIcon size={14} />
                      Load models
                    </span>
                  )}
                </Button>
              </div>
              {testStatus === "success" && (
                <span className="flex gap-1 items-center text-xs text-green-500">
                  <CheckCircleIcon size={12} />
                  Connected — {availableModels.length} model
                  {availableModels.length !== 1 ? "s" : ""} available
                </span>
              )}
              {testStatus === "error" && (
                <span className="flex gap-1 items-center text-xs text-destructive">
                  <XCircleIcon size={12} />
                  {testError}
                </span>
              )}
            </div>
          </div>
        ) : adapter?.supportsOAuth ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Authentication</span>
              {credentialStatus === "connected" ? (
                <div className="flex gap-2">
                  <Button
                    size="small"
                    theme="ghost-danger"
                    onClick={handleDisconnect}
                  >
                    {meta?.disconnectLabel ?? "Disconnect"}
                  </Button>
                </div>
              ) : oauthPending ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">
                    {oauthInstruction}
                  </p>
                  <div className="flex gap-2">
                    {adapterId !== "openai" && (
                      <Input
                        hiddenLabel
                        value={oauthCode}
                        container="flex-1"
                        placeholder="Paste authorization code here"
                        onChange={(e: any) => setOauthCode(e.target.value)}
                        onKeyDown={(e: any) =>
                          e.key === "Enter" && handleSubmitOAuthCode()
                        }
                      />
                    )}
                    <Button
                      size="small"
                      disabled={
                        authLoading ||
                        (adapterId !== "openai" && !oauthCode.trim())
                      }
                      onClick={handleSubmitOAuthCode}
                    >
                      {authLoading ? (
                        <SpinnerIcon size={14} className="animate-spin" />
                      ) : adapterId === "openai" ? (
                        "Complete sign-in"
                      ) : (
                        "Submit"
                      )}
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOauthPending(false);
                      setOauthCode("");
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground w-fit"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="small"
                    disabled={authLoading}
                    onClick={handleConnectOAuth}
                  >
                    {authLoading
                      ? "Opening browser..."
                      : (meta?.oauthLabel ?? "Connect")}
                  </Button>
                </div>
              )}
            </div>
            {adapterId !== "openai" && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Or use API Key</span>
                <div className="flex gap-2">
                  <Input
                    hiddenLabel
                    type="password"
                    value={apiKey}
                    container="flex-1"
                    placeholder={meta?.keyHint ?? "API key"}
                    onChange={(e: any) => setApiKey(e.target.value)}
                    onKeyDown={(e: any) =>
                      e.key === "Enter" && handleTestConnection()
                    }
                  />
                  <Button
                    size="small"
                    disabled={!apiKey.trim()}
                    onClick={handleTestConnection}
                  >
                    Save
                  </Button>
                </div>
                {meta?.consoleUrl && (
                  <a
                    href={meta.consoleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-1 items-center text-[11px] text-primary hover:underline w-fit"
                  >
                    <ArrowSquareOutIcon size={11} />
                    Get API key
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">API Key</span>
              {meta?.consoleUrl && (
                <a
                  href={meta.consoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-1 items-center text-[11px] text-primary hover:underline"
                >
                  <ArrowSquareOutIcon size={11} />
                  Get key
                </a>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                hiddenLabel
                type="password"
                value={apiKey}
                container="flex-1"
                placeholder={
                  credentialStatus === "connected"
                    ? "key saved (paste new to replace)"
                    : (meta?.keyHint ?? "Paste your API key")
                }
                onChange={(e: any) => setApiKey(e.target.value)}
                onKeyDown={(e: any) =>
                  e.key === "Enter" && handleTestConnection()
                }
              />
              <Button
                size="small"
                disabled={!apiKey.trim() && credentialStatus !== "connected"}
                onClick={handleTestConnection}
              >
                {testStatus === "testing" ? (
                  <SpinnerIcon size={14} className="animate-spin" />
                ) : (
                  <span className="flex gap-1.5 items-center">
                    <PlugIcon size={14} />
                    {apiKey.trim() ? "Connect" : "Test"}
                  </span>
                )}
              </Button>
            </div>

            {/* Test result feedback */}
            {testStatus === "success" && (
              <span className="flex gap-1 items-center text-xs text-green-500">
                <CheckCircleIcon size={12} />
                Connected — {availableModels.length} model
                {availableModels.length !== 1 ? "s" : ""} available
              </span>
            )}
            {testStatus === "error" && (
              <span className="flex gap-1 items-center text-xs text-destructive">
                <XCircleIcon size={12} />
                {testError}
              </span>
            )}
          </div>
        )}

        {/* Model */}
        {adapterId !== "cli" && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Model</span>
            {availableModels.length > 0 ? (
              <Select
                hiddenLabel
                value={model}
                title="Model"
                onChange={(e) => setModel(e.target.value)}
                options={availableModels.map((m) => ({
                  value: m.id,
                  label: m.name,
                }))}
              />
            ) : adapterId === "ollama" ? (
              <Select
                hiddenLabel
                value=""
                title="Model"
                disabled
                options={[
                  {
                    value: "",
                    label:
                      testStatus === "testing" || ollamaModelsLoading
                        ? "Loading running models..."
                        : "Load running models from Ollama first",
                  },
                ]}
              />
            ) : (
              <Input
                hiddenLabel
                value={model}
                placeholder={adapter?.defaultModel ?? "Model name"}
                onChange={(e: any) => setModel(e.target.value)}
              />
            )}
            {adapterId === "ollama" && ollamaModelsLoading ? (
              <p className="text-[10px] text-muted-foreground">
                Loading running models from <code>{baseUrl.trim()}</code> via{" "}
                <code>/api/ps</code>...
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Default: <code>{adapter?.defaultModel}</code>
              </p>
            )}
          </div>
        )}

        {/* System prompt */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">System Prompt</span>
          <Textarea
            rows={3}
            optionalText=" "
            value={systemPrompt}
            placeholder="You are a helpful writing assistant..."
            onChange={(e: any) => setSystemPrompt(e.target.value)}
          />
        </div>

        <div className="flex justify-end pt-4 border-t border-border/50">
          <Button size="small" disabled={saving} onClick={handleSaveConfig}>
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>
    </>
  );
};
