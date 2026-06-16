import { createOpenAI } from "@ai-sdk/openai";
import { stepCountIs, streamText } from "ai";
import { proxyFetch } from "@/lib/proxy-fetch";
import { v4 as uuidv4 } from "uuid";
import type {
	AIAdapter,
	AIConversationMessage,
	AIFile,
	AIModel,
	AIStreamEvent,
	AuthCredentials,
	SendOptions,
} from "./types";

const CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
const CODEX_USER_AGENT = "codex_cli_rs/0.0.1";
const CODEX_DEFAULT_MODEL = "gpt-5.4-mini";
const CODEX_DEFAULT_INSTRUCTIONS = "You are Writeme Workspace AI.";

type CodexOAuthCredentials = AuthCredentials & { accessToken: string };

type OpenAIAuthClaims = {
	chatgpt_account_id?: string;
	"https://api.openai.com/auth"?: {
		chatgpt_account_id?: string;
		organizations?: Array<{ id?: string; is_default?: boolean }>;
	};
};

function parseJwtPayload<T extends object>(
	token: string | undefined,
): T | null {
	if (!token) return null;
	const [, payload] = token.split(".");
	if (!payload) return null;
	try {
		const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
		const padded = normalized.padEnd(
			normalized.length + ((4 - (normalized.length % 4)) % 4),
			"=",
		);
		return JSON.parse(atob(padded)) as T;
	} catch {
		return null;
	}
}

function extractAccountIdFromToken(
	token: string | undefined,
): string | undefined {
	const claims = parseJwtPayload<OpenAIAuthClaims>(token);
	const authClaims = claims?.["https://api.openai.com/auth"];
	return (
		claims?.chatgpt_account_id ??
		authClaims?.chatgpt_account_id ??
		authClaims?.organizations?.find((organization) => organization.is_default)
			?.id ??
		authClaims?.organizations?.find((organization) => organization.id)?.id
	);
}

function getCodexAccountId(credentials: AuthCredentials): string | undefined {
	return (
		credentials.accountId ??
		extractAccountIdFromToken(credentials.idToken) ??
		extractAccountIdFromToken(credentials.accessToken)
	);
}

function isCodexOAuthCredentials(
	credentials: AuthCredentials,
): credentials is CodexOAuthCredentials {
	return Boolean(credentials.accessToken && getCodexAccountId(credentials));
}

function createCodexHeaders(accountId: string) {
	return {
		"ChatGPT-Account-Id": accountId,
		originator: "codex_cli_rs",
		"OpenAI-Beta": "responses=experimental",
		"x-upstream-user-agent": CODEX_USER_AGENT,
	};
}

type CodexInputItem = {
	role?: unknown;
	content?: unknown;
};

type CodexRequestBody = {
	instructions?: unknown;
	input?: unknown;
	store?: unknown;
	stream?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === "object" && !Array.isArray(value);
}

function extractContentText(content: unknown): string | null {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return null;
	const text = content
		.map((part) => {
			if (!isRecord(part)) return null;
			return typeof part.text === "string" ? part.text : null;
		})
		.filter((part): part is string => Boolean(part?.trim()))
		.join("\n");
	return text.trim() ? text : null;
}

function isInstructionInput(item: CodexInputItem): boolean {
	return item.role === "developer" || item.role === "system";
}

export function createCodexRequestBody(
	rawBody: string,
	fallbackInstructions?: string,
): string {
	const parsed = JSON.parse(rawBody) as unknown;
	if (!isRecord(parsed)) return rawBody;

	const body = parsed as CodexRequestBody;
	const input = Array.isArray(body.input)
		? (body.input as CodexInputItem[])
		: [];
	const instructionText =
		typeof body.instructions === "string" && body.instructions.trim()
			? body.instructions
			: input
					.filter(isInstructionInput)
					.map((item) => extractContentText(item.content))
					.filter((text): text is string => Boolean(text?.trim()))
					.join("\n\n") ||
				fallbackInstructions ||
				CODEX_DEFAULT_INSTRUCTIONS;

	return JSON.stringify({
		...parsed,
		instructions: instructionText,
		input: input.filter((item) => !isInstructionInput(item)),
		store: false,
		stream: true,
	});
}

