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
const OLLAMA_ADAPTER_ID = "ollama";

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
				"relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-button-radius border border-card-border bg-muted/35 text-foreground/70 transition-colors duration-200 group-hover:text-foreground",
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
				<path
					fill={colored ? "#10a37f" : "currentColor"}
					d={OPENAI_ICON_PATH}
				/>
			</svg>
		);
	}

	if (id === "gemini") {
		return (
			<svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
				{colored && (
					<defs>
						<linearGradient
							id="gemini-provider-gradient"
							x1="2"
							x2="22"
							y1="22"
							y2="2"
						>
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
					fill={colored ? "#f4f4f5" : "currentColor"}
					d="M7.5 5.75c0-1.52 1.23-2.75 2.75-2.75h3.5c1.52 0 2.75 1.23 2.75 2.75v2.08l1.45 1.27A3.1 3.1 0 0 1 19 11.43V18a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-6.57c0-.9.39-1.76 1.05-2.33L7.5 7.83zm2.75-.75a.75.75 0 0 0-.75.75v2.98l-2.13 1.86c-.24.21-.37.51-.37.84V18c0 .55.45 1 1 1h8a1 1 0 0 0 1-1v-6.57c0-.33-.13-.63-.37-.84L14.5 8.73V5.75a.75.75 0 0 0-.75-.75zm-.75 8.25a1 1 0 1 1-2 0a1 1 0 0 1 2 0m7 0a1 1 0 1 1-2 0a1 1 0 0 1 2 0M9.25 16.5h5.5v1.5h-5.5z"
				/>
			</svg>
		);
	}

	return (
		<TerminalIcon className="size-5" weight={colored ? "fill" : "regular"} />
	);
}

function ProviderStatusIcon({ status }: { status: CredentialStatus }) {
	if (status === "connected") {
		return <CheckCircleIcon size={14} className="text-success" />;
	}
	if (status === "loading") {
		return (
			<SpinnerIcon size={14} className="animate-spin text-muted-foreground" />
		);
	}
	return <XCircleIcon size={14} className="text-muted-foreground" />;
}

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
		setBaseUrl(id === OLLAMA_ADAPTER_ID ? DEFAULT_OLLAMA_BASE_URL : "");
		setTestStatus("idle");
		setTestError("");
		setAvailableModels([]);
		setOauthPending(false);
		setOauthCode("");
		await checkCredentials(id);
	};

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
			const savedCreds =
				await repositories.ai.loadCredentials(OLLAMA_ADAPTER_ID);
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
		if (adapterId !== OLLAMA_ADAPTER_ID) return;
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
		if (adapterId === OLLAMA_ADAPTER_ID) {
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
					adapterId === OLLAMA_ADAPTER_ID
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
			<div className="max-w-6xl space-y-8">
				<section className="space-y-3">
					<div>
						<span className="text-sm font-semibold text-foreground">
							Provider
						</span>
						<p className="mt-1 text-xs text-muted-foreground">
							Choose the model runtime. Logos stay quiet until hover or active
							state.
						</p>
					</div>
					<div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
						{visibleAdapters.map((a) => {
							const aMeta = PROVIDER_META[a.id];
							const isSelected = adapterId === a.id;
							const statusText =
								credentialStatus === "connected"
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
									className={css(
										"group flex min-h-28 items-start gap-3 rounded-card-radius border bg-card-background/70 p-4 text-left transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
										isSelected &&
											"border-primary/45 bg-primary/10 shadow-soft ring-1 ring-primary/35",
										!isSelected && "border-card-border",
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
												<span className="inline-flex shrink-0 items-center gap-1 rounded-button-radius border border-card-border bg-background/70 px-2 py-1 text-[10px] font-medium text-muted-foreground">
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
				) : adapterId === OLLAMA_ADAPTER_ID ? (
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
								<span className="flex gap-1 items-center text-xs text-success">
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
							<span className="flex gap-1 items-center text-xs text-success">
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
								hiddenLabel
								value={model}
								placeholder={adapter?.defaultModel ?? "Model name"}
								onChange={(e: any) => setModel(e.target.value)}
							/>
						)}
						{adapterId === OLLAMA_ADAPTER_ID && ollamaModelsLoading ? (
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
