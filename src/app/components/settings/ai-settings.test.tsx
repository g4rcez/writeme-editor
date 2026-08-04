import type {
    ButtonHTMLAttributes,
    ChangeEventHandler,
    InputHTMLAttributes,
    ReactNode,
    Ref,
    SelectHTMLAttributes,
    TextareaHTMLAttributes,
} from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AISettings } from "./ai-settings";

const mocks = vi.hoisted(() => ({
    getConfigs: vi.fn(),
    loadCredentials: vi.fn(),
    saveConfig: vi.fn(),
    saveCredentials: vi.fn(),
    clearRepositoryCredentials: vi.fn(),
    getCredentials: vi.fn(),
    startOAuthFlow: vi.fn(),
    completeOAuthFlow: vi.fn(),
    clearCredentials: vi.fn(),
    listOpenAIModels: vi.fn(),
    listOllamaModels: vi.fn(),
    setAlert: vi.fn(),
}));

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    size?: string;
    theme?: string;
};

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
    container?: string;
    hiddenLabel?: boolean;
};

type SelectOption = { value: string; label?: string; disabled?: boolean };
type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
    ref?: Ref<HTMLSelectElement>;
    hiddenLabel?: boolean;
    loading?: boolean;
    placeholder?: string;
    onChange?: ChangeEventHandler<HTMLSelectElement>;
    options: SelectOption[];
    title: string;
};

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
    optionalText?: string;
};

vi.mock("@g4rcez/components", () => ({
    Button: ({ children, size: _size, theme: _theme, ...props }: ButtonProps) => (
        <button type="button" {...props}>
            {children}
        </button>
    ),
    Input: ({ container: _container, hiddenLabel: _hiddenLabel, ...props }: InputProps) => <input {...props} />,
    Select: ({ ref, hiddenLabel: _hiddenLabel, loading, options, placeholder, title, ...props }: SelectProps) => (
        <select ref={ref} aria-label={title} aria-busy={loading} {...props}>
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label ?? option.value}
                </option>
            ))}
        </select>
    ),
    Textarea: ({ optionalText: _optionalText, ...props }: TextareaProps) => <textarea {...props} />,
    css: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/app/ai/adapters/registry", () => {
    const anthropicAdapter = {
        id: "anthropic",
        name: "Anthropic (Claude)",
        supportsOAuth: true,
        defaultModel: "claude-test",
        listModels: vi.fn(async () => []),
    };
    const openAIAdapter = {
        id: "openai",
        name: "OpenAI (GPT)",
        supportsOAuth: true,
        defaultModel: "gpt-4o",
        listModels: mocks.listOpenAIModels,
    };
    const ollamaAdapter = {
        id: "ollama",
        name: "Ollama",
        supportsOAuth: false,
        defaultModel: "llama3.2",
        listModels: mocks.listOllamaModels,
    };
    const adapters = [anthropicAdapter, openAIAdapter, ollamaAdapter];

    return {
        adapterRegistry: {
            getAll: () => adapters,
            get: (id: string) => adapters.find((adapter) => adapter.id === id),
        },
    };
});

vi.mock("@/app/ai/auth/auth-manager", () => ({
    authManager: {
        getCredentials: mocks.getCredentials,
        startOAuthFlow: mocks.startOAuthFlow,
        completeOAuthFlow: mocks.completeOAuthFlow,
        clearCredentials: mocks.clearCredentials,
    },
}));

vi.mock("@/lib/is-electron", () => ({ isElectron: () => false }));

vi.mock("@/store/repositories", () => ({
    repositories: {
        ai: {
            getConfigs: mocks.getConfigs,
            loadCredentials: mocks.loadCredentials,
            saveConfig: mocks.saveConfig,
            saveCredentials: mocks.saveCredentials,
            clearCredentials: mocks.clearRepositoryCredentials,
        },
    },
}));

vi.mock("@/store/ui.store", () => ({
    uiDispatch: { setAlert: mocks.setAlert },
}));

function openAIConfig(model: string) {
    return {
        id: "openai-config",
        name: "OpenAI Config",
        adapterId: "openai",
        model,
        systemPrompt: "",
        isDefault: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((promiseResolve) => {
        resolve = promiseResolve;
    });
    return { promise, resolve };
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getConfigs.mockResolvedValue([openAIConfig("gpt-5-mini")]);
    mocks.loadCredentials.mockImplementation(async (adapterId: string) =>
        adapterId === "openai" ? { adapterId, accessToken: "stored-token", accountId: "account-id" } : null,
    );
    mocks.getCredentials.mockResolvedValue({
        accessToken: "fresh-token",
        accountId: "account-id",
    });
    mocks.listOllamaModels.mockResolvedValue([]);
    mocks.startOAuthFlow.mockResolvedValue({
        message: "Finish signing in with OpenAI.",
    });
    mocks.completeOAuthFlow.mockResolvedValue(undefined);
    mocks.clearCredentials.mockResolvedValue(undefined);
    mocks.saveConfig.mockResolvedValue(undefined);
});