function createCodexFetch(fallbackInstructions?: string) {
	return async (
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> => {
		const nextInit: RequestInit = { ...init };
		if (typeof init?.body === "string") {
			nextInit.body = createCodexRequestBody(init.body, fallbackInstructions);
		}
		return proxyFetch(input, nextInit);
	};
}

export class OpenAIAdapter implements AIAdapter {
	readonly id = "openai";
	readonly name = "OpenAI (GPT)";
	readonly supportsFiles = true;
	readonly supportsOAuth = true;
	readonly defaultModel = "gpt-4o";

	async auth(
		method: "oauth" | "api-key",
		apiKey?: string,
	): Promise<AuthCredentials> {
		if (method === "oauth") {
			const { authManager } = await import("@/app/ai/auth/auth-manager");
			await authManager.startOAuthFlow("openai");
			return {};
		}
		return { apiKey };
	}

	async refresh(credentials: AuthCredentials): Promise<AuthCredentials> {
		if (!credentials.refreshToken) return credentials;
		const { authManager } = await import("@/app/ai/auth/auth-manager");
		return authManager.refreshOpenAIToken(credentials);
	}

	isExpired(credentials: AuthCredentials): boolean {
		return credentials.expiresAt != null && Date.now() > credentials.expiresAt;
	}

	async listModels(credentials: AuthCredentials): Promise<AIModel[]> {
		try {
			if (isCodexOAuthCredentials(credentials)) {
				const accountId = getCodexAccountId(credentials)!;
				const resp = await proxyFetch(
					`${CODEX_BASE_URL}/models?client_version=writeme`,
					{
						headers: createCodexHeaders(accountId),
					},
				);
				if (!resp.ok)
					return [{ id: CODEX_DEFAULT_MODEL, name: CODEX_DEFAULT_MODEL }];
				const data = (await resp.json()) as {
					data?: { id?: string; slug?: string; name?: string }[];
					models?: { id?: string; slug?: string; name?: string }[];
				};
				const models = data.models ?? data.data ?? [];
				const parsed = models
					.map((model) => model.slug ?? model.id ?? model.name)
					.filter((id): id is string => Boolean(id))
					.map((id) => ({ id, name: id }));
				return parsed.length > 0
					? parsed
					: [{ id: CODEX_DEFAULT_MODEL, name: CODEX_DEFAULT_MODEL }];
			}

			const resp = await proxyFetch("https://api.openai.com/v1/models", {
				headers: {
					Authorization: `Bearer ${credentials.apiKey ?? credentials.accessToken ?? ""}`,
				},
			});
			if (!resp.ok) return [];
			const data = (await resp.json()) as { data: { id: string }[] };
			return (data.data ?? [])
				.filter((m) => /gpt|o1|o3/.test(m.id))
				.map((m) => ({ id: m.id, name: m.id }));
		} catch {
			return [];
		}
	}

	async prepareFile(file: File): Promise<AIFile> {
		const mimeType = file.type || "application/octet-stream";
		const data = await file.arrayBuffer();
		return {
			id: uuidv4(),
			name: file.name,
			mimeType,
			data,
			size: file.size,
		};
	}

	async *sendMessage(
		messages: AIConversationMessage[],
		options: SendOptions,
		signal?: AbortSignal,
	): AsyncIterable<AIStreamEvent> {
		const codexCredentials = isCodexOAuthCredentials(options.credentials)
			? options.credentials
			: null;
		const usesCodexBackend = codexCredentials != null;
		const openai = createOpenAI({
			apiKey: codexCredentials
				? codexCredentials.accessToken
				: (options.credentials.apiKey ?? options.credentials.accessToken ?? ""),
			baseURL: usesCodexBackend ? CODEX_BASE_URL : undefined,
			headers: codexCredentials
				? createCodexHeaders(getCodexAccountId(codexCredentials)!)
				: undefined,
			fetch: usesCodexBackend
				? createCodexFetch(options.systemPrompt)
				: proxyFetch,
		});

		const model =
			options.model ??
			(usesCodexBackend ? CODEX_DEFAULT_MODEL : this.defaultModel);

		const mapped = messages.map((msg) => {
			if (msg.role === "system") {
				return { role: "user" as const, content: msg.content.text };
			}
			if (!msg.content.files || msg.content.files.length === 0) {
				return {
					role: msg.role as "user" | "assistant",
					content: msg.content.text,
				};
			}
			const parts: any[] = msg.content.files
				.filter((f) => f.mimeType.startsWith("image/"))
				.map((f) => ({
					type: "image_url",
					image_url: {
						url: `data:${f.mimeType};base64,${bufferToBase64(f.data)}`,
					},
				}));
			parts.push({ type: "text", text: msg.content.text });
			return { role: msg.role as "user" | "assistant", content: parts };
		});

		try {
			const result = streamText({
				model: usesCodexBackend ? openai.responses(model) : openai.chat(model),
				messages: mapped,
				system: options.systemPrompt,
				abortSignal: signal,
				temperature: usesCodexBackend ? undefined : options.temperature,
				maxOutputTokens: usesCodexBackend ? undefined : options.maxTokens,
				tools: options.tools,
				toolChoice: options.toolChoice,
				stopWhen: options.tools ? stepCountIs(5) : undefined,
				providerOptions: {
					openai: {
						store: false,
					},
				},
			});

			for await (const chunk of result.textStream) {
				yield { type: "text", delta: chunk };
			}
			yield { type: "done" };
		} catch (err: any) {
			if (err?.name === "AbortError") {
				yield { type: "done" };
			} else {
				yield { type: "error", message: err?.message ?? String(err) };
			}
		}
	}
}

function bufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]!);
	}
	return btoa(binary);
}
