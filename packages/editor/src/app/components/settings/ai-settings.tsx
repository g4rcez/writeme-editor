import { Button, Input, Modal, Select, Textarea, css } from "@g4rcez/components";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { CopyIcon } from "@phosphor-icons/react/dist/csr/Copy";
import { PlugIcon } from "@phosphor-icons/react/dist/csr/Plug";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { SpinnerIcon } from "@phosphor-icons/react/dist/csr/Spinner";
import { TerminalIcon } from "@phosphor-icons/react/dist/csr/Terminal";
import { XCircleIcon } from "@phosphor-icons/react/dist/csr/XCircle";
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { v7 as uuid } from "uuid";
import type { AIModel } from "@/app/ai/adapters/types";
import type { AIConfig } from "@/store/repositories/electron/ai.repository";
import { adapterRegistry } from "@/app/ai/adapters/registry";
import { authManager, type OAuthStartResult } from "@/app/ai/auth/auth-manager";
import { copyDeviceCode } from "@/lib/copy-device-code";
import { isElectron } from "@/lib/is-electron";
import { repositories } from "@/store/repositories";
import { uiDispatch } from "@/store/ui.store";

type CredentialStatus = "connected" | "disconnected" | "loading";
type TestStatus = "idle" | "testing" | "success" | "error";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";
const OLLAMA_ADAPTER_ID = "ollama";
const OPENAI_ADAPTER_ID = "openai";

const PROVIDER_META: Record<
    string,
    {
        description: string;
        consoleUrl: string;
        keyHint: string;
        oauthLabel: string;
        disconnectLabel: string;
        shortLabel: string;
    }
> = {
    anthropic: {
        description: "Claude models with vision and PDF support",
        consoleUrl: "https://console.anthropic.com/settings/keys",
        keyHint: "Starts with sk-ant-",
        oauthLabel: "Sign in with Claude",
        disconnectLabel: "Disconnect Claude account",
        shortLabel: "Claude",
    },
    gemini: {
        description: "Gemini models with OAuth or API key",
        consoleUrl: "https://aistudio.google.com/apikey",
        keyHint: "Google AI Studio API key",
        oauthLabel: "Connect with Google",
        disconnectLabel: "Disconnect Google account",
        shortLabel: "Gemini",
    },
    openai: {
        description: "GPT and o-series models with ChatGPT OAuth",
        consoleUrl: "",
        keyHint: "",
        oauthLabel: "Sign in with OpenAI",
        disconnectLabel: "Disconnect OpenAI account",
        shortLabel: "GPT",
    },
    ollama: {
        description: "Local or cloud Ollama via OpenAI-compatible endpoints",
        consoleUrl: "",
        keyHint: "Optional cloud API key",
        oauthLabel: "",
        disconnectLabel: "Disconnect Ollama credentials",
        shortLabel: "Local",
    },
    cli: {
        description: "Run any CLI command as AI backend",
        consoleUrl: "",
        keyHint: "",
        oauthLabel: "",
        disconnectLabel: "",
        shortLabel: "Shell",
    },
};

const OPENAI_ICON_PATH =
    "M239.184 106.203a64.72 64.72 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.72 64.72 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.67 64.67 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.77 64.77 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483m-97.56 136.338a48.4 48.4 0 0 1-31.105-11.255l1.535-.87l51.67-29.825a8.6 8.6 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601M37.158 197.93a48.35 48.35 0 0 1-5.781-32.589l1.534.921l51.722 29.826a8.34 8.34 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803M23.549 85.38a48.5 48.5 0 0 1 25.58-21.333v61.39a8.29 8.29 0 0 0 4.195 7.316l62.874 36.272l-21.845 12.636a.82.82 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405zm179.466 41.695l-63.08-36.63L161.73 77.86a.82.82 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.54 8.54 0 0 0-4.4-7.213m21.742-32.69l-1.535-.922l-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.72.72 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391zM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87l-51.67 29.825a8.6 8.6 0 0 0-4.246 7.367zm11.868-25.58L128.067 97.3l28.188 16.218v32.434l-28.086 16.218l-28.188-16.218z";

function ProviderLogo({ id, active }: { id: string; active: boolean }) {
    return (
        <span
            className={css(
                "rounded-button-radius relative flex size-10 shrink-0 items-center justify-center overflow-hidden border border-card-border bg-muted/35 text-foreground/70 transition-colors duration-200 group-hover:text-foreground",
                active && "bg-background/40 text-foreground",
            )}
            aria-hidden="true"
        >
            <span
                className={css(
                    "absolute inset-0 flex items-center justify-center transition-opacity duration-200",
                    active ? "opacity-0" : "opacity-100 group-hover:opacity-0",
                )}
            >
                <ProviderLogoGlyph id={id} colored={false} />
            </span>
            <span
                className={css(
                    "absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200",
                    active && "opacity-100",
                    "group-hover:opacity-100",
                )}
            >
                <ProviderLogoGlyph id={id} colored />
            </span>
        </span>
    );
}

