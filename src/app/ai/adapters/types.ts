import type { ToolChoice, ToolSet } from "ai";

export type AuthCredentials = {
	accessToken?: string;
	refreshToken?: string;
	expiresAt?: number;
	apiKey?: string;
	baseUrl?: string;
	accountId?: string;
	idToken?: string;
};

export type AIFile = {
	id: string;
	name: string;
	mimeType: string;
	data: ArrayBuffer;
	size: number;
};

export type AIMessageContent = {
	text: string;
	files?: AIFile[];
};

export type AIStreamEvent =
	| { type: "text"; delta: string }
	| { type: "done" }
	| { type: "error"; message: string };

export type AIModel = {
	id: string;
	name: string;
	contextWindow?: number;
	supportsVision?: boolean;
};

export type SendOptions = {
	model?: string;
	systemPrompt?: string;
	temperature?: number;
	maxTokens?: number;
	baseUrl?: string;
	commandTemplate?: string;
	credentials: AuthCredentials;
	tools?: ToolSet;
	toolChoice?: ToolChoice<ToolSet>;
};

export type MessageRole = "user" | "assistant" | "system";

export type AIConversationMessage = {
	role: MessageRole;
	content: AIMessageContent;
};

export interface AIAdapter {
	readonly id: string;
	readonly name: string;
	readonly supportsFiles: boolean;
	readonly supportsOAuth: boolean;
	readonly defaultModel: string;
	auth(method: "oauth" | "api-key", apiKey?: string): Promise<AuthCredentials>;
	refresh(credentials: AuthCredentials): Promise<AuthCredentials>;
	isExpired(credentials: AuthCredentials): boolean;
	listModels(credentials: AuthCredentials): Promise<AIModel[]>;
	prepareFile(file: File): Promise<AIFile>;
	sendMessage(
		messages: AIConversationMessage[],
		options: SendOptions,
		signal?: AbortSignal,
	): AsyncIterable<AIStreamEvent>;
}