describe("AISettings OpenAI models", () => {
    it("starts with the credential-configured provider instead of a stale default config", async () => {
        const configs = deferred<Array<ReturnType<typeof openAIConfig>>>();
        mocks.getConfigs.mockReturnValue(configs.promise);

        render(<AISettings />);

        expect(screen.getByRole("status")).toHaveTextContent("Loading AI configuration");
        expect(screen.queryByRole("button", { name: /Anthropic \(Claude\)/ })).not.toBeInTheDocument();

        await act(async () => {
            configs.resolve([
                {
                    ...openAIConfig("claude-test"),
                    id: "anthropic-config",
                    name: "Anthropic Config",
                    adapterId: "anthropic",
                },
            ]);
            await configs.promise;
        });

        const openAIButton = await screen.findByRole("button", { name: /OpenAI \(GPT\)/ });
        expect(openAIButton).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: /Anthropic \(Claude\)/ })).toHaveAttribute("aria-pressed", "false");
    });

    it("loads connected account models and preserves the configured model", async () => {
        mocks.listOpenAIModels.mockResolvedValue([
            { id: "gpt-5", name: "GPT-5" },
            { id: "gpt-5-mini", name: "GPT-5 mini" },
        ]);

        render(<AISettings />);

        const modelSelect = await screen.findByRole("combobox", { name: "Model" });
        await waitFor(() => expect(modelSelect).toHaveValue("gpt-5-mini"));

        expect(modelSelect).toBeEnabled();
        expect(screen.getByRole("option", { name: "GPT-5" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "GPT-5 mini" })).toBeInTheDocument();
        expect(mocks.getCredentials).toHaveBeenCalledTimes(1);
        expect(mocks.listOpenAIModels).toHaveBeenCalledWith({
            accessToken: "fresh-token",
            accountId: "account-id",
        });

        fireEvent.click(screen.getByRole("button", { name: /OpenAI \(GPT\)/ }));
        expect(modelSelect).toHaveValue("gpt-5-mini");
        expect(mocks.listOpenAIModels).toHaveBeenCalledTimes(1);
    });

    it("keeps the OpenAI select visible and retries an empty model response", async () => {
        mocks.getConfigs.mockResolvedValue([openAIConfig("removed-model")]);
        mocks.listOpenAIModels.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "gpt-5", name: "GPT-5" }]);

        render(<AISettings />);

        const modelSelect = await screen.findByRole("combobox", { name: "Model" });
        expect(await screen.findByRole("alert")).toHaveTextContent("OpenAI returned no available models");
        expect(modelSelect).toBeDisabled();
        const saveButton = screen.getByRole("button", { name: "Save Configuration" });
        expect(saveButton).toBeDisabled();

        const retryButton = screen.getByRole("button", { name: "Retry loading models" });
        retryButton.focus();
        fireEvent.click(retryButton);

        expect(screen.getByRole("button", { name: "Retrying..." })).toHaveFocus();
        await waitFor(() => expect(modelSelect).toHaveValue("gpt-5"));
        expect(modelSelect).toBeEnabled();
        expect(modelSelect).toHaveFocus();
        expect(saveButton).toBeEnabled();
        expect(mocks.listOpenAIModels).toHaveBeenCalledTimes(2);
    });

    it("loads models after completing OpenAI OAuth", async () => {
        mocks.loadCredentials.mockResolvedValue(null);
        mocks.listOpenAIModels.mockResolvedValue([{ id: "gpt-5", name: "GPT-5" }]);

        render(<AISettings />);

        const modelSelect = await screen.findByRole("combobox", { name: "Model" });
        await waitFor(() => expect(modelSelect).toBeDisabled());
        fireEvent.click(screen.getByRole("button", { name: "Sign in with OpenAI" }));
        fireEvent.click(await screen.findByRole("button", { name: "Complete sign-in" }));

        await waitFor(() => expect(modelSelect).toHaveValue("gpt-5"));
        expect(modelSelect).toBeEnabled();
        expect(mocks.completeOAuthFlow).toHaveBeenCalledWith("openai", "");
        expect(mocks.listOpenAIModels).toHaveBeenCalledTimes(1);
    });

    it("ignores a stale OAuth start result after switching providers", async () => {
        const oauthStart = deferred<{ message: string }>();
        mocks.loadCredentials.mockResolvedValue(null);
        mocks.startOAuthFlow.mockReturnValue(oauthStart.promise);

        render(<AISettings />);

        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        const anthropicButton = screen.getByRole("button", { name: /Anthropic \(Claude\)/ });
        fireEvent.click(anthropicButton);
        await waitFor(() => expect(anthropicButton).toHaveTextContent("Needs setup"));

        await act(async () => {
            oauthStart.resolve({ message: "Stale OpenAI sign-in instructions" });
            await oauthStart.promise;
        });

        expect(screen.queryByText("Stale OpenAI sign-in instructions")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Complete sign-in" })).not.toBeInTheDocument();
        expect(anthropicButton).toHaveAttribute("aria-pressed", "true");
    });

    it("ignores a stale OAuth completion after switching providers", async () => {
        const oauthCompletion = deferred<void>();
        mocks.loadCredentials.mockResolvedValue(null);
        mocks.completeOAuthFlow.mockReturnValue(oauthCompletion.promise);

        render(<AISettings />);

        fireEvent.click(await screen.findByRole("button", { name: "Sign in with OpenAI" }));
        fireEvent.click(await screen.findByRole("button", { name: "Complete sign-in" }));
        const anthropicButton = screen.getByRole("button", { name: /Anthropic \(Claude\)/ });
        fireEvent.click(anthropicButton);
        await waitFor(() => expect(anthropicButton).toHaveTextContent("Needs setup"));

        await act(async () => {
            oauthCompletion.resolve();
            await oauthCompletion.promise;
        });

        expect(anthropicButton).toHaveAttribute("aria-pressed", "true");
        expect(anthropicButton).toHaveTextContent("Needs setup");
        expect(mocks.listOpenAIModels).not.toHaveBeenCalled();
        expect(mocks.setAlert).not.toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
    });

    it("keeps the Ollama model loading flow unchanged", async () => {
        mocks.listOpenAIModels.mockResolvedValue([{ id: "gpt-5", name: "GPT-5" }]);
        mocks.listOllamaModels.mockResolvedValue([{ id: "llama3.2", name: "Llama 3.2" }]);

        render(<AISettings />);

        await waitFor(() => expect(mocks.listOpenAIModels).toHaveBeenCalledTimes(1));
        fireEvent.click(screen.getByRole("button", { name: /Ollama/ }));

        const modelSelect = await screen.findByRole("combobox", { name: "Model" });
        expect(modelSelect).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Load models" }));

        await waitFor(() => expect(modelSelect).toHaveValue("llama3.2"));
        expect(modelSelect).toBeEnabled();
        expect(mocks.listOllamaModels).toHaveBeenCalledWith({
            baseUrl: "http://localhost:11434/v1",
        });
    });

    it("ignores an OpenAI model response after switching providers", async () => {
        const modelResponse = deferred<Array<{ id: string; name: string }>>();
        mocks.listOpenAIModels.mockReturnValue(modelResponse.promise);

        render(<AISettings />);

        await waitFor(() => expect(mocks.listOpenAIModels).toHaveBeenCalledTimes(1));
        fireEvent.click(screen.getByRole("button", { name: /Anthropic \(Claude\)/ }));

        await act(async () => {
            modelResponse.resolve([{ id: "stale-openai-model", name: "Stale OpenAI model" }]);
            await modelResponse.promise;
        });

        await waitFor(() => expect(screen.getByDisplayValue("claude-test")).toBeInTheDocument());
        expect(screen.queryByRole("combobox", { name: "Model" })).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue("stale-openai-model")).not.toBeInTheDocument();
    });

    it("ignores a stale credential result after switching providers", async () => {
        const anthropicCredentials = deferred<{ adapterId: string; accessToken: string }>();
        let anthropicCredentialCalls = 0;
        mocks.loadCredentials.mockImplementation((adapterId: string) => {
            if (adapterId === "openai") {
                return Promise.resolve({ adapterId, accessToken: "stored-token", accountId: "account-id" });
            }
            if (adapterId === "anthropic") {
                anthropicCredentialCalls += 1;
                return anthropicCredentialCalls === 1 ? Promise.resolve(null) : anthropicCredentials.promise;
            }
            return Promise.resolve(null);
        });
        mocks.listOpenAIModels.mockResolvedValue([]);

        render(<AISettings />);

        const anthropicButton = await screen.findByRole("button", { name: /Anthropic \(Claude\)/ });
        fireEvent.click(anthropicButton);
        const ollamaButton = screen.getByRole("button", { name: /Ollama/ });
        fireEvent.click(ollamaButton);
        await waitFor(() => expect(ollamaButton).toHaveTextContent("Needs setup"));

        await act(async () => {
            anthropicCredentials.resolve({
                adapterId: "anthropic",
                accessToken: "stale-token",
            });
            await anthropicCredentials.promise;
        });

        expect(ollamaButton).toHaveAttribute("aria-pressed", "true");
        expect(ollamaButton).toHaveTextContent("Needs setup");
    });
});