function ProviderLogoGlyph({ id, colored }: { id: string; colored: boolean }) {
    if (id === "anthropic") {
        return (
            <svg viewBox="0 0 256 176" className="size-6" aria-hidden="true">
                <path
                    fill={colored ? "#d97757" : "currentColor"}
                    d="m147.487 0l70.081 175.78H256L185.919 0zM66.183 106.221l23.98-61.774l23.98 61.774zM70.07 0L0 175.78h39.18l14.33-36.914h73.308l14.328 36.914h39.179L110.255 0z"
                />
            </svg>
        );
    }

    if (id === "openai") {
        return (
            <svg viewBox="0 0 260 260" className="size-6" aria-hidden="true">
                <path fill={colored ? "#10a37f" : "currentColor"} d={OPENAI_ICON_PATH} />
            </svg>
        );
    }

    if (id === "gemini") {
        return (
            <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
                {colored && (
                    <defs>
                        <linearGradient id="gemini-provider-gradient" x1="2" x2="22" y1="22" y2="2">
                            <stop stopColor="#1a73e8" />
                            <stop offset="0.5" stopColor="#8e75ff" />
                            <stop offset="1" stopColor="#e8710a" />
                        </linearGradient>
                    </defs>
                )}
                <path
                    fill={colored ? "url(#gemini-provider-gradient)" : "currentColor"}
                    d="M12 2.25c.84 4.98 4.77 8.91 9.75 9.75c-4.98.84-8.91 4.77-9.75 9.75c-.84-4.98-4.77-8.91-9.75-9.75c4.98-.84 8.91-4.77 9.75-9.75Z"
                />
            </svg>
        );
    }

    if (id === OLLAMA_ADAPTER_ID) {
        return (
            <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
                <path
                    fill="currentColor"
                    d="M7.5 5.75c0-1.52 1.23-2.75 2.75-2.75h3.5c1.52 0 2.75 1.23 2.75 2.75v2.08l1.45 1.27A3.1 3.1 0 0 1 19 11.43V18a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-6.57c0-.9.39-1.76 1.05-2.33L7.5 7.83zm2.75-.75a.75.75 0 0 0-.75.75v2.98l-2.13 1.86c-.24.21-.37.51-.37.84V18c0 .55.45 1 1 1h8a1 1 0 0 0 1-1v-6.57c0-.33-.13-.63-.37-.84L14.5 8.73V5.75a.75.75 0 0 0-.75-.75zm-.75 8.25a1 1 0 1 1-2 0a1 1 0 0 1 2 0m7 0a1 1 0 1 1-2 0a1 1 0 0 1 2 0M9.25 16.5h5.5v1.5h-5.5z"
                />
            </svg>
        );
    }

    return <TerminalIcon className="size-5" weight={colored ? "fill" : "regular"} />;
}

function ProviderStatusIcon({ status }: { status: CredentialStatus }) {
    if (status === "connected") {
        return <CheckCircleIcon size={14} className="text-success" />;
    }
    if (status === "loading") {
        return <SpinnerIcon size={14} className="animate-spin text-muted-foreground" />;
    }
    return <XCircleIcon size={14} className="text-muted-foreground" />;
}

function ExternalProviderLink({ href, label }: { href: string; label: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit items-center gap-1 text-[11px] text-primary hover:underline"
        >
            <ArrowSquareOutIcon size={11} />
            {label}
        </a>
    );
}

export const AISettings = (): ReactElement => {
    const adapters = adapterRegistry.getAll();
    const [adapterId, setAdapterId] = useState(adapters[0]?.id ?? "anthropic");
    const [configLoading, setConfigLoading] = useState(true);
    const [model, setModel] = useState("");
    const [systemPrompt, setSystemPrompt] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [baseUrl, setBaseUrl] = useState(DEFAULT_OLLAMA_BASE_URL);
    const [commandTemplate, setCommandTemplate] = useState("claude --dangerously-skip-permissions {{context}}");
    const [credentialStatus, setCredentialStatus] = useState<CredentialStatus>("loading");
    const [authLoading, setAuthLoading] = useState(false);
    const [configId, setConfigId] = useState<string>(uuid());
    const [saving, setSaving] = useState(false);
    const [testStatus, setTestStatus] = useState<TestStatus>("idle");
    const [testError, setTestError] = useState("");
    const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
    const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
    const [openAIModelsLoading, setOpenAIModelsLoading] = useState(false);
    const [openAIModelsError, setOpenAIModelsError] = useState("");
    const [oauthPending, setOauthPending] = useState(false);
    const [oauthCode, setOauthCode] = useState("");
    const [oauthInstruction, setOauthInstruction] = useState("");
    const [oauthDeviceCode, setOauthDeviceCode] = useState<OAuthStartResult["deviceCode"]>();
    const [codeCopying, setCodeCopying] = useState(false);
    const [authError, setAuthError] = useState("");
    const [storageConsent, setStorageConsent] = useState<"oauth" | "api-key" | null>(null);
    const [storagePreparing, setStoragePreparing] = useState(false);
    const [storageError, setStorageError] = useState("");
    const desktop = isElectron();
    const connectionBusy = authLoading || storagePreparing || testStatus === "testing";

    const adapter = adapterRegistry.get(adapterId);
    const meta = PROVIDER_META[adapterId];
    const ollamaModelRequestId = useRef(0);
    const openAIModelRequestId = useRef(0);
    const credentialRequestId = useRef(0);
    const testRequestId = useRef(0);
    const authRequestId = useRef(0);
    const storageRequestId = useRef(0);
    const openAIModelSelectRef = useRef<HTMLSelectElement>(null);
    const focusOpenAIModelAfterRetryRef = useRef(false);
    const pendingCredentialClears = useRef(new Map<string, Promise<void>>());

    const trackCredentialClear = (id: string): Promise<void> => {
        const clearPromise = authManager.clearCredentials(id);
        pendingCredentialClears.current.set(id, clearPromise);
        void clearPromise.then(
            () => {
                if (pendingCredentialClears.current.get(id) === clearPromise) {
                    pendingCredentialClears.current.delete(id);
                }
            },
            () => {
                if (pendingCredentialClears.current.get(id) === clearPromise) {
                    pendingCredentialClears.current.delete(id);
                }
            },
        );
        return clearPromise;
    };

    const checkCredentials = async (id: string) => {
        const requestId = ++credentialRequestId.current;
        setCredentialStatus("loading");
        const pendingClear = pendingCredentialClears.current.get(id);
        if (pendingClear) await pendingClear.catch(() => undefined);
        if (requestId !== credentialRequestId.current) return;
        const creds = await repositories.ai.loadCredentials(id);
        if (requestId !== credentialRequestId.current) return;
        if (!creds) {
            setCredentialStatus("disconnected");
            return;
        }
        const hasCredential = !!(creds.apiKey || creds.accessToken);
        setCredentialStatus(hasCredential ? "connected" : "disconnected");
    };

    useEffect(() => {
        let disposed = false;

        const load = async () => {
            const [configs, credentialEntries] = await Promise.all([
                repositories.ai.getConfigs().catch(() => []),
                Promise.all(
                    adapters.map(async (candidate) => {
                        const credentials = await repositories.ai.loadCredentials(candidate.id).catch(() => null);
                        return {
                            adapterId: candidate.id,
                            configured: Boolean(credentials?.apiKey || credentials?.accessToken),
                        };
                    }),
                ),
            ]);
            if (disposed) return;

            const defaultConfig = configs.find((config) => config.isDefault) ?? configs[0];
            const configuredAdapterIds = credentialEntries
                .filter((entry) => entry.configured)
                .map((entry) => entry.adapterId);
            const configuredAdapterId =
                (defaultConfig && configuredAdapterIds.includes(defaultConfig.adapterId)
                    ? defaultConfig.adapterId
                    : configuredAdapterIds[0]) ??
                defaultConfig?.adapterId ??
                adapters[0]?.id ??
                "anthropic";
            const configuredProviderConfig = configs.find((config) => config.adapterId === configuredAdapterId);

            setAdapterId(configuredAdapterId);
            setCredentialStatus(configuredAdapterIds.includes(configuredAdapterId) ? "connected" : "disconnected");
            if (configuredProviderConfig) {
                setConfigId(configuredProviderConfig.id);
                setModel(configuredProviderConfig.model ?? "");
                setSystemPrompt(configuredProviderConfig.systemPrompt ?? "");
                setBaseUrl(configuredProviderConfig.baseUrl ?? DEFAULT_OLLAMA_BASE_URL);
                setCommandTemplate(
                    configuredProviderConfig.commandTemplate ?? "claude --dangerously-skip-permissions {{context}}",
                );
            } else {
                setModel(adapterRegistry.get(configuredAdapterId)?.defaultModel ?? "");
                setSystemPrompt("");
                setBaseUrl(configuredAdapterId === OLLAMA_ADAPTER_ID ? DEFAULT_OLLAMA_BASE_URL : "");
            }
            setConfigLoading(false);
        };
        void load();
        return () => {
            disposed = true;
            credentialRequestId.current += 1;
            authRequestId.current += 1;
            storageRequestId.current += 1;
            openAIModelRequestId.current += 1;
            ollamaModelRequestId.current += 1;
            testRequestId.current += 1;
            authManager.cancelOAuthFlow();
        };
    }, []);

    const handleAdapterChange = async (id: string) => {
        if (id === adapterId) return;
        storageRequestId.current += 1;
        setStorageConsent(null);
        setStoragePreparing(false);
        setStorageError("");
        setAuthError("");
        setOauthDeviceCode(undefined);
        setCodeCopying(false);
        setOauthInstruction("");
        authRequestId.current += 1;
        credentialRequestId.current += 1;
        testRequestId.current += 1;
        openAIModelRequestId.current += 1;
        ollamaModelRequestId.current += 1;
        authManager.cancelOAuthFlow();
        focusOpenAIModelAfterRetryRef.current = false;
        setAdapterId(id);
        setAuthLoading(false);
        setModel(adapterRegistry.get(id)?.defaultModel ?? "");
        setApiKey("");
        setBaseUrl(id === OLLAMA_ADAPTER_ID ? DEFAULT_OLLAMA_BASE_URL : "");
        setTestStatus("idle");
        setTestError("");
        setAvailableModels([]);
        setOllamaModelsLoading(false);
        setOpenAIModelsLoading(false);
        setOpenAIModelsError("");
        setOauthPending(false);
        setOauthCode("");
        await checkCredentials(id);
    };

    const loadOpenAIModels = useCallback(async (): Promise<void> => {
        if (adapterId !== OPENAI_ADAPTER_ID) return;
        const openAIAdapter = adapterRegistry.get(OPENAI_ADAPTER_ID);
        if (!openAIAdapter) return;

        const requestId = ++openAIModelRequestId.current;
        setOpenAIModelsLoading(true);

        try {
            const credentials = await authManager.getCredentials(OPENAI_ADAPTER_ID, openAIAdapter);
            const models = await openAIAdapter.listModels(credentials);
            if (requestId !== openAIModelRequestId.current) return;

            setAvailableModels(models);
            if (models.length === 0) {
                setOpenAIModelsError("OpenAI returned no available models. Retry or reconnect your account.");
                return;
            }

            setOpenAIModelsError("");
            setModel((currentModel) =>
                models.some((availableModel) => availableModel.id === currentModel)
                    ? currentModel
                    : (models[0]?.id ?? ""),
            );
        } catch (error: unknown) {
            if (requestId !== openAIModelRequestId.current) return;
            setAvailableModels([]);
            setOpenAIModelsError(error instanceof Error ? error.message : "Failed to load OpenAI models.");
        } finally {
            if (requestId === openAIModelRequestId.current) {
                setOpenAIModelsLoading(false);
            }
        }
    }, [adapterId]);

    useEffect(() => {
        if (adapterId !== OPENAI_ADAPTER_ID || credentialStatus !== "connected") return;

        void loadOpenAIModels();
        return () => {
            openAIModelRequestId.current += 1;
        };
    }, [adapterId, credentialStatus, loadOpenAIModels]);

    useEffect(() => {
        if (!focusOpenAIModelAfterRetryRef.current || openAIModelsLoading) return;
        focusOpenAIModelAfterRetryRef.current = false;
        if (adapterId === OPENAI_ADAPTER_ID && !openAIModelsError && availableModels.length > 0) {
            openAIModelSelectRef.current?.focus();
        }
    }, [adapterId, availableModels, openAIModelsError, openAIModelsLoading]);

    const loadOllamaModels = async (silent = false): Promise<boolean> => {
        const ollamaAdapter = adapterRegistry.get(OLLAMA_ADAPTER_ID);
        if (!ollamaAdapter || adapterId !== OLLAMA_ADAPTER_ID || !baseUrl.trim()) {
            return false;
        }

        const requestId = ++ollamaModelRequestId.current;
        setOllamaModelsLoading(true);
        if (!silent) {
            setTestStatus("testing");
            setTestError("");
        }

        try {
            const savedCreds = await repositories.ai.loadCredentials(OLLAMA_ADAPTER_ID);
            const models = await ollamaAdapter.listModels({
                ...(savedCreds ?? {}),
                ...(!silent && apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
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
                setTestError("Could not reach Ollama or no models are installed. Check the base URL and try again.");
            }
            return false;
        } catch (err: unknown) {
            if (requestId !== ollamaModelRequestId.current) return false;
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
        if (adapterId !== OLLAMA_ADAPTER_ID) return;
        ollamaModelRequestId.current += 1;
        setAvailableModels([]);
        setOllamaModelsLoading(false);
        if (!baseUrl.trim()) return;

        const timeoutId = window.setTimeout(() => {
            void loadOllamaModels(true);
        }, 500);

        return () => {
            window.clearTimeout(timeoutId);
            ollamaModelRequestId.current += 1;
        };
    }, [adapterId, baseUrl]);

    const handleTestConnection = async () => {
        if (!adapter) return;
        const requestId = ++testRequestId.current;
        const enteredApiKey = apiKey.trim();
        const isCurrentRequest = (): boolean => requestId === testRequestId.current;

        setTestStatus("testing");
        setTestError("");
        try {
            if (adapterId === OLLAMA_ADAPTER_ID) {
                const loaded = await loadOllamaModels(false);
                if (!isCurrentRequest() || !loaded) return;
                if (enteredApiKey) {
                    setTestStatus("testing");
                    await authManager.saveCredentials(adapterId, {
                        apiKey: enteredApiKey,
                        baseUrl: baseUrl.trim(),
                    });
                    if (!isCurrentRequest()) return;
                    setApiKey("");
                    setTestStatus("success");
                }
                return;
            }

            const savedCreds = await repositories.ai.loadCredentials(adapterId);
            if (!isCurrentRequest()) return;
            const creds = {
                ...(savedCreds ?? {}),
                ...(enteredApiKey ? { apiKey: enteredApiKey } : {}),
            };
            if (!("apiKey" in creds) && !("accessToken" in creds)) {
                setTestStatus("error");
                setTestError("No credentials found. Connect first.");
                return;
            }
            const models = await adapter.listModels(creds);
            if (!isCurrentRequest()) return;
            if (models.length > 0) {
                setAvailableModels(models);
                if (enteredApiKey) {
                    await authManager.saveCredentials(adapterId, {
                        apiKey: enteredApiKey,
                    });
                    if (!isCurrentRequest()) return;
                    setApiKey("");
                }
                if (!isCurrentRequest()) return;
                setCredentialStatus("connected");
                setTestStatus("success");
            } else {
                setTestStatus("error");
                setTestError("Could not reach the API. Check your credentials and try again.");
            }
        } catch (err: unknown) {
            if (!isCurrentRequest()) return;
            setTestStatus("error");
            setTestError(err instanceof Error ? err.message : "Connection failed.");
        }
    };

    const handleConnectOAuth = async (): Promise<void> => {
        const requestId = ++authRequestId.current;
        const authAdapterId = adapterId;
        setAuthError("");
        setAuthLoading(true);
        try {
            const result = await authManager.startOAuthFlow(authAdapterId);
            if (requestId !== authRequestId.current) return;
            setOauthInstruction(result.message);
            setOauthDeviceCode(result.deviceCode);
            setOauthPending(true);
            setOauthCode("");
        } catch (err: unknown) {
            if (requestId !== authRequestId.current) return;
            setAuthError(err instanceof Error ? err.message : "Sign-in could not start. Try again.");
        } finally {
            if (requestId === authRequestId.current) setAuthLoading(false);
        }
    };

    const handleSubmitOAuthCode = async (): Promise<void> => {
        if (authLoading || (adapterId !== OPENAI_ADAPTER_ID && !oauthCode.trim())) return;
        setCodeCopying(false);
        const requestId = ++authRequestId.current;
        const authAdapterId = adapterId;
        setAuthError("");
        setAuthLoading(true);
        try {
            await authManager.completeOAuthFlow(authAdapterId, oauthCode.trim());
            if (requestId !== authRequestId.current) return;
            setOauthPending(false);
            setOauthCode("");
            if (authAdapterId === OPENAI_ADAPTER_ID) {
                setOpenAIModelsLoading(true);
                setOpenAIModelsError("");
            }
            setCredentialStatus("connected");
            uiDispatch.setAlert({
                open: true,
                message: `Connected to ${adapter?.name ?? authAdapterId}.`,
                type: "success",
            });
        } catch (err: unknown) {
            if (requestId !== authRequestId.current) return;
            setAuthError(err instanceof Error ? err.message : "Sign-in could not finish. Try again.");
        } finally {
            if (requestId === authRequestId.current) setAuthLoading(false);
        }
    };

    const handleCancelOAuth = () => {
        authRequestId.current += 1;
        authManager.cancelOAuthFlow();
        setAuthLoading(false);
        setOauthPending(false);
        setOauthCode("");
        setOauthInstruction("");
        setOauthDeviceCode(undefined);
        setCodeCopying(false);
        setAuthError("");
    };

    const requestConnection = (action: "oauth" | "api-key"): void => {
        if (connectionBusy) return;
        setAuthError("");
        setTestStatus("idle");
        setTestError("");
        setStorageError("");
        setStorageConsent(action);
    };

    const requestTestConnection = (): void => {
        if (connectionBusy) return;
        if (apiKey.trim()) requestConnection("api-key");
        else void handleTestConnection();
    };

    const handleCancelStorage = (): void => {
        storageRequestId.current += 1;
        setStorageConsent(null);
        setStoragePreparing(false);
        setStorageError("");
    };

    const handleAllowStorage = async (): Promise<void> => {
        const action = storageConsent;
        if (!action || storagePreparing) return;
        const requestId = ++storageRequestId.current;
        setStoragePreparing(true);
        setStorageError("");
        try {
            if (desktop) await window.electronAPI.ai.prepareCredentialStorage();
            if (requestId !== storageRequestId.current) return;
            setStorageConsent(null);
            setStoragePreparing(false);
            if (action === "oauth") await handleConnectOAuth();
            else await handleTestConnection();
        } catch (error: unknown) {
            if (requestId !== storageRequestId.current) return;
            const message = error instanceof Error ? error.message : "";
            if (
                typeof window.electronAPI?.ai?.prepareCredentialStorage !== "function" ||
                /No handler registered|not a function/.test(message)
            ) {
                setStorageError(
                    "This window is using an outdated desktop bridge. Quit all Write Me windows and reopen the updated app, then try again. No new credentials have been saved.",
                );
            } else if (message.includes("AI setup access denied")) {
                setStorageError(
                    "This window cannot start AI setup. Open AI settings in the main Write Me window and try again. No new credentials have been saved.",
                );
            } else {
                setStorageError(
                    "Secure storage is unavailable. Encrypted storage could not be initialized. No new credentials have been saved. On macOS, unlock your login Keychain and allow Write Me access if asked. Use View > Toggle Developer Tools to check storage availability.",
                );
            }
        } finally {
            if (requestId === storageRequestId.current) setStoragePreparing(false);
        }
    };

    const handleCopyCode = async (): Promise<void> => {
        if (!oauthDeviceCode || codeCopying) return;
        const requestId = authRequestId.current;
        const userCode = oauthDeviceCode.userCode;
        setCodeCopying(true);
        const copied = await copyDeviceCode(userCode);
        if (requestId !== authRequestId.current) return;
        setOauthDeviceCode((current) => (current ? { ...current, copied } : current));
        setCodeCopying(false);
    };

    const handleDisconnect = async () => {
        const requestId = ++authRequestId.current;
        const disconnectedAdapterId = adapterId;
        storageRequestId.current += 1;
        setStorageConsent(null);
        setStoragePreparing(false);
        setStorageError("");
        setAuthError("");
        setOauthDeviceCode(undefined);
        setCodeCopying(false);
        credentialRequestId.current += 1;
        testRequestId.current += 1;
        openAIModelRequestId.current += 1;
        ollamaModelRequestId.current += 1;
        authManager.cancelOAuthFlow();
        focusOpenAIModelAfterRetryRef.current = false;
        setOpenAIModelsLoading(false);
        setOllamaModelsLoading(false);
        await trackCredentialClear(disconnectedAdapterId);
        if (requestId !== authRequestId.current) return;
        setCredentialStatus("disconnected");
        setTestStatus("idle");
        setAvailableModels([]);
        setOpenAIModelsError("");
        setOauthPending(false);
        setOauthCode("");
        uiDispatch.setAlert({
            open: true,
            message: "Disconnected.",
            type: "success",
        });
    };

    const hasValidOpenAIModel =
        adapterId !== OPENAI_ADAPTER_ID ||
        (credentialStatus === "connected" &&
            !openAIModelsLoading &&
            availableModels.some((availableModel) => availableModel.id === model));

    const handleSaveConfig = async () => {
        if (!hasValidOpenAIModel) {
            uiDispatch.setAlert({
                open: true,
                message: "Select an available OpenAI model before saving.",
                type: "error",
            });
            return;
        }

        setSaving(true);
        try {
            const config: AIConfig = {
                id: configId,
                name: `${adapter?.name ?? adapterId} Config`,
                adapterId,
                model: adapterId === OPENAI_ADAPTER_ID ? model : model || adapter?.defaultModel || "",
                systemPrompt,
                commandTemplate: adapterId === "cli" ? commandTemplate : undefined,
                baseUrl: adapterId === OLLAMA_ADAPTER_ID ? baseUrl.trim() : undefined,
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
        } catch (err: unknown) {
            uiDispatch.setAlert({
                open: true,
                message: err instanceof Error ? err.message : "Failed to save configuration.",
                type: "error",
            });
        } finally {
            setSaving(false);
        }
    };

    const visibleAdapters = adapters.filter((a) => a.id !== "cli" || isElectron());

    if (configLoading) {
        return (
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                Loading AI configuration...
            </p>
        );
    }

    return (
        <>
            <Modal
                open={storageConsent !== null}
                onChange={(open) => {
                    if (!open) handleCancelStorage();
                }}
                title={desktop ? "Allow secure credential storage?" : "Store credentials in this browser?"}
                footer={
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button theme="ghost-muted" onClick={handleCancelStorage}>
                            Cancel
                        </Button>
                        <Button disabled={storagePreparing} onClick={handleAllowStorage}>
                            {storagePreparing ? "Checking secure storage..." : "Allow and continue"}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4 text-sm leading-relaxed text-foreground">
                    <p>
                        {desktop
                            ? "Write Me needs your permission to encrypt and save this provider's credentials on your device."
                            : "This provider's credentials will be saved in this browser profile, without system Keychain protection. Use the desktop app for encrypted credential storage."}
                    </p>
                    {desktop && (
                        <p>
                            Your operating system may ask for access to its credential store. On macOS, unlock your
                            login Keychain and allow Write Me access. Sign-in will only start after encrypted storage is
                            available.
                        </p>
                    )}
                    <p>Your prompts and the note content you send will be shared with the selected provider.</p>
                    {storagePreparing && (
                        <output className="block">
                            Checking encrypted storage. Respond to any system permission prompt.
                        </output>
                    )}
                    {storageError && (
                        <p role="alert" className="text-danger">
                            {storageError}
                        </p>
                    )}
                </div>
            </Modal>
            <div className="grid max-w-6xl min-w-0 gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
                <section className="min-w-0 space-y-3" aria-labelledby="ai-provider-heading">
                    <div>
                        <h2 id="ai-provider-heading" className="text-sm font-semibold text-foreground">
                            Provider
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">Choose an account or a local runtime.</p>
                    </div>
                    <Select
                        title="Provider"
                        hiddenLabel
                        container="lg:hidden"
                        value={adapterId}
                        disabled={saving}
                        onChange={(event) => void handleAdapterChange(event.target.value)}
                        options={visibleAdapters.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
                    />
                    <div className="hidden gap-2 lg:grid">
                        {visibleAdapters.map((a) => {
                            const aMeta = PROVIDER_META[a.id];
                            const isSelected = adapterId === a.id;
                            const statusText =
                                a.id === "cli"
                                    ? "Local command"
                                    : credentialStatus === "connected"
                                      ? "Connected"
                                      : credentialStatus === "loading"
                                        ? "Checking"
                                        : "Needs setup";

                            return (
                                <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => handleAdapterChange(a.id)}
                                    aria-pressed={isSelected}
                                    disabled={saving}
                                    className={css(
                                        "group flex min-w-0 items-start gap-3 rounded-button-radius border p-3 text-left transition-colors hover:bg-secondary-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
                                        isSelected && "border-primary bg-secondary-background",
                                        !isSelected && "border-transparent",
                                    )}
                                >
                                    <ProviderLogo id={a.id} active={isSelected} />
                                    <span className="flex min-w-0 flex-1 flex-col gap-2">
                                        <span className="flex items-start justify-between gap-3">
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-semibold text-foreground">
                                                    {a.name}
                                                </span>
                                                <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">
                                                    {aMeta?.shortLabel ?? a.id}
                                                </span>
                                            </span>
                                            {isSelected && (
                                                <span className="rounded-button-radius inline-flex shrink-0 items-center gap-1 border border-card-border bg-background/70 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                                                    <ProviderStatusIcon status={credentialStatus} />
                                                    {statusText}
                                                </span>
                                            )}
                                        </span>
                                        {aMeta?.description && (
                                            <span className="text-xs leading-snug text-muted-foreground">
                                                {aMeta.description}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <div className="min-w-0 space-y-8">
                    <section className="space-y-5" aria-labelledby="ai-connection-heading">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <ProviderLogo id={adapterId} active />
                                <div className="min-w-0">
                                    <h2 id="ai-connection-heading" className="text-lg font-semibold text-foreground">
                                        {adapter?.name ?? adapterId}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">{meta?.description}</p>
                                </div>
                            </div>
                            <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                                {adapterId !== "cli" && <ProviderStatusIcon status={credentialStatus} />}
                                {adapterId === "cli"
                                    ? "Local command"
                                    : credentialStatus === "connected"
                                      ? "Connected"
                                      : credentialStatus === "loading"
                                        ? "Checking..."
                                        : "Not connected"}
                            </span>
                        </div>
                        {adapterId !== "cli" && (
                            <div className="flex items-start gap-3 rounded-card-radius bg-secondary-background p-4 text-sm leading-relaxed text-foreground">
                                <ShieldCheckIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                                <div className="space-y-1">
                                    <p className="font-medium">Before you connect</p>
                                    <p>
                                        {desktop
                                            ? "Allow access to your system credential store when asked. Write Me checks encrypted storage before sign-in."
                                            : "Credentials stay in this browser profile. The desktop app uses your system credential store to encrypt them."}
                                    </p>
                                    <p>
                                        {adapterId === OLLAMA_ADAPTER_ID
                                            ? "Local Ollama does not need a key. Cloud endpoints receive the prompts and note content you send."
                                            : "Your provider receives the prompts and note content you send. AI usage may incur provider charges."}
                                    </p>
                                </div>
                            </div>
                        )}
                        {authError && (
                            <p role="alert" className="text-sm text-danger">
                                {authError}
                            </p>
                        )}
                        {adapterId === "cli" ? (
                            <div className="flex flex-col gap-2">
                                <span className="text-sm font-medium">CLI Command Template</span>
                                <p className="text-xs text-muted-foreground">
                                    Use <code>{"{{prompt}}"}</code> for the user message,{" "}
                                    <code>{"{{system_prompt}}"}</code> for the system prompt,{" "}
                                    <code>{"{{context}}"}</code> for the note content.
                                </p>
                                <Input
                                    title="CLI command template"
                                    hiddenLabel
                                    value={commandTemplate}
                                    placeholder="claude --dangerously-skip-permissions {{context}}"
                                    onChange={(e: any) => setCommandTemplate(e.target.value)}
                                />
                            </div>
                        ) : adapterId === OLLAMA_ADAPTER_ID ? (
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <span className="text-sm font-medium">Base URL</span>
                                    <Input
                                        title="Base URL"
                                        hiddenLabel
                                        value={baseUrl}
                                        placeholder={DEFAULT_OLLAMA_BASE_URL}
                                        onChange={(event) => setBaseUrl(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") requestTestConnection();
                                        }}
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                        Use <code>{DEFAULT_OLLAMA_BASE_URL}</code> for local Ollama, or a cloud Ollama
                                        OpenAI-compatible base URL. Running models load from the same host via{" "}
                                        <code>/api/ps</code>.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <span className="text-sm font-medium">API Key (optional)</span>
                                    <div className="flex gap-2">
                                        <Input
                                            title="API key (optional)"
                                            hiddenLabel
                                            type="password"
                                            value={apiKey}
                                            container="min-w-0 flex-1"
                                            autoComplete="off"
                                            onChange={(event) => setApiKey(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") requestTestConnection();
                                            }}
                                            placeholder={meta?.keyHint ?? "Optional API key"}
                                        />
                                        <Button
                                            size="small"
                                            disabled={!baseUrl.trim() || connectionBusy || ollamaModelsLoading}
                                            onClick={requestTestConnection}
                                        >
                                            {testStatus === "testing" || ollamaModelsLoading ? (
                                                <SpinnerIcon size={14} className="animate-spin" />
                                            ) : (
                                                <span className="flex items-center gap-1.5">
                                                    <PlugIcon size={14} />
                                                    Load models
                                                </span>
                                            )}
                                        </Button>
                                    </div>
                                    {testStatus === "success" && (
                                        <span className="flex items-center gap-1 text-xs text-success">
                                            <CheckCircleIcon size={12} />
                                            Connected — {availableModels.length} model
                                            {availableModels.length !== 1 ? "s" : ""} available
                                        </span>
                                    )}
                                    {testStatus === "error" && (
                                        <span className="text-destructive flex items-center gap-1 text-xs">
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
                                            <Button size="small" theme="ghost-danger" onClick={handleDisconnect}>
                                                {meta?.disconnectLabel ?? "Disconnect"}
                                            </Button>
                                        </div>
                                    ) : oauthPending ? (
                                        <div className="space-y-4">
                                            {oauthDeviceCode ? (
                                                <div className="space-y-3">
                                                    <p className="text-sm text-foreground">
                                                        Enter this code on the OpenAI page, then return here to complete
                                                        sign-in.
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <Input
                                                            title="Device authorization code"
                                                            hiddenLabel
                                                            readOnly
                                                            value={oauthDeviceCode.userCode}
                                                            container="w-full sm:w-52"
                                                            className="font-mono text-xl"
                                                            onFocus={(event) => event.currentTarget.select()}
                                                        />
                                                        <Button
                                                            size="small"
                                                            theme="ghost-muted"
                                                            disabled={codeCopying || authLoading}
                                                            onClick={handleCopyCode}
                                                        >
                                                            <CopyIcon size={16} aria-hidden="true" />
                                                            {codeCopying ? "Copying..." : "Copy code"}
                                                        </Button>
                                                    </div>
                                                    <output className="block text-sm text-foreground">
                                                        {oauthDeviceCode.copied
                                                            ? "Code copied to clipboard."
                                                            : "Automatic copy was unavailable. Use Copy code or select and copy the code above."}
                                                    </output>
                                                    <ExternalProviderLink
                                                        href={oauthDeviceCode.verificationUrl}
                                                        label="Open OpenAI sign-in page"
                                                    />
                                                </div>
                                            ) : (
                                                <p className="text-sm text-foreground">{oauthInstruction}</p>
                                            )}
                                            <div className="flex flex-wrap gap-2">
                                                {adapterId !== "openai" && (
                                                    <Input
                                                        title="Authorization code"
                                                        hiddenLabel
                                                        value={oauthCode}
                                                        autoComplete="one-time-code"
                                                        container="min-w-0 flex-1"
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
                                                        authLoading || (adapterId !== "openai" && !oauthCode.trim())
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
                                            <Button size="small" theme="ghost-muted" onClick={handleCancelOAuth}>
                                                Cancel sign-in
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <Button
                                                size="small"
                                                disabled={connectionBusy}
                                                onClick={() => requestConnection("oauth")}
                                            >
                                                {authLoading ? "Opening browser..." : (meta?.oauthLabel ?? "Connect")}
                                            </Button>
                                            {authLoading && (
                                                <Button size="small" theme="ghost-muted" onClick={handleCancelOAuth}>
                                                    Cancel sign-in
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {adapterId !== "openai" && !oauthPending && (
                                    <div className="flex flex-col gap-2">
                                        <span className="text-sm font-medium">Or use API Key</span>
                                        <div className="flex gap-2">
                                            <Input
                                                title="API key"
                                                hiddenLabel
                                                type="password"
                                                value={apiKey}
                                                container="min-w-0 flex-1"
                                                autoComplete="off"
                                                placeholder={meta?.keyHint ?? "API key"}
                                                onChange={(event) => setApiKey(event.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter" && apiKey.trim()) requestTestConnection();
                                                }}
                                            />
                                            <Button
                                                size="small"
                                                disabled={!apiKey.trim() || connectionBusy}
                                                onClick={requestTestConnection}
                                            >
                                                {testStatus === "testing" ? "Verifying..." : "Verify and save key"}
                                            </Button>
                                        </div>
                                        {meta?.consoleUrl && (
                                            <ExternalProviderLink href={meta.consoleUrl} label="Get API key" />
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">API Key</span>
                                    {meta?.consoleUrl && (
                                        <ExternalProviderLink href={meta.consoleUrl} label="Get key" />
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        title="API key"
                                        hiddenLabel
                                        type="password"
                                        value={apiKey}
                                        autoComplete="off"
                                        container="min-w-0 flex-1"
                                        placeholder={
                                            credentialStatus === "connected"
                                                ? "key saved (paste new to replace)"
                                                : (meta?.keyHint ?? "Paste your API key")
                                        }
                                        onChange={(event) => setApiKey(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") requestTestConnection();
                                        }}
                                    />
                                    <Button
                                        size="small"
                                        disabled={
                                            connectionBusy || (!apiKey.trim() && credentialStatus !== "connected")
                                        }
                                        onClick={requestTestConnection}
                                    >
                                        {testStatus === "testing" ? (
                                            <SpinnerIcon size={14} className="animate-spin" />
                                        ) : (
                                            <span className="flex items-center gap-1.5">
                                                <PlugIcon size={14} />
                                                {apiKey.trim() ? "Connect" : "Test"}
                                            </span>
                                        )}
                                    </Button>
                                </div>

                                {/* Test result feedback */}
                                {testStatus === "success" && (
                                    <span className="flex items-center gap-1 text-xs text-success">
                                        <CheckCircleIcon size={12} />
                                        Connected — {availableModels.length} model
                                        {availableModels.length !== 1 ? "s" : ""} available
                                    </span>
                                )}
                                {testStatus === "error" && (
                                    <span className="text-destructive flex items-center gap-1 text-xs">
                                        <XCircleIcon size={12} />
                                        {testError}
                                    </span>
                                )}
                            </div>
                        )}

                        {adapter?.supportsOAuth && testStatus === "error" && (
                            <p role="alert" className="text-sm text-danger">
                                {testError}
                            </p>
                        )}
                        {adapter?.supportsOAuth && testStatus === "success" && (
                            <output className="block text-sm text-foreground">
                                Credentials saved — {availableModels.length} model
                                {availableModels.length === 1 ? "" : "s"} available.
                            </output>
                        )}
                    </section>

                    {adapterId !== "cli" && (
                        <section
                            className="flex flex-col gap-3 border-t border-border pt-6"
                            aria-labelledby="ai-model-heading"
                        >
                            <h2 id="ai-model-heading" className="text-sm font-semibold text-foreground">
                                Model
                            </h2>
                            {adapterId === OPENAI_ADAPTER_ID ? (
                                <Select
                                    ref={openAIModelSelectRef}
                                    hiddenLabel
                                    value={
                                        availableModels.some((availableModel) => availableModel.id === model)
                                            ? model
                                            : ""
                                    }
                                    title="Model"
                                    required={false}
                                    loading={credentialStatus === "loading" || openAIModelsLoading}
                                    disabled={
                                        credentialStatus !== "connected" ||
                                        openAIModelsLoading ||
                                        availableModels.length === 0
                                    }
                                    placeholder={
                                        credentialStatus === "loading" || openAIModelsLoading
                                            ? "Loading OpenAI models..."
                                            : credentialStatus !== "connected"
                                              ? "Connect OpenAI to load models"
                                              : openAIModelsError
                                                ? "OpenAI models unavailable"
                                                : "No OpenAI models available"
                                    }
                                    onChange={(event) => setModel(event.target.value)}
                                    options={availableModels.map((availableModel) => ({
                                        value: availableModel.id,
                                        label: availableModel.name,
                                    }))}
                                />
                            ) : availableModels.length > 0 ? (
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
                            ) : adapterId === OLLAMA_ADAPTER_ID ? (
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
                                    title="Model"
                                    hiddenLabel
                                    value={model}
                                    placeholder={adapter?.defaultModel ?? "Model name"}
                                    onChange={(e: any) => setModel(e.target.value)}
                                />
                            )}
                            {adapterId === OPENAI_ADAPTER_ID && openAIModelsError ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <p role="alert" className="text-destructive text-xs">
                                        {openAIModelsError}
                                    </p>
                                    <Button
                                        size="small"
                                        disabled={openAIModelsLoading || credentialStatus !== "connected"}
                                        onClick={() => {
                                            focusOpenAIModelAfterRetryRef.current = true;
                                            void loadOpenAIModels();
                                        }}
                                    >
                                        {openAIModelsLoading ? "Retrying..." : "Retry loading models"}
                                    </Button>
                                </div>
                            ) : adapterId === OPENAI_ADAPTER_ID && openAIModelsLoading ? (
                                <p role="status" className="text-[10px] text-muted-foreground">
                                    Loading models available to your OpenAI account...
                                </p>
                            ) : adapterId === OPENAI_ADAPTER_ID && availableModels.length > 0 ? (
                                <p role="status" className="text-[10px] text-muted-foreground">
                                    {availableModels.length} model
                                    {availableModels.length === 1 ? "" : "s"} available
                                </p>
                            ) : adapterId === OLLAMA_ADAPTER_ID && ollamaModelsLoading ? (
                                <p className="text-[10px] text-muted-foreground">
                                    Loading running models from <code>{baseUrl.trim()}</code> via <code>/api/ps</code>
                                    ...
                                </p>
                            ) : (
                                <p className="text-[10px] text-muted-foreground">
                                    Default: <code>{adapter?.defaultModel}</code>
                                </p>
                            )}
                        </section>
                    )}

                    <section
                        className="space-y-3 border-t border-border pt-6"
                        aria-labelledby="ai-instructions-heading"
                    >
                        <h2 id="ai-instructions-heading" className="text-sm font-semibold text-foreground">
                            Writing instructions
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Optional instructions used with your prompts, such as tone, language, or writing style.
                        </p>
                        <Textarea
                            title="System prompt"
                            hiddenLabel
                            rows={4}
                            optionalText=" "
                            value={systemPrompt}
                            placeholder="You are a helpful writing assistant..."
                            onChange={(event) => setSystemPrompt(event.target.value)}
                        />
                    </section>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
                        <p className="text-sm text-muted-foreground">Save to use this provider as your default.</p>
                        <Button
                            size="small"
                            disabled={
                                saving ||
                                authLoading ||
                                storagePreparing ||
                                testStatus === "testing" ||
                                !hasValidOpenAIModel
                            }
                            onClick={handleSaveConfig}
                        >
                            {saving ? "Saving..." : "Save Configuration"}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
};
